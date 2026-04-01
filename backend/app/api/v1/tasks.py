"""
任务管理 API — 基于 Kernel ObjectService 的 Task CRUD

端点:
  GET    /api/v1/projects/{project_id}/tasks          — 列出任务 (可按 phase_id 过滤)
  POST   /api/v1/projects/{project_id}/tasks          — 创建任务
  PATCH  /api/v1/projects/{project_id}/tasks/{task_id} — 更新任务
  DELETE /api/v1/projects/{project_id}/tasks/{task_id} — 删除任务
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Any, Optional
from datetime import date
from loguru import logger

from app.kernel.database import get_db
from app.services.kernel.object_service import ObjectService
from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate

router = APIRouter()

MODEL_KEY = "Task"


# ── 请求 / 响应模型 ──────────────────────────────────────


class TaskCreateRequest(BaseModel):
    """创建任务请求"""

    name: str = Field(..., min_length=1, max_length=256, description="任务名称")
    description: Optional[str] = Field(default=None, max_length=2048, description="任务描述")
    phase_id: Optional[str] = Field(default=None, description="关联阶段 ID (sys_objects/xxx)")
    assignee_id: Optional[str] = Field(default=None, description="负责人 ID (sys_objects/xxx)")
    due_date: Optional[date] = Field(default=None, description="截止日期")
    priority: Optional[str] = Field(
        default="medium", description="优先级: low / medium / high / urgent"
    )


class TaskUpdateRequest(BaseModel):
    """更新任务请求 (所有字段可选)"""

    name: Optional[str] = Field(default=None, min_length=1, max_length=256)
    description: Optional[str] = Field(default=None, max_length=2048)
    phase_id: Optional[str] = Field(default=None)
    assignee_id: Optional[str] = Field(default=None)
    due_date: Optional[date] = Field(default=None)
    priority: Optional[str] = Field(default=None)
    status: Optional[str] = Field(default=None, description="状态: pending / in_progress / completed / cancelled")


class TaskResponse(BaseModel):
    """任务响应"""

    key: str
    name: str
    description: Optional[str] = None
    phase_id: Optional[str] = None
    assignee_id: Optional[str] = None
    due_date: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None
    project_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_task_response(obj: dict[str, Any]) -> TaskResponse:
    """将 kernel 对象转换为 TaskResponse"""
    props = obj.get("properties", {})
    return TaskResponse(
        key=obj.get("_key", ""),
        name=props.get("name", ""),
        description=props.get("description"),
        phase_id=props.get("phase_id"),
        assignee_id=props.get("assignee_id"),
        due_date=props.get("due_date"),
        priority=props.get("priority", "medium"),
        status=props.get("status", "pending"),
        project_id=props.get("project_id", ""),
        created_at=props.get("created_at"),
        updated_at=props.get("updated_at"),
    )


# ── 端点 ──────────────────────────────────────────────


@router.get(
    "/projects/{project_id}/tasks",
    response_model=list[TaskResponse],
    summary="列出任务",
)
def list_tasks(
    project_id: str,
    phase_id: Optional[str] = Query(default=None, description="按阶段过滤"),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取项目下的所有任务，可按 phase_id 过滤"""
    service = ObjectService(db)
    objects = service.list_objects(model_key=MODEL_KEY, limit=500)

    # 按 project_id 过滤
    tasks = []
    for obj in objects:
        props = obj.get("properties", {})
        if props.get("project_id") == project_id:
            if phase_id and props.get("phase_id") != phase_id:
                continue
            tasks.append(_to_task_response(obj))

    logger.info(f"列出项目 {project_id} 的任务: 共 {len(tasks)} 条")
    return [t.model_dump() for t in tasks]


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建任务",
)
def create_task(
    project_id: str,
    data: TaskCreateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """在项目下创建新任务"""
    from datetime import datetime, timezone

    properties = {
        "project_id": project_id,
        "name": data.name,
        "description": data.description,
        "phase_id": data.phase_id,
        "assignee_id": data.assignee_id,
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "priority": data.priority or "medium",
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    service = ObjectService(db)
    obj_data = ObjectCreate(model_key=MODEL_KEY, properties=properties)
    result = service.create_object(obj_data)

    logger.info(f"创建任务: {data.name}, key={result.get('_key')}")
    return _to_task_response(result).model_dump()


@router.patch(
    "/projects/{project_id}/tasks/{task_id}",
    response_model=TaskResponse,
    summary="更新任务",
)
def update_task(
    project_id: str,
    task_id: str,
    data: TaskUpdateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """更新任务 (部分字段)"""
    from datetime import datetime, timezone

    service = ObjectService(db)

    # 验证任务存在且属于该项目
    existing = service.get_object(task_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 '{task_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 '{task_id}' 不属于项目 '{project_id}'",
        )

    # 构建更新字段 (只更新非 None 的字段)
    update_fields = {}
    if data.name is not None:
        update_fields["name"] = data.name
    if data.description is not None:
        update_fields["description"] = data.description
    if data.phase_id is not None:
        update_fields["phase_id"] = data.phase_id
    if data.assignee_id is not None:
        update_fields["assignee_id"] = data.assignee_id
    if data.due_date is not None:
        update_fields["due_date"] = data.due_date.isoformat()
    if data.priority is not None:
        update_fields["priority"] = data.priority
    if data.status is not None:
        update_fields["status"] = data.status
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    obj_data = ObjectUpdate(properties=update_fields)
    result = service.update_object(task_id, obj_data)

    logger.info(f"更新任务: key={task_id}, fields={list(update_fields.keys())}")
    return _to_task_response(result).model_dump()


@router.delete(
    "/projects/{project_id}/tasks/{task_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除任务",
)
def delete_task(
    project_id: str,
    task_id: str,
    db: Any = Depends(get_db),
) -> None:
    """删除任务"""
    service = ObjectService(db)

    # 验证任务存在且属于该项目
    existing = service.get_object(task_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 '{task_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"任务 '{task_id}' 不属于项目 '{project_id}'",
        )

    service.delete_object(task_id)
    logger.info(f"删除任务: key={task_id}")
