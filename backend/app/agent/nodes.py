"""
Consulting Agent — LangGraph 工作流节点

每个节点是一个纯函数：(state) → partial_state_update。
LangGraph 会自动 merge partial update 到完整 state。
"""
from __future__ import annotations

import json
import logging
from typing import Any

from loguru import logger

from app.agent.state import AgentMode, ConsultingState
from app.services.ai_client import AIClient

# 延迟导入避免循环依赖
def _get_blueprint_service():
    from app.kernel.database import get_db
    from app.agent.blueprint_service import BlueprintService
    return BlueprintService(get_db())

def _get_ai_client() -> AIClient:
    return AIClient()


# ─── 1. init_node: 初始化 ───

def init_node(state: ConsultingState) -> dict:
    """
    初始化会话：加载 benchmark 的逻辑依赖树，设 mode=PLAN。

    需要在调用前通过 update_state 注入 session_id, benchmark_id, project_goal。
    """
    try:
        svc = _get_blueprint_service()
        tree = svc.get_dependency_tree(state["benchmark_id"])

        return {
            "blueprint": tree,
            "execution_order": tree["execution_order"],
            "current_node_index": 0,
            # NOTE: 不要重置 collected_data — start_with_seed 可能已注入种子数据
            "missing_fields": [],
            "interaction_count": 0,
            "distilled_spec": None,
            "pptx_path": None,
            "progress": 0.0,
            "error_message": None,
            "mode": AgentMode.PLAN,
            "messages": [{
                "role": "system",
                "content": f"已加载标杆模板「{tree['title']}」，共 {len(tree['nodes'])} 个分析节点。开始分析缺失数据..."
            }],
        }
    except Exception as e:
        logger.error(f"init_node failed: {e}")
        return {
            "mode": AgentMode.FAILED,
            "error_message": f"初始化失败: {str(e)}",
            "messages": [{"role": "system", "content": f"初始化失败: {str(e)}"}],
        }


# ─── 2. planner_node: 核心规划 ───

def planner_node(state: ConsultingState) -> dict:
    """
    规划节点：对比 blueprint vs collected_data，判断下一步。

    核心原则：数据够用就生成报告，而非强制补全所有字段。
    - 有原始工作流数据 (from project) → 直接 EXECUTE
    - 数据覆盖 >40% blueprint 节点 → EXECUTE（AI distiller 可处理部分数据）
    - 数据覆盖低且缺关键信息 → INTERACT
    - 全部齐备 → EXECUTE
    """
    try:
        svc = _get_blueprint_service()

        collected_data = state.get("collected_data", {})

        # 检查是否有原始工作流数据（来自 start_with_seed）
        has_raw_data = "__raw_workflow__" in collected_data

        # 计算节点覆盖率
        tree_with_status = svc.get_dependency_tree_with_status(
            state["benchmark_id"], collected_data
        )
        total_nodes = len(tree_with_status.get("nodes", []))
        completed = sum(
            1 for n in tree_with_status.get("nodes", [])
            if n.get("status") == "complete"
        )
        # 也统计"有部分数据"的节点（not missing）
        has_data = sum(
            1 for n in tree_with_status.get("nodes", [])
            if n.get("status") != "missing"
        )
        coverage = has_data / total_nodes if total_nodes > 0 else 0.0
        progress = completed / total_nodes if total_nodes > 0 else 0.0

        # 决策：有原始数据或覆盖率足够高 → 直接执行
        if has_raw_data or coverage >= 0.4:
            filled_nodes = [n.get("node_type") for n in tree_with_status.get("nodes", []) if n.get("status") != "missing"]
            logger.info(
                f"Planner: skipping questionnaire. "
                f"has_raw={has_raw_data}, coverage={coverage:.0%}, "
                f"filled_nodes={filled_nodes}"
            )
            return {
                "missing_fields": [],
                "mode": AgentMode.EXECUTE,
                "progress": round(max(progress, coverage), 2),
                "messages": [{
                    "role": "system",
                    "content": f"已继承项目工作流数据（覆盖 {len(filled_nodes)}/{total_nodes} 个分析维度），直接生成报告..."
                }],
            }

        # 数据不足 → 检查缺失字段，进入交互模式
        missing = svc.get_missing_fields(state["benchmark_id"], collected_data)

        if missing:
            return {
                "missing_fields": missing,
                "mode": AgentMode.INTERACT,
                "progress": round(progress, 2),
            }
        else:
            # 所有数据齐备
            return {
                "missing_fields": [],
                "mode": AgentMode.EXECUTE,
                "progress": 1.0,
                "messages": [{
                    "role": "system",
                    "content": "所有分析节点数据已收集完毕，开始生成报告..."
                }],
            }
    except Exception as e:
        logger.error(f"planner_node failed: {e}")
        return {
            "mode": AgentMode.FAILED,
            "error_message": f"规划失败: {str(e)}",
        }


