"""
Knowledge Base Management API

Provides endpoints for managing the consulting knowledge base:
- Statistics and dashboard data
- Document listing and management
- File upload and processing
- Semantic search
- Quality analysis

Created: 2026-03-20
"""

import os
import uuid
import asyncio
from pathlib import Path
from typing import Optional, List, Dict, Any
from datetime import datetime
from loguru import logger

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel

router = APIRouter(prefix="/kb", tags=["Knowledge Base"])


# ============================================================================
# Pydantic Models
# ============================================================================

class KBStats(BaseModel):
    """Knowledge base statistics"""
    overview: Dict[str, Any]
    distribution: Dict[str, Any]
    quality: Dict[str, Any]
    system: Dict[str, Any]


class DocumentInfo(BaseModel):
    """Document information"""
    id: str
    file_name: str
    category: str
    file_type: str
    file_size_kb: int
    chunk_count: int
    status: str  # pending, processing, ready, error
    uploaded_at: str
    processed_at: Optional[str] = None
    quality_score: Optional[float] = None
    preview: Optional[str] = None


class DocumentList(BaseModel):
    """Paginated document list"""
    documents: List[DocumentInfo]
    pagination: Dict[str, Any]


class UploadResponse(BaseModel):
    """Upload response"""
    task_id: str
    status: str
    message: str


class UploadStatus(BaseModel):
    """Upload status"""
    task_id: str
    status: str  # processing, completed, failed
    progress: int
    document_id: Optional[str] = None
    chunks_created: Optional[int] = None
    error: Optional[str] = None


class SearchResult(BaseModel):
    """Search result"""
    chunk_id: str
    document_id: str
    file_name: str
    content: str
    score: float
    category: str
    metadata: Dict[str, Any]


class SearchResponse(BaseModel):
    """Search response"""
    results: List[SearchResult]
    query_time_ms: int
    total_results: int


class QualityReport(BaseModel):
    """Quality analysis report"""
    overall_score: float
    dimensions: Dict[str, Any]
    suggestions: List[Dict[str, Any]]


# ============================================================================
# Knowledge Base Manager
# ============================================================================

