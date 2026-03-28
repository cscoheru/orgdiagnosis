"""
绩效领域 LangGraph 分析节点

提供 analyze_performance_node，负责：
1. 从内核查询绩效相关数据（指标、能力素质、考核周期）
2. 组装分析上下文
3. 调用 AI 进行绩效诊断
4. 将分析结果写回内核并更新工作流状态
"""

from __future__ import annotations

import json
import logging
from typing import Any

from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.domain.performance.prompts import (
    PERFORMANCE_SYSTEM_PROMPT,
    PERFORMANCE_DIMENSION_PROMPT,
)

logger = logging.getLogger(__name__)

# 内核桥接单例
_bridge = KernelBridge()


async def _query_performance_data() -> dict[str, Any]:
    """从内核查询绩效领域所有相关数据

    查询三个元模型的对象：Performance_Metric、Competency、Review_Cycle。

    Returns:
        {
            "metrics": [...],
            "competencies": [...],
            "cycles": [...],
        }
    """
    # 并行查询三个元模型的数据
    metrics = await _bridge.get_objects_by_model("Performance_Metric", limit=200)
    competencies = await _bridge.get_objects_by_model("Competency", limit=200)
    cycles = await _bridge.get_objects_by_model("Review_Cycle", limit=200)

    return {
        "metrics": metrics or [],
        "competencies": competencies or [],
        "cycles": cycles or [],
    }


def _build_context(data: dict[str, Any]) -> str:
    """将查询到的内核数据格式化为 AI 可理解的文本上下文

    Args:
        data: _query_performance_data 返回的数据字典

    Returns:
        格式化的上下文字符串
    """
    # 格式化绩效指标
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

    # 格式化能力素质
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

    # 格式化考核周期
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


async def _call_ai_analysis(
    metrics_text: str,
    competency_text: str,
    cycle_text: str,
) -> dict[str, Any]:
    """调用 AI 进行绩效诊断分析

    Args:
        metrics_text: 格式化的绩效指标文本
        competency_text: 格式化的能力素质文本
        cycle_text: 格式化的考核周期文本

    Returns:
        AI 返回的结构化分析结果字典
    """
    # 延迟导入 AI 服务，避免循环依赖
    from app.services.ai_service import AIService

    ai_service = AIService()

    # 组装维度分析 prompt
    user_prompt = PERFORMANCE_DIMENSION_PROMPT.format(
        metrics_data=metrics_text,
        competency_data=competency_text,
        cycle_data=cycle_text,
        context_data="组织绩效体系诊断",
    )

    # 调用 AI 分析
    raw_result = await ai_service.chat(
        system_prompt=PERFORMANCE_SYSTEM_PROMPT,
        user_prompt=user_prompt,
        temperature=0.3,
    )

    # 尝试解析 JSON 格式的结果
    try:
        if isinstance(raw_result, str):
            # 尝试从返回文本中提取 JSON
            result = json.loads(raw_result)
        elif isinstance(raw_result, dict):
            result = raw_result
        else:
            result = {"raw_response": str(raw_result)}
    except (json.JSONDecodeError, TypeError):
        # JSON 解析失败，将原始文本作为结果
        logger.warning("绩效分析结果 JSON 解析失败，使用原始文本")
        result = {"raw_response": str(raw_result), "parse_error": True}

    return result


async def _write_results_to_kernel(
    analysis_result: dict[str, Any],
    data: dict[str, Any],
    state: dict[str, Any],
) -> dict[str, Any]:
    """将分析结果写回内核

    创建一个 Performance_Analysis 对象存储分析结论，
    并关联到相关的绩效指标、能力素质、考核周期对象。

    Args:
        analysis_result: AI 分析结果
        data: 查询到的原始数据
        state: 当前工作流状态

    Returns:
        更新后的工作流状态（含 kernel_context 追踪）
    """
    # 将分析结果存入内核
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

    # 在工作流状态中追踪创建的内核对象
    state = track_kernel_object(state, analysis_obj.get("_id", ""))

    # 将分析对象与原始数据对象建立关联
    obj_id = analysis_obj.get("_id", "")
    for obj in data["metrics"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id,
                    to_id=source_id,
                    relation_type="analyzes_metric",
                )
            except Exception as e:
                logger.warning(f"创建指标关联失败: {e}")

    for obj in data["competencies"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id,
                    to_id=source_id,
                    relation_type="analyzes_competency",
                )
            except Exception as e:
                logger.warning(f"创建能力关联失败: {e}")

    for obj in data["cycles"]:
        source_id = obj.get("_id", "")
        if source_id and obj_id:
            try:
                await _bridge.create_relation(
                    from_id=obj_id,
                    to_id=source_id,
                    relation_type="analyzes_cycle",
                )
            except Exception as e:
                logger.warning(f"创建周期关联失败: {e}")

    return state


async def analyze_performance_node(state: dict[str, Any]) -> dict[str, Any]:
    """绩效分析节点 — LangGraph 节点函数

    执行流程:
    1. 从内核查询绩效数据（指标、能力素质、考核周期）
    2. 构建分析上下文
    3. 调用 AI 进行绩效诊断
    4. 将分析结果写回内核
    5. 更新工作流状态

    Args:
        state: LangGraph 工作流状态

    Returns:
        更新后的工作流状态字典（仅包含变更的字段）
    """
    logger.info("[绩效领域] 开始绩效分析...")

    try:
        # 第一步：从内核查询绩效相关数据
        data = await _query_performance_data()
        logger.info(
            "[绩效领域] 查询到数据 — 指标: %d, 能力: %d, 周期: %d",
            len(data["metrics"]),
            len(data["competencies"]),
            len(data["cycles"]),
        )

        # 第二步：构建 AI 分析上下文
        metrics_text, competency_text, cycle_text = _build_context(data)

        # 第三步：调用 AI 进行绩效诊断
        analysis_result = await _call_ai_analysis(
            metrics_text, competency_text, cycle_text
        )
        logger.info("[绩效领域] AI 分析完成")

        # 第四步：将分析结果写回内核
        state = await _write_results_to_kernel(analysis_result, data, state)
        logger.info("[绩效领域] 分析结果已写入内核")

        # 第五步：更新工作流状态
        state = set_domain_result("performance", {
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
        # 返回错误状态，不中断整个工作流
        return set_domain_result(state, "performance", {
            "status": "failed",
            "error": str(e),
        })
