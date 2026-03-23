"""
知识库后台处理 API

功能：
- 接收 R2 文件处理请求
- 从 R2 下载文件
- 解析 + 分块
- 向量化 + 存入 ChromaDB
- 更新 PostgreSQL 元数据

部署：阿里云服务器
"""

import os
import uuid
import asyncio
from pathlib import Path
from typing import Optional
from datetime import datetime
from loguru import logger

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/kb", tags=["Knowledge Base Processing"])


# ============================================================================
# 配置
# ============================================================================

# R2 配置
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID", "")
R2_ACCESS_KEY = os.getenv("R2_ACCESS_KEY", "")
R2_SECRET_KEY = os.getenv("R2_SECRET_KEY", "")
R2_BUCKET = os.getenv("R2_BUCKET", "consulting-knowledge")

# PostgreSQL (复用现有配置)
DATABASE_URL = os.getenv("DATABASE_URL", "")

# ChromaDB 路径
CHROMA_PERSIST_DIR = os.getenv("CHROMA_PERSIST_DIR", "./storage/chroma")


# ============================================================================
# Pydantic 模型
# ============================================================================

class ProcessRequest(BaseModel):
    """处理请求"""
    r2_key: str
    file_name: str
    file_hash: str
    category: Optional[str] = None


class ProcessResponse(BaseModel):
    """处理响应"""
    document_id: str
    status: str
    message: str


class ProcessStatus(BaseModel):
    """处理状态"""
    document_id: str
    status: str  # pending, processing, completed, failed
    progress: int
    chunks_created: Optional[int] = None
    error: Optional[str] = None


# ============================================================================
# 处理任务存储 (生产环境用 Redis)
# ============================================================================

process_tasks = {}  # document_id -> status


# ============================================================================
# R2 下载器
# ============================================================================

class R2Downloader:
    """从 R2 下载文件"""

    def __init__(self):
        self.account_id = R2_ACCOUNT_ID
        self.access_key = R2_ACCESS_KEY
        self.secret_key = R2_SECRET_KEY
        self.bucket = R2_BUCKET

    def download(self, r2_key: str, local_path: str) -> bool:
        """下载文件"""
        try:
            import boto3
            from botocore.config import Config

            s3 = boto3.client(
                "s3",
                endpoint_url=f"https://{self.account_id}.r2.cloudflarestorage.com",
                aws_access_key_id=self.access_key,
                aws_secret_access_key=self.secret_key,
                config=Config(signature_version="s3v4")
            )

            s3.download_file(self.bucket, r2_key, local_path)
            return True

        except Exception as e:
            logger.error(f"R2 下载失败: {e}")
            return False


# ============================================================================
# 后台处理函数
# ============================================================================

