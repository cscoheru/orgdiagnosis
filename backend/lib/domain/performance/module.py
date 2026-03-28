"""
绩效领域模块

PerformanceModule 是绩效领域的自包含模块，继承 BaseDomainModule。
负责注册绩效分析节点、元模型 key 和 AI prompt 模板。

元模型:
- Performance_Metric: 绩效指标（metric_name, formula, review_cycle, weight, target_value, unit）
- Competency: 能力素质（competency_name, dimension, definition, behavioral_indicators, level_description）
- Review_Cycle: 考核周期（cycle_name, cycle_type, start_date, end_date, status, completion_rate）

使用方式:
    from lib.domain.performance import PerformanceModule

    module = PerformanceModule()
    module.register_nodes()  # 注册 LangGraph 节点
"""

from __future__ import annotations

from typing import Callable, Dict, List

from lib.domain.base import BaseDomainModule
from lib.domain.performance.nodes import analyze_performance_node
from lib.domain.performance.prompts import (
    PERFORMANCE_SYSTEM_PROMPT,
    PERFORMANCE_DIMENSION_PROMPT,
)


class PerformanceModule(BaseDomainModule):
    """绩效领域模块

    管理绩效指标、能力素质、考核周期三大元模型，
    提供绩效诊断分析节点和配套 AI prompt。
    """

    domain_key: str = "performance"
    display_name: str = "绩效"
    meta_models: List[str] = [
        "Performance_Metric",
        "Competency",
        "Review_Cycle",
    ]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回绩效分析节点映射

        Returns:
            {"analyze_performance": analyze_performance_node}
        """
        return {"analyze_performance": analyze_performance_node}

    def get_meta_model_keys(self) -> List[str]:
        """返回绩效领域管理的内核元模型 key 列表

        Returns:
            ["Performance_Metric", "Competency", "Review_Cycle"]
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回绩效领域 AI prompt 模板

        Returns:
            {
                "system": 绩效分析系统提示词,
                "dimension": 绩效维度分析提示词,
            }
        """
        return {
            "system": PERFORMANCE_SYSTEM_PROMPT,
            "dimension": PERFORMANCE_DIMENSION_PROMPT,
        }
