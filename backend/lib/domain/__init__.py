"""
ConsultingOS 领域模块

五大咨询领域 (战略/组织/绩效/薪酬/人才) 的自包含模块。
每个模块注册自己的 LangGraph 节点、元模型和 AI prompt。
"""

from lib.domain.base import BaseDomainModule

__all__ = ["BaseDomainModule"]
