"""
四阶段巩固逻辑 — 借鉴 Claude Code consolidationPrompt.ts

Phase 1: 定向 — 读取已有知识索引
Phase 2: 收集 — 从 LangGraph checkpoint 读取近期会话
Phase 3: 整合 — AI 整合知识，写入 ArangoDB
Phase 4: 修剪 — 标记过期知识
"""
from __future__ import annotations

from loguru import logger

from app.services.memory.memory_service import MemoryService
from app.services.memory.types import MemoryType


class Consolidator:
    """四阶段知识巩固"""

    def __init__(self, db: Any):
        self._db = db
        self._memory_svc = MemoryService(db)

    async def consolidate(
        self,
        project_id: str,
        session_summaries: list[dict],
    ) -> dict:
        """
        执行四阶段巩固。

        Args:
            project_id: 项目 ID
            session_summaries: 近期会话摘要列表 [{"session_id": ..., "summary": ..., "messages": [...]}]

        Returns:
            {"new_entries": int, "updated_entries": int, "pruned_entries": int}
        """
        stats = {"new_entries": 0, "updated_entries": 0, "pruned_entries": 0}

        # Phase 1: 定向 — 读取已有知识索引
        existing_index = self._memory_svc.get_index(project_id=project_id)
        total_existing = sum(len(v) for v in existing_index.values())
        logger.info(f"[dream:consolidate] Phase 1: {total_existing} existing knowledge entries")

        # Phase 2: 收集 — 从 session_summaries 提取知识
        new_knowledge = await self._extract_knowledge(session_summaries)
        logger.info(f"[dream:consolidate] Phase 2: extracted {len(new_knowledge)} knowledge items")

        # Phase 3: 整合 — 去重后写入 ArangoDB
        for item in new_knowledge:
            # 简单去重：标题相似则更新，否则新建
            is_duplicate = False
            existing = self._memory_svc.list(
                project_id=project_id,
                memory_type=MemoryType(item["memory_type"]),
                limit=100,
            )
            for ex in existing:
                if ex.get("properties", {}).get("title") == item["title"]:
                    is_duplicate = True
                    break

            if is_duplicate:
                stats["updated_entries"] += 1
                logger.debug(f"[dream:consolidate] Duplicate: {item['title']}")
            else:
                self._memory_svc.save(
                    memory_type=MemoryType(item["memory_type"]),
                    title=item["title"],
                    content=item["content"],
                    project_id=project_id,
                    source_type="dream",
                    confidence=item.get("confidence", 0.8),
                    tags=item.get("tags", []),
                )
                stats["new_entries"] += 1

        # Phase 4: 修剪 — 标记过期知识（confidence < 0.5 且超过 30 天）
        # 简化实现：暂不自动删除，只记录日志
        logger.info(f"[dream:consolidate] Phase 4: pruning skipped (no expiration policy yet)")

        return stats

    async def _extract_knowledge(self, session_summaries: list[dict]) -> list[dict]:
        """从会话摘要中提取知识条目"""
        if not session_summaries:
            return []

        # 如果没有 AI 配置，使用简单的规则提取
        from app.services.ai_client import AIClient
        ai_client = AIClient()

        if not ai_client.is_configured():
            return self._rule_based_extract(session_summaries)

        # AI 提取
        try:
            summaries_text = "\n".join(
                f"会话 {s['session_id']}: {s.get('summary', '')}"
                for s in session_summaries
            )

            system_prompt = """你是一位咨询知识管理助手。从以下会话摘要中提取值得保存的知识条目。
每条知识需要分类为: client(客户)、methodology(方法论)、project(项目)、reference(参考资源)。
输出 JSON 数组格式。直接输出 JSON，不要加 markdown 代码块。"""

            user_prompt = f"""会话摘要：
{summaries_text}

请提取知识条目，格式:
[{{"memory_type": "client|methodology|project|reference", "title": "简短标题", "content": "详细内容", "confidence": 0.8, "tags": ["标签"]}}]"""

            items = await ai_client.chat_json(system_prompt, user_prompt, temperature=0.2)
            if isinstance(items, list):
                return items
            if isinstance(items, dict) and "items" in items:
                return items["items"]
            return []
        except Exception as e:
            logger.warning(f"[dream:consolidate] AI extraction failed: {e}, falling back to rules")
            return self._rule_based_extract(session_summaries)

    def _rule_based_extract(self, session_summaries: list[dict]) -> list[dict]:
        """规则提取（AI 不可用时的 fallback）"""
        items = []
        for s in session_summaries:
            summary = s.get("summary", "")
            if not summary:
                continue
            items.append({
                "memory_type": "project",
                "title": f"会话 {s['session_id'][:8]} 摘要",
                "content": summary,
                "confidence": 0.5,
                "tags": ["auto-extracted"],
            })
        return items