# ─── 3. interact_node: 交互引导 ───

async def interact_node(state: ConsultingState) -> dict:
    """
    交互节点：读取 missing_fields，通过 ToolRegistry 调用 guidance_generator 生成引导话术。

    此节点之前会 interrupt（human-in-the-loop），用户提交数据后恢复。
    """
    try:
        missing = state.get("missing_fields", [])
        if not missing:
            return {"mode": AgentMode.PLAN}

        # 通过 ToolRegistry 调用 guidance_generator
        from app.tools import call_tool, ToolContext

        result = await call_tool("guidance_generator", ToolContext(
            session_id=state["session_id"],
            benchmark_id=state["benchmark_id"],
            project_goal=state.get("project_goal", ""),
            collected_data=state.get("collected_data", {}),
            messages=state.get("messages", []),
            blueprint=state.get("blueprint", {}),
            project_id=state.get("project_id"),
            extra={
                "missing_fields": missing,
                "progress": state.get("progress", 0.0),
                "interaction_count": state.get("interaction_count", 0),
            },
        ))

        if not result.success:
            # Fallback 到模板引导
            guidance = _build_template_guidance(
                missing[0].get("node_display_name", ""), missing
            )
            ui_components = [{
                "type": f.get("field_type", "input"),
                "key": f.get("field_key", ""),
                "label": f.get("field_label", ""),
                "required": f.get("required", False),
            } for f in missing]
            return {
                "messages": [{
                    "role": "assistant",
                    "content": guidance,
                    "metadata": {"ui_components": ui_components},
                }],
                "interaction_count": state.get("interaction_count", 0) + 1,
            }

        update = {
            "interaction_count": state.get("interaction_count", 0) + 1,
        }
        if result.message:
            update["messages"] = [result.message]
        return update
    except Exception as e:
        logger.error(f"interact_node failed: {e}")
        return {
            "mode": AgentMode.FAILED,
            "error_message": f"交互引导生成失败: {str(e)}",
        }


# ─── 4. collect_node: 数据收集 ───

def collect_node(state: ConsultingState) -> dict:
    """
    数据收集节点：将用户提交的数据合并到 collected_data。

    用户数据通过 update_state 注入到 state["__user_data__"]。
    """
    try:
        user_data = state.get("__user_data__", {})
        if not user_data:
            return {
                "mode": AgentMode.FAILED,
                "error_message": "未收到用户数据",
            }

        # 处理特殊 "确认执行" 操作（来自 guidance_generator 的跳过建议）
        if "__confirm_execute__" in user_data:
            if user_data["__confirm_execute__"] == "直接生成":
                return {
                    "mode": AgentMode.EXECUTE,
                    "messages": [{"role": "user", "content": "确认直接生成报告"}],
                }
            # 用户选择补充更多信息，回到 PLAN
            return {
                "mode": AgentMode.PLAN,
                "messages": [{"role": "user", "content": "选择补充更多信息"}],
            }

        collected = dict(state.get("collected_data", {}))

        # 预加载所有 logic node 的 schema，建立 field_key → node_type 映射
        field_to_node = _build_field_to_node_map(state["benchmark_id"])

        # 按 node_type 分组合并
        for key, value in user_data.items():
            if value is None or value == "":
                continue
            # key 可能是 "node_type.field_key" 或直接是 "field_key"
            if "." in key:
                node_type, field_key = key.split(".", 1)
            else:
                node_type = field_to_node.get(key, "")
                field_key = key

            if node_type:
                if node_type not in collected:
                    collected[node_type] = {}
                collected[node_type][field_key] = value

        # 检查是否需要蒸馏 (超过 8 轮交互)
        new_count = state.get("interaction_count", 0)
        should_distill = new_count > 0 and new_count % 8 == 0

        return {
            "collected_data": collected,
            "mode": AgentMode.DISTILL if should_distill else AgentMode.PLAN,
            "messages": [{
                "role": "user",
                "content": _summarize_user_input(user_data),
            }],
        }
    except Exception as e:
        logger.error(f"collect_node failed: {e}")
        return {
            "mode": AgentMode.FAILED,
            "error_message": f"数据收集失败: {str(e)}",
        }


