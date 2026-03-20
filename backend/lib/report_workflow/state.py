"""
Report Generation Workflow State

Defines the state machine for the Human-in-the-loop report generation process.
"""

from typing import TypedDict, List, Optional, Dict, Any, Annotated
from enum import Enum
from datetime import datetime
import operator


class WorkflowStatus(str, Enum):
    """工作流状态"""
    PENDING = "pending"                      # 等待开始
    GENERATING_OUTLINE = "generating_outline"  # 生成大纲中
    OUTLINE_READY = "outline_ready"            # 大纲待审核 ⏸
    GENERATING_SLIDES = "generating_slides"    # 生成内容中
    SLIDES_READY = "slides_ready"              # 内容待审核 ⏸
    READY_FOR_EXPORT = "ready_for_export"      # 准备导出
    EXPORTING = "exporting"                    # 导出中
    COMPLETED = "completed"                    # 完成
    FAILED = "failed"                          # 失败
    CANCELLED = "cancelled"                    # 已取消


class ReportState(TypedDict):
    """
    报告生成工作流状态

    使用 LangGraph 管理整个生成流程，支持中断恢复。
    """
    # === 任务标识 ===
    task_id: str                                    # 任务唯一ID
    status: WorkflowStatus                          # 当前状态
    created_at: str                                 # 创建时间
    updated_at: str                                 # 更新时间

    # === 输入数据 ===
    requirement: Optional[Dict[str, Any]]            # ClientRequirement JSON
    five_d_diagnosis: Optional[Dict[str, Any]]       # 五维诊断结果 (可选)

    # === 大纲阶段 ===
    outline: Optional[Dict[str, Any]]                # ReportOutline
    outline_confirmed: bool                          # 大纲是否已确认
    outline_confirmed_at: Optional[str]              # 大纲确认时间

    # === 内容生成阶段 ===
    current_section: Optional[str]                  # 当前正在生成的部分
    completed_sections: Annotated[List[str], operator.add]  # 已完成的部分
    slides: Optional[List[Dict[str, Any]]]           # SlideDraft 列表
    slides_confirmed: bool                           # 内容是否已确认
    slides_confirmed_at: Optional[str]              # 内容确认时间

    # === 导出阶段 ===
    pptx_path: Optional[str]                        # 生成的 PPTX 文件路径
    exported_at: Optional[str]                      # 导出时间

    # === 进度追踪 ===
    progress_percentage: float                      # 进度百分比
    error_message: Optional[str]                    # 错误信息
    error_step: Optional[str]                       # 出错的步骤

    # === LlamaIndex 上下文 ===
    retrieved_evidence: Optional[List[Dict[str, Any]]]  # 检索到的证据


def create_initial_state(
    task_id: str,
    requirement: Dict[str, Any],
    five_d_diagnosis: Optional[Dict[str, Any]] = None
) -> ReportState:
    """创建初始状态"""
    now = datetime.now().isoformat()
    return ReportState(
        task_id=task_id,
        status=WorkflowStatus.PENDING,
        created_at=now,
        updated_at=now,
        requirement=requirement,
        five_d_diagnosis=five_d_diagnosis,
        outline=None,
        outline_confirmed=False,
        outline_confirmed_at=None,
        current_section=None,
        completed_sections=[],
        slides=None,
        slides_confirmed=False,
        slides_confirmed_at=None,
        pptx_path=None,
        exported_at=None,
        progress_percentage=0.0,
        error_message=None,
        error_step=None,
        retrieved_evidence=None,
    )


def update_state(
    state: ReportState,
    **updates
) -> ReportState:
    """更新状态"""
    return ReportState(
        **{
            **state,
            **updates,
            "updated_at": datetime.now().isoformat()
        }
    )


def mark_error(state: ReportState, error_message: str, error_step: str) -> ReportState:
    """标记错误状态"""
    return update_state(
        state,
        status=WorkflowStatus.FAILED,
        error_message=error_message,
        error_step=error_step,
    )


def get_progress_for_status(status: WorkflowStatus) -> float:
    """根据状态获取进度百分比"""
    progress_map = {
        WorkflowStatus.PENDING: 0.0,
        WorkflowStatus.GENERATING_OUTLINE: 20.0,
        WorkflowStatus.OUTLINE_READY: 25.0,
        WorkflowStatus.GENERATING_SLIDES: 50.0,
        WorkflowStatus.SLIDES_READY: 80.0,
        WorkflowStatus.READY_FOR_EXPORT: 90.0,
        WorkflowStatus.EXPORTING: 95.0,
        WorkflowStatus.COMPLETED: 100.0,
        WorkflowStatus.FAILED: 0.0,
        WorkflowStatus.CANCELLED: 0.0,
    }
    return progress_map.get(status, 0.0)
