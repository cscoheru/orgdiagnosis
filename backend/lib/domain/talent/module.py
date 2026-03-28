"""
人才领域模块 (TalentModule)

继承 BaseDomainModule，注册人才领域相关的:
- LangGraph 分析节点
- 内核元模型 (Employee / Talent_Pipeline / Learning_Development)
- AI prompt 模板
"""

from __future__ import annotations

from typing import Callable, Dict, List

from lib.domain.base import BaseDomainModule
from lib.domain.talent.nodes import analyze_talent_node
from lib.domain.talent.prompts import TALENT_SYSTEM_PROMPT, TALENT_DIMENSION_PROMPT


class TalentModule(BaseDomainModule):
    """人才领域模块

    负责人才盘点、继任计划、学习发展等人才管理领域的分析。
    通过 BaseDomainModule 接口被编排器动态发现和组合。
    """

    domain_key: str = "talent"
    display_name: str = "人才"
    meta_models: List[str] = [
        "Employee",
        "Talent_Pipeline",
        "Learning_Development",
    ]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回人才领域分析节点映射

        Returns:
            {"analyze_talent": analyze_talent_node}
        """
        return {"analyze_talent": analyze_talent_node}

    def get_meta_model_keys(self) -> List[str]:
        """返回人才领域管理的内核元模型 key 列表

        Returns:
            ["Employee", "Talent_Pipeline", "Learning_Development"]
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回人才领域 AI prompt 模板

        Returns:
            {"system": TALENT_SYSTEM_PROMPT, "dimension": TALENT_DIMENSION_PROMPT}
        """
        return {
            "system": TALENT_SYSTEM_PROMPT,
            "dimension": TALENT_DIMENSION_PROMPT,
        }
