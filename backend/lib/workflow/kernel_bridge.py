"""
KernelBridge — LangGraph 节点与内核的双向桥接

LangGraph 节点通过此类与内核交互 (进程内调用，无 HTTP 开销)。
内核是唯一的"数据真相源"，所有工作流节点的数据读写都经过这里。

使用方式:
    bridge = KernelBridge()
    result = await bridge.create_object("Employee", {"name": "张三"})
    graph = await bridge.query_graph("sys_objects/1", depth=2)
"""

from __future__ import annotations

import asyncio
from typing import Any

from app.kernel.database import get_db


class KernelBridge:
    """LangGraph 节点通过此桥接与内核交互 (进程内调用，无 HTTP 开销)

    所有方法都是 async，内部通过 run_in_executor 包装同步的 kernel service 调用，
    避免阻塞 LangGraph 的异步事件循环。
    """

    def __init__(self) -> None:
        self._db = None

    def _get_db(self) -> Any:
        """延迟初始化数据库连接 (避免 import 时副作用)"""
        if self._db is None:
            self._db = get_db()
        return self._db

    async def _run_sync(self, fn, *args, **kwargs) -> Any:
        """在 executor 中运行同步函数，避免阻塞事件循环"""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    # ──────────────────────────────────────────────
    # 对象操作
    # ──────────────────────────────────────────────

    async def create_object(
        self,
        model_key: str,
        properties: dict[str, Any],
    ) -> dict[str, Any]:
        """在内核中创建一个对象

        Args:
            model_key: 元模型 key (如 "Employee", "Strategic_Goal")
            properties: 对象属性 (必须符合元模型定义)

        Returns:
            {"_key": "...", "_id": "...", "model_key": "...", "properties": {...}}
        """
        from app.services.kernel.object_service import ObjectService
        from app.models.kernel.meta_model import ObjectCreate

        db = self._get_db()
        svc = ObjectService(db)
        data = ObjectCreate(model_key=model_key, properties=properties)
        return await self._run_sync(svc.create_object, data)

    async def get_object(self, key: str) -> dict[str, Any] | None:
        """根据 _key 获取对象"""
        from app.services.kernel.object_service import ObjectService

        db = self._get_db()
        svc = ObjectService(db)
        return await self._run_sync(svc.get_object, key)

    async def get_objects_by_model(
        self,
        model_key: str,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """获取指定元模型的所有对象"""
        from app.services.kernel.object_service import ObjectService

        db = self._get_db()
        svc = ObjectService(db)
        return await self._run_sync(svc.list_objects, model_key, limit)

    async def list_all_objects(self, limit: int = 100) -> list[dict[str, Any]]:
        """获取所有对象"""
        from app.services.kernel.object_service import ObjectService

        db = self._get_db()
        svc = ObjectService(db)
        return await self._run_sync(svc.list_objects, None, limit)

    async def get_objects_by_field(
        self,
        model_key: str,
        field_name: str,
        field_value: Any,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """按字段值过滤对象

        Args:
            model_key: 元模型 key
            field_name: 属性字段名 (在 properties 内)
            field_value: 期望的字段值
        """
        from app.repositories.object_repo import ObjectRepository

        db = self._get_db()
        repo = ObjectRepository(db)

        def _query():
            aql = """
            FOR doc IN @@collection
            FILTER doc.model_key == @model_key
               AND doc.properties[@field_name] == @field_value
            SORT doc._key ASC
            LIMIT @limit
            RETURN doc
            """
            cursor = db.aql.execute(
                aql,
                bind_vars={
                    "@collection": "sys_objects",
                    "model_key": model_key,
                    "field_name": field_name,
                    "field_value": field_value,
                    "limit": limit,
                },
            )
            return list(cursor)

        return await self._run_sync(_query)

    async def get_ancestors(
        self,
        obj_id: str,
        relation_type: str,
        max_depth: int = 10,
    ) -> list[dict[str, Any]]:
        """沿关系边向上遍历，获取祖先链

        Args:
            obj_id: 起始对象 _id (如 sys_objects/123)
            relation_type: 关系类型 (如 "Parent_Org", "Decomposed_From")
            max_depth: 最大遍历深度

        Returns:
            从直接上级到最远祖先的有序列表
        """
        from app.repositories.relation_repo import RelationRepository

        db = self._get_db()
        repo = RelationRepository(db)

        def _traverse():
            ancestors = []
            current_id = obj_id
            for _ in range(max_depth):
                # Find INBOUND relations of given type
                aql = """
                FOR edge IN @@collection
                FILTER edge._to == @current_id
                   AND edge.relation_type == @relation_type
                LIMIT 1
                RETURN edge._from
                """
                cursor = db.aql.execute(
                    aql,
                    bind_vars={
                        "@collection": "sys_relations",
                        "current_id": current_id,
                        "relation_type": relation_type,
                    },
                )
                parents = list(cursor)
                if not parents:
                    break
                parent_id = parents[0]
                parent_key = parent_id.split("/")[1]
                parent_obj = db.collection("sys_objects").get(parent_key)
                if parent_obj is None:
                    break
                ancestors.append(parent_obj)
                current_id = parent_id
            return ancestors

        return await self._run_sync(_traverse)

    # ──────────────────────────────────────────────
    # 关系操作
    # ──────────────────────────────────────────────

    async def create_relation(
        self,
        from_id: str,
        to_id: str,
        relation_type: str,
        properties: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """创建两个对象间的关系"""
        from app.services.kernel.relation_service import RelationService
        from app.models.kernel.relation import RelationCreate

        db = self._get_db()
        svc = RelationService(db)
        data = RelationCreate(
            from_obj_id=from_id,
            to_obj_id=to_id,
            relation_type=relation_type,
            properties=properties,
        )
        return await self._run_sync(svc.create_relation, data)

    async def query_graph(
        self,
        start_obj_id: str,
        depth: int = 2,
        direction: str = "OUTBOUND",
    ) -> dict[str, Any]:
        """从指定对象出发遍历图谱

        Returns:
            树状图谱数据: {root, relations, tree, total_vertices, total_edges}
        """
        from app.services.kernel.relation_service import RelationService
        from app.models.kernel.relation import DirectionEnum

        db = self._get_db()
        svc = RelationService(db)
        dir_enum = DirectionEnum(direction)
        return await self._run_sync(svc.get_object_graph, start_obj_id, dir_enum, depth)

    # ──────────────────────────────────────────────
    # 元模型操作
    # ──────────────────────────────────────────────

    async def get_meta_model(self, model_key: str) -> dict[str, Any] | None:
        """根据 model_key 获取元模型"""
        from app.services.kernel.meta_service import MetaModelService

        db = self._get_db()
        svc = MetaModelService(db)
        return await self._run_sync(svc.get_meta_model_by_key, model_key)

    async def list_meta_models(self, limit: int = 100) -> list[dict[str, Any]]:
        """获取所有元模型"""
        from app.services.kernel.meta_service import MetaModelService

        db = self._get_db()
        svc = MetaModelService(db)
        return await self._run_sync(svc.list_meta_models, limit)
