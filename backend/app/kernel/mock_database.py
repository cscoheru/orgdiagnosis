"""
内存模拟数据库（用于演示和测试）

在生产环境中应使用真实的 ArangoDB 连接
"""
from typing import Any
from copy import deepcopy


class InMemoryCollection:
    """内存集合"""

    def __init__(self, name: str, is_edge: bool = False):
        self._name = name
        self._is_edge = is_edge
        self._documents: dict[str, dict[str, Any]] = {}
        self._counter = 0

    def insert(self, doc: dict[str, Any]) -> dict[str, str]:
        """插入文档"""
        self._counter += 1
        key = str(self._counter)
        doc["_key"] = key
        doc["_id"] = f"{self._name}/{key}"
        doc["_rev"] = f"_rev_{key}"
        self._documents[key] = deepcopy(doc)
        return {"_key": key, "_id": doc["_id"], "_rev": doc["_rev"]}

    def get(self, key: str) -> dict[str, Any] | None:
        """获取文档"""
        return deepcopy(self._documents.get(key))

    def update(self, doc: dict[str, Any]) -> dict[str, str]:
        """更新文档"""
        key = doc["_key"]
        if key in self._documents:
            self._documents[key].update(doc)
            self._documents[key]["_rev"] = f"_rev_{key}_updated"
            return {"_key": key, "_id": self._documents[key]["_id"], "_rev": self._documents[key]["_rev"]}
        raise KeyError(f"Document {key} not found")

    def delete(self, key: str) -> bool:
        """删除文档"""
        if key in self._documents:
            del self._documents[key]
            return True
        raise KeyError(f"Document {key} not found")


class InMemoryDatabase:
    """内存数据库（支持图遍历）"""

    def __init__(self):
        self._collections: dict[str, InMemoryCollection] = {}

    def collection(self, name: str) -> InMemoryCollection:
        """获取集合（如不存在则自动创建为普通集合）"""
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name, is_edge=False)
        return self._collections[name]

    def has_collection(self, name: str) -> bool:
        """检查集合是否存在"""
        return name in self._collections

    def create_collection(self, name: str, edge: bool = False) -> None:
        """创建集合"""
        if name not in self._collections:
            self._collections[name] = InMemoryCollection(name, edge)

    def aql_execute(self, query: str, bind_vars: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        """模拟 AQL 查询"""
        bind_vars = bind_vars or {}
        collection_name = bind_vars.get("@collection", "")
        edge_collection_name = bind_vars.get("@edge_collection", "")

        # 模型过滤查询
        if "FILTER doc.model_key ==" in query:
            model_key = bind_vars.get("model_key")
            collection = self._collections.get(collection_name)
            if collection:
                return [doc for doc in collection._documents.values() if doc.get("model_key") == model_key]
            return []

        # 列表查询
        if "SORT doc._key ASC" in query or "SORT e._key ASC" in query:
            collection = self._collections.get(collection_name)
            if collection:
                offset = bind_vars.get("offset", 0)
                limit = bind_vars.get("limit", 100)
                docs = sorted(collection._documents.values(), key=lambda x: x["_key"])
                return docs[offset:offset + limit]
            return []

        # 计数查询
        if "COLLECT WITH COUNT" in query:
            model_key = bind_vars.get("model_key")
            collection = self._collections.get(collection_name)
            if collection:
                count = sum(1 for doc in collection._documents.values() if doc.get("model_key") == model_key)
                return [count]
            return [0]

        # 关系过滤查询
        if "FILTER e._from ==" in query or "FILTER e._to ==" in query:
            edge_collection = self._collections.get(edge_collection_name or "sys_relations")
            if edge_collection:
                results = []
                for doc in edge_collection._documents.values():
                    if "e._from ==" in query and doc.get("_from") == bind_vars.get("obj_id"):
                        results.append(doc)
                    elif "e._to ==" in query and doc.get("_to") == bind_vars.get("obj_id"):
                        results.append(doc)
                    elif "OR e._to ==" in query:
                        obj_id = bind_vars.get("obj_id")
                        if doc.get("_from") == obj_id or doc.get("_to") == obj_id:
                            results.append(doc)
                return results[:bind_vars.get("limit", 100)]
            return []

        # 关系存在检查
        if "e._from ==" in query and "e._to ==" in query and "e.relation_type ==" in query:
            edge_collection = self._collections.get(edge_collection_name or "sys_relations")
            if edge_collection:
                from_id = bind_vars.get("from_id")
                to_id = bind_vars.get("to_id")
                relation_type = bind_vars.get("relation_type")
                for doc in edge_collection._documents.values():
                    if doc.get("_from") == from_id and doc.get("_to") == to_id and doc.get("relation_type") == relation_type:
                        return [True]
            return []

        # 图遍历查询
        if "FOR v, e, p IN" in query and "@edge_collection" in query:
            return self._execute_graph_traversal(query, bind_vars)

        return []

    def _execute_graph_traversal(self, query: str, bind_vars: dict[str, Any]) -> list[dict[str, Any]]:
        """执行图遍历 (BFS)"""
        import re

        depth = bind_vars.get("depth", 1)
        start_obj_id = bind_vars.get("start_obj_id", "")
        edge_collection_name = bind_vars.get("@edge_collection", "sys_relations")

        direction = "OUTBOUND"
        if "INBOUND" in query:
            direction = "INBOUND"
        elif "ANY" in query:
            direction = "ANY"

        edge_collection = self._collections.get(edge_collection_name)
        vertex_collection = self._collections.get("sys_objects")

        if not edge_collection or not vertex_collection:
            return []

        results = []
        visited = set()
        queue = [(start_obj_id, [])]

        for current_depth in range(1, depth + 1):
            next_queue = []

            for current_vertex_id, path_edges in queue:
                if current_vertex_id in visited:
                    continue
                visited.add(current_vertex_id)

                for edge in edge_collection._documents.values():
                    edge_from = edge.get("_from", "")
                    edge_to = edge.get("_to", "")
                    next_vertex_id = None

                    if direction == "OUTBOUND":
                        if edge_from == current_vertex_id:
                            next_vertex_id = edge_to
                    elif direction == "INBOUND":
                        if edge_to == current_vertex_id:
                            next_vertex_id = edge_from
                    elif direction == "ANY":
                        if edge_from == current_vertex_id:
                            next_vertex_id = edge_to
                        elif edge_to == current_vertex_id:
                            next_vertex_id = edge_from

                    if next_vertex_id and next_vertex_id not in visited:
                        vertex_key = next_vertex_id.split("/")[-1]
                        vertex = vertex_collection.get(vertex_key)

                        if vertex:
                            new_path = path_edges + [edge["_id"]]
                            results.append({
                                "vertex": vertex,
                                "edge": edge,
                                "path": {
                                    "vertices": [start_obj_id] + [r.get("_from") if direction == "INBOUND" else r.get("_to") for r in [edge]],
                                    "edges": new_path
                                }
                            })
                            next_queue.append((next_vertex_id, new_path))

            queue = next_queue
            if not queue:
                break

        return results

    @property
    def aql(self):
        """AQL 查询接口"""
        class AQL:
            def __init__(self, db):
                self._db = db

            def execute(self, query: str, bind_vars: dict[str, Any] | None = None):
                return self._db.aql_execute(query, bind_vars)

        return AQL(self)


# 全局模拟数据库实例
_mock_db = InMemoryDatabase()


def get_mock_db() -> InMemoryDatabase:
    """获取模拟数据库实例"""
    return _mock_db
