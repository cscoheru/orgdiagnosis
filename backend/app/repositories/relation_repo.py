"""
关系仓库 — sys_relations 边集合的 CRUD + 图遍历操作
"""
from typing import Any

from app.kernel.exceptions import handle_arango_error
from app.models.kernel.relation import RelationCreate, RelationUpdate, DirectionEnum

EDGE_COLLECTION = "sys_relations"
VERTEX_COLLECTION = "sys_objects"


class RelationRepository:
    """关系仓库 (Edge 集合操作)"""

    def __init__(self, db: Any):
        self._db = db
        self._collection = db.collection(EDGE_COLLECTION)

    def create(self, data: RelationCreate) -> dict[str, Any]:
        """创建关系 (边)"""
        try:
            edge_doc = {
                "_from": data.from_obj_id,
                "_to": data.to_obj_id,
                "relation_type": data.relation_type,
                "properties": data.properties or {},
            }
            result = self._collection.insert(edge_doc)
            return self.get_by_key(result["_key"])
        except Exception as e:
            raise handle_arango_error(e)

    def get_by_key(self, key: str) -> dict[str, Any] | None:
        """根据 _key 获取关系"""
        try:
            return self._collection.get(key)
        except Exception as e:
            raise handle_arango_error(e)

    def update(self, key: str, data: RelationUpdate) -> dict[str, Any] | None:
        """更新关系"""
        try:
            update_data = {k: v for k, v in data.model_dump().items() if v is not None}
            if not update_data:
                return self.get_by_key(key)

            self._collection.update({"_key": key, **update_data})
            return self.get_by_key(key)
        except Exception as e:
            raise handle_arango_error(e)

    def delete(self, key: str) -> bool:
        """删除关系"""
        try:
            self._collection.delete(key)
            return True
        except Exception as e:
            raise handle_arango_error(e)

    def list_all(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """获取所有关系"""
        try:
            aql = """
            FOR e IN @@collection
            SORT e._key ASC
            LIMIT @offset, @limit
            RETURN e
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={"@collection": EDGE_COLLECTION, "offset": offset, "limit": limit},
            )
            return list(cursor)
        except Exception as e:
            raise handle_arango_error(e)

    def list_by_vertex(
        self, obj_id: str, direction: DirectionEnum, limit: int = 100
    ) -> list[dict[str, Any]]:
        """获取与指定顶点相关的所有边"""
        try:
            if direction == DirectionEnum.OUTBOUND:
                filter_clause = "e._from == @obj_id"
            elif direction == DirectionEnum.INBOUND:
                filter_clause = "e._to == @obj_id"
            else:
                filter_clause = "e._from == @obj_id OR e._to == @obj_id"

            aql = f"""
            FOR e IN @@collection
            FILTER {filter_clause}
            SORT e._key ASC
            LIMIT @limit
            RETURN e
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={"@collection": EDGE_COLLECTION, "obj_id": obj_id, "limit": limit},
            )
            return list(cursor)
        except Exception as e:
            raise handle_arango_error(e)

    def get_object_graph(
        self,
        start_obj_id: str,
        direction: DirectionEnum,
        depth: int,
    ) -> list[dict[str, Any]]:
        """获取以指定对象为起点的图谱数据 (AQL 图遍历)"""
        try:
            aql = f"""
            FOR v, e, p IN 1..@depth {direction.value} @start_obj_id @@edge_collection
            RETURN {{
                vertex: v,
                edge: e,
                path: {{
                    vertices: p.vertices[*]._id,
                    edges: p.edges[*]._id
                }}
            }}
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={
                    "@edge_collection": EDGE_COLLECTION,
                    "start_obj_id": start_obj_id,
                    "depth": depth,
                },
            )
            return list(cursor)
        except Exception as e:
            raise handle_arango_error(e)

    def exists_relation(self, from_id: str, to_id: str, relation_type: str) -> bool:
        """检查关系是否已存在"""
        try:
            aql = """
            FOR e IN @@collection
            FILTER e._from == @from_id AND e._to == @to_id AND e.relation_type == @relation_type
            RETURN TRUE
            """
            cursor = self._db.aql.execute(
                aql,
                bind_vars={
                    "@collection": EDGE_COLLECTION,
                    "from_id": from_id,
                    "to_id": to_id,
                    "relation_type": relation_type,
                },
            )
            return len(list(cursor)) > 0
        except Exception as e:
            raise handle_arango_error(e)
