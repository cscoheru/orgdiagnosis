"""
人才领域 LangGraph 节点

提供人才维度的分析节点，遵循统一的"查询内核 → 构建上下文 → 调用 AI → 写回内核"模式。
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from loguru import logger

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object


# ──────────────────────────────────────────────
# 人才领域管理的内核元模型
# ──────────────────────────────────────────────

TALENT_META_MODELS: List[str] = [
    "Employee",
    "Talent_Pipeline",
    "Learning_Development",
]

# AI 返回的结构化对象字段描述 (与 prompts.py 保持一致)
TALENT_OBJECT_SCHEMAS: Dict[str, str] = {
    "Employee": "name, employee_id, education, experience_years, join_date, performance_grade, nine_box_position, job_role_id",
    "Talent_Pipeline": "pipeline_name, employee, target_role, readiness, development_plan, risk_of_loss",
    "Learning_Development": "program_name, employee, training_type, competency_target, start_date, status",
}


async def analyze_talent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """人才领域分析节点

    执行流程:
    1. 通过 KernelBridge 查询内核中已有的人才数据
    2. 将内核数据 + 文档内容构建为 AI 分析上下文
    3. 调用 AI 生成诊断结果和结构化对象
    4. 将 AI 提取的对象写回内核
    5. 更新工作流状态 (results / kernel_context)

    Args:
        state: LangGraph 工作流状态

    Returns:
        更新后的状态字典 (合并式，不修改原 state)
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] 开始人才领域分析...")

    try:
        bridge = KernelBridge()

        # ── Step 1: 查询内核已有数据 ──
        kernel_context_text = await _query_kernel(bridge, task_id)
        if kernel_context_text:
            logger.info(f"[{task_id}] 已从内核获取人才领域补充数据")

        # ── Step 2: 构建上下文 ──
        documents = state.get("documents", [])
        doc_context = "\n\n".join(
            doc.get("content", "")[:500] for doc in documents[:5]
        )
        full_context = doc_context
        if kernel_context_text:
            full_context += f"\n\n--- 已有内核数据 (人才) ---\n{kernel_context_text}"

        # ── Step 3: 调用 AI 分析 ──
        result = await _call_ai(task_id, full_context)

        # ── Step 4: 写回内核 ──
        created_ids = await _write_to_kernel(bridge, task_id, result)
        result["kernel_objects_created"] = len(created_ids)

        # 追踪创建的内核对象
        for obj_id in created_ids:
            state = track_kernel_object(state, obj_id)

        # ── Step 5: 更新领域结果 ──
        state = set_domain_result(state, "talent", result)

        # 更新进度
        completed = list(state.get("completed_dimensions", []))
        if "talent" not in completed:
            completed.append("talent")
        progress = len(completed) / 5 * 100

        logger.info(
            f"[{task_id}] 人才领域分析完成: "
            f"score={result.get('total_score', 0)}, "
            f"kernel_objects={len(created_ids)}"
        )

        return {
            **state,
            "completed_dimensions": completed,
            "progress_percentage": progress,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] 人才领域分析失败: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "analyze_talent",
            "updated_at": datetime.now().isoformat(),
        }


# ──────────────────────────────────────────────
# 内部辅助函数
# ──────────────────────────────────────────────


async def _query_kernel(bridge: KernelBridge, task_id: str) -> str:
    """查询内核中已有的人才领域对象，作为 AI 分析的补充上下文

    Args:
        bridge: 内核桥接实例
        task_id: 任务 ID (日志用)

    Returns:
        格式化的已有数据文本，无数据时返回空字符串
    """
    all_objects: list[dict[str, Any]] = []

    for model_key in TALENT_META_MODELS:
        try:
            objects = await bridge.get_objects_by_model(model_key, limit=20)
            if objects:
                all_objects.append(f"  [{model_key}]: {len(objects)} 个对象")
                for obj in objects[:5]:  # 最多展示 5 个
                    props = obj.get("properties", {})
                    # 优先用 name 字段作为标识，fallback 到 _key
                    name = props.get("name", obj.get("_key", "?"))
                    all_objects.append(f"    - {name}: {props}")
        except Exception as e:
            logger.warning(f"[{task_id}] 查询 {model_key} 失败: {e}")

    if not all_objects:
        return ""

    return "\n".join(all_objects)


