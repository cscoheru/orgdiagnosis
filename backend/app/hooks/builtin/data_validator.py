"""
数据验证 Hook — 在 BEFORE_NODE 时验证用户提交数据的完整性
"""
from loguru import logger

from app.hooks.base import BaseHook, HookContext, HookPoint, HookResult
from app.hooks.registry import register_hook


@register_hook(HookPoint.BEFORE_NODE, priority=50)
class DataValidatorHook(BaseHook):
    name = "data_validator"
    hook_point = HookPoint.BEFORE_NODE

    async def execute(self, ctx: HookContext) -> HookResult:
        # 只在 collect_node 执行前验证
        if ctx.node_name != "collect_node":
            return HookResult(should_continue=True)

        user_data = ctx.data.get("__user_data__", {})
        if not user_data:
            return HookResult(
                should_continue=False,
                message="未收到用户数据",
            )

        # 检查是否有空值（允许空字符串，但不允许 None）
        warnings = []
        for key, value in user_data.items():
            if value is None:
                warnings.append(f"字段 {key} 的值为空")

        if warnings:
            logger.warning(f"[data_validator] {len(warnings)} warnings: {warnings}")
            # 不阻断，只记录警告
            return HookResult(should_continue=True, message="; ".join(warnings))

        return HookResult(should_continue=True)
