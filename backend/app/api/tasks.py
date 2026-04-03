"""
后台任务查询 API
"""
from fastapi import APIRouter, HTTPException, Query

from app.services.task_manager import task_manager

router = APIRouter(prefix="/agent/tasks", tags=["后台任务"])


@router.get("", summary="列出后台任务")
def list_tasks(
    project_id: str | None = Query(default=None),
    task_type: str | None = Query(default=None),
    limit: int = Query(default=50),
):
    tasks = task_manager.list_tasks(project_id=project_id, task_type=task_type)
    return {
        "items": [
            {
                "task_id": t.task_id,
                "task_type": t.task_type,
                "status": t.status.value,
                "progress": t.progress,
                "error": t.error,
                "created_at": t.created_at,
                "completed_at": t.completed_at,
            }
            for t in tasks[:limit]
        ],
        "count": len(tasks),
    }


@router.get("/{task_id}", summary="查询任务状态")
def get_task(task_id: str):
    task = task_manager.get_status(task_id)
    if not task:
        raise HTTPException(404, "任务不存在")
    return {
        "task_id": task.task_id,
        "task_type": task.task_type,
        "status": task.status.value,
        "progress": task.progress,
        "result": task.result if task.status.value == "completed" else None,
        "error": task.error,
        "created_at": task.created_at,
        "started_at": task.started_at,
        "completed_at": task.completed_at,
    }


@router.post("/{task_id}/cancel", summary="取消任务")
def cancel_task(task_id: str):
    success = task_manager.cancel(task_id)
    if not success:
        raise HTTPException(400, "无法取消（任务不存在或已完成）")
    return {"task_id": task_id, "status": "cancelled"}
