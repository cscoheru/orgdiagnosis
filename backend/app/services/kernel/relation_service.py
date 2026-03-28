"""
关系服务 — 关系 CRUD + 图遍历 + 树结构构建
"""
from fastapi import HTTPException, status
from typing import Any
from collections import defaultdict

from app.repositories.relation_repo import RelationRepository
from app.repositories.object_repo import ObjectRepository
from app.models.kernel.relation import (
    RelationCreate,
    RelationUpdate,
    DirectionEnum,
    GraphNode,
)


class RelationService:
    """关系服务"""

    def __init__(self, db: Any):
        self._db = db
        self._relation_repo = RelationRepository(db)
        self._object_repo = ObjectRepository(db)

    def _validate_object_exists(self, obj_id: str) -> dict[str, Any]:
        """验证对象是否存在"""
        parts = obj_id.split("/")
        if len(parts) != 2 or parts[0] != "sys_objects":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"无效的对象 _id 格式: {obj_id}",
            )

        obj = self._object_repo.get_by_key(parts[1])
        if obj is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"对象 '{obj_id}' 不存在",
            )
        return obj

    def create_relation(self, data: RelationCreate) -> dict[str, Any]:
        """创建关系"""
        self._validate_object_exists(data.from_obj_id)
        self._validate_object_exists(data.to_obj_id)

        if self._relation_repo.exists_relation(
            data.from_obj_id, data.to_obj_id, data.relation_type
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"关系 '{data.relation_type}' 已存在于 {data.from_obj_id} → {data.to_obj_id}",
            )

        if data.from_obj_id == data.to_obj_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="起点和终点不能是同一个对象",
            )

        return self._relation_repo.create(data)

    def get_relation(self, key: str) -> dict[str, Any] | None:
        """获取关系"""
        return self._relation_repo.get_by_key(key)

    def list_relations(self, limit: int = 100, offset: int = 0) -> list[dict[str, Any]]:
        """获取关系列表"""
        return self._relation_repo.list_all(limit, offset)

    def update_relation(self, key: str, data: RelationUpdate) -> dict[str, Any] | None:
        """更新关系"""
        existing = self._relation_repo.get_by_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"关系 '{key}' 不存在",
            )
        return self._relation_repo.update(key, data)

    def delete_relation(self, key: str) -> bool:
        """删除关系"""
        existing = self._relation_repo.get_by_key(key)
        if existing is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"关系 '{key}' 不存在",
            )
        return self._relation_repo.delete(key)

    def get_object_graph(
        self,
        start_obj_id: str,
        direction: DirectionEnum,
        depth: int,
    ) -> dict[str, Any]:
        """获取以指定对象为起点的图谱数据 (树状结构)"""
        root = self._validate_object_exists(start_obj_id)

        graph_data = self._relation_repo.get_object_graph(
            start_obj_id, direction, depth
        )

        tree = self._build_tree(root, graph_data, direction)

        unique_vertices = {start_obj_id}
        unique_edges = set()
        for item in graph_data:
            unique_vertices.add(item["vertex"]["_id"])
            if item["edge"]:
                unique_edges.add(item["edge"]["_id"])

        return {
            "root": root,
            "relations": graph_data,
            "tree": tree.model_dump(),
            "total_vertices": len(unique_vertices),
            "total_edges": len(unique_edges),
        }

    def _build_tree(
        self,
        root: dict[str, Any],
        graph_data: list[dict[str, Any]],
        direction: DirectionEnum,
    ) -> GraphNode:
        """将图遍历结果转换为树状结构 (邻接表 + BFS)"""
        adjacency: dict[str, list[tuple[dict, dict | None]]] = defaultdict(list)
        visited: set[str] = set()

        for item in graph_data:
            edge = item.get("edge")
            vertex = item.get("vertex")
            if not vertex:
                continue

            if direction == DirectionEnum.OUTBOUND:
                parent_id = edge["_from"] if edge else root["_id"]
            elif direction == DirectionEnum.INBOUND:
                parent_id = edge["_to"] if edge else root["_id"]
            else:
                path = item.get("path", {})
                vertices = path.get("vertices", [])
                if len(vertices) >= 2:
                    parent_id = vertices[-2]
                else:
                    parent_id = root["_id"]

            adjacency[parent_id].append((vertex, edge))

        def build_node(obj: dict[str, Any]) -> GraphNode:
            obj_id = obj["_id"]
            if obj_id in visited:
                return GraphNode(vertex={"_id": obj_id, "_circular_ref": True})

            visited.add(obj_id)
            children = []
            for child_vertex, child_edge in adjacency.get(obj_id, []):
                child_node = build_node(child_vertex)
                child_node.edge = child_edge
                children.append(child_node)

            return GraphNode(vertex=obj, children=children)

        return build_node(root)
