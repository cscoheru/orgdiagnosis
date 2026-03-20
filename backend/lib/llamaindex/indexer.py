"""
Consulting Knowledge Indexer

Builds and manages vector indices for consulting knowledge base
using LlamaIndex with Qwen3-VL-Embedding (DashScope).
"""

import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from loguru import logger

from llama_index.core import VectorStoreIndex, StorageContext, Settings
from llama_index.core.schema import Document, NodeWithScore
from llama_index.core.node_parser import SentenceSplitter, HierarchicalNodeParser

# Vector Store
from llama_index.vector_stores.chroma import ChromaVectorStore
import chromadb

# Embedding
from .embeddings import get_embed_model, BatchedDashScopeEmbedding


class ConsultingKnowledgeIndexer:
    """
    咨询知识库索引构建器

    使用 Qwen3-VL-Embedding (DashScope) 构建向量索引
    持久化到 ChromaDB
    """

    def __init__(
        self,
        persist_dir: str = "./storage/chroma",
        collection_name: str = "consulting_knowledge",
        embed_model_type: str = "dashscope",
        chunk_size: int = 512,
        chunk_overlap: int = 50,
        embed_batch_size: int = 10,
    ):
        """
        初始化索引构建器

        Args:
            persist_dir: 向量存储持久化目录
            collection_name: ChromaDB 集合名称
            embed_model_type: Embedding 模型类型 (dashscope/openai)
            chunk_size: 文本分块大小
            chunk_overlap: 分块重叠大小
            embed_batch_size: Embedding 批量大小 (DashScope 限制为 10)
        """
        self.persist_dir = Path(persist_dir)
        self.persist_dir.mkdir(parents=True, exist_ok=True)
        self.collection_name = collection_name
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
        self.embed_batch_size = embed_batch_size

        # 初始化 Embedding 模型
        self.embed_model = self._init_embed_model(embed_model_type)

        # 配置全局 Settings
        Settings.embed_model = self.embed_model
        Settings.chunk_size = chunk_size
        Settings.chunk_overlap = chunk_overlap

        # 初始化向量存储
        self.chroma_client = None
        self.chroma_collection = None
        self.vector_store = None
        self.index = None

        logger.info(f"ConsultingKnowledgeIndexer initialized with {embed_model_type} embedding (batch_size={embed_batch_size})")

    def _init_embed_model(self, model_type: str):
        """初始化 Embedding 模型"""
        try:
            model = get_embed_model(
                embed_model_type=model_type,
                model_name="text-embedding-v3",
            )
            logger.info(f"Using {model_type} embedding")
            return model
        except Exception as e:
            logger.error(f"Failed to initialize {model_type} embedding: {e}")
            raise

    def _init_chroma(self):
        """初始化 ChromaDB"""
        self.chroma_client = chromadb.PersistentClient(path=str(self.persist_dir))

        # 获取或创建集合
        self.chroma_collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name,
            metadata={"hnsw:space": "cosine"}
        )

        self.vector_store = ChromaVectorStore(chroma_collection=self.chroma_collection)
        logger.info(f"ChromaDB initialized at {self.persist_dir}")

    def build_index(
        self,
        documents: List[Document],
        show_progress: bool = True
    ) -> VectorStoreIndex:
        """
        构建向量索引

        Args:
            documents: Document 列表
            show_progress: 是否显示进度

        Returns:
            VectorStoreIndex
        """
        if not documents:
            logger.warning("No documents to index")
            return None

        # 初始化 ChromaDB
        self._init_chroma()

        # 创建存储上下文
        storage_context = StorageContext.from_defaults(vector_store=self.vector_store)

        # 创建节点解析器
        node_parser = SentenceSplitter(
            chunk_size=self.chunk_size,
            chunk_overlap=self.chunk_overlap,
        )

        logger.info(f"Building index for {len(documents)} documents...")

        # 构建索引 (使用小批量以符合 DashScope 限制)
        self.index = VectorStoreIndex.from_documents(
            documents,
            storage_context=storage_context,
            embed_model=self.embed_model,
            transformations=[node_parser],
            show_progress=show_progress,
            # DashScope 限制批量大小为 10
            embed_batch_size=self.embed_batch_size,
        )

        logger.info(f"Index built successfully with {len(documents)} documents")

        return self.index

    def load_index(self) -> Optional[VectorStoreIndex]:
        """
        加载已有索引

        Returns:
            VectorStoreIndex 或 None
        """
        try:
            self._init_chroma()

            storage_context = StorageContext.from_defaults(
                vector_store=self.vector_store
            )

            self.index = VectorStoreIndex.from_vector_store(
                self.vector_store,
                embed_model=self.embed_model,
            )

            logger.info("Index loaded successfully")
            return self.index

        except Exception as e:
            logger.error(f"Error loading index: {e}")
            return None

    def add_documents(self, documents: List[Document]) -> bool:
        """
        向现有索引添加文档

        Args:
            documents: 要添加的 Document 列表

        Returns:
            是否成功
        """
        if self.index is None:
            logger.warning("No index loaded, creating new one")
            return self.build_index(documents) is not None

        try:
            for doc in documents:
                self.index.insert(doc)

            logger.info(f"Added {len(documents)} documents to index")
            return True

        except Exception as e:
            logger.error(f"Error adding documents: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """获取索引统计信息"""
        if self.chroma_collection is None:
            return {"status": "not_initialized"}

        count = self.chroma_collection.count()
        return {
            "status": "ready",
            "document_count": count,
            "collection_name": self.collection_name,
            "persist_dir": str(self.persist_dir),
        }

    def delete_index(self) -> bool:
        """删除索引"""
        try:
            if self.chroma_client:
                self.chroma_client.delete_collection(self.collection_name)
                logger.info(f"Collection '{self.collection_name}' deleted")
                self.index = None
                self.vector_store = None
                return True
        except Exception as e:
            logger.error(f"Error deleting index: {e}")
            return False


def create_consulting_index(
    data_dir: str = "./data/historical_reports",
    persist_dir: str = "./storage/chroma",
    category: Optional[str] = None,
    embed_model_type: str = "dashscope",
) -> ConsultingKnowledgeIndexer:
    """
    创建咨询知识库索引的便捷函数

    Args:
        data_dir: 历史报告目录
        persist_dir: 持久化目录
        category: 指定加载的类别
        embed_model_type: Embedding 模型类型

    Returns:
        ConsultingKnowledgeIndexer 实例
    """
    from .document_processor import ConsultingDocumentProcessor

    # 加载文档
    processor = ConsultingDocumentProcessor(data_dir)
    documents = processor.load_documents(category=category)

    # 构建索引
    indexer = ConsultingKnowledgeIndexer(
        persist_dir=persist_dir,
        embed_model_type=embed_model_type,
    )
    indexer.build_index(documents)

    return indexer
