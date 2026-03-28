"""
对象实例仓库 — sys_objects 集合的 CRUD 操作
"""
from typing import Any

from app.kernel.exceptions import handle_arango_error

COLLECTION_NAME = "sys_objects"


class ObjectRepository:
    """对象实例仓库"""

    def __init__(self, db: Any):
        self._db = db
        self._collection = db.collection(COLLECTION_NAME)

    def create(self, data: dict[str, Any]) -> dict[str, Any]:
        """创建对象实例"""
        try:
            result = self._collection.insert(data)
            return self.get_by_key(result["_key"])
        except Exception as e:
            raise handle_arango_error(e)

    def get_by_key(self, key: str) -> dict[str, Any] | None:
        """根据 _key 获取对象"""
        try:
            return self._collection.get(key)
        except Exception as e:
            raise handle_arango_error(e)

    def list_by_model_key(
        self, model_key: str, limit: int = 100, offset: int = 0
    ) -> list[dict[str, Any]]:
        """根据 model_key 获取对象列表"""
        try:
            aql = """
            FOR doc IN @@collection
            FILTER doc.model_key == @model_key
            SORT doc._key ASC
            LIMIT @offset, @limit
            RETURN doc
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={
                    "@collection": COLLECTION_NAME,
                    "model_key": model_key,
                    "offset": offset,
                    "limit": limit,
                },
            )
            return list(cursor)
        except Exception as e:
            raise handle_arango_error(e)

    def list_all(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """获取所有对象"""
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

    def update(self, key: str, data: dict[str, Any]) -> dict[str, Any] | None:
        """更新对象"""
        try:
            self._collection.update({"_key": key, **data})
            return self.get_by_key(key)
        except Exception as e:
            raise handle_arango_error(e)

    def delete(self, key: str) -> bool:
        """删除对象"""
        try:
            self._collection.delete(key)
            return True
        except Exception as e:
            raise handle_arango_error(e)

    def count_by_model_key(self, model_key: str) -> int:
        """统计指定 model_key 的对象数量"""
        try:
            aql = "FOR doc IN @@collection FILTER doc.model_key == @model_key COLLECT WITH COUNT INTO c RETURN c"
            cursor = self._db.aql.execute(
                aql, bind_vars={"@collection": COLLECTION_NAME, "model_key": model_key}
            )
            results = list(cursor)
            return results[0] if results else 0
        except Exception as e:
            raise handle_arango_error(e)
