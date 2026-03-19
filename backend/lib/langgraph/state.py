"""
LangGraph State Definition for Five-Dimensional Diagnosis

This module defines the state machine state for the diagnostic workflow.
"""

from typing import TypedDict, List, Dict, Any, Optional
from enum import Enum
from datetime import datetime


class WorkflowStatus(str, Enum):
    """工作流状态"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class DiagnosticState(TypedDict, total=False):
    """
    诊断工作流状态

    这个状态在整个 LangGraph 工作流中传递和更新。
    """

    # === 核心标识 ===
    task_id: str
    status: str

    # === 输入数据 ===
    raw_text: str
    file_path: str

    # === 处理中间状态 ===
    documents: List[Any]  # 分片后的文档
    vectorstore_info: Dict[str, Any]  # 向量存储信息

    # === 五维结果 ===
    strategy_result: Optional[Dict[str, Any]]
    structure_result: Optional[Dict[str, Any]]
    performance_result: Optional[Dict[str, Any]]
    compensation_result: Optional[Dict[str, Any]]
    talent_result: Optional[Dict[str, Any]]

    # === 进度追踪 ===
    current_dimension: str
    completed_dimensions: List[str]
    progress_percentage: float

    # === 最终报告 ===
    final_report: Optional[Dict[str, Any]]
    overall_score: float

    # === 错误处理 ===
    error: Optional[str]
    error_step: Optional[str]

    # === 元数据 ===
    created_at: Optional[str]
    updated_at: Optional[str]
    retry_count: int


def create_initial_state(
    task_id: str,
    raw_text: str = "",
    file_path: str = ""
) -> DiagnosticState:
    """
    创建初始状态

    Args:
        task_id: 任务 ID
        raw_text: 原始文本
        file_path: 文件路径

    Returns:
        初始化的状态字典
    """
    now = datetime.now().isoformat()

    return DiagnosticState(
        task_id=task_id,
        status=WorkflowStatus.PENDING.value,
        raw_text=raw_text,
        file_path=file_path,
        documents=[],
        vectorstore_info={},
        strategy_result=None,
        structure_result=None,
        performance_result=None,
        compensation_result=None,
        talent_result=None,
        current_dimension="",
        completed_dimensions=[],
        progress_percentage=0.0,
        final_report=None,
        overall_score=0.0,
        error=None,
        error_step=None,
        created_at=now,
        updated_at=now,
        retry_count=0,
    )


def mark_dimension_complete(
    state: DiagnosticState,
    dimension: str,
    result: Dict[str, Any]
) -> DiagnosticState:
    """
    标记维度完成

    Args:
        state: 当前状态
        dimension: 完成的维度
        result: 该维度的分析结果

    Returns:
        更新后的状态
    """
    completed = state.get("completed_dimensions", []) or []
    if dimension not in completed:
        completed = completed + [dimension]

    # 更新对应维度的结果
    result_key = f"{dimension}_result"

    return {
        **state,
        "completed_dimensions": completed,
        result_key: result,
        "progress_percentage": len(completed) * 20,  # 5 个维度，每个 20%
        "updated_at": datetime.now().isoformat(),
    }


def mark_error(
    state: DiagnosticState,
    error: str,
    step: Optional[str] = None
) -> DiagnosticState:
    """
    标记错误

    Args:
        state: 当前状态
        error: 错误信息
        step: 错误发生的步骤

    Returns:
        更新后的状态
    """
    return {
        **state,
        "status": WorkflowStatus.FAILED.value,
        "error": error,
        "error_step": step,
        "updated_at": datetime.now().isoformat(),
    }


def update_progress(
    state: DiagnosticState,
    current_dimension: str,
    progress_percentage: float
) -> DiagnosticState:
    """
    更新进度

    Args:
        state: 当前状态
        current_dimension: 当前处理的维度
        progress_percentage: 进度百分比

    Returns:
        更新后的状态
    """
    return {
        **state,
        "current_dimension": current_dimension,
        "progress_percentage": progress_percentage,
        "updated_at": datetime.now().isoformat(),
    }
