"""
步骤处理器注册表

通过 register_step() 注册步骤类型处理器，
通过 get_step_handler() 获取处理器实例。
"""
from typing import Dict, Optional, Type
from .step import BaseStepHandler

_step_registry: Dict[str, Type[BaseStepHandler]] = {}


def register_step(step_type: str):
    """
    步骤处理器注册装饰器

    用法:
        @register_step("ai_extract_form")
        class AIExtractFormHandler(BaseStepHandler):
            ...
    """
    def decorator(cls: Type[BaseStepHandler]):
        _step_registry[step_type] = cls
        return cls
    return decorator


def get_step_handler(step_type: str) -> BaseStepHandler:
    """获取步骤处理器实例"""
    cls = _step_registry.get(step_type)
    if not cls:
        raise ValueError(
            f"未注册的步骤类型: {step_type}. "
            f"已注册: {list(_step_registry.keys())}"
        )
    return cls()


def list_registered_steps() -> Dict[str, str]:
    """列出所有已注册的步骤类型"""
    return {
        step_type: handler_cls.__name__
        for step_type, handler_cls in _step_registry.items()
    }
