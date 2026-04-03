"""
后台任务管理器 — 借鉴 Claude Code src/tasks/ 的 TaskManager

用 asyncio.create_task 实现后台执行（Python 不需要像 TypeScript 那样 fork 子进程）。
"""
from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Awaitable, Callable


class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class BackgroundTask:
    task_id: str
    task_type: str  # report_generation | data_export | dream_consolidation
    project_id: str | None = None
    session_id: str | None = None
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    started_at: str | None = None
    completed_at: str | None = None


class TaskManager:
    """后台任务管理器"""

    def __init__(self):
        self._tasks: dict[str, BackgroundTask] = {}
        self._cancelled: set[str] = set()

    async def spawn(
        self,
        task_type: str,
        coro: Awaitable[dict],
        project_id: str | None = None,
        session_id: str | None = None,
    ) -> str:
        """启动后台任务，返回 task_id"""
        task_id = uuid.uuid4().hex[:8]
        task = BackgroundTask(
            task_id=task_id,
            task_type=task_type,
            project_id=project_id,
            session_id=session_id,
        )
        self._tasks[task_id] = task

        async def _run():
            if task_id in self._cancelled:
                task.status = TaskStatus.CANCELLED
                self._cancelled.discard(task_id)
                return

            task.status = TaskStatus.RUNNING
            task.started_at = datetime.now(timezone.utc).isoformat()
            try:
                result = await coro
                if task_id in self._cancelled:
                    task.status = TaskStatus.CANCELLED
                    self._cancelled.discard(task_id)
                    return
                task.result = result if isinstance(result, dict) else {"value": result}
                task.status = TaskStatus.COMPLETED
            except Exception as e:
                if task_id in self._cancelled:
                    task.status = TaskStatus.CANCELLED
                    self._cancelled.discard(task_id)
                    return
                task.error = str(e)
                task.status = TaskStatus.FAILED
            finally:
                task.completed_at = datetime.now(timezone.utc).isoformat()

        asyncio.create_task(_run())
        return task_id

    def get_status(self, task_id: str) -> BackgroundTask | None:
        return self._tasks.get(task_id)

    def list_tasks(
        self,
        project_id: str | None = None,
        task_type: str | None = None,
    ) -> list[BackgroundTask]:
        tasks = list(self._tasks.values())
        if project_id:
            tasks = [t for t in tasks if t.project_id == project_id]
        if task_type:
            tasks = [t for t in tasks if t.task_type == task_type]
        return sorted(tasks, key=lambda t: t.created_at, reverse=True)

    def cancel(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if not task:
            return False
        if task.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
            self._cancelled.add(task_id)
            return True
        return False


# 全局单例
task_manager = TaskManager()
