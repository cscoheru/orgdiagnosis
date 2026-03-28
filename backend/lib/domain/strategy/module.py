"""
战略领域模块

StrategyModule 继承 BaseDomainModule，向编排器注册战略维度的
分析节点、元模型和 AI 提示词模板。
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from lib.domain.base import BaseDomainModule

from .nodes import analyze_strategy_node
from .prompts import STRATEGY_SYSTEM_PROMPT, STRATEGY_DIMENSION_PROMPT


class StrategyModule(BaseDomainModule):
    """战略领域模块

    管理战略维度的分析逻辑，包括：
    - 战略目标 (Strategic_Goal)
    - 战略举措 (Strategic_Initiative)
    - 市场环境 (Market_Context)
    """

    domain_key: str = "strategy"
    display_name: str = "战略"
    meta_models: List[str] = ["Strategic_Goal", "Strategic_Initiative", "Market_Context"]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回战略领域的分析节点映射

        Returns:
            {"analyze_strategy": analyze_strategy_node}
        """
        return {"analyze_strategy": analyze_strategy_node}

    def get_meta_model_keys(self) -> List[str]:
        """返回战略领域管理的内核元模型 key 列表

        Returns:
            ["Strategic_Goal", "Strategic_Initiative", "Market_Context"]
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回战略领域专属 AI 提示词模板

        Returns:
            {"system": 系统提示词, "dimension": 维度分析提示词}
        """
        return {
            "system": STRATEGY_SYSTEM_PROMPT,
            "dimension": STRATEGY_DIMENSION_PROMPT,
        }
