"""
Report Generation Workflow State

Defines the state machine for the Human-in-the-loop report generation process.
"""

from typing import TypedDict, List, Optional, Dict, Any, Annotated
from enum import Enum
from datetime import datetime
import operator


class WorkflowStatus(str, Enum):
    """工作流状态 - 多层扩展版本"""
    PENDING = "pending"                      # 等待开始
    GENERATING_MODULES = "generating_modules"  # 生成模块中 (Step 1)
    MODULES_READY = "modules_ready"            # 模块待审核 ⏸
    GENERATING_PAGE_TITLES = "generating_page_titles"  # 生成页面标题中 (Step 2)
    PAGE_TITLES_READY = "page_titles_ready"    # 页面标题待审核 ⏸
    GENERATING_OUTLINE = "generating_outline"  # 生成大纲中 (兼容旧流程)
    OUTLINE_READY = "outline_ready"            # 大纲待审核 ⏸
    GENERATING_SLIDES = "generating_slides"    # 生成内容中 (Step 3)
    SLIDES_READY = "slides_ready"              # 内容待审核 ⏸
    READY_FOR_EXPORT = "ready_for_export"      # 准备导出
    EXPORTING = "exporting"                    # 导出中
    COMPLETED = "completed"                    # 完成
    FAILED = "failed"                          # 失败
    CANCELLED = "cancelled"                    # 已取消


class ReportState(TypedDict):
    """
    报告生成工作流状态 - 多层扩展版本

    使用 LangGraph 管理整个生成流程，支持中断恢复。

    多层扩展流程:
    Step 1: Modules (模块定义) - 5-8 个核心模块
    Step 2: Page Titles (页面标题) - 每个模块 2-4 页
    Step 3: Page Content (页面内容) - 完整的 elements 和 layout
    """
    # === 任务标识 ===
    task_id: str                                    # 任务唯一ID
    status: WorkflowStatus                          # 当前状态
    created_at: str                                 # 创建时间
    updated_at: str                                 # 更新时间

    # === 输入数据 ===
    requirement: Optional[Dict[str, Any]]            # ClientRequirement JSON
    five_d_diagnosis: Optional[Dict[str, Any]]       # 五维诊断结果 (可选)

    # === 多层扩展 Step 1: 模块定义 ===
    modules: Optional[List[Dict[str, Any]]]          # ModuleSchema 列表
    modules_confirmed: bool                          # 模块是否已确认
    modules_confirmed_at: Optional[str]              # 模块确认时间

    # === 多层扩展 Step 2: 页面标题 ===
    page_titles: Optional[List[Dict[str, Any]]]      # PageTitleSchema 列表
    page_titles_confirmed: bool                      # 页面标题是否已确认
    page_titles_confirmed_at: Optional[str]          # 页面标题确认时间

    # === 大纲阶段 (兼容旧流程) ===
    outline: Optional[Dict[str, Any]]                # ReportOutline
    outline_confirmed: bool                          # 大纲是否已确认
    outline_confirmed_at: Optional[str]              # 大纲确认时间

    # === 内容生成阶段 (Step 3) ===
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
    """创建初始状态 - 多层扩展版本"""
    now = datetime.now().isoformat()
    return ReportState(
        task_id=task_id,
        status=WorkflowStatus.PENDING,
        created_at=now,
        updated_at=now,
        requirement=requirement,
        five_d_diagnosis=five_d_diagnosis,
        # 多层扩展 Step 1: 模块
        modules=None,
        modules_confirmed=False,
        modules_confirmed_at=None,
        # 多层扩展 Step 2: 页面标题
        page_titles=None,
        page_titles_confirmed=False,
        page_titles_confirmed_at=None,
        # 大纲 (兼容旧流程)
        outline=None,
        outline_confirmed=False,
        outline_confirmed_at=None,
        # 内容生成
        current_section=None,
        completed_sections=[],
        slides=None,
        slides_confirmed=False,
        slides_confirmed_at=None,
        # 导出
        pptx_path=None,
        exported_at=None,
        # 进度
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
    """根据状态获取进度百分比 - 多层扩展版本"""
    progress_map = {
        WorkflowStatus.PENDING: 0.0,
        # 多层扩展 Step 1: 模块
        WorkflowStatus.GENERATING_MODULES: 10.0,
        WorkflowStatus.MODULES_READY: 15.0,
        # 多层扩展 Step 2: 页面标题
        WorkflowStatus.GENERATING_PAGE_TITLES: 20.0,
        WorkflowStatus.PAGE_TITLES_READY: 25.0,
        # 兼容旧流程
        WorkflowStatus.GENERATING_OUTLINE: 20.0,
        WorkflowStatus.OUTLINE_READY: 25.0,
        # Step 3: 内容生成
        WorkflowStatus.GENERATING_SLIDES: 50.0,
        WorkflowStatus.SLIDES_READY: 80.0,
        # 导出
        WorkflowStatus.READY_FOR_EXPORT: 90.0,
        WorkflowStatus.EXPORTING: 95.0,
        WorkflowStatus.COMPLETED: 100.0,
        WorkflowStatus.FAILED: 0.0,
        WorkflowStatus.CANCELLED: 0.0,
    }
    return progress_map.get(status, 0.0)
