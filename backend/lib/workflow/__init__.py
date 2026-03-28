"""
ConsultingOS 工作流框架

连接"内核数据层"和"AI 分析层"的桥梁。
提供基础状态、内核桥接、节点注册表。
"""

from lib.workflow.base_state import (
    WorkflowState,
    create_workflow_state,
    track_kernel_object,
    track_kernel_relation,
    set_domain_result,
)
from lib.workflow.kernel_bridge import KernelBridge
from lib.workflow.node_registry import register_node, get_nodes_by_domain, get_all_domains

__all__ = [
    "WorkflowState",
    "create_workflow_state",
    "track_kernel_object",
    "track_kernel_relation",
    "set_domain_result",
    "KernelBridge",
    "register_node",
    "get_nodes_by_domain",
    "get_all_domains",
]
