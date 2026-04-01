"""
交付成果 API — 基于 Kernel ObjectService 的 Deliverable CRUD

端点:
  GET    /api/v1/projects/{project_id}/deliverables                  — 列出交付成果
  POST   /api/v1/projects/{project_id}/deliverables                  — 创建交付成果
  PATCH  /api/v1/projects/{project_id}/deliverables/{deliverable_id} — 更新交付成果
  DELETE /api/v1/projects/{project_id}/deliverables/{deliverable_id} — 删除交付成果
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from typing import Any, Optional
from loguru import logger

from app.kernel.database import get_db
from app.services.kernel.object_service import ObjectService
from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate

router = APIRouter()

MODEL_KEY = "Deliverable"


# ── 请求 / 响应模型 ──────────────────────────────────────


class DeliverableCreateRequest(BaseModel):
    """创建交付成果请求"""

    title: str = Field(..., min_length=1, max_length=512, description="交付成果标题")
    phase_id: Optional[str] = Field(default=None, description="关联阶段 ID (sys_objects/xxx)")
    deliverable_type: Optional[str] = Field(
        default="document", description="类型: document / report / presentation / dataset / other"
    )
    source_module: Optional[str] = Field(
        default=None, description="来源模块: diagnosis / analysis / plan / other"
    )
    content: Optional[str] = Field(default=None, max_length=32768, description="成果内容 (文本)")
    file_path: Optional[str] = Field(default=None, max_length=1024, description="关联文件路径")


class DeliverableUpdateRequest(BaseModel):
    """更新交付成果请求 (所有字段可选)"""

    title: Optional[str] = Field(default=None, min_length=1, max_length=512)
    phase_id: Optional[str] = Field(default=None)
    deliverable_type: Optional[str] = Field(default=None)
    source_module: Optional[str] = Field(default=None)
    content: Optional[str] = Field(default=None, max_length=32768)
    file_path: Optional[str] = Field(default=None, max_length=1024)


class DeliverableResponse(BaseModel):
    """交付成果响应"""

    key: str
    title: str
    phase_id: Optional[str] = None
    deliverable_type: Optional[str] = None
    source_module: Optional[str] = None
    content: Optional[str] = None
    file_path: Optional[str] = None
    project_id: str
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


def _to_deliverable_response(obj: dict[str, Any]) -> DeliverableResponse:
    """将 kernel 对象转换为 DeliverableResponse"""
    props = obj.get("properties", {})
    return DeliverableResponse(
        key=obj.get("_key", ""),
        title=props.get("title", ""),
        phase_id=props.get("phase_id"),
        deliverable_type=props.get("deliverable_type", "document"),
        source_module=props.get("source_module"),
        content=props.get("content"),
        file_path=props.get("file_path"),
        project_id=props.get("project_id", ""),
        created_at=props.get("created_at"),
        updated_at=props.get("updated_at"),
    )


# ── 端点 ──────────────────────────────────────────────


@router.get(
    "/projects/{project_id}/deliverables",
    response_model=list[DeliverableResponse],
    summary="列出交付成果",
)
def list_deliverables(
    project_id: str,
    phase_id: Optional[str] = Query(default=None, description="按阶段过滤"),
    source_module: Optional[str] = Query(default=None, description="按来源模块过滤"),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取项目下的所有交付成果，可按 phase_id 和 source_module 过滤"""
    service = ObjectService(db)
    objects = service.list_objects(model_key=MODEL_KEY, limit=500)

    deliverables = []
    for obj in objects:
        props = obj.get("properties", {})
        if props.get("project_id") == project_id:
            if phase_id and props.get("phase_id") != phase_id:
                continue
            if source_module and props.get("source_module") != source_module:
                continue
            deliverables.append(_to_deliverable_response(obj))

    logger.info(f"列出项目 {project_id} 的交付成果: 共 {len(deliverables)} 条")
    return [d.model_dump() for d in deliverables]


@router.post(
    "/projects/{project_id}/deliverables",
    response_model=DeliverableResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建交付成果",
)
def create_deliverable(
    project_id: str,
    data: DeliverableCreateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """在项目下创建新交付成果"""
    from datetime import datetime, timezone

    properties = {
        "project_id": project_id,
        "title": data.title,
        "phase_id": data.phase_id,
        "deliverable_type": data.deliverable_type or "document",
        "source_module": data.source_module,
        "content": data.content,
        "file_path": data.file_path,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    service = ObjectService(db)
    obj_data = ObjectCreate(model_key=MODEL_KEY, properties=properties)
    result = service.create_object(obj_data)

    logger.info(f"创建交付成果: {data.title}, key={result.get('_key')}")
    return _to_deliverable_response(result).model_dump()


@router.patch(
    "/projects/{project_id}/deliverables/{deliverable_id}",
    response_model=DeliverableResponse,
    summary="更新交付成果",
)
def update_deliverable(
    project_id: str,
    deliverable_id: str,
    data: DeliverableUpdateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """更新交付成果 (部分字段)"""
    from datetime import datetime, timezone

    service = ObjectService(db)

    # 验证交付成果存在且属于该项目
    existing = service.get_object(deliverable_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付成果 '{deliverable_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付成果 '{deliverable_id}' 不属于项目 '{project_id}'",
        )

    # 构建更新字段
    update_fields = {}
    if data.title is not None:
        update_fields["title"] = data.title
    if data.phase_id is not None:
        update_fields["phase_id"] = data.phase_id
    if data.deliverable_type is not None:
        update_fields["deliverable_type"] = data.deliverable_type
    if data.source_module is not None:
        update_fields["source_module"] = data.source_module
    if data.content is not None:
        update_fields["content"] = data.content
    if data.file_path is not None:
        update_fields["file_path"] = data.file_path
    update_fields["updated_at"] = datetime.now(timezone.utc).isoformat()

    obj_data = ObjectUpdate(properties=update_fields)
    result = service.update_object(deliverable_id, obj_data)

    logger.info(f"更新交付成果: key={deliverable_id}, fields={list(update_fields.keys())}")
    return _to_deliverable_response(result).model_dump()


@router.delete(
    "/projects/{project_id}/deliverables/{deliverable_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="删除交付成果",
)
def delete_deliverable(
    project_id: str,
    deliverable_id: str,
    db: Any = Depends(get_db),
) -> None:
    """删除交付成果"""
    service = ObjectService(db)

    existing = service.get_object(deliverable_id)
    if existing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付成果 '{deliverable_id}' 不存在",
        )
    if existing.get("properties", {}).get("project_id") != project_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"交付成果 '{deliverable_id}' 不属于项目 '{project_id}'",
        )

    service.delete_object(deliverable_id)
    logger.info(f"删除交付成果: key={deliverable_id}")