# ─── 5. distill_node: 记忆蒸馏 ───

async def distill_node(state: ConsultingState) -> dict:
    """
    蒸馏节点：将 collected_data + messages 压缩为结构化 Project_Spec。

    防止长时间交互导致大模型上下文混乱。
    """
    try:
        collected = state.get("collected_data", {})
        blueprint = state.get("blueprint", {})
        goal = state.get("project_goal", "")

        ai_client = _get_ai_client()

        if ai_client.is_configured():
            system_prompt = """你是一位资深管理咨询顾问。请将以下已收集的项目数据整理为结构化的项目规格书。
保留所有关键信息，去除冗余和重复内容。输出格式为 JSON。
直接输出 JSON，不要加 markdown 代码块。"""

            user_prompt = f"""项目目标：{goal}
标杆模板：{blueprint.get('title', '')}
已收集数据：
{json.dumps(collected, ensure_ascii=False, indent=2)}

请整理为以下 JSON 结构：
{{
  "project_title": "项目标题",
  "industry": "行业",
  "spec_data": {{
    "node_type_1": {{ ... }},
    "node_type_2": {{ ... }}
  }},
  "key_findings": "关键发现摘要",
  "recommendations": "建议摘要"
}}"""

            try:
                distilled = await ai_client.chat_json(
                    system_prompt, user_prompt,
                    temperature=0.2,
                )
            except Exception as e:
                logger.warning(f"AI distillation failed: {e}, using raw data")
                distilled = {
                    "project_title": goal[:50],
                    "spec_data": collected,
                }
        else:
            distilled = {
                "project_title": goal[:50],
                "spec_data": collected,
            }

        return {
            "distilled_spec": distilled,
            "mode": AgentMode.PLAN,
            "messages": [{
                "role": "system",
                "content": f"已完成对话记忆蒸馏，整理出 {len(distilled.get('spec_data', {}))} 个分析模块的结构化数据。继续收集剩余数据..."
            }],
        }
    except Exception as e:
        logger.error(f"distill_node failed: {e}")
        # 蒸馏失败不致命，继续规划
        return {
            "mode": AgentMode.PLAN,
            "messages": [{"role": "system", "content": f"蒸馏失败 ({e})，继续使用原始数据..."}],
        }


# ─── 6. executor_node: 执行生成 ───

