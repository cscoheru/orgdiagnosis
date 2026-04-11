"""
级联编排器 (Phase 4)

一键生成完整级联：公司目标 → 部门目标 → 岗位目标
可选：年度 → 季度 → 月度周期分解
"""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.domain.performance.nodes import _ref, _unref, _call_ai, _build_enriched_context

logger = logging.getLogger(__name__)
_bridge = KernelBridge()


async def generate_full_cascade(state: dict[str, Any]) -> dict[str, Any]:
    """一键级联生成：公司目标 → 部门目标 → 岗位目标

    输入 state 需包含:
    - plan_id: 绩效方案 ID
    - org_unit_id: 起始部门 ID（如公司总部）
    - cascade_mode: "top_down" | "standalone"
    """
    logger.info("[绩效领域] 开始级联生成...")

    try:
        plan_id = state.get("plan_id", "")
        root_org_id = state.get("org_unit_id", "")
        cascade_mode = state.get("cascade_mode", "top_down")

        # 1. 读取绩效方案
        plan = await _bridge.get_object(plan_id) if plan_id else None
        plan_props = plan.get("properties", {}) if plan else {}

        # 2. 读取战略目标（含富化上下文）
        strategic_goals = await _bridge.get_objects_by_model("Strategic_Goal", limit=50)
        enriched_context = _build_enriched_context(plan_props)

        # 3. 获取组织树
        from lib.workflow.hierarchy_utils import get_org_tree
        org_tree = await get_org_tree(_bridge, root_org_id)

        # 4. 递归为每个部门生成组织绩效
        created_org_perfs = []
        await _cascade_org_performances(
            org_tree,
            plan_id,
            plan_props,
            strategic_goals or [],
            enriched_context,
            None,  # parent_org_perf_id (top-level has no parent)
            created_org_perfs,
            state,
        )

        # 5. 为每个组织绩效生成岗位绩效
        created_pos_perfs = []
        for org_perf in created_org_perfs:
            pos_count = await _generate_positions_for_org(
                org_perf["_key"],
                plan_id,
                plan_props,
                state,
            )
            created_pos_perfs.extend(pos_count)

        state = set_domain_result(state, "cascade", {
            "status": "completed",
            "org_performances": len(created_org_perfs),
            "position_performances": len(created_pos_perfs),
        })

        logger.info("[绩效领域] 级联生成完成: %d 部门绩效, %d 岗位绩效",
                     len(created_org_perfs), len(created_pos_perfs))
        return state

    except Exception as e:
        logger.error("[绩效领域] 级联生成失败: %s", e)
        return set_domain_result(state, "cascade", {
            "status": "failed",
            "error": str(e),
        })


async def _cascade_org_performances(
    org_nodes: list[dict[str, Any]],
    plan_id: str,
    plan_props: dict[str, Any],
    strategic_goals: list[dict[str, Any]],
    enriched_context: str,
    parent_org_perf_id: str | None,
    results: list[dict[str, Any]],
    state: dict[str, Any],
):
    """递归为组织树中的每个节点生成 Org_Performance"""
    for node in org_nodes:
        org_key = node["_key"]
        org_props = node.get("properties", {})

        # 构建上下文
        goals_text = ""
        if strategic_goals:
            lines = []
            for g in strategic_goals:
                p = g.get("properties", {})
                lines.append(f"- {p.get('goal_name', '')} ({p.get('goal_type', '')}) P{p.get('priority', '')}")
            goals_text = "\n".join(lines)

        org_text = (
            f"部门: {org_props.get('unit_name', '')} | "
            f"类型: {org_props.get('unit_type', '')} | "
            f"层级: {org_props.get('level', '')}"
        )

        # 如果有上级绩效，加入上下文
        parent_context = ""
        if parent_org_perf_id:
            parent_perf = await _bridge.get_object(parent_org_perf_id)
            if parent_perf:
                pp = parent_perf.get("properties", {})
                parent_context = f"\n\n## 上级部门绩效\n{json.dumps(pp.get('strategic_kpis', []), ensure_ascii=False)}"

        # 调用 AI
        from lib.domain.performance.prompts import ORG_PERFORMANCE_GENERATION_PROMPT
        client_context = (
            f"客户: {plan_props.get('client_name', '')} | "
            f"行业: {plan_props.get('industry', '')} | "
            f"方法论: {plan_props.get('methodology', '')}"
        )

        result = await _call_ai(
            "你是一位资深的绩效管理咨询顾问。",
            ORG_PERFORMANCE_GENERATION_PROMPT.format(
                client_context=client_context,
                strategic_goals=goals_text + parent_context,
                org_unit_info=org_text,
                industry_context=plan_props.get("industry", "未指定"),
                enriched_context=enriched_context,
            ),
            temperature=0.4,
        )

        # 确定绩效类型
        level = org_props.get("level", 99)
        perf_type = "company" if level == 1 else "department"

        # 创建 Org_Performance
        org_perf = await _bridge.create_object(
            "Org_Performance",
            {
                "org_unit_ref": _ref(org_key),
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
                "generated_at": __import__("datetime").datetime.now().isoformat(),
                "perf_type": perf_type,
                "parent_goal_ref": _ref(parent_org_perf_id) if parent_org_perf_id else "",
            },
        )

        state = track_kernel_object(state, org_perf.get("_id", ""))

        # 创建 DECOMPOSED_FROM 关系（如果有上级）
        if parent_org_perf_id:
            try:
                await _bridge.create_relation(
                    from_id=org_perf.get("_id", ""),
                    to_id=f"sys_objects/{parent_org_perf_id}",
                    relation_type="Decomposed_From",
                )
            except Exception as e:
                logger.warning(f"创建 DECOMPOSED_FROM 关系失败: {e}")

        results.append(org_perf)

        # 递归处理子部门
        children = node.get("children", [])
        if children:
            await _cascade_org_performances(
                children,
                plan_id,
                plan_props,
                strategic_goals,
                enriched_context,
                org_perf.get("_key", ""),
                results,
                state,
            )


async def _generate_positions_for_org(
    org_perf_id: str,
    plan_id: str,
    plan_props: dict[str, Any],
    state: dict[str, Any],
) -> list[dict[str, Any]]:
    """为指定部门绩效生成所有岗位绩效"""
    from lib.domain.performance.nodes import generate_position_performance_node
    from lib.workflow.base_state import create_workflow_state

    pos_state = create_workflow_state(
        task_id=f"pos_perf_{org_perf_id}",
        org_perf_id=org_perf_id,
    )
    # 注入 plan 信息
    pos_state["plan_id"] = plan_id

    result_state = await generate_position_performance_node(pos_state)
    result = result_state.get("results", {}).get("position_performance", {})

    if result.get("status") == "completed":
        return result.get("positions", [])
    return []
