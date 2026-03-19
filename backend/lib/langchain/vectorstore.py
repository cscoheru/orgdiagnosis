"""
Vector Store Manager for Five-Dimensional Diagnosis

This module provides ChromaDB integration for document retrieval
using LangChain's vector store abstractions.
"""

import os
import shutil
from typing import List, Optional, Dict, Any
from loguru import logger

# LangChain imports
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings

# 尝试导入不同的 Embeddings 实现
try:
    from langchain_openai import OpenAIEmbeddings
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

try:
    from langchain_community.embeddings import HuggingFaceEmbeddings
    HAS_HUGGINGFACE = True
except ImportError:
    HAS_HUGGINGFACE = False

# ChromaDB
try:
    from langchain_chroma import Chroma
    import chromadb
    HAS_CHROMA = True
except ImportError:
    HAS_CHROMA = False


class VectorStoreManager:
    """
    向量存储管理器

    核心功能：
    1. 创建/加载 ChromaDB 向量库
    2. 文档向量化存储
    3. 语义相似度检索
    4. 按维度过滤检索
    """

    def __init__(
        self,
        persist_directory: str = "./chroma_db",
        embedding_type: str = "openai",
        collection_name: str = "diagnosis_docs",
        openai_api_key: Optional[str] = None
    ):
        """
        初始化向量存储管理器

        Args:
            persist_directory: 持久化目录
            embedding_type: 嵌入类型 (openai/huggingface)
            collection_name: 集合名称
            openai_api_key: OpenAI API Key (如果使用 OpenAI Embeddings)
        """
        self.persist_directory = persist_directory
        self.collection_name = collection_name
        self.embedding_type = embedding_type

        # 初始化 Embeddings
        self.embeddings = self._init_embeddings(embedding_type, openai_api_key)

        # 初始化 Vector Store
        self.vectorstore: Optional[Chroma] = None

        logger.info(f"VectorStoreManager initialized: persist_dir={persist_directory}, embedding={embedding_type}")

    def _init_embeddings(self, embedding_type: str, api_key: Optional[str]) -> Embeddings:
        """初始化 Embeddings 模型"""
        if embedding_type == "openai":
            if not HAS_OPENAI:
                raise ImportError("langchain-openai not installed. Run: pip install langchain-openai")

            if api_key:
                os.environ["OPENAI_API_KEY"] = api_key

            return OpenAIEmbeddings(
                model="text-embedding-3-small",  # 更经济的选择
                # model="text-embedding-ada-002",  # 旧版模型
            )

        elif embedding_type == "huggingface":
            if not HAS_HUGGINGFACE:
                raise ImportError("langchain-community not installed. Run: pip install langchain-community")

            # 使用本地模型，免费
            return HuggingFaceEmbeddings(
                model_name="BAAI/bge-small-zh-v1.5",  # 中文优化的小模型
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )

        else:
            raise ValueError(f"Unknown embedding type: {embedding_type}")

    def create_vectorstore(
        self,
        documents: List[Document],
        reset: bool = False
    ) -> Chroma:
        """
        创建向量存储

        Args:
            documents: 文档列表
            reset: 是否重置现有存储

        Returns:
            Chroma 向量存储实例
        """
        if not HAS_CHROMA:
            raise ImportError("chromadb not installed. Run: pip install chromadb")

        if reset and os.path.exists(self.persist_directory):
            shutil.rmtree(self.persist_directory)
            logger.info(f"Reset vector store: {self.persist_directory}")

        # 创建持久化客户端
        client = chromadb.PersistentClient(path=self.persist_directory)

        # 创建向量存储
        self.vectorstore = Chroma.from_documents(
            documents=documents,
            embedding=self.embeddings,
            client=client,
            collection_name=self.collection_name,
        )

        logger.info(f"Created vector store with {len(documents)} documents")
        return self.vectorstore

    def load_vectorstore(self) -> Optional[Chroma]:
        """
        加载现有向量存储

        Returns:
            Chroma 向量存储实例，如果不存在返回 None
        """
        if not os.path.exists(self.persist_directory):
            logger.warning(f"Persist directory not found: {self.persist_directory}")
            return None

        client = chromadb.PersistentClient(path=self.persist_directory)

        self.vectorstore = Chroma(
            client=client,
            collection_name=self.collection_name,
            embedding_function=self.embeddings,
        )

        logger.info(f"Loaded vector store from {self.persist_directory}")
        return self.vectorstore

    def add_documents(self, documents: List[Document]) -> None:
        """
        向现有向量存储添加文档

        Args:
            documents: 要添加的文档列表
        """
        if self.vectorstore is None:
            self.create_vectorstore(documents)
        else:
            self.vectorstore.add_documents(documents)
            logger.info(f"Added {len(documents)} documents to vector store")

    def similarity_search(
        self,
        query: str,
        k: int = 5,
        filter_dict: Optional[Dict[str, Any]] = None
    ) -> List[Document]:
        """
        相似度搜索

        Args:
            query: 查询文本
            k: 返回结果数量
            filter_dict: 元数据过滤条件

        Returns:
            相似文档列表
        """
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Call create_vectorstore() first.")

        results = self.vectorstore.similarity_search(
            query=query,
            k=k,
            filter=filter_dict
        )

        logger.info(f"Similarity search for '{query[:50]}...': found {len(results)} results")
        return results

    def similarity_search_with_score(
        self,
        query: str,
        k: int = 5
    ) -> List[tuple]:
        """
        带分数的相似度搜索

        Args:
            query: 查询文本
            k: 返回结果数量

        Returns:
            (Document, score) 列表，分数越低越相似
        """
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Call create_vectorstore() first.")

        results = self.vectorstore.similarity_search_with_score(
            query=query,
            k=k
        )

        return results

    def mmr_search(
        self,
        query: str,
        k: int = 5,
        fetch_k: int = 20,
        lambda_mult: float = 0.5
    ) -> List[Document]:
        """
        MMR (最大边际相关性) 搜索

        在相关性和多样性之间取得平衡

        Args:
            query: 查询文本
            k: 返回结果数量
            fetch_k: 候选文档数量
            lambda_mult: 0 = 最大多样性, 1 = 最大相关性

        Returns:
            多样化的相似文档列表
        """
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Call create_vectorstore() first.")

        results = self.vectorstore.max_marginal_relevance_search(
            query=query,
            k=k,
            fetch_k=fetch_k,
            lambda_mult=lambda_mult
        )

        logger.info(f"MMR search for '{query[:50]}...': found {len(results)} results")
        return results

    def get_retriever(self, search_kwargs: Optional[Dict] = None):
        """
        获取 LangChain Retriever

        用于与 LangChain Chain 和 Agent 集成

        Args:
            search_kwargs: 搜索参数

        Returns:
            VectorStoreRetriever 实例
        """
        if self.vectorstore is None:
            raise ValueError("Vector store not initialized. Call create_vectorstore() first.")

        default_kwargs = {"k": 5}
        if search_kwargs:
            default_kwargs.update(search_kwargs)

        return self.vectorstore.as_retriever(
            search_kwargs=default_kwargs
        )

    def delete_collection(self) -> None:
        """删除集合"""
        if self.vectorstore:
            self.vectorstore.delete_collection()
            self.vectorstore = None
            logger.info(f"Deleted collection: {self.collection_name}")

    def get_collection_stats(self) -> Dict[str, Any]:
        """获取集合统计信息"""
        if self.vectorstore is None:
            return {"status": "not_initialized"}

        client = chromadb.PersistentClient(path=self.persist_directory)
        collection = client.get_collection(self.collection_name)

        return {
            "status": "active",
            "name": self.collection_name,
            "count": collection.count(),
            "persist_directory": self.persist_directory
        }


