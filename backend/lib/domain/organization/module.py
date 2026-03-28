"""
组织领域模块

实现 BaseDomainModule 接口，注册组织领域的 LangGraph 节点、元模型和 AI prompt。
供编排器动态发现和组合。

元模型:
- Org_Unit: 组织单元 (事业部/职能中心/子公司/项目组)
- Job_Role: 岗位角色 (管理M/专业P/操作O/营销S)
- Process_Flow: 业务流程

分析节点:
- analyze_structure: 组织结构综合诊断
"""

from __future__ import annotations

from typing import Any, Callable, Dict, List

from lib.domain.base import BaseDomainModule

from .nodes import analyze_structure_node
from .prompts import (
    ORGANIZATION_SYSTEM_PROMPT,
    ORGANIZATION_DIMENSION_PROMPT,
)


class OrganizationModule(BaseDomainModule):
    """组织领域模块

    管理组织结构相关的元模型、分析节点和 AI 提示词。
    domain_key 使用 "structure" 以匹配工作流状态索引。
    """

    domain_key: str = "structure"
    display_name: str = "组织"
    meta_models: List[str] = ["Org_Unit", "Job_Role", "Process_Flow"]

    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回组织领域的分析节点映射

        Returns:
            {"analyze_structure": analyze_structure_node}
        """
        return {"analyze_structure": analyze_structure_node}

    def get_meta_model_keys(self) -> List[str]:
        """返回组织领域管理的元模型 key 列表

        Returns:
            ["Org_Unit", "Job_Role", "Process_Flow"]
        """
        return self.meta_models

    def get_prompt_templates(self) -> Dict[str, str]:
        """返回组织领域的 AI prompt 模板

        Returns:
            {"system": "...", "dimension": "..."}
        """
        return {
            "system": ORGANIZATION_SYSTEM_PROMPT,
            "dimension": ORGANIZATION_DIMENSION_PROMPT,
        }
