"""
会议纪要 API — 基于 Kernel ObjectService 的 Meeting CRUD

端点:
  GET    /api/v1/projects/{project_id}/meetings              — 列出会议纪要 (可按 phase_id 过滤)
  POST   /api/v1/projects/{project_id}/meetings              — 创建会议纪要
  PATCH  /api/v1/projects/{project_id}/meetings/{meeting_id} — 更新会议纪要
  DELETE /api/v1/projects/{project_id}/meetings/{meeting_id} — 删除会议纪要
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

MODEL_KEY = "Meeting"


# ── 请求 / 响应模型 ──────────────────────────────────────


class MeetingCreateRequest(BaseModel):
    """创建会议纪要请求"""

    meeting_date: date = Field(..., description="会议日期")
    title: str = Field(..., min_length=1, max_length=512, description="会议标题")
    attendees: Optional[list[str]] = Field(default=None, description="参会人员列表")
    decisions: Optional[list[str]] = Field(default=None, description="会议决议列表")
    action_items: Optional[list[str]] = Field(default=None, description="待办事项列表")
    notes: Optional[str] = Field(default=None, max_length=8192, description="会议记录/笔记")
    phase_id: Optional[str] = Field(default=None, description="关联阶段 ID (sys_objects/xxx)")


class MeetingUpdateRequest(BaseModel):
    """更新会议纪要请求 (所有字段可选)"""

    meeting_date: Optional[date] = Field(default=None)
    title: Optional[str] = Field(default=None, min_length=1, max_length=512)
    attendees: Optional[list[str]] = Field(default=None)
    decisions: Optional[list[str]] = Field(default=None)
    action_items: Optional[list[str]] = Field(default=None)
    notes: Optional[str] = Field(default=None, max_length=8192)
    phase_id: Optional[str] = Field(default=None)


class MeetingResponse(BaseModel):
    """会议纪要响应"""

    key: str
    meeting_date: Optional[str] = None
    title: str
    attendees: Optional[list[str]] = None
    decisions: Optional[list[str]] = None
    action_items: Optional[list[str]] = None
    notes: Optional[str] = None
    phase_id: Optional[str] = None
    project_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_meeting_response(obj: dict[str, Any]) -> MeetingResponse:
    """将 kernel 对象转换为 MeetingResponse"""
    props = obj.get("properties", {})
    return MeetingResponse(
        key=obj.get("_key", ""),
        meeting_date=props.get("meeting_date"),
        title=props.get("title", ""),
        attendees=props.get("attendees"),
        decisions=props.get("decisions"),
        action_items=props.get("action_items"),
        notes=props.get("notes"),
        phase_id=props.get("phase_id"),
        project_id=props.get("project_id", ""),
        created_at=props.get("created_at"),
        updated_at=props.get("updated_at"),
    )


# ── 端点 ──────────────────────────────────────────────


@router.get(
    "/projects/{project_id}/meetings",
    response_model=list[MeetingResponse],
    summary="列出会议纪要",
)
def list_meetings(
    project_id: str,
    phase_id: Optional[str] = Query(default=None, description="按阶段过滤"),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取项目下的所有会议纪要，可按 phase_id 过滤"""
    service = ObjectService(db)
    objects = service.list_objects(model_key=MODEL_KEY, limit=500)

    meetings = []
    for obj in objects:
        props = obj.get("properties", {})
        if props.get("project_id") == project_id:
            if phase_id and props.get("phase_id") != phase_id:
                continue
            meetings.append(_to_meeting_response(obj))

    # 按会议日期倒序排列
    meetings.sort(key=lambda m: m.meeting_date or "", reverse=True)

    logger.info(f"列出项目 {project_id} 的会议纪要: 共 {len(meetings)} 条")
    return [m.model_dump() for m in meetings]


@router.post(
    "/projects/{project_id}/meetings",
    response_model=MeetingResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建会议纪要",
)
def create_meeting(
    project_id: str,
    data: MeetingCreateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """在项目下创建新会议纪要"""
    from datetime import datetime, timezone

    properties = {
        "project_id": project_id,
        "meeting_date": data.meeting_date.isoformat(),
        "title": data.title,
        "attendees": data.attendees or [],
        "decisions": data.decisions or [],
        "action_items": data.action_items or [],
        "notes": data.notes,
        "phase_id": data.phase_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    service = ObjectService(db)
    obj_data = ObjectCreate(model_key=MODEL_KEY, properties=properties)
    result = service.create_object(obj_data)

    logger.info(f"创建会议纪要: {data.title}, key={result.get('_key')}")
    return _to_meeting_response(result).model_dump()


@router.patch(
    "/projects/{project_id}/meetings/{meeting_id}",
    response_model=MeetingResponse,
    summary="更新会议纪要",
)
def update_meeting(
    project_id: str,
    meeting_id: str,
    data: MeetingUpdateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """更新会议纪要 (部分字段)"""
    from datetime import datetime, timezone

    service = ObjectService(db)

    # 验证会议纪要存在且属于该项目
    existing = service.get_object(meeting_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"会议纪要 '{meeting_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"会议纪要 '{meeting_id}' 不属于项目 '{project_id}'",
        )

    # 构建更新字段
    update_fields = {}
    if data.meeting_date is not None:
        update_fields["meeting_date"] = data.meeting_date.isoformat()
    if data.title is not None:
        update_fields["title"] = data.title
    if data.attendees is not None:
        update_fields["attendees"] = data.attendees
    if data.decisions is not None:
        update_fields["decisions"] = data.decisions
    if data.action_items is not None:
        update_fields["action_items"] = data.action_items
    if data.notes is not None:
        update_fields["notes"] = data.notes
    if data.phase_id is not None:
        update_fields["phase_id"] = data.phase_id
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    obj_data = ObjectUpdate(properties=update_fields)
    result = service.update_object(meeting_id, obj_data)

    logger.info(f"更新会议纪要: key={meeting_id}, fields={list(update_fields.keys())}")
    return _to_meeting_response(result).model_dump()


@router.delete(
    "/projects/{project_id}/meetings/{meeting_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除会议纪要",
)
def delete_meeting(
    project_id: str,
    meeting_id: str,
    db: Any = Depends(get_db),
) -> None:
    """删除会议纪要"""
    service = ObjectService(db)

    existing = service.get_object(meeting_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"会议纪要 '{meeting_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"会议纪要 '{meeting_id}' 不属于项目 '{project_id}'",
        )

    service.delete_object(meeting_id)
    logger.info(f"删除会议纪要: key={meeting_id}")
