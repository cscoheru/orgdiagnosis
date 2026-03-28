"""
工作流步骤处理器基类

每种步骤类型实现 execute() 方法，接收当前步骤输入数据，
返回步骤输出数据。引擎负责状态管理和步骤推进。
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from pydantic import BaseModel


class StepResult(BaseModel):
    """步骤执行结果"""
    success: bool = True
    data: Dict[str, Any] = {}
    error: Optional[str] = None
    requires_input: bool = False  # 是否需要人工输入才能继续


class BaseStepHandler(ABC):
    """步骤处理器基类"""

    @abstractmethod
    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        """
        执行步骤

        Args:
            step_id: 步骤标识
            input_data: 步骤输入数据 (含前置步骤输出 + 人工编辑数据)
            context: 全局上下文 (project_id, workflow_type, 所有步骤历史数据)

        Returns:
            StepResult: 步骤执行结果
        """
        ...

    @abstractmethod
    async def validate_input(
        self,
        step_id: str,
        input_data: Dict[str, Any],
    ) -> Optional[str]:
        """
        校验步骤输入

        Returns:
            错误信息字符串，None 表示校验通过
        """
        ...

    def get_description(self, step_id: str) -> str:
        """返回步骤描述 (用于前端展示)"""
        return f"步骤: {step_id}"
