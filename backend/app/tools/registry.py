"""
工具注册表 — 复用 workflow_engine/registry.py 的装饰器模式

用法:
  @register_tool
  class MyTool(BaseConsultingTool):
      name = "my_tool"
      ...

  # 调用工具
  result = await call_tool("my_tool", ctx)
"""
from __future__ import annotations

from typing import Any, Type

from loguru import logger

from app.tools.base import BaseConsultingTool, ToolContext, ToolResult

# 已注册的工具类 {name: class}
_tool_registry: dict[str, Type[BaseConsultingTool]] = {}


def register_tool(cls: Type[BaseConsultingTool]) -> Type[BaseConsultingTool]:
    """工具注册装饰器"""
    instance = cls()
    if not instance.name:
        raise ValueError(f"Tool class {cls.__name__} must define a `name` attribute")
    if instance.name in _tool_registry:
        logger.warning(f"Tool '{instance.name}' already registered, overwriting")
    _tool_registry[instance.name] = cls
    logger.debug(f"Registered tool: {instance.name} ({cls.__name__})")
    return cls


def get_tool(name: str) -> BaseConsultingTool:
    """获取工具实例"""
    cls = _tool_registry.get(name)
    if not cls:
        available = list(_tool_registry.keys())
        raise ValueError(f"未注册的工具: {name}. 已注册: {available}")
    return cls()


def list_tools(category: str | None = None) -> list[dict[str, str]]:
    """列出已注册工具"""
    tools = []
    for name, cls in _tool_registry.items():
        inst = cls()
        if category and inst.category != category:
            continue
        tools.append({
            "name": name,
            "description": inst.description,
            "category": inst.category,
        })
    return tools


async def call_tool(name: str, ctx: ToolContext) -> ToolResult:
    """调用工具（hook 拦截点在此注入）"""
    from app.hooks.base import HookContext as HC, HookPoint, HookResult
    from app.hooks.registry import run_hooks

    tool = get_tool(name)

    # BEFORE_TOOL hook
    hook_ctx = HC(
        hook_point=HookPoint.BEFORE_TOOL,
        tool_name=name,
        session_id=ctx.session_id,
        project_id=ctx.project_id or "",
        data={"tool_context": ctx.model_dump()},
    )
    hook_result = await run_hooks(HookPoint.BEFORE_TOOL, hook_ctx)
    if not hook_result.should_continue:
        return ToolResult(
            success=False,
            error=f"被 hook 拦截: {hook_result.message}",
        )
    if hook_result.override_data:
        updated_ctx_data = hook_result.override_data.get("tool_context", {})
        if updated_ctx_data:
            ctx = ToolContext(**updated_ctx_data)

    # 执行工具
    result = await tool.execute(ctx)

    # AFTER_TOOL hook
    hook_ctx = HC(
        hook_point=HookPoint.AFTER_TOOL,
        tool_name=name,
        session_id=ctx.session_id,
        project_id=ctx.project_id or "",
        data={"token_usage": result.token_usage},
    )
    await run_hooks(HookPoint.AFTER_TOOL, hook_ctx)

    return result
