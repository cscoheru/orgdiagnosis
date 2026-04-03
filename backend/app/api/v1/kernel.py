"""
内核 API 路由 — ConsultingOS 元数据引擎 REST API

端点:
  POST/GET/PATCH/DELETE  /meta[/{key}]       — 元模型 CRUD
  POST/GET/PATCH/DELETE  /objects[/{key}]    — 对象实例 CRUD
  POST/GET/DELETE        /relations[/{key}]  — 关系 (边) CRUD
  GET                    /graph              — 图谱遍历 (树状结构)
  POST                   /reports/generate   — 报告生成
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Any

from app.kernel.database import get_db
from app.services.kernel.meta_service import MetaModelService
from app.services.kernel.object_service import ObjectService
from app.services.kernel.relation_service import RelationService
from app.services.kernel.report_service import ReportService
from app.models.kernel.meta_model import (
    MetaModelCreate,
    MetaModelUpdate,
    MetaModelResponse,
    ObjectCreate,
    ObjectUpdate,
    ObjectResponse,
)
from app.models.kernel.relation import (
    RelationCreate,
    RelationResponse,
    DirectionEnum,
)
from app.models.kernel.report import ReportGenerateRequest


router = APIRouter(tags=["内核"])


# ==================== Meta Model APIs ====================


@router.post(
    "/meta",
    response_model=MetaModelResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建元模型",
)
def create_meta_model(
    data: MetaModelCreate,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """创建新的元模型定义"""
    service = MetaModelService(db)
    return service.create_meta_model(data)


@router.get("/meta", response_model=list[MetaModelResponse], summary="获取元模型列表")
def list_meta_models(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取所有元模型"""
    service = MetaModelService(db)
    return service.list_meta_models(limit, offset)


@router.get("/meta/{key}", response_model=MetaModelResponse, summary="获取元模型")
def get_meta_model(
    key: str,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """根据 _key 或 model_key 获取元模型"""
    service = MetaModelService(db)
    result = service.get_meta_model_by_key(key) or service.get_meta_model(key)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"元模型 '{key}' 不存在",
        )
    return result


@router.patch("/meta/{key}", response_model=MetaModelResponse, summary="更新元模型")
def update_meta_model(
    key: str,
    data: MetaModelUpdate,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """更新元模型定义（支持 _key 或 model_key）"""
    service = MetaModelService(db)
    return service.update_meta_model(key, data)


@router.delete("/meta/{key}", status_code=status.HTTP_204_NO_CONTENT, summary="删除元模型")
def delete_meta_model(
    key: str,
    db: Any = Depends(get_db),
) -> None:
    """删除元模型 (有关联对象时拒绝)"""
    service = MetaModelService(db)
    service.delete_meta_model(key)


# ==================== Object APIs ====================


@router.post(
    "/objects",
    response_model=ObjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="创建对象实例",
)
def create_object(
    data: ObjectCreate,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """
    创建对象实例

    根据 model_key 对应的元模型校验 properties:
    - 必填字段检查
    - 类型校验 (含 ENUM 可选值、REFERENCE 存在性)
    - 白名单过滤 + 默认值填充
    """
    service = ObjectService(db)
    return service.create_object(data)


@router.get("/objects", response_model=list[ObjectResponse], summary="获取对象列表")
def list_objects(
    model_key: str | None = Query(default=None, description="按元模型过滤"),
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取对象列表，可按 model_key 过滤"""
    service = ObjectService(db)
    return service.list_objects(model_key, limit, offset)


@router.get("/objects/{key}", response_model=ObjectResponse, summary="获取对象")
def get_object(
    key: str,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """根据 _key 获取对象"""
    service = ObjectService(db)
    result = service.get_object(key)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"对象 '{key}' 不存在",
        )
    return result


@router.patch("/objects/{key}", response_model=ObjectResponse, summary="更新对象")
def update_object(
    key: str,
    data: ObjectUpdate,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """更新对象属性 (根据元模型校验)"""
    service = ObjectService(db)
    return service.update_object(key, data)


@router.delete("/objects/{key}", status_code=status.HTTP_204_NO_CONTENT, summary="删除对象")
def delete_object(
    key: str,
    db: Any = Depends(get_db),
) -> None:
    """删除对象"""
    service = ObjectService(db)
    service.delete_object(key)


# ==================== Relation APIs ====================


@router.post(
    "/relations",
    status_code=status.HTTP_201_CREATED,
    summary="创建关系 (边)",
)
def create_relation(
    data: RelationCreate,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """
    创建对象间的关系

    - from_obj_id: 起点 _id (sys_objects/xxx)
    - to_obj_id: 终点 _id (sys_objects/xxx)
    - relation_type: 关系类型
    """
    service = RelationService(db)
    return service.create_relation(data)


@router.get("/relations", summary="获取关系列表")
def list_relations(
    limit: int = Query(default=100, ge=1, le=1000),
    offset: int = Query(default=0, ge=0),
    db: Any = Depends(get_db),
) -> list[dict[str, Any]]:
    """获取所有关系"""
    service = RelationService(db)
    return service.list_relations(limit, offset)


@router.get("/relations/{key}", summary="获取关系")
def get_relation(
    key: str,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """根据 _key 获取关系"""
    service = RelationService(db)
    result = service.get_relation(key)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"关系 '{key}' 不存在",
        )
    return result


@router.delete("/relations/{key}", status_code=status.HTTP_204_NO_CONTENT, summary="删除关系")
def delete_relation(
    key: str,
    db: Any = Depends(get_db),
) -> None:
    """删除关系"""
    service = RelationService(db)
    service.delete_relation(key)


# ==================== Graph APIs ====================


@router.get("/graph", summary="获取图谱树状结构")
def get_object_graph(
    start_obj_id: str = Query(..., description="起点对象 _id (sys_objects/xxx)"),
    direction: DirectionEnum = Query(default=DirectionEnum.OUTBOUND, description="遍历方向"),
    depth: int = Query(default=2, ge=1, le=10, description="穿透层数 (1-10)"),
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """
    获取以指定对象为起点的图谱数据 (树状结构)

    - OUTBOUND: 从起点向外 (from → to)
    - INBOUND: 向内指向起点 (from ← to)
    - ANY: 双向遍历
    """
    service = RelationService(db)
    return service.get_object_graph(start_obj_id, direction, depth)


# ==================== Report APIs ====================


@router.post("/reports/generate", summary="生成报告")
def generate_report(
    data: ReportGenerateRequest,
    db: Any = Depends(get_db),
) -> dict[str, Any]:
    """根据模板和内核图谱数据生成报告"""
    service = ReportService(db)
    return service.generate_report(
        template_key=data.template_key,
        obj_id=data.obj_id,
        output_format=data.output_format,
        parameters=data.parameters,
    )
