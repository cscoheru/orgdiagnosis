"""
Knowledge Base V2 - 简化版知识库

不使用向量，直接基于:
- 全文搜索 (SQLite FTS5)
- 项目分组
- 五维分类

核心组件:
- KnowledgeBaseStore: SQLite存储
- TaxonomyManager: 五维分类管理
- DocumentParser: 文档解析器 (PPTX/PDF)
- DocumentClassifier: 文档分类器
- SearchService: 搜索服务

Created: 2026-03-22
"""

from .store import KnowledgeBaseStore, get_knowledge_store
from .taxonomy_data import TaxonomyManager, TAXONOMY_STATS
from .document_parser import DocumentParser, ParsedDocument, ParsedPage, parse_document, parse_and_store
from .classifier import DocumentClassifier, ClassificationResult, get_classifier
from .search_service import SearchService, SearchResult, SearchResponse, get_search_service

__all__ = [
    # Store
    "KnowledgeBaseStore",
    "get_knowledge_store",

    # Taxonomy
    "TaxonomyManager",
    "TAXONOMY_STATS",

    # Parser
    "DocumentParser",
    "ParsedDocument",
    "ParsedPage",
    "parse_document",
    "parse_and_store",

    # Classifier
    "DocumentClassifier",
    "ClassificationResult",
    "get_classifier",

    # Search
    "SearchService",
    "SearchResult",
    "SearchResponse",
    "get_search_service",
]
