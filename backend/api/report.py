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


# === Multi-Level Expansion Models ===

class ModulesResponse(BaseModel):
    """模块列表响应"""
    task_id: str
    modules: List[Dict[str, Any]]
    total_modules: int


class ConfirmModulesRequest(BaseModel):
    """确认模块请求"""
    task_id: str
    modified_modules: Optional[List[Dict[str, Any]]] = None


class PageTitlesResponse(BaseModel):
    """页面标题列表响应"""
    task_id: str
    page_titles: List[Dict[str, Any]]
    total_pages: int


class ModulesResponse(BaseModel):
    """模块列表响应"""
    task_id: str
    modules: List[Dict[str, Any]]
    total_modules: int


class ConfirmPageTitlesRequest(BaseModel):
    """确认页面标题请求"""
    task_id: str
    modified_page_titles: Optional[List[Dict[str, Any]]] = None


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
        task_id = await manager.start_task(
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

    success = await manager.confirm_outline(
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

    # Accept both SLIDES_READY and COMPLETED status
    valid_statuses = [
        WorkflowStatus.SLIDES_READY.value,
        WorkflowStatus.COMPLETED.value,
    ]
    if task["status"] not in valid_statuses:
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

    success = await manager.confirm_slides(
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


# === Multi-Level Expansion Endpoints ===

@router.get("/modules/{task_id}", response_model=ModulesResponse)
async def get_modules(task_id: str):
    """
    获取生成的模块列表 (Multi-Level Expansion Step 1)

    返回已生成的模块列表，只要模块已生成即可获取（不限于 MODULES_READY 状态）。
    """
    from lib.report_workflow import get_workflow_manager, WorkflowStatus

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # Allow fetching modules at any stage after they've been generated
    # (not just MODULES_READY status)
    modules = task.get("modules", [])

    if not modules:
        # Only error if modules haven't been generated yet
        valid_statuses = [
            WorkflowStatus.MODULES_READY.value,
            WorkflowStatus.GENERATING_PAGE_TITLES.value,
            WorkflowStatus.PAGE_TITLES_READY.value,
            WorkflowStatus.GENERATING_SLIDES.value,
            WorkflowStatus.SLIDES_READY.value,
            WorkflowStatus.COMPLETED.value,
        ]
        if task["status"] not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"模块尚未生成，当前状态: {task['status']}"
            )

    return ModulesResponse(
        task_id=task_id,
        modules=modules,
        total_modules=len(modules),
    )


@router.post("/confirm-modules")
async def confirm_modules(request: ConfirmModulesRequest):
    """
    确认模块 (Multi-Level Expansion Step 1)

    用户确认或修改模块后，继续生成页面标题。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()

    success = await manager.confirm_modules(
        task_id=request.task_id,
        modified_modules=request.modified_modules
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="无法确认模块，请检查任务状态"
        )

    return {
        "success": True,
        "task_id": request.task_id,
        "message": "模块已确认，页面标题生成中..."
    }


@router.get("/page-titles/{task_id}", response_model=PageTitlesResponse)
async def get_page_titles(task_id: str):
    """
    获取生成的页面标题列表 (Multi-Level Expansion Step 2)

    返回已生成的页面标题列表，只要页面标题已生成即可获取（不限于 PAGE_TITLES_READY 状态）。
    """
    from lib.report_workflow import get_workflow_manager, WorkflowStatus

    manager = get_workflow_manager()
    task = manager.get_task_status(task_id)

    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")

    # Allow fetching page titles at any stage after they've been generated
    page_titles = task.get("page_titles", [])

    if not page_titles:
        # Only error if page titles haven't been generated yet
        valid_statuses = [
            WorkflowStatus.PAGE_TITLES_READY.value,
            WorkflowStatus.GENERATING_SLIDES.value,
            WorkflowStatus.SLIDES_READY.value,
            WorkflowStatus.COMPLETED.value,
        ]
        if task["status"] not in valid_statuses:
            raise HTTPException(
                status_code=400,
                detail=f"页面标题尚未生成，当前状态: {task['status']}"
            )

    return PageTitlesResponse(
        task_id=task_id,
        page_titles=page_titles,
        total_pages=len(page_titles),
    )

    return PageTitlesResponse(
        task_id=task_id,
        page_titles=page_titles,
        total_pages=len(page_titles),
    )


@router.post("/confirm-page-titles")
async def confirm_page_titles(request: ConfirmPageTitlesRequest):
    """
    确认页面标题 (Multi-Level Expansion Step 2)

    用户确认或修改页面标题后，继续生成幻灯片内容。
    """
    from lib.report_workflow import get_workflow_manager

    manager = get_workflow_manager()

    success = await manager.confirm_page_titles(
        task_id=request.task_id,
        modified_page_titles=request.modified_page_titles
    )

    if not success:
        raise HTTPException(
            status_code=400,
            detail="无法确认页面标题，请检查任务状态"
        )

    return {
        "success": True,
        "task_id": request.task_id,
        "message": "页面标题已确认，内容生成中..."
    }
