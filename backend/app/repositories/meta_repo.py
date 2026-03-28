"""
元模型仓库 — sys_meta_models 集合的 CRUD 操作
"""
from typing import Any

from app.kernel.exceptions import handle_arango_error
from app.models.kernel.meta_model import MetaModelCreate, MetaModelUpdate

COLLECTION_NAME = "sys_meta_models"


class MetaModelRepository:
    """元模型仓库"""

    def __init__(self, db: Any):
        self._db = db
        self._collection = db.collection(COLLECTION_NAME)

    def create(self, data: MetaModelCreate) -> dict[str, Any]:
        """创建元模型"""
        try:
            doc = data.model_dump()
            result = self._collection.insert(doc)
            return self.get_by_key(result["_key"])
        except Exception as e:
            raise handle_arango_error(e)

    def get_by_key(self, key: str) -> dict[str, Any] | None:
        """根据 _key 获取元模型"""
        try:
            return self._collection.get(key)
        except Exception as e:
            raise handle_arango_error(e)

    def get_by_model_key(self, model_key: str) -> dict[str, Any] | None:
        """根据 model_key 获取元模型"""
        try:
            aql = "FOR doc IN @@collection FILTER doc.model_key == @model_key RETURN doc"
            cursor = self._db.aql.execute(
                aql, bind_vars={"@collection": COLLECTION_NAME, "model_key": model_key}
            )
            results = list(cursor)
            return results[0] if results else None
        except Exception as e:
            raise handle_arango_error(e)

    def list_all(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """获取所有元模型"""
        try:
            aql = """
            FOR doc IN @@collection
            SORT doc._key ASC
            LIMIT @offset, @limit
            RETURN doc
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={"@collection": COLLECTION_NAME, "offset": offset, "limit": limit},
            )
            return list(cursor)
        except Exception as e:
            raise handle_arango_error(e)

    def update(self, key: str, data: MetaModelUpdate) -> dict[str, Any] | None:
        """更新元模型"""
        try:
            update_data = {k: v for k, v in data.model_dump().items() if v is not None}
            if not update_data:
                return self.get_by_key(key)

            self._collection.update({"_key": key, **update_data})
            return self.get_by_key(key)
        except Exception as e:
            raise handle_arango_error(e)

    def delete(self, key: str) -> bool:
        """删除元模型"""
        try:
            self._collection.delete(key)
            return True
        except Exception as e:
            raise handle_arango_error(e)

    def exists_by_model_key(self, model_key: str) -> bool:
        """检查 model_key 是否已存在"""
        try:
            aql = "FOR doc IN @@collection FILTER doc.model_key == @model_key RETURN TRUE"
            cursor = self._db.aql.execute(
                aql, bind_vars={"@collection": COLLECTION_NAME, "model_key": model_key}
            )
            return len(list(cursor)) > 0
        except Exception as e:
            raise handle_arango_error(e)