class KnowledgeBaseManager:
    """
    知识库管理器

    整合 LlamaIndex 模块，提供统一的管理接口
    """

    def __init__(self):
        self.data_dir = Path("./data/historical_reports")
        self.storage_dir = Path("./storage/kb_metadata")
        self.storage_dir.mkdir(parents=True, exist_ok=True)

        # 文档元数据存储 (简单的 JSON 文件存储)
        self.metadata_file = self.storage_dir / "documents.json"
        self.uploads_file = self.storage_dir / "uploads.json"
        self._load_metadata()

        # 延迟加载 LlamaIndex 组件
        self._indexer = None
        self._processor = None

    def _load_metadata(self):
        """加载元数据"""
        import json

        self.documents = {}
        self.uploads = {}

        if self.metadata_file.exists():
            try:
                with open(self.metadata_file, "r", encoding="utf-8") as f:
                    self.documents = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load documents metadata: {e}")

        if self.uploads_file.exists():
            try:
                with open(self.uploads_file, "r", encoding="utf-8") as f:
                    self.uploads = json.load(f)
            except Exception as e:
                logger.warning(f"Failed to load uploads metadata: {e}")

    def _save_metadata(self):
        """保存元数据"""
        import json

        try:
            with open(self.metadata_file, "w", encoding="utf-8") as f:
                json.dump(self.documents, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save documents metadata: {e}")

        try:
            with open(self.uploads_file, "w", encoding="utf-8") as f:
                json.dump(self.uploads, f, ensure_ascii=False, indent=2)
        except Exception as e:
            logger.error(f"Failed to save uploads metadata: {e}")

    def _get_indexer(self):
        """延迟加载 indexer"""
        if self._indexer is None:
            from lib.llamaindex import ConsultingKnowledgeIndexer
            # 使用基于当前文件的绝对路径，确保无论从哪个目录启动都能找到数据
            backend_dir = Path(__file__).parent.parent
            persist_dir = backend_dir / "storage" / "chroma"
            data_dir = backend_dir / "data" / "historical_reports"

            self._indexer = ConsultingKnowledgeIndexer(
                persist_dir=str(persist_dir),
            )
            # 更新数据目录
            self.data_dir = data_dir
        return self._indexer

    def _get_processor(self):
        """延迟加载 processor"""
        if self._processor is None:
            from lib.llamaindex import ConsultingDocumentProcessor
            self._processor = ConsultingDocumentProcessor(str(self.data_dir))
        return self._processor

    def get_stats(self) -> Dict[str, Any]:
        """获取知识库统计信息"""
        try:
            indexer = self._get_indexer()
            indexer._init_chroma()

            # 从 ChromaDB 获取基础统计
            chroma_count = indexer.chroma_collection.count() if indexer.chroma_collection else 0

            # 从元数据获取文档分布
            category_counts = {}
            file_type_counts = {}
            total_size_kb = 0

            for doc_id, doc in self.documents.items():
                cat = doc.get("category", "general")
                category_counts[cat] = category_counts.get(cat, 0) + 1

                ft = doc.get("file_type", "unknown")
                file_type_counts[ft] = file_type_counts.get(ft, 0) + 1

                total_size_kb += doc.get("file_size_kb", 0)

            # 计算质量分数
            quality_score = self._calculate_quality_score(category_counts, chroma_count)

            return {
                "overview": {
                    "total_documents": len(self.documents),
                    "total_chunks": chroma_count,
                    "storage_size_mb": round(total_size_kb / 1024, 2),
                    "last_updated": datetime.now().isoformat()
                },
                "distribution": {
                    "by_category": category_counts,
                    "by_file_type": file_type_counts
                },
                "quality": {
                    "avg_chunk_size": 512,  # 配置值
                    "coverage_score": quality_score["coverage"],
                    "duplicate_rate": 0.02,  # 估计值
                    "completeness": quality_score["completeness"]
                },
                "system": {
                    "embedding_model": "text-embedding-v3",
                    "embedding_dimensions": 1024,
                    "chunk_config": {
                        "size": 512,
                        "overlap": 50
                    }
                }
            }
        except Exception as e:
            logger.error(f"Failed to get stats: {e}")
            return {
                "overview": {"total_documents": 0, "total_chunks": 0, "storage_size_mb": 0},
                "distribution": {"by_category": {}, "by_file_type": {}},
                "quality": {"coverage_score": 0, "duplicate_rate": 0, "completeness": 0},
                "system": {}
            }

    def _calculate_quality_score(self, category_counts: Dict, total_chunks: int) -> Dict:
        """计算质量分数"""
        # 覆盖度：基于类别分布的均衡度
        expected_categories = ["strategy", "hr", "performance", "compensation", "talent", "finance"]
        covered = sum(1 for cat in expected_categories if category_counts.get(cat, 0) > 0)
        coverage = covered / len(expected_categories) if expected_categories else 0

        # 完整度：基于元数据完整率
        complete_docs = sum(1 for doc in self.documents.values()
                          if doc.get("category") and doc.get("file_type"))
        completeness = complete_docs / len(self.documents) if self.documents else 1.0

        return {
            "coverage": round(coverage, 2),
            "completeness": round(completeness, 2)
        }

    def list_documents(
        self,
        page: int = 1,
        limit: int = 20,
        category: Optional[str] = None,
        status: Optional[str] = None,
        search: Optional[str] = None
    ) -> Dict[str, Any]:
        """列出文档"""
        # 过滤文档
        filtered = []
        for doc_id, doc in self.documents.items():
            if category and doc.get("category") != category:
                continue
            if status and doc.get("status") != status:
                continue
            if search and search.lower() not in doc.get("file_name", "").lower():
                continue
            filtered.append(doc)

        # 排序 (按更新时间降序)
        filtered.sort(key=lambda x: x.get("updated_at", ""), reverse=True)

        # 分页
        total = len(filtered)
        start = (page - 1) * limit
        end = start + limit
        page_docs = filtered[start:end]

        return {
            "documents": page_docs,
            "pagination": {
                "page": page,
                "limit": limit,
                "total": total,
                "total_pages": (total + limit - 1) // limit if limit > 0 else 0
            }
        }

    def get_document(self, doc_id: str) -> Optional[Dict]:
        """获取单个文档"""
        return self.documents.get(doc_id)

    def upload_document(
        self,
        file: UploadFile,
        category: Optional[str] = None,
        background_tasks: BackgroundTasks = None
    ) -> Dict:
        """上传文档"""
        # 生成文档 ID
        doc_id = str(uuid.uuid4())
        upload_id = str(uuid.uuid4())

        # 检查文件类型
        file_ext = Path(file.filename).suffix.lower()
        supported = [".pdf", ".docx", ".pptx", ".md", ".txt"]
        if file_ext not in supported:
            raise HTTPException(400, f"不支持的文件类型: {file_ext}")

        # 保存文件
        category = category or "general"
        category_dir = self.data_dir / category
        category_dir.mkdir(parents=True, exist_ok=True)

        file_path = category_dir / f"{doc_id}_{file.filename}"

        # 读取并保存文件
        content = file.file.read()
        with open(file_path, "wb") as f:
            f.write(content)

        file_size_kb = len(content) // 1024

        # 记录文档元数据
        self.documents[doc_id] = {
            "id": doc_id,
            "file_name": file.filename,
            "file_path": str(file_path),
            "category": category,
            "file_type": file_ext[1:],  # 去掉点
            "file_size_kb": file_size_kb,
            "chunk_count": 0,
            "status": "processing",
            "uploaded_at": datetime.now().isoformat(),
            "processed_at": None,
            "quality_score": None,
            "preview": None
        }

        # 记录上传状态
        self.uploads[upload_id] = {
            "task_id": upload_id,
            "document_id": doc_id,
            "status": "processing",
            "progress": 0,
            "chunks_created": 0,
            "error": None,
            "started_at": datetime.now().isoformat()
        }

        self._save_metadata()

        # 后台处理文档
        if background_tasks:
            background_tasks.add_task(
                self._process_document,
                upload_id,
                doc_id,
                str(file_path),
                category
            )

        return {
            "task_id": upload_id,
            "status": "processing",
            "message": "文档已上传，正在处理中..."
        }

    def _process_document(self, upload_id: str, doc_id: str, file_path: str, category: str):
        """后台处理文档"""
        try:
            # 更新进度
            self.uploads[upload_id]["progress"] = 10
            self._save_metadata()

            # 加载文档
            processor = self._get_processor()
            docs = processor._load_single_file(file_path, category)

            if not docs:
                raise Exception("文档解析失败")

            self.uploads[upload_id]["progress"] = 30
            self._save_metadata()

            # 添加到索引
            indexer = self._get_indexer()
            indexer.load_index()  # 加载现有索引
            indexer.add_documents(docs)

            self.uploads[upload_id]["progress"] = 80
            self._save_metadata()

            # 更新文档元数据
            chunk_count = len(docs)
            preview = docs[0].text[:200] if docs else None

            self.documents[doc_id].update({
                "chunk_count": chunk_count,
                "status": "ready",
                "processed_at": datetime.now().isoformat(),
                "quality_score": 0.85,  # 估计值
                "preview": preview
            })

            # 更新上传状态
            self.uploads[upload_id].update({
                "status": "completed",
                "progress": 100,
                "chunks_created": chunk_count
            })

            self._save_metadata()
            logger.info(f"Document {doc_id} processed: {chunk_count} chunks")

        except Exception as e:
            logger.error(f"Failed to process document {doc_id}: {e}")

            self.documents[doc_id]["status"] = "error"
            self.uploads[upload_id].update({
                "status": "failed",
                "error": str(e)
            })
            self._save_metadata()

    def get_upload_status(self, upload_id: str) -> Optional[Dict]:
        """获取上传状态"""
        return self.uploads.get(upload_id)

    def delete_document(self, doc_id: str) -> bool:
        """删除文档"""
        doc = self.documents.get(doc_id)
        if not doc:
            return False

        try:
            # 删除文件
            file_path = Path(doc.get("file_path", ""))
            if file_path.exists():
                file_path.unlink()

            # 从元数据中删除
            del self.documents[doc_id]
            self._save_metadata()

            # TODO: 从 ChromaDB 中删除向量

            return True
        except Exception as e:
            logger.error(f"Failed to delete document {doc_id}: {e}")
            return False

    def search(
        self,
        query: str,
        category: Optional[str] = None,
        top_k: int = 5
    ) -> Dict:
        """语义搜索"""
        import time
        start_time = time.time()

        try:
            indexer = self._get_indexer()
            index = indexer.load_index()

            if not index:
                return {
                    "results": [],
                    "query_time_ms": 0,
                    "total_results": 0
                }

            # 执行搜索 - retriever.retrieve() 可以直接接受字符串
            retriever = index.as_retriever(similarity_top_k=top_k)
            nodes = retriever.retrieve(query)

            # 过滤类别
            if category:
                nodes = [n for n in nodes
                        if n.node.metadata.get("category") == category]

            # 格式化结果
            results = []
            for node in nodes[:top_k]:
                doc_id = node.node.metadata.get("file_path", "").split("/")[-1].split("_")[0]

                results.append({
                    "chunk_id": node.node.node_id,
                    "document_id": doc_id,
                    "file_name": node.node.metadata.get("file_name", "unknown"),
                    "content": node.node.get_content()[:500],
                    "score": round(node.score, 4) if node.score else 0,
                    "category": node.node.metadata.get("category", "general"),
                    "metadata": node.node.metadata
                })

            query_time_ms = int((time.time() - start_time) * 1000)

            return {
                "results": results,
                "query_time_ms": query_time_ms,
                "total_results": len(results)
            }

        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {
                "results": [],
                "query_time_ms": 0,
                "total_results": 0,
                "error": str(e)
            }

    def get_quality_report(self) -> Dict:
        """获取质量报告"""
        stats = self.get_stats()

        # 分析各维度
        dimensions = {
            "coverage": {
                "score": stats["quality"]["coverage_score"],
                "details": {},
                "recommendations": []
            },
            "freshness": {
                "score": 0.70,
                "recommendations": []
            },
            "completeness": {
                "score": stats["quality"]["completeness"],
                "recommendations": []
            },
            "redundancy": {
                "score": 1 - stats["quality"]["duplicate_rate"],
                "recommendations": []
            }
        }

        # 分析类别覆盖
        category_dist = stats["distribution"]["by_category"]
        for cat in ["strategy", "hr", "performance", "compensation", "talent", "finance"]:
            count = category_dist.get(cat, 0)
            if count == 0:
                dimensions["coverage"]["details"][cat] = "缺失"
                dimensions["coverage"]["recommendations"].append(f"建议补充{cat}类文档")
            elif count < 2:
                dimensions["coverage"]["details"][cat] = "需补充"
                dimensions["coverage"]["recommendations"].append(f"{cat}类文档不足")
            else:
                dimensions["coverage"]["details"][cat] = "良好"

        # 生成建议
        suggestions = []

        if dimensions["coverage"]["score"] < 0.8:
            suggestions.append({
                "priority": "high",
                "action": "add_documents",
                "reason": "知识库覆盖度不足，建议补充更多类别的文档"
            })

        if stats["overview"]["total_documents"] < 10:
            suggestions.append({
                "priority": "high",
                "action": "add_documents",
                "reason": "文档数量较少，建议增加历史案例"
            })

        # 计算总分
        overall_score = (
            dimensions["coverage"]["score"] * 0.4 +
            dimensions["freshness"]["score"] * 0.2 +
            dimensions["completeness"]["score"] * 0.2 +
            dimensions["redundancy"]["score"] * 0.2
        )

        return {
            "overall_score": round(overall_score, 2),
            "dimensions": dimensions,
            "suggestions": suggestions
        }

    def get_categories(self) -> List[Dict]:
        """获取分类列表"""
        return [
            {"id": "strategy", "name": "战略规划", "count": 0},
            {"id": "hr", "name": "人力资源", "count": 0},
            {"id": "performance", "name": "绩效管理", "count": 0},
            {"id": "compensation", "name": "薪酬激励", "count": 0},
            {"id": "talent", "name": "人才管理", "count": 0},
            {"id": "finance", "name": "财务管理", "count": 0},
            {"id": "operations", "name": "运营管理", "count": 0},
            {"id": "general", "name": "通用", "count": 0},
        ]


# 全局实例
_kb_manager: Optional[KnowledgeBaseManager] = None


def get_kb_manager() -> KnowledgeBaseManager:
    """获取知识库管理器实例"""
    global _kb_manager
    if _kb_manager is None:
        _kb_manager = KnowledgeBaseManager()
    return _kb_manager


# ============================================================================
# API Endpoints
# ============================================================================

@router.get("/stats", response_model=KBStats)
async def get_stats():
    """获取知识库统计信息"""
    manager = get_kb_manager()
    return manager.get_stats()


@router.get("/documents", response_model=DocumentList)
async def list_documents(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None
):
    """获取文档列表"""
    manager = get_kb_manager()
    return manager.list_documents(page, limit, category, status, search)


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """获取单个文档详情"""
    manager = get_kb_manager()
    doc = manager.get_document(doc_id)
    if not doc:
        raise HTTPException(404, "文档不存在")
    return doc


@router.post("/documents/upload", response_model=UploadResponse)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: Optional[str] = Form(None)
):
    """上传文档"""
    manager = get_kb_manager()
    return manager.upload_document(file, category, background_tasks)


@router.get("/documents/upload/{upload_id}", response_model=UploadStatus)
async def get_upload_status(upload_id: str):
    """获取上传状态"""
    manager = get_kb_manager()
    status = manager.get_upload_status(upload_id)
    if not status:
        raise HTTPException(404, "上传任务不存在")
    return status


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """删除文档"""
    manager = get_kb_manager()
    success = manager.delete_document(doc_id)
    if not success:
        raise HTTPException(404, "文档不存在或删除失败")
    return {"success": True, "message": "文档已删除"}


@router.post("/search", response_model=SearchResponse)
async def search(
    query: str = Query(..., description="搜索查询"),
    category: Optional[str] = Query(None, description="分类过滤"),
    top_k: int = Query(5, ge=1, le=20, description="返回结果数量")
):
    """语义搜索"""
    manager = get_kb_manager()
    return manager.search(query, category, top_k)


@router.get("/categories")
async def get_categories():
    """获取分类列表"""
    manager = get_kb_manager()
    return manager.get_categories()


@router.get("/quality", response_model=QualityReport)
async def get_quality():
    """获取质量报告"""
    manager = get_kb_manager()
    return manager.get_quality_report()


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "ok", "service": "knowledge-base"}