class DimensionRetriever:
    """
    维度专用检索器

    为每个维度定制检索策略
    """

    # 维度查询模板
    DIMENSION_QUERIES = {
        "strategy": [
            "战略规划 目标 愿景 使命",
            "市场竞争 业务增长",
            "创新 业务设计",
            "关键任务 执行"
        ],
        "structure": [
            "组织架构 部门 层级",
            "决策机制 授权体系",
            "流程 协作 数字化",
            "人效 响应速度"
        ],
        "performance": [
            "绩效考核 目标 KPI OKR",
            "辅导 反馈 面谈",
            "公平 申诉",
            "激励 晋升 淘汰"
        ],
        "compensation": [
            "薪酬 工资 奖金",
            "福利 调薪",
            "固浮比 公平",
            "总额管控"
        ],
        "talent": [
            "人才 招聘 盘点 梯队",
            "胜任力 雇主品牌",
            "培养 骨干 职业通道",
            "流失 敬业 非物质激励"
        ]
    }

    def __init__(self, vectorstore_manager: VectorStoreManager):
        self.manager = vectorstore_manager

    def retrieve_for_dimension(
        self,
        dimension: str,
        k: int = 5
    ) -> List[Document]:
        """
        为指定维度检索相关文档

        使用多个查询词进行检索，合并去重

        Args:
            dimension: 维度名称
            k: 每个查询返回的结果数

        Returns:
            相关文档列表
        """
        if dimension not in self.DIMENSION_QUERIES:
            raise ValueError(f"Unknown dimension: {dimension}")

        queries = self.DIMENSION_QUERIES[dimension]
        all_docs = []
        seen_content = set()

        for query in queries:
            docs = self.manager.similarity_search(query, k=k)

            for doc in docs:
                # 简单去重：基于内容哈希
                content_hash = hash(doc.page_content[:200])
                if content_hash not in seen_content:
                    seen_content.add(content_hash)
                    all_docs.append(doc)

        logger.info(f"Retrieved {len(all_docs)} unique documents for dimension '{dimension}'")
        return all_docs


# 便捷函数
def create_vectorstore_from_documents(
    documents: List[Document],
    persist_directory: str = "./chroma_db",
    embedding_type: str = "openai"
) -> VectorStoreManager:
    """
    从文档创建向量存储的便捷函数

    Args:
        documents: 文档列表
        persist_directory: 持久化目录
        embedding_type: 嵌入类型

    Returns:
        VectorStoreManager 实例
    """
    manager = VectorStoreManager(
        persist_directory=persist_directory,
        embedding_type=embedding_type
    )
    manager.create_vectorstore(documents)
    return manager
