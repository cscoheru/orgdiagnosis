"""
领域模块基类

所有领域模块 (strategy/, organization/ 等) 继承 BaseDomainModule。
编排器通过基类接口动态发现和组合领域模块。

使用方式:

    class StrategyModule(BaseDomainModule):
        domain_key = "strategy"
        display_name = "战略"
        meta_models = ["Strategic_Goal", "Strategic_Initiative", "Market_Context"]

        def get_analysis_nodes(self):
            return {"analyze_strategy": analyze_strategy_node}

        def get_meta_model_keys(self):
            return self.meta_models

        def get_prompt_templates(self):
            return {"analyze": "你是一位资深战略顾问..."}
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Callable, Dict, List


class BaseDomainModule(ABC):
    """领域模块抽象基类

    每个领域模块必须实现:
    - domain_key: 唯一标识 (用于节点注册和状态索引)
    - display_name: 中文显示名
    - meta_models: 管理的内核元模型 key 列表
    - get_analysis_nodes(): 返回 LangGraph 节点函数映射
    - get_meta_model_keys(): 返回元模型 key 列表
    - get_prompt_templates(): 返回 prompt 模板映射
    """

    domain_key: str
    display_name: str
    meta_models: List[str]

    @abstractmethod
    def get_analysis_nodes(self) -> Dict[str, Callable]:
        """返回领域分析节点映射

        Returns:
            {"node_name": callable, ...}
            callable 签名: async def node(state: WorkflowState) -> WorkflowState
        """
        ...

    @abstractmethod
    def get_meta_model_keys(self) -> List[str]:
        """返回该领域管理的内核元模型 key 列表

        Returns:
            ["Strategic_Goal", "Strategic_Initiative", ...]
        """
        ...

    @abstractmethod
    def get_prompt_templates(self) -> Dict[str, str]:
        """返回领域专属 AI prompt 模板

        Returns:
            {"analyze": "系统提示词...", "synthesis": "..."}
        """
        ...

    def register_nodes(self) -> List[str]:
        """将领域节点注册到全局节点注册表

        Returns:
            注册成功的节点名称列表
        """
        from lib.workflow.node_registry import register_node

        registered = []
        for name, func in self.get_analysis_nodes().items():
            try:
                register_node(name, domain=self.domain_key)(func)
                registered.append(name)
            except ValueError:
                # 已注册，跳过
                pass
        return registered
