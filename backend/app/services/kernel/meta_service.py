"""
元模型服务 — 元模型 CRUD + 关联对象检查
"""
from fastapi import HTTPException, status
from typing import Any

from app.repositories.meta_repo import MetaModelRepository
from app.repositories.object_repo import ObjectRepository
from app.models.kernel.meta_model import MetaModelCreate, MetaModelUpdate


class MetaModelService:
    """元模型服务"""

    def __init__(self, db: Any):
        self._db = db
        self._meta_repo = MetaModelRepository(db)
        self._object_repo = ObjectRepository(db)

    def create_meta_model(self, data: MetaModelCreate) -> dict[str, Any]:
        """创建元模型"""
        if self._meta_repo.exists_by_model_key(data.model_key):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"元模型 '{data.model_key}' 已存在",
            )
        return self._meta_repo.create(data)

    def get_meta_model(self, key: str) -> dict[str, Any] | None:
        """获取元模型"""
        return self._meta_repo.get_by_key(key)

    def get_meta_model_by_key(self, model_key: str) -> dict[str, Any] | None:
        """根据 model_key 获取元模型"""
        return self._meta_repo.get_by_model_key(model_key)

    def list_meta_models(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """获取元模型列表"""
        return self._meta_repo.list_all(limit, offset)

    def _resolve_key(self, key: str) -> dict[str, Any] | None:
        """先按 model_key 查，再按 _key 查"""
        return self._meta_repo.get_by_model_key(key) or self._meta_repo.get_by_key(key)

    def update_meta_model(self, key: str, data: MetaModelUpdate) -> dict[str, Any] | None:
        """更新元模型（支持 model_key 或 _key）"""
        existing = self._resolve_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"元模型 '{key}' 不存在",
            )
        return self._meta_repo.update(existing["_key"], data)

    def delete_meta_model(self, key: str) -> bool:
        """删除元模型（支持 model_key 或 _key）"""
        existing = self._resolve_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"元模型 '{key}' 不存在",
            )

        model_key = existing.get("model_key")
        object_count = self._object_repo.count_by_model_key(model_key)
        if object_count > 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"元模型 '{model_key}' 下有 {object_count} 个对象，无法删除",
            )

        return self._meta_repo.delete(key)

    def add_fields_to_model(
        self,
        model_key: str,
        new_fields: list[dict[str, Any]],
    ) -> dict[str, Any] | None:
        """向已有元模型追加字段（不删除旧字段）

        Args:
            model_key: 元模型 key
            new_fields: 新字段定义列表 [{field_name, field_type, ...}]

        Returns:
            更新后的元模型
        """
        existing = self._meta_repo.get_by_model_key(model_key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"元模型 '{model_key}' 不存在",
            )

        existing_names = {f["field_name"] for f in existing.get("fields", [])}
        to_add = [f for f in new_fields if f["field_name"] not in existing_names]

        if not to_add:
            return existing

        merged = existing.get("fields", []) + to_add
        return self._meta_repo.update(existing["_key"], MetaModelUpdate(fields=merged))
