"""
Hook 基类 — 借鉴 Claude Code src/hooks/ 的 PreToolUse/PostToolUse 模式

关键设计：
  - 优先级排序（priority）决定执行顺序
  - 短路执行（continue=False）阻止后续 hook 和节点执行
  - 可修改数据（override_data）替换上下文
"""
from abc import ABC, abstractmethod
from enum import Enum
from typing import Any

from pydantic import BaseModel


class HookPoint(str, Enum):
    """Hook 拦截点"""
    BEFORE_NODE = "before_node"
    AFTER_NODE = "after_node"
    BEFORE_TOOL = "before_tool"
    AFTER_TOOL = "after_tool"
    ON_ERROR = "on_error"
    ON_SESSION_START = "on_session_start"
    ON_SESSION_END = "on_session_end"


class HookContext(BaseModel):
    """Hook 上下文"""
    hook_point: HookPoint
    node_name: str = ""
    tool_name: str = ""
    session_id: str = ""
    project_id: str = ""
    data: dict[str, Any] = {}


class HookResult(BaseModel):
    """Hook 执行结果"""
    should_continue: bool = True
    override_data: dict[str, Any] = {}
    message: str = ""


class BaseHook(ABC):
    """Hook 抽象基类"""

    name: str = ""
    hook_point: HookPoint = HookPoint.BEFORE_NODE
    priority: int = 100

    @abstractmethod
    async def execute(self, ctx: HookContext) -> HookResult:
        ...
