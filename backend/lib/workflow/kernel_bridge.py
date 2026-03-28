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
