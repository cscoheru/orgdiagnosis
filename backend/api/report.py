"""
Report Generation API Endpoints

FastAPI endpoints for the Human-in-the-loop report generation workflow.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from loguru import logger

router = APIRouter(prefix="/report", tags=["report"])


# === Request/Response Models ===

class StartReportRequest(BaseModel):
    """启动报告生成请求"""
    requirement: Dict[str, Any]  # ClientRequirement JSON
    five_d_diagnosis: Optional[Dict[str, Any]] = None


class StartReportResponse(BaseModel):
    """启动报告生成响应"""
    success: bool
    task_id: str
    message: str


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    progress_percentage: float
    created_at: str
    updated_at: str
    error_message: Optional[str] = None


class OutlineResponse(BaseModel):
    """大纲响应"""
    task_id: str
    outline: Dict[str, Any]
    estimated_slides: int


class ConfirmOutlineRequest(BaseModel):
    """确认大纲请求"""
    task_id: str
    modified_outline: Optional[Dict[str, Any]] = None


class SlidesResponse(BaseModel):
    """内容响应"""
    task_id: str
    slides: List[Dict[str, Any]]
    total_slides: int


class ConfirmSlidesRequest(BaseModel):
    """确认内容请求"""
    task_id: str
    modified_slides: Optional[List[Dict[str, Any]]] = None


# === API Endpoints ===

@router.post("/start", response_model=StartReportResponse)
async def start_report(request: StartReportRequest):
    """
    启动报告生成任务

    接收客户需求，开始生成流程，返回 task_id。
    工作流会在大纲生成后暂停，等待人工确认。
    """
    from lib.report_workflow import get_workflow_manager

    try:
        manager = get_workflow_manager()
        task_id = manager.start_task(
            requirement=request.requirement,
            five_d_diagnosis=request.five_d_diagnosis
        )

        return StartReportResponse(
            success=True,
            task_id=task_id,
            message="任务已启动，大纲生成中..."
        )

    except Exception as e:
        logger.error(f"Failed to start report: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    获取任务状态

    返回任务当前状态、进度、错误信息等。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    return TaskStatusResponse(
        task_id=task_id,
        status=task["status"],
        progress_percentage=task["progress_percentage"],
        created_at=task["created_at"],
        updated_at=task["updated_at"],
        error_message=task.get("error_message"),
    )


@router.get("/outline/{task_id}", response_model=OutlineResponse)
async def get_outline(task_id: str):
    """
    获取生成的大纲

    仅当状态为 outline_ready 时返回大纲。
    """
    from lib.report_workflow import get_workflow_manager, WorkflowStatus

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task["status"] != WorkflowStatus.OUTLINE_READY.value:
        raise HTTPException(
            status_code=400,
            detail=f"大纲尚未就绪，当前状态: {task['status']}"
        )

    outline = task.get("outline", {})

    return OutlineResponse(
        task_id=task_id,
        outline=outline,
        estimated_slides=outline.get("estimated_slides", 0),
    )


@router.post("/confirm-outline")
async def confirm_outline(request: ConfirmOutlineRequest):
    """
    确认大纲

    用户确认或修改大纲后，继续生成内容。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()

    success = manager.confirm_outline(
        task_id=request.task_id,
        modified_outline=request.modified_outline
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="无法确认大纲，请检查任务状态"
        )

    return {
        "success": True,
        "task_id": request.task_id,
        "message": "大纲已确认，内容生成中..."
    }


@router.get("/slides/{task_id}", response_model=SlidesResponse)
async def get_slides(task_id: str):
    """
    获取生成的内容

    仅当状态为 slides_ready 时返回内容。
    """
    from lib.report_workflow import get_workflow_manager, WorkflowStatus

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task["status"] != WorkflowStatus.SLIDES_READY.value:
        raise HTTPException(
            status_code=400,
            detail=f"内容尚未就绪，当前状态: {task['status']}"
        )

    slides = task.get("slides", [])

    return SlidesResponse(
        task_id=task_id,
        slides=slides,
        total_slides=len(slides),
    )


@router.post("/confirm-slides")
async def confirm_slides(request: ConfirmSlidesRequest):
    """
    确认内容

    用户确认或修改内容后，导出 PPTX。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()

    success = manager.confirm_slides(
        task_id=request.task_id,
        modified_slides=request.modified_slides
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="无法确认内容，请检查任务状态"
        )

    return {
        "success": True,
        "task_id": request.task_id,
        "message": "内容已确认，正在导出 PPTX..."
    }


@router.get("/export/{task_id}")
async def export_pptx(task_id: str):
    """
    导出 PPTX 文件

    仅当状态为 completed 时返回文件下载。
    """
    from lib.report_workflow import get_workflow_manager, WorkflowStatus

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    if task["status"] != WorkflowStatus.COMPLETED.value:
        raise HTTPException(
            status_code=400,
            detail=f"报告尚未完成，当前状态: {task['status']}"
        )

    pptx_path = task.get("pptx_path")
    if not pptx_path:
        raise HTTPException(status_code=500, detail="PPTX 文件路径不存在")

    return FileResponse(
        path=pptx_path,
        filename=f"consulting_report_{task_id}.pptx",
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation"
    )


@router.get("/tasks")
async def list_tasks():
    """
    列出所有任务

    用于调试和监控。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()
    tasks = manager.list_tasks()

    return {
        "tasks": tasks,
        "count": len(tasks)
    }


@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """
    取消任务

    标记任务为已取消状态。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()
    success = manager.cancel_task(task_id)

    if not success:
        raise HTTPException(status_code=404, detail="任务不存在")

    return {
        "success": True,
        "task_id": task_id,
        "message": "任务已取消"
    }