async def _call_ai(task_id: str, context: str) -> Dict[str, Any]:
    """调用 AI 分析人才维度

    使用统一 AI 客户端，传入系统 prompt 和上下文。
    AI 返回诊断评分 + 结构化对象列表。

    Args:
        task_id: 任务 ID (日志用)
        context: 文档 + 内核数据组成的分析上下文

    Returns:
        AI 分析结果字典
    """
    from app.services.ai_client import ai_client
    from lib.domain.talent.prompts import TALENT_SYSTEM_PROMPT, TALENT_DIMENSION_PROMPT

    # AI 未配置时返回默认结果
    if not ai_client.is_configured():
        logger.warning(f"[{task_id}] AI 未配置，人才维度使用默认数据")
        return {
            "category": "talent",
            "display_name": "人才管理",
            "total_score": 50.0,
            "summary_insight": "AI 未配置，人才维度使用默认数据",
            "secondary_metrics": [],
            "extracted_objects": [],
        }

    # 构建 extracted_objects 的 JSON schema 描述
    extracted_schema = ""
    if TALENT_OBJECT_SCHEMAS:
        extracted_schema = ',\n    "extracted_objects": [\n'
        for model_key, fields in TALENT_OBJECT_SCHEMAS.items():
            extracted_schema += f'        {{"_model": "{model_key}", {fields}}},\n'
        extracted_schema += "    ]"

    # 组装用户 prompt
    user_prompt = TALENT_DIMENSION_PROMPT.replace(
        "{{", "{"
    ).replace(
        "}}", "}"
    ) + f"\n\n--- 待分析文本 ---\n{context}"

    try:
        result = await ai_client.chat_json(
            TALENT_SYSTEM_PROMPT,
            user_prompt,
            timeout=60,
        )

        # 确保返回格式完整
        result.setdefault("category", "talent")
        result.setdefault("display_name", "人才管理")
        result.setdefault("total_score", 50.0)
        result.setdefault("summary_insight", "")
        result.setdefault("secondary_metrics", [])
        result.setdefault("extracted_objects", [])

        logger.info(
            f"[{task_id}] AI 人才分析完成: "
            f"score={result['total_score']}, "
            f"objects={len(result.get('extracted_objects', []))}"
        )
        return result

    except Exception as e:
        logger.error(f"[{task_id}] AI 人才分析失败: {e}")
        return {
            "category": "talent",
            "display_name": "人才管理",
            "total_score": 50.0,
            "summary_insight": f"分析失败: {str(e)}",
            "secondary_metrics": [],
            "extracted_objects": [],
        }


async def _write_to_kernel(
    bridge: KernelBridge,
    task_id: str,
    result: Dict[str, Any],
) -> List[str]:
    """将 AI 提取的结构化对象写入内核

    Args:
        bridge: 内核桥接实例
        task_id: 任务 ID (日志用)
        result: AI 分析结果 (包含 extracted_objects)

    Returns:
        创建成功对象的 _id 列表
    """
    extracted = result.get("extracted_objects", [])
    if not extracted:
        logger.info(f"[{task_id}] 无结构化对象需要写入内核")
        return []

    created_ids: List[str] = []

    for obj_data in extracted:
        model_key = obj_data.pop("_model", None)
        if not model_key:
            logger.warning(f"[{task_id}] 跳过无 _model 字段的对象: {obj_data}")
            continue

        # 只保留非内部属性
        properties = {k: v for k, v in obj_data.items() if not k.startswith("_")}

        try:
            created = await bridge.create_object(model_key, properties)
            obj_id = created.get("_id") or created.get("_key", "")
            if obj_id:
                created_ids.append(obj_id)
                logger.info(f"[{task_id}] 内核对象已创建: {model_key}/{obj_id}")
        except Exception as e:
            logger.warning(f"[{task_id}] 创建 {model_key} 对象失败: {e}")
            continue

    return created_ids
