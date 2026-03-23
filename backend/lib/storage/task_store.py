"""
Task Store - Persistent Storage for Report Tasks

Uses SQLite for task persistence, ensuring tasks survive server restarts.
"""

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any, List
from loguru import logger
from contextlib import contextmanager

# Storage directory
STORAGE_DIR = Path(__file__).parent.parent.parent / "storage"
STORAGE_DIR.mkdir(exist_ok=True)

DB_PATH = STORAGE_DIR / "report_tasks.db"


class TaskStore:
    """SQLite-based task persistence store"""

    def __init__(self, db_path: str = str(DB_PATH)):
        self.db_path = db_path
        self._init_db()

    def _init_db(self):
        """Initialize database schema"""
        with self._get_connection() as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS report_tasks (
                    task_id TEXT PRIMARY KEY,
                    status TEXT NOT NULL,
                    state_json TEXT NOT NULL,
                    checkpoint_json TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_status ON report_tasks(status)
            """)
            conn.execute("""
                CREATE INDEX IF NOT EXISTS idx_created_at ON report_tasks(created_at)
            """)
            conn.commit()
        logger.info(f"TaskStore initialized at {self.db_path}")

    @contextmanager
    def _get_connection(self):
        """Get database connection with context manager"""
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def create_task(self, task_id: str, state: Dict[str, Any]) -> bool:
        """Create a new task"""
        now = datetime.utcnow().isoformat()
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    INSERT INTO report_tasks (task_id, status, state_json, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    task_id,
                    state.get("status", "pending"),
                    json.dumps(state, ensure_ascii=False),
                    now,
                    now
                ))
                conn.commit()
            logger.info(f"Task created: {task_id}")
            return True
        except sqlite3.IntegrityError:
            logger.error(f"Task already exists: {task_id}")
            return False
        except Exception as e:
            logger.error(f"Failed to create task {task_id}: {e}")
            return False

    def get_task(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task by ID"""
        try:
            with self._get_connection() as conn:
                row = conn.execute("""
                    SELECT state_json, checkpoint_json, updated_at
                    FROM report_tasks WHERE task_id = ?
                """, (task_id,)).fetchone()

                if row:
                    state = json.loads(row["state_json"])
                    checkpoint = json.loads(row["checkpoint_json"]) if row["checkpoint_json"] else None
                    return {
                        "state": state,
                        "checkpoint": checkpoint,
                        "updated_at": row["updated_at"]
                    }
                return None
        except Exception as e:
            logger.error(f"Failed to get task {task_id}: {e}")
            return None

    def get_state(self, task_id: str) -> Optional[Dict[str, Any]]:
        """Get task state only"""
        result = self.get_task(task_id)
        return result["state"] if result else None

    def update_task(self, task_id: str, state: Dict[str, Any], checkpoint: Optional[Dict[str, Any]] = None) -> bool:
        """Update task state and optionally checkpoint"""
        now = datetime.utcnow().isoformat()
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    UPDATE report_tasks
                    SET status = ?, state_json = ?, checkpoint_json = ?, updated_at = ?
                    WHERE task_id = ?
                """, (
                    state.get("status", "pending"),
                    json.dumps(state, ensure_ascii=False),
                    json.dumps(checkpoint, ensure_ascii=False) if checkpoint else None,
                    now,
                    task_id
                ))
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to update task {task_id}: {e}")
            return False

    def update_state(self, task_id: str, state: Dict[str, Any]) -> bool:
        """Update task state only"""
        return self.update_task(task_id, state, None)

    def save_checkpoint(self, task_id: str, checkpoint: Dict[str, Any]) -> bool:
        """Save workflow checkpoint"""
        now = datetime.utcnow().isoformat()
        try:
            with self._get_connection() as conn:
                conn.execute("""
                    UPDATE report_tasks
                    SET checkpoint_json = ?, updated_at = ?
                    WHERE task_id = ?
                """, (
                    json.dumps(checkpoint, ensure_ascii=False),
                    now,
                    task_id
                ))
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to save checkpoint for {task_id}: {e}")
            return False

    def delete_task(self, task_id: str) -> bool:
        """Delete task"""
        try:
            with self._get_connection() as conn:
                conn.execute("DELETE FROM report_tasks WHERE task_id = ?", (task_id,))
                conn.commit()
            return True
        except Exception as e:
            logger.error(f"Failed to delete task {task_id}: {e}")
            return False

    def list_tasks(
        self,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List tasks with optional filtering"""
        try:
            with self._get_connection() as conn:
                if status:
                    rows = conn.execute("""
                        SELECT task_id, status, created_at, updated_at
                        FROM report_tasks
                        WHERE status = ?
                        ORDER BY created_at DESC
                        LIMIT ? OFFSET ?
                    """, (status, limit, offset)).fetchall()
                else:
                    rows = conn.execute("""
                        SELECT task_id, status, created_at, updated_at
                        FROM report_tasks
                        ORDER BY created_at DESC
                        LIMIT ? OFFSET ?
                    """, (limit, offset)).fetchall()

                return [dict(row) for row in rows]
        except Exception as e:
            logger.error(f"Failed to list tasks: {e}")
            return []

    def count_tasks(self, status: Optional[str] = None) -> int:
        """Count tasks"""
        try:
            with self._get_connection() as conn:
                if status:
                    row = conn.execute(
                        "SELECT COUNT(*) as count FROM report_tasks WHERE status = ?",
                        (status,)
                    ).fetchone()
                else:
                    row = conn.execute(
                        "SELECT COUNT(*) as count FROM report_tasks"
                    ).fetchone()
                return row["count"] if row else 0
        except Exception as e:
            logger.error(f"Failed to count tasks: {e}")
            return 0

    def cleanup_old_tasks(self, days: int = 30) -> int:
        """Clean up tasks older than specified days"""
        try:
            with self._get_connection() as conn:
                cursor = conn.execute("""
                    DELETE FROM report_tasks
                    WHERE datetime(updated_at) < datetime('now', ?)
                    AND status IN ('completed', 'failed', 'cancelled')
                """, (f'-{days} days',))
                conn.commit()
                deleted = cursor.rowcount
                if deleted > 0:
                    logger.info(f"Cleaned up {deleted} old tasks")
                return deleted
        except Exception as e:
            logger.error(f"Failed to cleanup old tasks: {e}")
            return 0


# Global instance
_task_store: Optional[TaskStore] = None


def get_task_store() -> TaskStore:
    """Get global task store instance"""
    global _task_store
    if _task_store is None:
        _task_store = TaskStore()
    return _task_store
