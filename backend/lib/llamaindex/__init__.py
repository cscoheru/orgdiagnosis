"""
LlamaIndex Knowledge Base Module

This module provides document processing, indexing, and retrieval capabilities
for historical consulting reports using LlamaIndex.
"""

from .document_processor import ConsultingDocumentProcessor
from .indexer import ConsultingKnowledgeIndexer
from .retriever import ConsultingKnowledgeRetriever
from .embeddings import BatchedDashScopeEmbedding, get_embed_model

__all__ = [
    "ConsultingDocumentProcessor",
    "ConsultingKnowledgeIndexer",
    "ConsultingKnowledgeRetriever",
    "BatchedDashScopeEmbedding",
    "get_embed_model",
]
