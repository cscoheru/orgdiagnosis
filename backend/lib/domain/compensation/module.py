"""
薪酬领域模块

CompensationModule(BaseDomainModule) — 薪酬领域的自包含模块。
注册 LangGraph 分析节点、元模型定义和 AI Prompt 模板。
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from lib.domain.base import BaseDomainModule

from lib.domain.compensation.prompts import (
    COMPENSATION_SYSTEM_PROMPT,
    COMPENSATION_DIMENSION_PROMPT,
)
from lib.domain.compensation.nodes import analyze_compensation_node


class CompensationModule(BaseDomainModule):
    """薪酬领域模块

    管理薪酬策略、薪酬结构和市场对标分析。
    对应三个内核元模型: Salary_Band, Pay_Component, Market_Benchmark。
    """

    domain_key: str = "compensation"
    display_name: str = "薪酬"

    # 该领域管理的内核元模型 key 列表
    meta_models: List[str] = [
        "Salary_Band",
        "Pay_Component",
        "Market_Benchmark",
    ]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回薪酬领域分析节点映射

        Returns:
            {"analyze_compensation": analyze_compensation_node}
        """
        return {
            "analyze_compensation": analyze_compensation_node,
        }

    def get_meta_model_keys(self) -> List[str]:
        """返回薪酬领域管理的内核元模型 key 列表

        Returns:
            ["Salary_Band", "Pay_Component", "Market_Benchmark"]
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回薪酬领域专属 AI prompt 模板

        Returns:
            {
                "system": COMPENSATION_SYSTEM_PROMPT,
                "dimension": COMPENSATION_DIMENSION_PROMPT,
            }
        """
        return {
            "system": COMPENSATION_SYSTEM_PROMPT,
            "dimension": COMPENSATION_DIMENSION_PROMPT,
        }
