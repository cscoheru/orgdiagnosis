"""
周期分解节点 (Phase 4)

将年度绩效分解为季度/月度目标。
"""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.domain.performance.nodes import _ref, _unref, _call_ai

logger = logging.getLogger(__name__)
_bridge = KernelBridge()

PERIOD_DECOMPOSITION_PROMPT = """你是一位资深的绩效管理顾问，擅长将年度绩效目标分解为周期性子目标。

## 年度部门绩效
{annual_perf_data}

## 目标周期
{target_periods}

## 任务

请将年度绩效的四维度指标按比例分配到各周期。规则：
1. 战略KPI: 按业务季节性分配（如Q4冲刺、Q1规划期）
2. 部门管理指标: 相对均匀分配，考虑季度差异
3. 团队发展: 考虑培训周期（Q1集中培训）
4. 敬业度/合规: 年度指标按季度均分或按审计周期分配

请以 JSON 格式输出每个周期的绩效数据：
{{
    "periods": [
        {{
            "period_target": "2026-Q1",
            "strategic_kpis": [...],
            "management_indicators": [...],
            "team_development": [...],
            "engagement_compliance": [...],
            "dimension_weights": {{"strategic": 50, "management": 25, "team_development": 15, "engagement": 10}}
        }}
    ]
}}
"""


async def decompose_period_node(state: dict[str, Any]) -> dict[str, Any]:
    """将年度绩效分解为季度/月度目标

    输入 state 需包含: org_perf_id, target_periods (list)
    """
    logger.info("[绩效领域] 开始周期分解...")

    try:
        org_perf_id = state.get("org_perf_id", "")
        target_periods = state.get("target_periods", ["Q1", "Q2", "Q3", "Q4"])

        # 1. 读取年度部门绩效
        org_perf = await _bridge.get_object(org_perf_id)
        if not org_perf:
            return set_domain_result(state, "period_decomposition", {
                "status": "failed",
                "error": f"部门绩效 {org_perf_id} 不存在",
            })

        props = org_perf.get("properties", {})
        annual_data = (
            f"部门: {props.get('org_unit_name', '')}\n"
            f"战略KPI: {json.dumps(props.get('strategic_kpis', []), ensure_ascii=False)}\n"
            f"部门管理指标: {json.dumps(props.get('management_indicators', []), ensure_ascii=False)}\n"
            f"团队发展: {json.dumps(props.get('team_development', []), ensure_ascii=False)}\n"
            f"敬业度/合规: {json.dumps(props.get('engagement_compliance', []), ensure_ascii=False)}\n"
            f"维度权重: {json.dumps(props.get('dimension_weights', {}), ensure_ascii=False)}"
        )

        # 2. 调用 AI 分解
        result = await _call_ai(
            "你是一位资深的绩效管理顾问。",
            PERIOD_DECOMPOSITION_PROMPT.format(
                annual_perf_data=annual_data,
                target_periods=", ".join(target_periods),
            ),
            temperature=0.3,
        )

        # 3. 创建子 Org_Performance
        periods = result.get("periods", [])
        created = []

        for period in periods:
            period_target = period.get("period_target", "")

            child_perf = await _bridge.create_object(
                "Org_Performance",
                {
                    "org_unit_ref": props.get("org_unit_ref", ""),
                    "org_unit_name": props.get("org_unit_name", ""),
                    "plan_ref": props.get("plan_ref", ""),
                    "project_id": props.get("project_id", ""),
                    "strategic_kpis": period.get("strategic_kpis", []),
                    "management_indicators": period.get("management_indicators", []),
                    "team_development": period.get("team_development", []),
                    "engagement_compliance": period.get("engagement_compliance", []),
                    "dimension_weights": period.get("dimension_weights", {}),
                    "period": "季度" if "Q" in period_target else "月度",
                    "status": "生成中",
                    "perf_type": "department",
                    "parent_goal_ref": _ref(org_perf_id),
                    "period_target": period_target,
                },
            )

            child_id = child_perf.get("_id", "")
            state = track_kernel_object(state, child_id)

            # 创建 DECOMPOSED_FROM 关系
            try:
                await _bridge.create_relation(
                    from_id=child_id,
                    to_id=org_perf.get("_id", ""),
                    relation_type="Decomposed_From",
                )
            except Exception as e:
                logger.warning(f"创建 DECOMPOSED_FROM 关系失败: {e}")

            created.append({
                "period": period_target,
                "id": child_id,
            })

        state = set_domain_result(state, "period_decomposition", {
            "status": "completed",
            "periods_created": len(created),
            "periods": created,
        })

        logger.info("[绩效领域] 周期分解完成: %d 个周期", len(created))
        return state

    except Exception as e:
        logger.error("[绩效领域] 周期分解失败: %s", e)
        return set_domain_result(state, "period_decomposition", {
            "status": "failed",
            "error": str(e),
        })
