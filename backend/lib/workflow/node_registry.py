"""
领域节点自动发现与注册表

各领域模块 (strategy/, organization/ 等) 在 import 时通过 @register_node
装饰器注册自己的 LangGraph 节点。编排器通过注册表动态发现可用节点，
实现领域模块的热插拔。

使用方式 (领域模块中):

    from lib.workflow.node_registry import register_node

    @register_node("analyze_strategy", domain="strategy")
    async def analyze_strategy(state: WorkflowState) -> WorkflowState:
        ...

    @register_node("build_org_graph", domain="organization")
    async def build_org_graph(state: WorkflowState) -> WorkflowState:
        ...

使用方式 (编排器中):

    from lib.workflow.node_registry import get_nodes_by_domain

    strategy_nodes = get_nodes_by_domain("strategy")
    # → {"analyze_strategy": <function>, ...}
"""

from __future__ import annotations

from typing import Any, Callable


# ──────────────────────────────────────────────
# 全局注册表
# ──────────────────────────────────────────────

# {node_name: {"func": callable, "domain": str}}
_REGISTRY: dict[str, dict[str, Any]] = {}


# ──────────────────────────────────────────────
# 公共 API
# ──────────────────────────────────────────────

def register_node(
    name: str,
    *,
    domain: str,
) -> Callable[[Callable], Callable]:
    """装饰器: 注册一个领域节点到全局注册表

    Args:
        name: 节点名称 (唯一标识，如 "analyze_strategy")
        domain: 领域标识 (如 "strategy", "organization")

    Returns:
        原函数不变

    Raises:
        ValueError: name 已被注册
    """
    if name in _REGISTRY:
        raise ValueError(
            f"Node '{name}' already registered by domain '{_REGISTRY[name]['domain']}'"
        )

    def decorator(func: Callable) -> Callable:
        _REGISTRY[name] = {"func": func, "domain": domain}
        return func

    return decorator


def get_available_nodes() -> dict[str, dict[str, Any]]:
    """返回所有已注册节点

    Returns:
        {"node_name": {"func": callable, "domain": str}, ...}
    """
    return dict(_REGISTRY)


def get_nodes_by_domain(domain_key: str) -> dict[str, Callable]:
    """返回指定领域的已注册节点

    Args:
        domain_key: 领域标识 (如 "strategy")

    Returns:
        {"node_name": callable, ...}
    """
    return {
        name: entry["func"]
        for name, entry in _REGISTRY.items()
        if entry["domain"] == domain_key
    }


def get_all_domains() -> list[str]:
    """返回所有已注册领域的去重列表

    Returns:
        ["strategy", "organization", ...]
    """
    return sorted({entry["domain"] for entry in _REGISTRY.values()})
