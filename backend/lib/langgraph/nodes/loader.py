"""
Document Loader Nodes

Nodes for loading and preprocessing documents.
"""

from typing import Dict, Any, List, Optional
from loguru import logger

from langchain_core.documents import Document

from lib.langchain import DocumentProcessor


def load_documents_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：加载文档

    从原始文本或文件加载并分片文档
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Loading documents...")

    try:
        processor = DocumentProcessor()

        if state.get("raw_text"):
            documents = processor.process(text=state["raw_text"])
        elif state.get("file_path"):
            documents = processor.process(file_path=state["file_path"])
        else:
            return {
                **state,
                "status": "failed",
                "error": "No input text or file provided",
                "error_step": "load_documents",
            }

        logger.info(f"[{task_id}] Loaded {len(documents)} document chunks")

        return {
            **state,
            "documents": [
                {"content": doc.page_content, "metadata": doc.metadata}
                for doc in documents
            ],
            "status": "processing",
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error loading documents: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "load_documents",
        }


def build_vectorstore_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：构建向量存储

    将文档向量化存储到 ChromaDB
    """
    from lib.langchain import VectorStoreManager

    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Building vectorstore...")

    try:
        # 重建 Document 对象
        documents = [
            Document(page_content=doc["content"], metadata=doc["metadata"])
            for doc in state.get("documents", [])
        ]

        # 创建向量存储
        manager = VectorStoreManager(
            persist_directory=f"./chroma_db/{task_id}"
        )
        manager.create_vectorstore(documents)

        logger.info(f"[{task_id}] Vectorstore created with {len(documents)} documents")

        return {
            **state,
            "vectorstore_info": {
                "persist_directory": f"./chroma_db/{task_id}",
                "document_count": len(documents),
            },
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error building vectorstore: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "build_vectorstore",
        }