async def executor_node(state: ConsultingState) -> dict:
    """
    执行节点：蒸馏数据 → 存入 ArangoDB → 生成 PPTX 报告。

    如果尚未蒸馏，先触发一次蒸馏。
    """
    try:
        collected = state.get("collected_data", {})
        blueprint = state.get("blueprint", {})
        goal = state.get("project_goal", "")

        # ─── Step 1: 蒸馏（如果尚未蒸馏） ───
        distilled = state.get("distilled_spec")
        if not distilled:
            distilled = await _do_distill(collected, blueprint, goal)

        # ─── Step 2: 持久化到 ArangoDB ───
        svc = _get_blueprint_service()
        kernel_ids = []

        # 将 collected_data 整体存为一个 Collected_Data 对象
        try:
            from app.models.kernel.meta_model import ObjectCreate
            from datetime import datetime, timezone
            data_obj = svc.obj_svc.create_object(ObjectCreate(
                model_key="Collected_Data",
                properties={
                    "session_id": state["session_id"],
                    "node_types": list(collected.keys()),
                    "data": collected,
                    "collected_at": datetime.now(timezone.utc).isoformat(),
                },
            ))
            kernel_ids.append(data_obj["_id"])
            logger.info(f"Persisted Collected_Data → {data_obj['_key']} ({len(collected)} nodes)")
        except Exception as e:
            logger.warning(f"Failed to persist Collected_Data: {e}")

        try:
            from app.models.kernel.meta_model import ObjectCreate
            from datetime import datetime, timezone
            spec_obj = svc.obj_svc.create_object(ObjectCreate(
                model_key="Project_Spec",
                properties={
                    "session_id": state["session_id"],
                    "title": distilled.get("project_title", ""),
                    "industry": distilled.get("industry", ""),
                    "spec_data": distilled.get("spec_data", collected),
                    "distilled_at": datetime.now(timezone.utc).isoformat(),
                },
            ))
            kernel_ids.append(spec_obj["_id"])
        except Exception as e:
            logger.warning(f"Failed to persist Project_Spec: {e}")

        # ─── Step 3: 生成 PPTX ───
        pptx_path = None
        pptx_error = None
        try:
            pptx_path = await _generate_pptx(state["session_id"], distilled, collected)
        except Exception as e:
            pptx_error = str(e)
            logger.warning(f"PPTX generation failed: {e}")

        # ─── Step 4: 构建响应 ───
        content_parts = [
            f"所有数据已收集完毕！",
            f"",
            f"已将 {len(kernel_ids)} 条数据存入知识图谱。",
            f"项目规格书：{distilled.get('project_title', '')}",
        ]
        if pptx_path:
            content_parts.append(f"")
            content_parts.append(f"报告已生成：{pptx_path}")
        elif pptx_error:
            content_parts.append(f"")
            content_parts.append(f"报告生成失败：{pptx_error}")

        return {
            "mode": AgentMode.COMPLETED,
            "progress": 1.0,
            "distilled_spec": distilled,
            "pptx_path": pptx_path,
            "messages": [{
                "role": "assistant",
                "content": "\n".join(content_parts),
                "metadata": {
                    "kernel_objects_created": kernel_ids,
                    "distilled_spec": distilled,
                    "pptx_path": pptx_path,
                },
            }],
        }
    except Exception as e:
        logger.error(f"executor_node failed: {e}")
        return {
            "mode": AgentMode.FAILED,
            "error_message": f"执行失败: {str(e)}",
        }


# ─── Helper functions ───

async def _do_distill(
    collected: dict[str, Any],
    blueprint: dict,
    goal: str,
) -> dict:
    """执行蒸馏：将 collected_data 压缩为结构化 Project_Spec。"""
    ai_client = _get_ai_client()

    if ai_client.is_configured():
        system_prompt = """你是一位资深管理咨询顾问。请将以下已收集的项目数据整理为结构化的项目规格书。
保留所有关键信息，去除冗余和重复内容。输出格式为 JSON。
直接输出 JSON，不要加 markdown 代码块。"""

        user_prompt = f"""项目目标：{goal}
标杆模板：{blueprint.get('title', '')}
已收集数据：
{json.dumps(collected, ensure_ascii=False, indent=2)}

请整理为以下 JSON 结构：
{{
  "project_title": "项目标题",
  "industry": "行业",
  "spec_data": {{
    "node_type_1": {{ ... }},
    "node_type_2": {{ ... }}
  }},
  "key_findings": "关键发现摘要",
  "recommendations": "建议摘要"
}}"""

        try:
            distilled = await ai_client.chat_json(
                system_prompt, user_prompt,
                temperature=0.2,
            )
            return distilled
        except Exception as e:
            logger.warning(f"AI distillation failed: {e}, using raw data")

    return {
        "project_title": goal[:50],
        "industry": "",
        "spec_data": collected,
    }


