"""
搜索服务

提供:
- 全文搜索 (FTS5)
- 按项目筛选
- 按五维维度筛选
- 组合搜索

Created: 2026-03-22
"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass
from loguru import logger

from .store import KnowledgeBaseStore


@dataclass
class SearchResult:
    """搜索结果"""
    page_id: str
    document_id: str
    page_number: int
    content: str
    highlighted_content: Optional[str]
    filename: str
    document_title: Optional[str]
    project_id: Optional[str]
    project_name: Optional[str]
    dimension_l1: Optional[str]
    dimension_l2: Optional[str]
    dimension_l3: Optional[str]
    confidence: Optional[float]
    rank: float

    def to_dict(self) -> Dict[str, Any]:
        return {
            "page_id": self.page_id,
            "document_id": self.document_id,
            "page_number": self.page_number,
            "content": self.content[:500] + "..." if len(self.content) > 500 else self.content,
            "highlighted_content": self.highlighted_content,
            "filename": self.filename,
            "document_title": self.document_title,
            "project_id": self.project_id,
            "project_name": self.project_name,
            "dimension": {
                "l1": self.dimension_l1,
                "l2": self.dimension_l2,
                "l3": self.dimension_l3,
                "confidence": self.confidence
            },
            "rank": self.rank
        }


@dataclass
class SearchResponse:
    """搜索响应"""
    query: str
    total: int
    results: List[SearchResult]
    filters: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "query": self.query,
            "total": self.total,
            "results": [r.to_dict() for r in self.results],
            "filters": self.filters
        }


class SearchService:
    """
    搜索服务

    功能:
    - 全文关键词搜索
    - 项目筛选
    - 五维维度筛选
    - 组合搜索
    """

    def __init__(self, store: KnowledgeBaseStore):
        """
        初始化搜索服务

        Args:
            store: KnowledgeBaseStore 实例
        """
        self.store = store

    def search(
        self,
        query: str,
        project_id: str = None,
        dimension_l1: str = None,
        dimension_l2: str = None,
        dimension_l3: str = None,
        limit: int = 20,
        offset: int = 0
    ) -> SearchResponse:
        """
        综合搜索

        Args:
            query: 搜索关键词
            project_id: 项目ID筛选
            dimension_l1: L1维度筛选
            dimension_l2: L2维度筛选
            dimension_l3: L3维度筛选
            limit: 返回数量限制
            offset: 偏移量

        Returns:
            SearchResponse
        """
        # 构建筛选条件
        filters = {}
        if project_id:
            filters["project_id"] = project_id
        if dimension_l1:
            filters["dimension_l1"] = dimension_l1
        if dimension_l2:
            filters["dimension_l2"] = dimension_l2
        if dimension_l3:
            filters["dimension_l3"] = dimension_l3

        # 执行搜索
        raw_results = self.store.search(
            query=query,
            project_id=project_id,
            dimension_l1=dimension_l1,
            dimension_l2=dimension_l2,
            dimension_l3=dimension_l3,
            limit=limit
        )

        # 转换结果
        results = []
        for row in raw_results:
            results.append(SearchResult(
                page_id=row.get("page_id"),
                document_id=row.get("document_id"),
                page_number=row.get("page_number"),
                content=row.get("content", ""),
                highlighted_content=row.get("highlighted_content"),
                filename=row.get("filename"),
                document_title=row.get("document_title"),
                project_id=row.get("project_id"),
                project_name=row.get("project_name"),
                dimension_l1=row.get("dimension_l1"),
                dimension_l2=row.get("dimension_l2"),
                dimension_l3=row.get("dimension_l3"),
                confidence=row.get("confidence"),
                rank=row.get("rank", 0)
            ))

        logger.info(f"Search: '{query}' -> {len(results)} results")

        return SearchResponse(
            query=query,
            total=len(results),
            results=results,
            filters=filters
        )

    def search_by_project(
        self,
        project_id: str,
        query: str = None,
        limit: int = 50
    ) -> SearchResponse:
        """
        按项目搜索

        Args:
            project_id: 项目ID
            query: 可选的关键词搜索
            limit: 返回数量限制

        Returns:
            SearchResponse
        """
        if query:
            return self.search(query=query, project_id=project_id, limit=limit)

        # 如果没有关键词，返回项目下的所有文档页面
        documents = self.store.list_documents(project_id=project_id, limit=limit)

        results = []
        for doc in documents:
            pages = self.store.get_pages(doc["id"])
            for page in pages[:3]:  # 每个文档最多取3页
                classification = self.store.get_classification(doc["id"])
                results.append(SearchResult(
                    page_id=page["id"],
                    document_id=doc["id"],
                    page_number=page["page_number"],
                    content=page["content"],
                    highlighted_content=None,
                    filename=doc["filename"],
                    document_title=doc.get("title"),
                    project_id=project_id,
                    project_name=None,
                    dimension_l1=classification.get("dimension_l1") if classification else None,
                    dimension_l2=classification.get("dimension_l2") if classification else None,
                    dimension_l3=classification.get("dimension_l3") if classification else None,
                    confidence=classification.get("confidence") if classification else None,
                    rank=0
                ))

        return SearchResponse(
            query=f"project:{project_id}",
            total=len(results),
            results=results[:limit],
            filters={"project_id": project_id}
        )

    def search_by_dimension(
        self,
        dimension_l1: str = None,
        dimension_l2: str = None,
        dimension_l3: str = None,
        query: str = None,
        limit: int = 50
    ) -> SearchResponse:
        """
        按五维维度搜索

        Args:
            dimension_l1: L1维度
            dimension_l2: L2维度
            dimension_l3: L3维度
            query: 可选的关键词搜索
            limit: 返回数量限制

        Returns:
            SearchResponse
        """
        if query:
            return self.search(
                query=query,
                dimension_l1=dimension_l1,
                dimension_l2=dimension_l2,
                dimension_l3=dimension_l3,
                limit=limit
            )

        # 如果没有关键词，按维度筛选
        documents = self.store.search_by_dimension(
            dimension_l1=dimension_l1,
            dimension_l2=dimension_l2,
            dimension_l3=dimension_l3,
            limit=limit
        )

        results = []
        for doc in documents:
            pages = self.store.get_pages(doc["id"])
            for page in pages[:3]:  # 每个文档最多取3页
                results.append(SearchResult(
                    page_id=page["id"],
                    document_id=doc["id"],
                    page_number=page["page_number"],
                    content=page["content"],
                    highlighted_content=None,
                    filename=doc["filename"],
                    document_title=doc.get("title"),
                    project_id=doc.get("project_id"),
                    project_name=None,
                    dimension_l1=doc.get("dimension_l1"),
                    dimension_l2=doc.get("dimension_l2"),
                    dimension_l3=doc.get("dimension_l3"),
                    confidence=doc.get("confidence"),
                    rank=0
                ))

        filters = {}
        if dimension_l1:
            filters["dimension_l1"] = dimension_l1
        if dimension_l2:
            filters["dimension_l2"] = dimension_l2
        if dimension_l3:
            filters["dimension_l3"] = dimension_l3

        return SearchResponse(
            query=f"dimension:{dimension_l1}/{dimension_l2}/{dimension_l3}",
            total=len(results),
            results=results[:limit],
            filters=filters
        )

    def get_suggestions(self, prefix: str, limit: int = 10) -> List[str]:
        """
        获取搜索建议

        基于已有文档内容提供建议

        Args:
            prefix: 搜索前缀
            limit: 建议数量

        Returns:
            建议列表
        """
        # 简单实现：返回常见关键词
        # TODO: 可以基于搜索历史或热门词汇优化
        common_terms = [
            "战略规划", "组织架构", "绩效管理", "薪酬体系", "人才盘点",
            "业务现状", "市场洞察", "关键任务", "绩效指标", "激励方案",
            "组织效能", "跨部门协同", "OKR", "KPI", "胜任力模型"
        ]

        suggestions = [term for term in common_terms if prefix.lower() in term.lower()]
        return suggestions[:limit]

    def get_recent_searches(self, user_id: str = None, limit: int = 10) -> List[str]:
        """
        获取最近搜索记录

        Args:
            user_id: 用户ID（可选）
            limit: 返回数量

        Returns:
            搜索记录列表
        """
        # TODO: 实现搜索历史记录
        return []


def get_search_service(store: KnowledgeBaseStore = None) -> SearchService:
    """
    获取搜索服务实例

    Args:
        store: KnowledgeBaseStore 实例（可选，自动创建）

    Returns:
        SearchService 实例
    """
    if store is None:
        from .store import get_knowledge_store
        store = get_knowledge_store()
    return SearchService(store)
