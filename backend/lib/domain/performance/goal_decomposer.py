"""
战略举措分解节点 (Phase 3)

将战略举措 (Strategic_Initiative) 分解为里程碑 + 关联KPI。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.domain.performance.nodes import _ref, _unref, _safe_json_dumps, _build_enriched_context, _call_ai
from lib.domain.performance.prompts import INITIATIVE_DECOMPOSITION_PROMPT

logger = logging.getLogger(__name__)
_bridge = KernelBridge()


async def decompose_initiative_node(state: dict[str, Any]) -> dict[str, Any]:
    """AI 将战略举措分解为里程碑 + 关联 KPI

    输入 state 需包含: initiative_id, plan_id (可选)
    """
    logger.info("[绩效领域] 开始战略举措分解...")

    try:
        initiative_id = state.get("initiative_id", "")
        plan_id = state.get("plan_id", "")

        # 1. 读取战略举措
        initiative = await _bridge.get_object(initiative_id)
        if not initiative:
            return set_domain_result(state, "initiative_decomposition", {
                "status": "failed",
                "error": f"战略举措 {initiative_id} 不存在",
            })

        ini_props = initiative.get("properties", {})

        # 2. 读取业务上下文
        enriched = ""
        if plan_id:
            plan = await _bridge.get_object(plan_id)
            if plan:
                enriched = _build_enriched_context(plan.get("properties", {}))

        # 3. 读取已有关联KPI
        existing_goals = await _bridge.get_objects_by_model("Strategic_Goal", limit=50)
        goals_text = ""
        if existing_goals:
            lines = []
            for g in existing_goals:
                p = g.get("properties", {})
                if p.get("goal_type") in ("operational_kpi", "revenue_target", "profit_target"):
                    lines.append(f"- {p.get('goal_name', '')} (目标值: {p.get('target_value', '')})")
            goals_text = "\n".join(lines) if lines else "暂无KPI型目标"

        # 4. 构建举措信息
        initiative_text = (
            f"举措名称: {ini_props.get('initiative_name', '')}\n"
            f"描述: {ini_props.get('description', '')}\n"
            f"状态: {ini_props.get('status', '')}\n"
            f"开始日期: {ini_props.get('start_date', '')}\n"
            f"结束日期: {ini_props.get('end_date', '')}"
        )

        # 5. 调用 AI 分解
        result = await _call_ai(
            "你是一位资深的战略管理顾问。",
            INITIATIVE_DECOMPOSITION_PROMPT.format(
                initiative_info=initiative_text,
                enriched_context=enriched or "无详细业务上下文",
                existing_goals=goals_text,
            ),
            temperature=0.3,
        )

        # 6. 更新战略举措的里程碑
        milestones = result.get("milestones", [])
        linked_kpis = result.get("linked_kpis", [])

        # 7. 创建关联KPI目标
        created_kpis = []
        for kpi in linked_kpis:
            kpi_name = kpi.get("kpi_goal_name", "")
            if not kpi_name:
                continue

            kpi_obj = await _bridge.create_object(
                "Strategic_Goal",
                {
                    "goal_name": kpi_name,
                    "goal_type": "operational_kpi",
                    "priority": "P1",
                    "target_value": kpi.get("target_value", 0),
                    "status": "进行中",
                    "period_type": "annual",
                    "target_metrics": [
                        {
                            "metric_name": kpi_name,
                            "unit": kpi.get("unit", ""),
                            "target_value": kpi.get("target_value", 0),
                        }
                    ],
                },
            )

            kpi_id = kpi_obj.get("_id", "")
            state = track_kernel_object(state, kpi_id)
            created_kpis.append({"name": kpi_name, "id": kpi_id})

            # 创建 LINKED_KPI 关系
            try:
                await _bridge.create_relation(
                    from_id=initiative.get("_id", ""),
                    to_id=kpi_id,
                    relation_type="Linked_KPI",
                )
            except Exception as e:
                logger.warning(f"创建 LINKED_KPI 关系失败: {e}")

        # 8. 更新战略举措 (写入里程碑 + 关联KPI引用)
        linked_kpi_refs = [
            {"kpi_goal_id": kpi["id"], "weight": 0}
            for kpi in created_kpis
        ]

        # 直接更新内核对象
        from app.services.kernel.object_service import ObjectService
        from app.kernel.database import get_db
        from app.models.kernel.meta_model import ObjectUpdate

        db = get_db()
        svc = ObjectService(db)
        svc.update_object(initiative_id, ObjectUpdate(properties={
            "milestones": milestones,
            "linked_kpis": linked_kpi_refs,
        }))

        state = set_domain_result(state, "initiative_decomposition", {
            "status": "completed",
            "milestones_count": len(milestones),
            "linked_kpis_count": len(created_kpis),
            "linked_kpis": created_kpis,
        })

        logger.info("[绩效领域] 战略举措分解完成: %d 里程碑, %d KPI", len(milestones), len(created_kpis))
        return state

    except Exception as e:
        logger.error("[绩效领域] 战略举措分解失败: %s", e)
        return set_domain_result(state, "initiative_decomposition", {
            "status": "failed",
            "error": str(e),
        })
