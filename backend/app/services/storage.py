"""
Supabase 存储服务
处理诊断数据的 CRUD 操作
"""
import logging
from typing import Dict, Any, Optional, List
from datetime import datetime
import uuid
import httpx

from app.config import settings

logger = logging.getLogger(__name__)


class StorageError(Exception):
    """存储操作错误"""
    pass


class SupabaseStorage:
    """Supabase 存储服务"""

    def __init__(self):
        self.url = settings.SUPABASE_URL
        self.key = settings.SUPABASE_ANON_KEY
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    def is_configured(self) -> bool:
        """检查 Supabase 是否配置"""
        return bool(self.url and self.key)

    async def create_diagnosis(
        self,
        raw_input: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        创建诊断记录

        Args:
            raw_input: 原始输入文本
            data: 五维诊断数据

        Returns:
            创建的记录
        """
        if not self.is_configured():
            # Mock 模式
            return self._create_mock_diagnosis(raw_input, data)

        session_id = str(uuid.uuid4())

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{self.url}/rest/v1/diagnosis_sessions",
                    headers=self.headers,
                    json={
                        "id": session_id,
                        "raw_input": raw_input,
                        "data_strategy": data.get("strategy"),
                        "data_structure": data.get("structure"),
                        "data_performance": data.get("performance"),
                        "data_compensation": data.get("compensation"),
                        "data_talent": data.get("talent"),
                        "overall_score": data.get("overall_score", 0),
                        "created_at": datetime.utcnow().isoformat()
                    }
                )

                if response.status_code not in [200, 201]:
                    raise StorageError(f"创建记录失败: {response.text}")

                result = response.json()
                return result[0] if isinstance(result, list) else result

        except Exception as e:
            logger.error(f"创建诊断记录失败: {str(e)}")
            raise StorageError(f"存储失败: {str(e)}")

    async def get_diagnosis(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        获取诊断记录

        Args:
            session_id: 会话 ID

        Returns:
            诊断记录或 None
        """
        if not self.is_configured():
            return self._get_mock_diagnosis(session_id)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/diagnosis_sessions?id=eq.{session_id}",
                    headers={**self.headers, "Prefer": "return=representation"}
                )

                if response.status_code != 200:
                    raise StorageError(f"查询失败: {response.text}")

                results = response.json()
                if not results:
                    return None

                return self._format_record(results[0])

        except Exception as e:
            logger.error(f"获取诊断记录失败: {str(e)}")
            raise StorageError(f"查询失败: {str(e)}")

    async def list_diagnoses(
        self,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        获取诊断记录列表

        Args:
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            记录列表
        """
        if not self.is_configured():
            return self._list_mock_diagnoses(limit, offset)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.url}/rest/v1/diagnosis_sessions"
                    f"?select=id,created_at,overall_score,raw_input"
                    f"&order=created_at.desc"
                    f"&limit={limit}"
                    f"&offset={offset}",
                    headers=self.headers
                )

                if response.status_code != 200:
                    raise StorageError(f"查询失败: {response.text}")

                results = response.json()
                return [
                    {
                        "id": r["id"],
                        "created_at": r["created_at"],
                        "overall_score": r.get("overall_score", 0),
                        "preview": (r.get("raw_input", "") or "")[:100] + "..."
                    }
                    for r in results
                ]

        except Exception as e:
            logger.error(f"获取诊断列表失败: {str(e)}")
            raise StorageError(f"查询失败: {str(e)}")

    def _format_record(self, record: Dict[str, Any]) -> Dict[str, Any]:
        """格式化记录"""
        return {
            "id": record.get("id"),
            "created_at": record.get("created_at"),
            "raw_input": record.get("raw_input"),
            "overall_score": record.get("overall_score"),
            "summary": record.get("summary"),
            "strategy": record.get("data_strategy"),
            "structure": record.get("data_structure"),
            "performance": record.get("data_performance"),
            "compensation": record.get("data_compensation"),
            "talent": record.get("data_talent"),
        }

    # ========== Mock 方法 ==========

    _mock_db: Dict[str, Dict[str, Any]] = {}

    def _create_mock_diagnosis(
        self,
        raw_input: str,
        data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Mock 创建"""
        session_id = str(uuid.uuid4())
        record = {
            "id": session_id,
            "raw_input": raw_input,
            "data_strategy": data.get("strategy"),
            "data_structure": data.get("structure"),
            "data_performance": data.get("performance"),
            "data_compensation": data.get("compensation"),
            "data_talent": data.get("talent"),
            "overall_score": data.get("overall_score", 0),
            "created_at": datetime.utcnow().isoformat()
        }
        self._mock_db[session_id] = record
        logger.info(f"[Mock] 创建诊断记录: {session_id}")
        return record

    def _get_mock_diagnosis(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Mock 获取"""
        record = self._mock_db.get(session_id)
        if record:
            return self._format_record(record)
        return None

    def _list_mock_diagnoses(
        self,
        limit: int,
        offset: int
    ) -> List[Dict[str, Any]]:
        """Mock 列表"""
        records = list(self._mock_db.values())
        records.sort(key=lambda x: x.get("created_at", ""), reverse=True)

        return [
            {
                "id": r["id"],
                "created_at": r["created_at"],
                "overall_score": r.get("overall_score", 0),
                "preview": (r.get("raw_input", "") or "")[:100] + "..."
            }
            for r in records[offset:offset + limit]
        ]


# 单例实例
storage = SupabaseStorage()
