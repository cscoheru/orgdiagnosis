"""
DreamService — 三级门控 + 触发巩固

借鉴 Claude Code autoDream.ts 的门控顺序：
  1. 时间门控 — hours since lastConsolidatedAt >= minHours
  2. 会话数门控 — session count since last >= minSessions
  3. 锁门控 — 没有其他进程正在巩固
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from loguru import logger

from app.services.dream.config import DreamConfig
from app.services.dream.consolidation_lock import ConsolidationLock
from app.services.dream.consolidation import Consolidator


class DreamService:
    """后台记忆巩固服务"""

    def __init__(self, db: Any):
        self._db = db
        self._lock = ConsolidationLock(db)
        self._consolidator = Consolidator(db)
        self.config = DreamConfig()

    async def check_and_consolidate(self, project_id: str) -> bool:
        """
        检查是否需要巩固，需要则执行。

        Returns True 如果巩固被执行。
        """
        if not project_id:
            return False

        # Gate 1: 时间门控
        last_at = self._lock.read_last_consolidated_at(project_id)
        now = datetime.now(timezone.utc)
        hours_since = (now - last_at).total_seconds() / 3600
        if hours_since < self.config.min_hours:
            logger.debug(
                f"[dream] skip — {hours_since:.1f}h since last, need {self.config.min_hours}h"
            )
            return False

        # Gate 2: 会话数门控
        recent_sessions = self._count_sessions_since(project_id, last_at)
        if recent_sessions < self.config.min_sessions:
            logger.debug(
                f"[dream] skip — {recent_sessions} sessions since last, need {self.config.min_sessions}"
            )
            return False

        # Gate 3: 锁门控
        acquired = self._lock.try_acquire(
            project_id,
            timeout_hours=self.config.lock_timeout_hours,
        )
        if not acquired:
            logger.debug("[dream] skip — lock held by another process")
            return False

        try:
            # 收集近期会话摘要
            session_summaries = self._get_session_summaries(project_id, last_at)

            # 执行巩固
            stats = await self._consolidator.consolidate(project_id, session_summaries)

            # 更新时间戳并释放锁
            self._lock.update_consolidated_at(project_id)

            logger.info(
                f"[dream] completed — new={stats['new_entries']} "
                f"updated={stats['updated_entries']} pruned={stats['pruned_entries']}"
            )
            return True
        except Exception as e:
            logger.error(f"[dream] consolidation failed: {e}")
            self._lock.release(project_id)
            return False

    def _count_sessions_since(self, project_id: str, since: datetime) -> int:
        """统计指定时间之后的会话数"""
        from app.services.kernel.object_service import ObjectService
        obj_svc = ObjectService(self._db)

        sessions = obj_svc.list_objects(model_key="Agent_Session", limit=200)
        count = 0
        for s in sessions:
            props = s.get("properties", {})
            if props.get("project_id") != project_id:
                continue
            # 简单判断：如果 status 是 completed 或有 interaction_count > 0
            if props.get("status") in ("completed", "failed") or props.get("interaction_count", 0) > 0:
                count += 1
        return count

    def _get_session_summaries(self, project_id: str, since: datetime) -> list[dict]:
        """获取近期会话摘要"""
        from app.services.kernel.object_service import ObjectService
        obj_svc = ObjectService(self._db)

        sessions = obj_svc.list_objects(model_key="Agent_Session", limit=50)
        summaries = []
        for s in sessions:
            props = s.get("properties", {})
            if props.get("project_id") != project_id:
                continue
            summaries.append({
                "session_id": s.get("_key", ""),
                "summary": f"项目目标: {props.get('project_goal', '')}",
                "status": props.get("status", ""),
                "interaction_count": props.get("interaction_count", 0),
            })
        return summaries