async def process_document_task(
    document_id: str,
    r2_key: str,
    file_name: str,
    file_hash: str,
    category: Optional[str] = None
):
    """
    后台处理文档

    流程：
    1. 从 R2 下载文件
    2. 解析文档
    3. 分块
    4. 向量化
    5. 存入 ChromaDB
    6. 更新 PostgreSQL
    """
    from lib.llamaindex import ConsultingDocumentProcessor
    from lib.llamaindex.embeddings import get_embed_model
    import chromadb

    process_tasks[document_id] = {
        "status": "processing",
        "progress": 0,
        "chunks_created": 0
    }

    temp_file = None

    try:
        # Step 1: 下载文件 (10%)
        logger.info(f"[{document_id}] 从 R2 下载: {r2_key}")
        temp_file = f"/tmp/{document_id}_{file_name}"

        downloader = R2Downloader()
        if not downloader.download(r2_key, temp_file):
            raise Exception("R2 下载失败")

        process_tasks[document_id]["progress"] = 10

        # Step 2: 解析文档 (20%)
        logger.info(f"[{document_id}] 解析文档...")
        processor = ConsultingDocumentProcessor()
        documents = processor.load_single_file(Path(temp_file))

        if not documents:
            raise Exception("文档解析失败，无内容")

        process_tasks[document_id]["progress"] = 20

        # Step 3: 分块 (30%)
        logger.info(f"[{document_id}] 分块处理...")
        from llama_index.core.node_parser import SentenceSplitter

        splitter = SentenceSplitter(chunk_size=512, chunk_overlap=50)
        nodes = splitter.get_nodes_from_documents(documents)

        logger.info(f"[{document_id}] 生成 {len(nodes)} 个 chunks")
        process_tasks[document_id]["progress"] = 30

        # Step 4: 向量化 (30-80%)
        logger.info(f"[{document_id}] 向量化...")
        embed_model = get_embed_model(
            embed_model_type="dashscope",
            model_name="text-embedding-v3"
        )

        # 批量向量化
        embeddings = []
        batch_size = 10  # DashScope 限制

        for i in range(0, len(nodes), batch_size):
            batch = nodes[i:i+batch_size]
            texts = [n.get_content() for n in batch]

            # 获取向量
            batch_embeddings = embed_model.get_text_embedding_batch(texts)
            embeddings.extend(batch_embeddings)

            progress = 30 + int((i / len(nodes)) * 50)
            process_tasks[document_id]["progress"] = progress

        process_tasks[document_id]["progress"] = 80

        # Step 5: 存入 ChromaDB (80-90%)
        logger.info(f"[{document_id}] 存入 ChromaDB...")

        chroma_client = chromadb.PersistentClient(path=CHROMA_PERSIST_DIR)
        collection = chroma_client.get_or_create_collection(
            name="consulting_knowledge",
            metadata={"hnsw:space": "cosine"}
        )

        # 准备数据
        ids = [str(uuid.uuid4()) for _ in nodes]
        metadatas = []
        for node in nodes:
            meta = node.metadata.copy()
            meta["document_id"] = document_id
            meta["file_name"] = file_name
            meta["category"] = category or "general"
            metadatas.append(meta)

        # 添加到集合
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=[n.get_content() for n in nodes],
            metadatas=metadatas
        )

        process_tasks[document_id]["progress"] = 90
        process_tasks[document_id]["chunks_created"] = len(nodes)

        # Step 6: 更新 PostgreSQL (90-100%)
        logger.info(f"[{document_id}] 更新数据库...")

        # TODO: 实际的 PostgreSQL 更新
        # async with get_db_session() as session:
        #     doc = await session.get(KnowledgeDocument, document_id)
        #     doc.status = "ready"
        #     doc.chunk_count = len(nodes)
        #     doc.processed_at = datetime.now()
        #     await session.commit()

        # 记录 chunk 信息
        # for i, (chunk_id, node) in enumerate(zip(ids, nodes)):
        #     chunk = KnowledgeChunk(
        #         id=chunk_id,
        #         document_id=document_id,
        #         chunk_index=i,
        #         content=node.get_content()[:500],
        #         chroma_id=chunk_id
        #     )
        #     session.add(chunk)

        process_tasks[document_id]["progress"] = 100
        process_tasks[document_id]["status"] = "completed"

        logger.info(f"[{document_id}] 处理完成: {len(nodes)} chunks")

    except Exception as e:
        logger.error(f"[{document_id}] 处理失败: {e}")
        process_tasks[document_id]["status"] = "failed"
        process_tasks[document_id]["error"] = str(e)

    finally:
        # 清理临时文件
        if temp_file and Path(temp_file).exists():
            Path(temp_file).unlink()


# ============================================================================
# API 端点
# ============================================================================

@router.post("/process", response_model=ProcessResponse)
async def process_document(
    request: ProcessRequest,
    background_tasks: BackgroundTasks
):
    """
    触发文档处理

    文件已在 R2，此端点触发后台处理流程
    """
    document_id = str(uuid.uuid4())

    # 记录到数据库
    # TODO: 实际的 PostgreSQL 插入
    # async with get_db_session() as session:
    #     doc = KnowledgeDocument(
    #         id=document_id,
    #         file_name=request.file_name,
    #         r2_key=request.r2_key,
    #         category=request.category,
    #         status="pending"
    #     )
    #     session.add(doc)
    #     await session.commit()

    # 添加后台任务
    background_tasks.add_task(
        process_document_task,
        document_id,
        request.r2_key,
        request.file_name,
        request.file_hash,
        request.category
    )

    return ProcessResponse(
        document_id=document_id,
        status="processing",
        message=f"文档 {request.file_name} 已加入处理队列"
    )


@router.get("/process/{document_id}", response_model=ProcessStatus)
async def get_process_status(document_id: str):
    """获取处理状态"""
    if document_id not in process_tasks:
        # 尝试从数据库查询
        # TODO: 实际的 PostgreSQL 查询
        raise HTTPException(status_code=404, detail="文档不存在")

    task = process_tasks[document_id]
    return ProcessStatus(
        document_id=document_id,
        status=task["status"],
        progress=task["progress"],
        chunks_created=task.get("chunks_created"),
        error=task.get("error")
    )


@router.post("/batch-process")
async def batch_process(
    requests: list[ProcessRequest],
    background_tasks: BackgroundTasks
):
    """
    批量处理

    一次提交多个文档处理请求
    """
    document_ids = []

    for req in requests:
        document_id = str(uuid.uuid4())
        document_ids.append(document_id)

        background_tasks.add_task(
            process_document_task,
            document_id,
            req.r2_key,
            req.file_name,
            req.file_hash,
            req.category
        )

    return {
        "submitted": len(document_ids),
        "document_ids": document_ids
    }
