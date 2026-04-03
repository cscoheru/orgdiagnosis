"""
Hook 系统
"""
from app.hooks.base import BaseHook, HookContext, HookPoint, HookResult
from app.hooks.registry import list_hooks, register_hook, run_hooks

__all__ = [
    "BaseHook",
    "HookContext",
    "HookPoint",
    "HookResult",
    "list_hooks",
    "register_hook",
    "run_hooks",
]
