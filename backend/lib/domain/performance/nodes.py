"""
绩效领域 LangGraph 分析节点

提供 7 个节点函数：
- analyze_performance_node: 原有诊断节点
- generate_org_performance_node: AI 生成部门绩效 (四维度)
- generate_position_performance_node: 一键生成岗位绩效 (四分区)
- generate_review_template_node: AI 生成考核表单
- analyze_review_patterns_node: 考核数据分析
- calibration_analysis_node: 校准分析
- generate_performance_report_node: 咨询报告生成
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.domain.performance.prompts import (
    PERFORMANCE_SYSTEM_PROMPT,
    PERFORMANCE_DIMENSION_PROMPT,
    ORG_PERFORMANCE_GENERATION_PROMPT,
    POSITION_PERFORMANCE_GENERATION_PROMPT,
    TEMPLATE_GENERATION_PROMPT,
    REVIEW_PATTERN_ANALYSIS_PROMPT,
    CALIBRATION_ANALYSIS_PROMPT,
    PERFORMANCE_REPORT_PROMPT,
)

logger = logging.getLogger(__name__)

# 内核桥接单例
_bridge = KernelBridge()


def _ref(key: str) -> str:
    """将裸 _key 转为 sys_objects/ 引用格式（用于 reference 类型字段写入）。"""
    if not key:
        return ""
    return key if key.startswith("sys_objects/") else f"sys_objects/{key}"


def _unref(value: str | None) -> str:
    """将 sys_objects/ 引用还原为裸 _key（用于从 properties 读取后传给 get_object）。"""
    if not value:
        return ""
    return value.removeprefix("sys_objects/")


# ──────────────────────────────────────────────
# 通用工具函数
# ──────────────────────────────────────────────

async def _call_ai(
    system_prompt: str,
    user_prompt: str,
    temperature: float = 0.3,
) -> dict[str, Any]:
    """调用 AI 并解析 JSON 响应"""
    from app.services.ai_client import ai_client

    raw_result = await ai_client.chat(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        temperature=temperature,
    )

    try:
        if isinstance(raw_result, str):
            # 尝试从返回文本中提取 JSON
            json_start = raw_result.find("{")
            json_end = raw_result.rfind("}") + 1
            if json_start >= 0 and json_end > json_start:
                result = json.loads(raw_result[json_start:json_end])
            else:
                result = {"raw_response": raw_result, "parse_error": True}
        elif isinstance(raw_result, dict):
            result = raw_result
        else:
            result = {"raw_response": str(raw_result), "parse_error": True}
    except (json.JSONDecodeError, TypeError):
        logger.warning("AI 响应 JSON 解析失败")
        result = {"raw_response": str(raw_result), "parse_error": True}

    return result


def _safe_json_dumps(obj: Any) -> str:
    """安全序列化对象为 JSON 字符串"""
    if isinstance(obj, (dict, list)):
        return json.dumps(obj, ensure_ascii=False)
    return str(obj) if obj is not None else ""


def _build_enriched_context(plan_props: dict[str, Any]) -> str:
    """从 plan.business_context 构建丰富的 AI 上下文

    读取方案中已填充的战略上下文分区，格式化为 AI 可理解的文本。
    如果没有上下文数据，则降级为基础客户信息。
    """
    ctx = plan_props.get("business_context", {})
    if not ctx:
        return f"客户: {plan_props.get('client_name', '')}"

    # 兼容 JSON 字符串
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except (json.JSONDecodeError, TypeError):
            return f"客户: {plan_props.get('client_name', '')}"

    SECTION_LABELS = {
        "client_profile": "客户概况",
        "business_review": "业务复盘",
        "market_insights": "市场洞察",
        "swot_data": "SWOT 分析",
        "strategic_direction": "战略方向",
        "bsc_cards": "BSC 战略地图",
        "action_plans": "行动计划",
        "targets": "战略目标",
    }

    parts = []
    for key, label in SECTION_LABELS.items():
        content = ctx.get(key)
        if content:
            if isinstance(content, (dict, list)):
                content = json.dumps(content, ensure_ascii=False, indent=2)
            parts.append(f"## {label}\n{content}")

    if not parts:
        return f"客户: {plan_props.get('client_name', '')}"

    return "\n\n".join(parts)


# ──────────────────────────────────────────────
# 原有诊断节点 (保持不变)
# ──────────────────────────────────────────────

async def _query_performance_data() -> dict[str, Any]:
    """从内核查询绩效领域原有三个元模型的数据"""
    metrics = await _bridge.get_objects_by_model("Performance_Metric", limit=200)
    competencies = await _bridge.get_objects_by_model("Competency", limit=200)
    cycles = await _bridge.get_objects_by_model("Review_Cycle", limit=200)
    return {
        "metrics": metrics or [],
        "competencies": competencies or [],
        "cycles": cycles or [],
    }


def _build_context(data: dict[str, Any]) -> str:
    """将查询到的内核数据格式化为 AI 可理解的文本上下文"""
    metrics_lines = []
    for obj in data["metrics"]:
        props = obj.get("properties", {})
        name = props.get("metric_name", "未命名指标")
        formula = props.get("formula", "")
        cycle = props.get("review_cycle", "")
        weight = props.get("weight", 0)
        target = props.get("target_value", "")
        unit = props.get("unit", "")
        metrics_lines.append(
            f"- {name} | 公式: {formula} | 周期: {cycle} | "
            f"权重: {weight} | 目标值: {target} {unit}"
        )
    metrics_text = "\n".join(metrics_lines) if metrics_lines else "暂无绩效指标数据"

    competency_lines = []
    for obj in data["competencies"]:
        props = obj.get("properties", {})
        name = props.get("competency_name", "未命名能力")
        dimension = props.get("dimension", "")
        definition = props.get("definition", "")
        indicators = props.get("behavioral_indicators", [])
        indicators_text = "、".join(indicators) if isinstance(indicators, list) else str(indicators)
        competency_lines.append(
            f"- {name} | 维度: {dimension} | 定义: {definition} | "
            f"行为指标: {indicators_text}"
        )
    competency_text = "\n".join(competency_lines) if competency_lines else "暂无能力素质数据"

    cycle_lines = []
    for obj in data["cycles"]:
        props = obj.get("properties", {})
        name = props.get("cycle_name", "未命名周期")
        cycle_type = props.get("cycle_type", "")
        start = props.get("start_date", "")
        end = props.get("end_date", "")
        status = props.get("status", "")
        rate = props.get("completion_rate", 0)
        cycle_lines.append(
            f"- {name} | 类型: {cycle_type} | 时间: {start} ~ {end} | "
            f"状态: {status} | 完成率: {rate}%"
        )
    cycle_text = "\n".join(cycle_lines) if cycle_lines else "暂无考核周期数据"

    return metrics_text, competency_text, cycle_text


async def _write_results_to_kernel(
    analysis_result: dict[str, Any],
    data: dict[str, Any],
    state: dict[str, Any],
) -> dict[str, Any]:
    """将分析结果写回内核"""
    analysis_obj = await _bridge.create_object(
        "Performance_Analysis",
        {
            "diagnosis": analysis_result.get("diagnosis", ""),
            "maturity_level": analysis_result.get("maturity_level", 0),
            "key_issues": json.dumps(
                analysis_result.get("key_issues", []), ensure_ascii=False
            ),
            "strengths": json.dumps(
                analysis_result.get("strengths", []), ensure_ascii=False
            ),
            "recommendations": json.dumps(
                analysis_result.get("recommendations", []), ensure_ascii=False
            ),
            "source_metrics_count": len(data["metrics"]),
            "source_competencies_count": len(data["competencies"]),
            "source_cycles_count": len(data["cycles"]),
        },
    )

    state = track_kernel_object(state, analysis_obj.get("_id", ""))

    obj_id = analysis_obj.get("_id", "")
    for obj in data["metrics"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id, to_id=source_id,
                    relation_type="analyzes_metric",
                )
            except Exception as e:
                logger.warning(f"创建指标关联失败: {e}")

    for obj in data["competencies"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id, to_id=source_id,
                    relation_type="analyzes_competency",
                )
            except Exception as e:
                logger.warning(f"创建能力关联失败: {e}")

    for obj in data["cycles"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id, to_id=source_id,
                    relation_type="analyzes_cycle",
                )
            except Exception as e:
                logger.warning(f"创建周期关联失败: {e}")

    return state


async def analyze_performance_node(state: dict[str, Any]) -> dict[str, Any]:
    """绩效分析节点 — 原有诊断节点"""
    logger.info("[绩效领域] 开始绩效分析...")

    try:
        data = await _query_performance_data()
        logger.info(
            "[绩效领域] 查询到数据 — 指标: %d, 能力: %d, 周期: %d",
            len(data["metrics"]), len(data["competencies"]), len(data["cycles"]),
        )

        metrics_text, competency_text, cycle_text = _build_context(data)
        analysis_result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            PERFORMANCE_DIMENSION_PROMPT.format(
                metrics_data=metrics_text,
                competency_data=competency_text,
                cycle_data=cycle_text,
                context_data="组织绩效体系诊断",
            ),
        )
        logger.info("[绩效领域] AI 分析完成")

        state = await _write_results_to_kernel(analysis_result, data, state)
        logger.info("[绩效领域] 分析结果已写入内核")

        state = set_domain_result(state, "performance", {
            "status": "completed",
            "summary": analysis_result.get("diagnosis", ""),
            "maturity_level": analysis_result.get("maturity_level", 0),
            "key_issues": analysis_result.get("key_issues", []),
            "recommendations": analysis_result.get("recommendations", []),
            "data_stats": {
                "metrics_count": len(data["metrics"]),
                "competencies_count": len(data["competencies"]),
                "cycles_count": len(data["cycles"]),
            },
        })

        logger.info("[绩效领域] 分析节点执行完成")
        return state

    except Exception as e:
        logger.error("[绩效领域] 分析节点执行失败: %s", e)
        return set_domain_result(state, "performance", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 1: AI 生成部门绩效
# ──────────────────────────────────────────────

async def generate_org_performance_node(state: dict[str, Any]) -> dict[str, Any]:
    """AI 生成部门绩效 (四维度)

    从 Strategic_Goal + Org_Unit 生成 Org_Performance。
    输入 state 需包含: plan_id, org_unit_id
    """
    logger.info("[绩效领域] 开始生成部门绩效...")

    try:
        plan_id = state.get("plan_id", "")
        org_unit_id = state.get("org_unit_id", "")

        # 1. 查询绩效方案
        plan_data = await _bridge.get_object(plan_id) if plan_id else None
        plan_props = plan_data.get("properties", {}) if plan_data else {}

        # 2. 查询战略目标（包含新增的 goal_type、milestones、target_metrics 等字段）
        strategic_goals = await _bridge.get_objects_by_model("Strategic_Goal", limit=50)
        goals_text = ""
        if strategic_goals:
            lines = []
            for g in strategic_goals:
                p = g.get("properties", {})
                goal_type = p.get("goal_type", "operational_kpi")
                line = f"- {p.get('goal_name', '')} ({goal_type}) | 优先级: {p.get('priority', '')} | 目标值: {p.get('target_value', '')} | 状态: {p.get('status', '')}"
                # 新增字段：描述
                desc = p.get("description", "")
                if desc:
                    line += f"\n  描述: {desc}"
                # 新增字段：里程碑
                milestones = p.get("milestones", [])
                if milestones and isinstance(milestones, (dict, list)):
                    line += f"\n  里程碑: {_safe_json_dumps(milestones)}"
                # 新增字段：多指标
                target_metrics = p.get("target_metrics", [])
                if target_metrics and isinstance(target_metrics, (dict, list)):
                    line += f"\n  衡量指标: {_safe_json_dumps(target_metrics)}"
                lines.append(line)
            goals_text = "\n".join(lines)
        else:
            goals_text = "暂无战略目标数据"

        # 3. 查询部门信息
        org_data = await _bridge.get_object(org_unit_id) if org_unit_id else None
        org_props = org_data.get("properties", {}) if org_data else {}
        org_text = (
            f"部门: {org_props.get('unit_name', '未知')} | "
            f"类型: {org_props.get('unit_type', '')} | "
            f"层级: {org_props.get('level', '')} | "
            f"预算: {org_props.get('budget', '')} | "
            f"编制: {org_props.get('headcount', '')} | "
            f"负责人: {org_props.get('manager', '')}"
        )

        # 4. 构建富化上下文（Phase 2: 战略上下文）
        enriched_context = _build_enriched_context(plan_props)
        client_context = (
            f"客户: {plan_props.get('client_name', '')} | "
            f"行业: {plan_props.get('industry', '')} | "
            f"方法论: {plan_props.get('methodology', '')} | "
            f"周期: {plan_props.get('cycle_type', '')}"
        )

        result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            ORG_PERFORMANCE_GENERATION_PROMPT.format(
                client_context=client_context,
                strategic_goals=goals_text,
                org_unit_info=org_text,
                industry_context=plan_props.get("industry", "未指定"),
                enriched_context=enriched_context,
            ),
            temperature=0.4,
        )

        # 5. 写入 Org_Performance 对象
        org_perf = await _bridge.create_object(
            "Org_Performance",
            {
                "org_unit_ref": _ref(org_unit_id),
                "org_unit_name": org_props.get("unit_name", ""),
                "plan_ref": _ref(plan_id),
                "project_id": plan_props.get("project_id", ""),
                "strategic_kpis": result.get("strategic_kpis", []),
                "management_indicators": result.get("management_indicators", []),
                "team_development": result.get("team_development", []),
                "engagement_compliance": result.get("engagement_compliance", []),
                "dimension_weights": result.get("dimension_weights", {}),
                "strategic_alignment": result.get("strategic_alignment", []),
                "period": plan_props.get("cycle_type", "年度"),
                "status": "生成中",
                "generated_at": datetime.now().isoformat(),
            },
        )

        state = track_kernel_object(state, org_perf.get("_id", ""))

        # 6. 建立战略对齐关系
        org_perf_id = org_perf.get("_id", "")
        if strategic_goals and org_perf_id:
            for g in strategic_goals:
                try:
                    await _bridge.create_relation(
                        from_id=org_perf_id,
                        to_id=g.get("_id", ""),
                        relation_type="Goal_Aligned",
                    )
                except Exception as e:
                    logger.warning(f"创建战略对齐关系失败: {e}")

        state = set_domain_result(state, "org_performance", {
            "status": "completed",
            "org_perf_id": org_perf_id,
            "dimension_weights": result.get("dimension_weights", {}),
        })

        logger.info("[绩效领域] 部门绩效生成完成: %s", org_perf_id)
        return state

    except Exception as e:
        logger.error("[绩效领域] 部门绩效生成失败: %s", e)
        return set_domain_result(state, "org_performance", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 2: 一键生成岗位绩效
# ──────────────────────────────────────────────

async def generate_position_performance_node(state: dict[str, Any]) -> dict[str, Any]:
    """一键生成岗位绩效 (四分区)

    从 Org_Performance + Job_Role 批量生成 Position_Performance。
    输入 state 需包含: org_perf_id
    """
    logger.info("[绩效领域] 开始生成岗位绩效...")

    try:
        org_perf_id = state.get("org_perf_id", "")

        # 1. 查询部门绩效
        org_perf = await _bridge.get_object(org_perf_id)
        org_perf_props = org_perf.get("properties", {})

        # 2. 查询关联部门
        org_unit_id = _unref(org_perf_props.get("org_unit_ref"))
        plan_id = _unref(org_perf_props.get("plan_ref"))
        project_id = org_perf_props.get("project_id", "")

        # 3. 查询该部门下的所有岗位
        job_roles = await _bridge.get_objects_by_model("Job_Role", limit=100)
        dept_roles = [
            r for r in (job_roles or [])
            if r.get("properties", {}).get("org_unit_id") in (org_unit_id, f"sys_objects/{org_unit_id}")
        ]

        if not dept_roles:
            logger.warning("[绩效领域] 未找到该部门下的岗位")
            return set_domain_result(state, "position_performance", {
                "status": "failed",
                "error": "该部门下无岗位数据",
            })

        # 4. 查询胜任力模型
        competencies = await _bridge.get_objects_by_model("Competency", limit=200)
        comp_text = ""
        if competencies:
            lines = []
            for c in competencies:
                p = c.get("properties", {})
                lines.append(
                    f"- {p.get('competency_name', '')} | "
                    f"维度: {p.get('dimension', '')} | "
                    f"行为指标: {p.get('behavioral_indicators', [])}"
                )
            comp_text = "\n".join(lines)

        # 5. 查询绩效方案配置
        plan_data = await _bridge.get_object(plan_id) if plan_id else None
        plan_config = (
            f"方法论: {plan_data.get('properties', {}).get('methodology', '')} | "
            f"周期: {plan_data.get('properties', {}).get('cycle_type', '')} | "
            f"权重配置: {plan_data.get('properties', {}).get('weight_config', '')}"
        ) if plan_data else "未指定"

        # 6. 构建部门绩效上下文
        org_perf_text = (
            f"战略KPI: {org_perf_props.get('strategic_kpis', [])}\n"
            f"部门管理指标: {org_perf_props.get('management_indicators', [])}\n"
            f"团队发展指标: {org_perf_props.get('team_development', [])}\n"
            f"敬业度/合规指标: {org_perf_props.get('engagement_compliance', [])}\n"
            f"维度权重: {org_perf_props.get('dimension_weights', {})}"
        )

        # 7. 为每个岗位生成绩效 (批量)
        created_positions = []
        for role in dept_roles:
            role_props = role.get("properties", {})
            role_text = (
                f"岗位: {role_props.get('role_name', '')} | "
                f"序列: {role_props.get('job_family', '')} | "
                f"职级: {role_props.get('level_range', '')} | "
                f"关键岗位: {role_props.get('is_key_position', False)} | "
                f"胜任力要求: {role_props.get('competency_requirements', [])}"
            )

            result = await _call_ai(
                PERFORMANCE_SYSTEM_PROMPT,
                POSITION_PERFORMANCE_GENERATION_PROMPT.format(
                    org_performance_data=org_perf_text,
                    job_role_info=role_text,
                    competency_data=comp_text,
                    plan_config=plan_config,
                ),
                temperature=0.4,
            )

            # 判断是否管理岗
            is_leader = role_props.get("job_family") == "管理M"
            leader_config = result.get("leader_config") if is_leader else None
            team_perf = result.get("team_performance") if is_leader else None

            pos_perf = await _bridge.create_object(
                "Position_Performance",
                {
                    "job_role_ref": role.get("_id", ""),
                    "job_role_name": role_props.get("role_name", ""),
                    "org_perf_ref": _ref(org_perf_id),
                    "plan_ref": _ref(plan_id),
                    "project_id": project_id,
                    "performance_goals": result.get("performance_goals", []),
                    "competency_items": result.get("competency_items", []),
                    "values_items": result.get("values_items", []),
                    "development_goals": result.get("development_goals", []),
                    "section_weights": result.get("section_weights", {}),
                    "is_leader": is_leader,
                    "leader_config": leader_config,
                    "team_performance": team_perf,
                    "auto_generated": True,
                    "is_edited": False,
                    "status": "已生成",
                },
            )

            state = track_kernel_object(state, pos_perf.get("_id", ""))
            created_positions.append({
                "role_name": role_props.get("role_name", ""),
                "pos_perf_id": pos_perf.get("_id", ""),
                "is_leader": is_leader,
            })

        state = set_domain_result(state, "position_performance", {
            "status": "completed",
            "count": len(created_positions),
            "positions": created_positions,
        })

        logger.info("[绩效领域] 岗位绩效生成完成: %d 个岗位", len(created_positions))
        return state

    except Exception as e:
        logger.error("[绩效领域] 岗位绩效生成失败: %s", e)
        return set_domain_result(state, "position_performance", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 3: AI 生成考核表单
# ──────────────────────────────────────────────

async def generate_review_template_node(state: dict[str, Any]) -> dict[str, Any]:
    """AI 生成考核表单模板

    从 Position_Performance 生成 Review_Template + Rating_Model。
    输入 state 需包含: pos_perf_id
    """
    logger.info("[绩效领域] 开始生成考核表单...")

    try:
        pos_perf_id = state.get("pos_perf_id", "")

        # 1. 查询岗位绩效
        pos_perf = await _bridge.get_object(pos_perf_id)
        pos_props = pos_perf.get("properties", {})

        # 2. 查询关联岗位
        job_role_id = _unref(pos_props.get("job_role_ref"))
        job_role = await _bridge.get_object(job_role_id) if job_role_id else None
        job_props = job_role.get("properties", {}) if job_role else {}

        # 3. 查询绩效方案
        plan_id = _unref(pos_props.get("plan_ref"))
        plan_data = await _bridge.get_object(plan_id) if plan_id else None
        plan_props = plan_data.get("properties", {}) if plan_data else {}

        # 4. 查询现有评分模型
        rating_models = await _bridge.get_objects_by_model("Rating_Model", limit=10)
        rating_text = ""
        if rating_models:
            lines = []
            for rm in rating_models:
                p = rm.get("properties", {})
                lines.append(
                    f"- {p.get('model_name', '')} | "
                    f"类型: {p.get('scale_type', '')} | "
                    f"范围: {p.get('min_value', '')}-{p.get('max_value', '')}"
                )
            rating_text = "\n".join(lines)

        # 5. 构建上下文
        pos_perf_text = (
            f"业绩目标: {pos_props.get('performance_goals', [])}\n"
            f"能力评估: {pos_props.get('competency_items', [])}\n"
            f"价值观: {pos_props.get('values_items', [])}\n"
            f"发展目标: {pos_props.get('development_goals', [])}\n"
            f"是否管理岗: {pos_props.get('is_leader', False)}\n"
            f"分区权重: {pos_props.get('section_weights', {})}"
        )

        job_text = (
            f"岗位: {job_props.get('role_name', '')} | "
            f"序列: {job_props.get('job_family', '')} | "
            f"职级: {job_props.get('level_range', '')}"
        )

        plan_config = (
            f"方法论: {plan_props.get('methodology', '')} | "
            f"周期: {plan_props.get('cycle_type', '')} | "
            f"权重配置: {plan_props.get('weight_config', '')}"
        )

        # 6. 调用 AI 生成表单
        result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            TEMPLATE_GENERATION_PROMPT.format(
                position_performance_data=pos_perf_text,
                job_role_info=job_text,
                rating_model_data=rating_text or "暂无评分模型",
                plan_config=plan_config,
            ),
            temperature=0.4,
        )

        # 7. 创建或复用评分模型
        rating_rec = result.get("rating_recommendation", {})
        rating_model_id = None
        if rating_rec and not rating_models:
            # 无现有模型，创建默认模型
            rating_model = await _bridge.create_object(
                "Rating_Model",
                {
                    "model_name": f"{job_props.get('role_name', '默认')}_评分模型",
                    "scale_type": rating_rec.get("scale_type", "行为锚定"),
                    "min_value": rating_rec.get("min_value", 1),
                    "max_value": rating_rec.get("max_value", 5),
                    "step": 1.0,
                    "scale_definitions": rating_rec.get("scale_definitions", []),
                    "distribution_guide": rating_rec.get("distribution_guide", {}),
                    "is_default": False,
                },
            )
            rating_model_id = rating_model.get("_id", "")
            state = track_kernel_object(state, rating_model_id)
        elif rating_models:
            rating_model_id = rating_models[0].get("_id", "")

        # 8. 创建考核表单模板
        is_leader = pos_props.get("is_leader", False)
        template_type = "综合考核" if is_leader else plan_props.get("methodology", "KPI考核")
        if template_type == "KPI":
            template_type = "KPI考核"

        template = await _bridge.create_object(
            "Review_Template",
            {
                "template_name": f"{job_props.get('role_name', '岗位')}考核表单",
                "template_type": template_type,
                "applicable_roles": [job_props.get("job_family", "")],
                "sections": result.get("sections", []),
                "total_weight": result.get("total_weight", 100),
                "rating_model_ref": rating_model_id or "",
                "reviewer_config": result.get("reviewer_config", {}),
                "plan_ref": _ref(plan_id),
                "position_ref": _ref(pos_perf_id),
                "status": "草拟",
                "description": f"基于岗位绩效自动生成的考核表单 ({template_type})",
            },
        )

        state = track_kernel_object(state, template.get("_id", ""))

        state = set_domain_result(state, "review_template", {
            "status": "completed",
            "template_id": template.get("_id", ""),
            "rating_model_id": rating_model_id,
            "template_type": template_type,
        })

        logger.info("[绩效领域] 考核表单生成完成: %s", template.get("_id", ""))
        return state

    except Exception as e:
        logger.error("[绩效领域] 考核表单生成失败: %s", e)
        return set_domain_result(state, "review_template", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 4: 考核数据分析
# ──────────────────────────────────────────────

async def analyze_review_patterns_node(state: dict[str, Any]) -> dict[str, Any]:
    """考核数据分析 — 识别评分偏差和模式

    输入 state 需包含: project_id (可选), cycle_id (可选)
    """
    logger.info("[绩效领域] 开始考核数据分析...")

    try:
        project_id = state.get("project_id", "")

        # 1. 查询所有考核记录
        reviews = await _bridge.get_objects_by_model("Performance_Review", limit=500)
        if not reviews:
            return set_domain_result(state, "review_patterns", {
                "status": "failed",
                "error": "无考核数据",
            })

        # 2. 构建统计摘要
        scores = []
        by_reviewer = {}
        for r in reviews:
            p = r.get("properties", {})
            score = p.get("overall_score")
            if score is not None:
                scores.append(score)
            reviewer = p.get("reviewer", "unknown")
            if reviewer not in by_reviewer:
                by_reviewer[reviewer] = []
            if score is not None:
                by_reviewer[reviewer].append(score)

        import statistics
        stats = {}
        if scores:
            stats = {
                "count": len(scores),
                "mean": round(statistics.mean(scores), 2),
                "median": round(statistics.median(scores), 2),
                "std_dev": round(statistics.stdev(scores), 2) if len(scores) > 1 else 0,
                "min": min(scores),
                "max": max(scores),
            }

        # 评分人分布
        reviewer_dist = {}
        for reviewer, rscores in by_reviewer.items():
            if rscores:
                reviewer_dist[reviewer] = {
                    "count": len(rscores),
                    "avg": round(statistics.mean(rscores), 2),
                }

        stats_text = json.dumps(stats, ensure_ascii=False)
        reviewer_text = json.dumps(reviewer_dist, ensure_ascii=False, indent=2)

        # 3. 调用 AI 分析
        result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            REVIEW_PATTERN_ANALYSIS_PROMPT.format(
                statistics_summary=stats_text,
                reviewer_distribution=reviewer_text,
                historical_trends="暂无历史趋势数据",
            ),
        )

        state = set_domain_result(state, "review_patterns", {
            "status": "completed",
            "statistics": stats,
            "bias_detected": result.get("bias_detected", []),
            "recommendations": result.get("recommendations", []),
        })

        logger.info("[绩效领域] 考核数据分析完成")
        return state

    except Exception as e:
        logger.error("[绩效领域] 考核数据分析失败: %s", e)
        return set_domain_result(state, "review_patterns", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 5: 校准分析
# ──────────────────────────────────────────────

async def calibration_analysis_node(state: dict[str, Any]) -> dict[str, Any]:
    """校准分析 — 分布对比 + 九宫格

    输入 state 需包含: calibration_id
    """
    logger.info("[绩效领域] 开始校准分析...")

    try:
        calibration_id = state.get("calibration_id", "")

        # 1. 查询校准会话
        cal_data = await _bridge.get_object(calibration_id)
        cal_props = cal_data.get("properties", {})

        before_text = cal_props.get("distribution_before", "{}")
        after_text = cal_props.get("distribution_after", "{}")
        nine_box_text = cal_props.get("nine_box_data", "[]")

        # 2. 查询关联考核记录
        org_unit = cal_props.get("org_unit", "")
        reviews = await _bridge.get_objects_by_model("Performance_Review", limit=500)
        review_list = []
        for r in (reviews or []):
            p = r.get("properties", {})
            if p.get("overall_rating"):
                review_list.append(
                    f"- {p.get('review_title', '')} | "
                    f"评分: {p.get('overall_score', '')} | "
                    f"等级: {p.get('overall_rating', '')}"
                )
        review_text = "\n".join(review_list) if review_list else "暂无考核数据"

        # 3. 调用 AI 分析
        result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            CALIBRATION_ANALYSIS_PROMPT.format(
                distribution_before=_safe_json_dumps(before_text),
                distribution_after=_safe_json_dumps(after_text),
                nine_box_data=_safe_json_dumps(nine_box_text),
                review_list=review_text,
            ),
        )

        state = set_domain_result(state, "calibration", {
            "status": "completed",
            "distribution_assessment": result.get("distribution_assessment", {}),
            "adjustment_recommendations": result.get("adjustment_recommendations", []),
            "nine_box_analysis": result.get("nine_box_analysis", {}),
            "calibration_guidance": result.get("calibration_guidance", ""),
        })

        logger.info("[绩效领域] 校准分析完成")
        return state

    except Exception as e:
        logger.error("[绩效领域] 校准分析失败: %s", e)
        return set_domain_result(state, "calibration", {
            "status": "failed",
            "error": str(e),
        })


# ──────────────────────────────────────────────
# 新增节点 6: 咨询报告生成
# ──────────────────────────────────────────────

async def generate_performance_report_node(state: dict[str, Any]) -> dict[str, Any]:
    """AI 生成绩效管理咨询报告

    聚合项目下全部绩效域数据，生成结构化咨询报告。
    输入 state 需包含: project_id
    """
    logger.info("[绩效领域] 开始生成咨询报告...")

    try:
        project_id = state.get("project_id", "")

        # 1. 查询绩效方案
        plans = await _bridge.get_objects_by_model("Performance_Plan", limit=10)
        plan_overview = ""
        if plans:
            plan = plans[0]
            p = plan.get("properties", {})
            plan_overview = (
                f"方案: {p.get('plan_name', '')} | "
                f"客户: {p.get('client_name', '')} | "
                f"行业: {p.get('industry', '')} | "
                f"方法论: {p.get('methodology', '')} | "
                f"周期: {p.get('cycle_type', '')} | "
                f"状态: {p.get('status', '')}"
            )

        # 2. 查询组织绩效
        org_perfs = await _bridge.get_objects_by_model("Org_Performance", limit=50)
        org_text = ""
        if org_perfs:
            lines = []
            for op in org_perfs:
                props = op.get("properties", {})
                lines.append(
                    f"- 状态: {props.get('status', '')} | "
                    f"维度权重: {props.get('dimension_weights', '')}"
                )
            org_text = "\n".join(lines)

        # 3. 查询岗位绩效
        pos_perfs = await _bridge.get_objects_by_model("Position_Performance", limit=200)
        pos_text = ""
        if pos_perfs:
            leader_count = sum(
                1 for pp in pos_perfs
                if pp.get("properties", {}).get("is_leader")
            )
            pos_text = (
                f"总岗位数: {len(pos_perfs)} | "
                f"管理岗: {leader_count} | "
                f"专业岗: {len(pos_perfs) - leader_count} | "
                f"已编辑: {sum(1 for pp in pos_perfs if pp.get('properties', {}).get('is_edited'))}"
            )

        # 4. 查询考核表单
        templates = await _bridge.get_objects_by_model("Review_Template", limit=50)
        template_text = f"表单模板数: {len(templates or [])}"

        # 5. 查询考核记录统计
        reviews = await _bridge.get_objects_by_model("Performance_Review", limit=500)
        review_count = len(reviews or [])
        if review_count > 0:
            scores = [
                r.get("properties", {}).get("overall_score")
                for r in reviews
                if r.get("properties", {}).get("overall_score") is not None
            ]
            import statistics
            if scores:
                review_stats = (
                    f"考核记录数: {review_count} | "
                    f"平均分: {round(statistics.mean(scores), 2)} | "
                    f"标准差: {round(statistics.stdev(scores), 2) if len(scores) > 1 else 0}"
                )
            else:
                review_stats = f"考核记录数: {review_count}"
        else:
            review_stats = "暂无考核数据"

        # 6. 查询校准结果
        calibrations = await _bridge.get_objects_by_model("Calibration_Session", limit=10)
        cal_text = f"校准会话数: {len(calibrations or [])}"

        # 7. 查询原有诊断数据
        diagnosis_results = state.get("results", {}).get("performance", {})
        diagnosis_text = _safe_json_dumps(diagnosis_results.get("diagnosis", ""))

        # 8. 调用 AI 生成报告
        result = await _call_ai(
            PERFORMANCE_SYSTEM_PROMPT,
            PERFORMANCE_REPORT_PROMPT.format(
                plan_overview=plan_overview,
                org_performance_data=org_text,
                position_performance_data=pos_text,
                template_design=template_text,
                review_statistics=review_stats,
                calibration_results=cal_text,
                diagnosis_data=diagnosis_text,
            ),
            temperature=0.3,
        )

        # 9. 写入 Deliverable 对象
        deliverable = await _bridge.create_object(
            "Deliverable",
            {
                "title": "绩效管理咨询报告",
                "project_id": project_id,
                "deliverable_type": "report",
                "source_module": "performance",
                "content": result.get("executive_summary", ""),
                "created_by": "AI",
                "created_at": datetime.now().isoformat(),
            },
        )
        state = track_kernel_object(state, deliverable.get("_id", ""))

        state = set_domain_result(state, "performance_report", {
            "status": "completed",
            "deliverable_id": deliverable.get("_id", ""),
            "executive_summary": result.get("executive_summary", ""),
            "issues_count": len(result.get("issues", [])),
            "recommendations_count": len(result.get("recommendations", [])),
        })

        logger.info("[绩效领域] 咨询报告生成完成: %s", deliverable.get("_id", ""))
        return state

    except Exception as e:
        logger.error("[绩效领域] 咨询报告生成失败: %s", e)
        return set_domain_result(state, "performance_report", {
            "status": "failed",
            "error": str(e),
        })