async def _generate_pptx(
    session_id: str,
    distilled: dict,
    collected: dict[str, Any],
) -> str | None:
    """
    将收集的数据转换为 slides 格式，调用 PPTXRendererV2 生成报告。

    Returns:
        生成的 PPTX 文件路径，失败返回 None。
    """
    import os
    from datetime import datetime

    # 将 collected_data 转换为 slides 格式
    slides = []

    # 封面页
    slides.append({
        "layout": "title_slide",
        "title": distilled.get("project_title", "组织诊断报告"),
        "subtitle": datetime.now().strftime("%Y年%m月"),
    })

    # 为每个 node_type 生成一页
    for node_type, data in collected.items():
        if not isinstance(data, dict) or not data:
            continue

        # 获取节点显示名
        svc = _get_blueprint_service()
        logic_node = svc.get_logic_node_by_type(node_type)
        display_name = (
            logic_node.get("properties", {}).get("display_name", node_type)
            if logic_node else node_type
        )

        # 将 dict 数据转为 bullets 列表
        bullets = []
        for key, value in data.items():
            if isinstance(value, str) and value:
                bullets.append(value)
            elif isinstance(value, (int, float)) and value:
                bullets.append(str(value))
            elif isinstance(value, list):
                bullets.extend(str(v) for v in value if v)

        if not bullets:
            continue

        # 提取 key_message（取第一个 bullet 或节点描述）
        key_message = ""
        if logic_node:
            key_message = logic_node.get("properties", {}).get("description", "")
        if not key_message and bullets:
            key_message = bullets[0][:50]

        slides.append({
            "title": display_name,
            "key_message": key_message,
            "bullets": bullets[:8],  # 最多 8 条
        })

    # 关键发现页
    if distilled.get("key_findings"):
        slides.append({
            "title": "关键发现",
            "key_message": distilled["key_findings"],
        })

    # 建议页
    if distilled.get("recommendations"):
        slides.append({
            "title": "建议与展望",
            "key_message": distilled["recommendations"],
        })

    if len(slides) < 2:
        logger.warning("Not enough slides to generate PPTX")
        return None

    # 调用 PPTXRendererV2
    try:
        from services.pptx_renderer_v2 import create_presentation_v2

        output_dir = os.path.join(os.path.dirname(__file__), "..", "..", "output", "pptx")
        pptx_path = create_presentation_v2(
            slides=slides,
            report_id=f"agent_{session_id}",
            client_name=distilled.get("project_title", ""),
            output_dir=output_dir,
            theme_id="blue_professional",
        )

        logger.info(f"PPTX generated: {pptx_path} ({len(slides)} slides)")
        return pptx_path
    except ImportError:
        logger.warning("PPTXRendererV2 not available, skipping PPTX generation")
        return None

def _find_node_type_for_field(field_key: str, missing_fields: list[dict]) -> str | None:
    """从 missing_fields 中查找 field_key 对应的 node_type"""
    for f in missing_fields:
        if f.get("field_key") == field_key:
            return f.get("node_type")
    return None


def _build_field_to_node_map(benchmark_id: str) -> dict[str, str]:
    """
    建立 field_key → node_type 的全局映射。

    从 benchmark 的所有 logic_node 的 required_data_schema 中提取。
    """
    svc = _get_blueprint_service()
    tree = svc.get_dependency_tree(benchmark_id)
    field_map: dict[str, str] = {}
    for node in tree.get("nodes", []):
        node_type = node.get("node_type", "")
        for field_key in node.get("required_fields", []):
            # 如果 field_key 尚未映射，或已有映射但不是唯一的，优先用这个
            if field_key not in field_map:
                field_map[field_key] = node_type
    return field_map


def _build_template_guidance(node_display: str, missing: list[dict]) -> str:
    """构建模板引导话术 (AI 不可用时的 fallback)"""
    fields = "、".join(f.get("field_label", "") for f in missing[:3])
    if len(missing) > 3:
        fields += f" 等 {len(missing)} 项"
    return f"为了完成「{node_display}」分析，请补充以下信息：{fields}。"


def _summarize_user_input(user_data: dict) -> str:
    """将用户提交的数据摘要为可读文本"""
    parts = []
    for key, value in user_data.items():
        if isinstance(value, str) and len(value) > 50:
            parts.append(f"{key}: {value[:50]}...")
        else:
            parts.append(f"{key}: {value}")
    return "已提交: " + "; ".join(parts)
