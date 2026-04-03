"""
Hook 注册表 — 优先级排序 + 短路执行 + 数据修改

用法:
  @register_hook(HookPoint.AFTER_TOOL, priority=10)
  class CostTrackerHook(BaseHook):
      name = "cost_tracker"
      ...

  # 执行所有 hook
  result = await run_hooks(HookPoint.AFTER_TOOL, ctx)
"""
from __future__ import annotations

from typing import Type

from loguru import logger

from app.hooks.base import BaseHook, HookContext, HookPoint, HookResult

# {hook_point: [{"cls": cls, "priority": int}, ...]}
_hook_registry: dict[HookPoint, list[dict]] = {point: [] for point in HookPoint}


def register_hook(
    point: HookPoint,
    priority: int = 100,
) -> callable:
    """Hook 注册装饰器"""
    def decorator(cls: Type[BaseHook]) -> Type[BaseHook]:
        instance = cls()
        entry = {"cls": cls, "priority": priority}
        _hook_registry[point].append(entry)
        _hook_registry[point].sort(key=lambda x: x["priority"])
        logger.debug(
            f"Registered hook: {instance.name or cls.__name__} "
            f"at {point.value} (priority={priority})"
        )
        return cls
    return decorator


async def run_hooks(point: HookPoint, ctx: HookContext) -> HookResult:
    """
    按优先级顺序执行所有 hook。

    任一 hook 返回 continue=False 则短路（不执行后续 hook）。
    hook 可以通过 override_data 修改上下文数据。
    """
    for entry in _hook_registry.get(point, []):
        hook = entry["cls"]()
        try:
            result = await hook.execute(ctx)
            if not result.should_continue:
                logger.debug(
                    f"Hook {hook.name or hook.__class__.__name__} "
                    f"short-circuited at {point.value}"
                )
                return result
            if result.override_data:
                ctx.data.update(result.override_data)
        except Exception as e:
            logger.error(
                f"Hook {hook.name or hook.__class__.__name__} failed: {e}"
            )
            # Hook 异常不阻断链路，继续执行后续 hook

    return HookResult(should_continue=True)


def list_hooks(point: HookPoint | None = None) -> list[dict]:
    """列出已注册的 hook"""
    result = []
    points = [point] if point else list(HookPoint)
    for p in points:
        for entry in _hook_registry.get(p, []):
            inst = entry["cls"]()
            result.append({
                "name": inst.name or inst.__class__.__name__,
                "hook_point": p.value,
                "priority": entry["priority"],
            })
    return sorted(result, key=lambda x: x["priority"])
