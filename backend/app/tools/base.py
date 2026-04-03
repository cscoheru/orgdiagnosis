"""
咨询工具抽象基类 — 借鉴 Claude Code Tool.ts 的 buildTool 模式

工具是自描述的（name + description + category），
LangGraph 节点通过 ToolRegistry 发现和调用工具。
"""
from abc import ABC, abstractmethod
from typing import Any

from pydantic import BaseModel


class ToolContext(BaseModel):
    """工具执行上下文"""
    session_id: str
    benchmark_id: str
    project_goal: str
    collected_data: dict[str, Any] = {}
    messages: list[dict] = []
    blueprint: dict = {}
    project_id: str | None = None
    # 额外上下文（不同工具可以传入不同字段）
    extra: dict[str, Any] = {}


class ToolResult(BaseModel):
    """工具执行结果"""
    success: bool = True
    data: dict[str, Any] = {}
    error: str | None = None
    # 追加到 messages 的消息
    message: dict | None = None
    # 追加到 metadata 的数据
    metadata: dict[str, Any] | None = None
    # token 使用量（供 cost_tracker hook 使用）
    token_usage: dict[str, int] = {}


class BaseConsultingTool(ABC):
    """咨询工具抽象基类"""

    name: str = ""
    description: str = ""
    category: str = "analysis"  # analysis | generation | external

    @abstractmethod
    async def execute(self, ctx: ToolContext) -> ToolResult:
        """执行工具，返回结果"""
        ...

    def is_read_only(self) -> bool:
        """工具是否只读（不修改外部状态）"""
        return True

    def get_cost_estimate(self) -> int:
        """预估 token 消耗"""
        return 0
