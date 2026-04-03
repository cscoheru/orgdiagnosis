"""
记忆服务 — 通过 ObjectService 操作 ArangoDB

提供 Knowledge_Entry 的 CRUD 操作 + 按类型/项目查询。
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.services.memory.types import MemoryType


class MemoryService:
    """知识条目 CRUD — 基于 ArangoDB ObjectService"""

    def __init__(self, db: Any):
        from app.services.kernel.object_service import ObjectService
        from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate
        self._obj_svc = ObjectService(db)
        self._ObjectCreate = ObjectCreate
        self._ObjectUpdate = ObjectUpdate

    def save(
        self,
        memory_type: MemoryType,
        title: str,
        content: str,
        project_id: str | None = None,
        session_id: str | None = None,
        source_type: str = "manual",
        tags: list[str] | None = None,
        confidence: float = 1.0,
    ) -> dict:
        """
        保存知识条目。

        Args:
            memory_type: 记忆类型
            title: 简短标题
            content: 知识内容（支持 Markdown）
            project_id: 关联项目
            session_id: 来源会话
            source_type: manual | agent | dream
            tags: 标签
            confidence: 置信度 0-1
        """
        properties: dict[str, Any] = {
            "memory_type": memory_type.value,
            "title": title,
            "content": content,
            "source_type": source_type,
            "confidence": confidence,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        if project_id:
            properties["project_id"] = project_id
        if session_id:
            properties["session_id"] = session_id
        if tags:
            properties["tags"] = tags

        obj = self._obj_svc.create_object(self._ObjectCreate(
            model_key="Knowledge_Entry",
            properties=properties,
        ))
        logger.info(f"Saved memory: {obj['_key']} type={memory_type.value} title={title}")
        return obj

    def list(
        self,
        project_id: str | None = None,
        memory_type: MemoryType | None = None,
        limit: int = 50,
    ) -> list[dict]:
        """列出知识条目"""
        objects = self._obj_svc.list_objects(
            model_key="Knowledge_Entry",
            limit=limit,
        )
        result = []
        for obj in objects:
            props = obj.get("properties", {})
            if project_id and props.get("project_id") != project_id:
                continue
            if memory_type and props.get("memory_type") != memory_type.value:
                continue
            result.append(obj)
        return result

    def get(self, key: str) -> dict | None:
        """获取单条知识"""
        return self._obj_svc.get_object(key)

    def delete(self, key: str) -> None:
        """删除知识条目"""
        self._obj_svc.delete_object(key)

    def get_index(self, project_id: str | None = None) -> dict:
        """
        获取知识索引 — 按类型分组统计。

        替代 Claude Code 的 MEMORY.md 文件索引。
        """
        objects = self.list(project_id=project_id, limit=500)
        index = {t.value: [] for t in MemoryType}
        for obj in objects:
            props = obj.get("properties", {})
            mtype = props.get("memory_type", "")
            if mtype in index:
                index[mtype].append({
                    "key": obj.get("_key", ""),
                    "title": props.get("title", ""),
                    "tags": props.get("tags", []),
                    "confidence": props.get("confidence", 1.0),
                })
        return index
