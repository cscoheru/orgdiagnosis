"""
Report Generation Node

Generates the final diagnostic report from all dimension results.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from lib.langchain.schemas import FIVE_DIMENSIONS_SCHEMA


def generate_report_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：生成最终报告

    汇总所有维度结果，生成完整的诊断报告
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Generating final report...")

    try:
        # 收集所有维度结果
        dimensions = []
        total_score = 0.0
        dimension_count = 0

        for dim_name in ["strategy", "structure", "performance", "compensation", "talent"]:
            dim_result = state.get(f"{dim_name}_result")
            if dim_result:
                dimensions.append(dim_result)
                total_score += dim_result.get("total_score", 0)
                dimension_count += 1

        # 计算总分
        overall_score = total_score / dimension_count if dimension_count > 0 else 0

        # 生成综合洞察
        overall_insight = _generate_overall_insight(dimensions, overall_score)

        # 构建最终报告
        final_report = {
            "task_id": task_id,
            "report_name": "组织诊断报告",
            "status": "completed",
            "overall_score": round(overall_score, 1),
            "overall_insight": overall_insight,
            "dimensions": dimensions,
            "dimension_count": dimension_count,
            "completed_at": datetime.now().isoformat(),
            "progress_percentage": 100.0,
        }

        logger.info(f"[{task_id}] Report generated: overall_score={overall_score:.1f}")

        return {
            **state,
            "status": "completed",
            "final_report": final_report,
            "overall_score": round(overall_score, 1),
            "progress_percentage": 100.0,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error generating report: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "generate_report",
        }


def _generate_overall_insight(dimensions: List[Dict[str, Any]], overall_score: float) -> str:
    """
    生成综合洞察

    基于各维度分数生成整体诊断建议
    """
    if not dimensions:
        return "由于数据不足，无法生成综合诊断建议。"

    # 找出最强和最弱的维度
    sorted_dims = sorted(dimensions, key=lambda x: x.get("total_score", 0), reverse=True)

    strongest = sorted_dims[0] if sorted_dims else None
    weakest = sorted_dims[-1] if sorted_dims else None

    strongest_name = strongest.get("display_name", "未知") if strongest else "未知"
    weakest_name = weakest.get("display_name", "未知") if weakest else "未知"

    # 生成洞察
    if overall_score >= 75:
        insight = f"企业整体健康状况优秀（综合评分：{overall_score:.0f}分）。"
        insight += f"{strongest_name}维度表现突出，是企业的核心竞争力。"
        if weakest and weakest.get("total_score", 0) < 70:
            insight += f"建议重点关注{weakest_name}维度的提升。"
    elif overall_score >= 60:
        insight = f"企业整体健康状况良好（综合评分：{overall_score:.0f}分）。"
        insight += f"{strongest_name}维度表现较好。"
        if weakest and weakest.get("total_score", 0) < 60:
            insight += f"但{weakest_name}维度存在明显短板，需要重点改进。"
    else:
        insight = f"企业整体健康状况需要关注（综合评分：{overall_score:.0f}分）。"
        insight += "多个维度存在较大提升空间。"
        if weakest:
            insight += f"建议优先改善{weakest_name}维度。"

    # 添加维度细节
    insight += "\n\n各维度详情："
    for dim in sorted_dims:
        dim_name = dim.get("display_name", "未知")
        dim_score = dim.get("total_score", 0)
        dim_insight = dim.get("summary_insight", "")
        insight += f"\n• **{dim_name}** ({dim_score:.0f}分): {dim_insight[:50]}..."

    return insight


def _calculate_health_level(score: float) -> str:
    """计算健康等级"""
    if score >= 80:
        return "优秀"
    elif score >= 70:
        return "良好"
    elif score >= 60:
        return "合格"
    elif score >= 50:
        return "需改进"
    else:
        return "较差"


def _generate_recommendations(dimensions: List[Dict[str, Any]]) -> List[str]:
    """生成改进建议"""
    recommendations = []

    for dim in dimensions:
        score = dim.get("total_score", 0)
        if score < 60:
            category = dim.get("category", "")
            display_name = dim.get("display_name", "")

            if category == "strategy":
                recommendations.append(f"【{display_name}】建议重新审视战略规划，明确战略意图和市场定位")
            elif category == "structure":
                recommendations.append(f"【{display_name}】建议优化组织架构，理顺权责关系")
            elif category == "performance":
                recommendations.append(f"【{display_name}】建议完善绩效考核体系，强化目标管理")
            elif category == "compensation":
                recommendations.append(f"【{display_name}】建议调整薪酬策略，提升市场竞争力")
            elif category == "talent":
                recommendations.append(f"【{display_name}】建议加强人才梯队建设，完善培养体系")

    return recommendations
