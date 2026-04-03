"""
成本追踪 Hook — 记录每次 AI 调用的 token 消耗
"""
from loguru import logger

from app.hooks.base import BaseHook, HookContext, HookPoint, HookResult
from app.hooks.registry import register_hook


@register_hook(HookPoint.AFTER_TOOL, priority=10)
class CostTrackerHook(BaseHook):
    name = "cost_tracker"
    hook_point = HookPoint.AFTER_TOOL

    async def execute(self, ctx: HookContext) -> HookResult:
        tool_name = ctx.tool_name
        token_usage = ctx.data.get("token_usage", {})
        if token_usage:
            input_tokens = token_usage.get("input_tokens", 0)
            output_tokens = token_usage.get("output_tokens", 0)
            logger.info(
                f"[cost_tracker] {tool_name}: "
                f"input={input_tokens} output={output_tokens}"
            )
        return HookResult(should_continue=True)
