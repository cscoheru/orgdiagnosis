"""
巩固锁 — ArangoDB 对象锁（替代 Claude Code 的文件锁）

Claude Code 用文件 mtime + PID 做锁。
咨询 OS 用 ArangoDB Consolidation_State 对象做锁，支持多容器并发。
"""
from __future__ import annotations

from datetime import datetime, timezone, timedelta
from typing import Any

from loguru import logger


class ConsolidationLock:
    """基于 ArangoDB 对象的巩固锁"""

    def __init__(self, db: Any):
        from app.services.kernel.object_service import ObjectService
        from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate
        self._obj_svc = ObjectService(db)
        self._ObjectCreate = ObjectCreate
        self._ObjectUpdate = ObjectUpdate

    def read_last_consolidated_at(self, project_id: str) -> datetime:
        """读取上次巩固时间"""
        state = self._get_state(project_id)
        if not state:
            return datetime.min.replace(tzinfo=timezone.utc)
        ts = state.get("properties", {}).get("last_consolidated_at", "")
        if not ts:
            return datetime.min.replace(tzinfo=timezone.utc)
        try:
            return datetime.fromisoformat(ts)
        except (ValueError, TypeError):
            return datetime.min.replace(tzinfo=timezone.utc)

    def try_acquire(self, project_id: str, timeout_hours: float = 1.0) -> bool:
        """
        尝试获取锁。

        Returns True 如果获取成功，False 如果被其他进程持有。
        """
        state = self._get_state(project_id)
        now = datetime.now(timezone.utc)

        if state:
            props = state.get("properties", {})
            locked = props.get("locked", False)
            locked_at = props.get("locked_at", "")

            if locked and locked_at:
                try:
                    locked_time = datetime.fromisoformat(locked_at)
                    if now - locked_time < timedelta(hours=timeout_hours):
                        logger.debug(f"[dream:lock] held by another process since {locked_at}")
                        return False
                except (ValueError, TypeError):
                    pass

            # 更新锁
            self._obj_svc.update_object(state["_key"], self._ObjectUpdate(properties={
                **{k: v for k, v in props.items() if k not in ("locked", "locked_at")},
                "locked": True,
                "locked_at": now.isoformat(),
            }))
            return True
        else:
            # 创建锁
            self._obj_svc.create_object(self._ObjectCreate(
                model_key="Consolidation_State",
                properties={
                    "project_id": project_id,
                    "locked": True,
                    "locked_at": now.isoformat(),
                    "last_consolidated_at": "",
                },
            ))
            return True

    def release(self, project_id: str) -> None:
        """释放锁"""
        state = self._get_state(project_id)
        if state:
            props = state.get("properties", {})
            self._obj_svc.update_object(state["_key"], self._ObjectUpdate(properties={
                **{k: v for k, v in props.items() if k not in ("locked", "locked_at")},
                "locked": False,
                "locked_at": "",
            }))

    def update_consolidated_at(self, project_id: str) -> None:
        """更新上次巩固时间"""
        now = datetime.now(timezone.utc).isoformat()
        state = self._get_state(project_id)
        if state:
            props = state.get("properties", {})
            self._obj_svc.update_object(state["_key"], self._ObjectUpdate(properties={
                **{k: v for k, v in props.items() if k != "last_consolidated_at"},
                "last_consolidated_at": now,
                "locked": False,
                "locked_at": "",
            }))

    def _get_state(self, project_id: str) -> dict | None:
        """获取 Consolidation_State 对象"""
        objects = self._obj_svc.list_objects(model_key="Consolidation_State", limit=100)
        for obj in objects:
            if obj.get("properties", {}).get("project_id") == project_id:
                return obj
        return None
