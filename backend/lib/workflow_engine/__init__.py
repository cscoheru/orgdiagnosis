"""
配置驱动工作流引擎

提供统一的工作流管理能力，通过配置定义不同工作流类型。
"""
from .engine import workflow_engine, WorkflowEngine
from .workflow_config import WORKFLOW_CONFIGS, get_workflow_config
from .registry import register_step, get_step_handler, list_registered_steps
from .step import BaseStepHandler, StepResult

__all__ = [
    "workflow_engine",
    "WorkflowEngine",
    "WORKFLOW_CONFIGS",
    "get_workflow_config",
    "register_step",
    "get_step_handler",
    "list_registered_steps",
    "BaseStepHandler",
    "StepResult",
]


def register_all_steps():
    """延迟导入并注册所有步骤处理器"""
    from lib.workflow_engine.steps import ai_extract_form  # noqa: F401
    from lib.workflow_engine.steps import ai_generate  # noqa: F401
    from lib.workflow_engine.steps import ppt_export  # noqa: F401
    from lib.workflow_engine.steps import smart_questionnaire  # noqa: F401
    from lib.workflow_engine.steps import manual_confirm  # noqa: F401
    from lib.workflow_engine.steps import ai_analyze  # noqa: F401
    from lib.workflow_engine.steps import auto_transition  # noqa: F401
    from lib.workflow_engine.steps import manual_edit  # noqa: F401
    from lib.workflow_engine.steps import continuous  # noqa: F401
