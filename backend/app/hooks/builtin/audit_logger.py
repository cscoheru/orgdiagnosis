"""
审计日志 Hook — 记录关键操作（会话创建/结束、报告生成等）
"""
from loguru import logger

from app.hooks.base import BaseHook, HookContext, HookPoint, HookResult
from app.hooks.registry import register_hook


@register_hook(HookPoint.ON_SESSION_START, priority=10)
@register_hook(HookPoint.ON_SESSION_END, priority=10)
class AuditLoggerHook(BaseHook):
    name = "audit_logger"
    hook_point = HookPoint.ON_SESSION_START

    async def execute(self, ctx: HookContext) -> HookResult:
        action = "started" if ctx.hook_point == HookPoint.ON_SESSION_START else "ended"
        logger.info(
            f"[audit] session {ctx.session_id} {action} "
            f"(project={ctx.project_id or 'N/A'})"
        )
        return HookResult(should_continue=True)
