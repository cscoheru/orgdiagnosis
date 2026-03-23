"""
知识库 API 端点 V2

提供:
- 项目管理
- 文档上传与解析
- 全文搜索
- 五维分类检索
- 统计信息

Created: 2026-03-22
"""

import os
import io
import tempfile
import uuid
import shutil
from typing import List, Optional, Dict, Any
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Query
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from loguru import logger

# MinIO storage
from lib.storage.minio_client import (
    upload_file,
    download_file,
    get_file_url,
    delete_file,
    file_exists
)

router = APIRouter(prefix="/knowledge", tags=["knowledge-v2"])


# ==================== Pydantic 模型 ====================

class ProjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_industry: Optional[str] = None
    project_type: Optional[str] = "consulting"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None


class SearchRequest(BaseModel):
    query: str
    project_id: Optional[str] = None
    dimension_l1: Optional[str] = None
    dimension_l2: Optional[str] = None
    dimension_l3: Optional[str] = None
    limit: int = 20


class DocumentUploadResponse(BaseModel):
    document_id: str
    filename: str
    page_count: int
    classification: Dict[str, Any]


# ==================== 辅助函数 ====================

def _get_store():
    """获取知识库存储实例"""
    from lib.knowledge.store import KnowledgeBaseStore
    return KnowledgeBaseStore()


def _get_unified_store():
    """获取统一项目存储实例"""
    from lib.projects.unified_store import unified_store
    return unified_store


def _get_taxonomy(store):
    """获取分类管理器"""
    from lib.knowledge.taxonomy_data import TaxonomyManager
    taxonomy = TaxonomyManager(store)
    taxonomy.initialize_taxonomy()
    return taxonomy


def _get_parser():
    """获取文档解析器"""
    from lib.knowledge.document_parser import DocumentParser
    return DocumentParser()


def _get_classifier(store):
    """获取分类器"""
    from lib.knowledge.classifier import DocumentClassifier
    taxonomy = _get_taxonomy(store)
    return DocumentClassifier(taxonomy)


# ==================== 项目管理 (使用统一项目存储) ====================

def _get_unified_store():
    """获取统一项目存储实例"""
    from lib.projects.unified_store import unified_store
    return unified_store


@router.get("/projects")
async def list_projects(status: str = None, limit: int = 100):
    """获取项目列表 - 使用统一项目管理"""
    store = _get_unified_store()
    projects, total = store.list_projects(status=status, limit=limit)
    return {"projects": projects, "total": total}


@router.post("/projects")
async def create_project(project: ProjectCreate):
    """创建项目 - 使用统一项目管理"""
    store = _get_unified_store()
    project_data = project.dict()
    new_project = store.create_project(project_data)
    return {"project": new_project, "message": "项目创建成功"}


@router.get("/projects/{project_id}")
async def get_project(project_id: str):
    """获取项目详情 - 包含知识库文档"""
    store = _get_unified_store()
    project = store.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="项目不存在")

    # 获取项目下的知识库文档
    kb_store = _get_store()
    documents = kb_store.list_documents(project_id=project_id, limit=100)
    project["knowledge_documents"] = documents

    return project


@router.put("/projects/{project_id}")
async def update_project(project_id: str, updates: ProjectUpdate):
    """更新项目"""
    store = _get_unified_store()
    updated = store.update_project(project_id, updates.dict(exclude_unset=True))
    if not updated:
        raise HTTPException(status_code=404, detail="项目不存在")
    return {"project": updated, "message": "项目更新成功"}


# ==================== 文档管理 ====================

@router.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(None),
    auto_classify: bool = Form(True),
    use_ai: bool = Form(False)
):
    """
    上传文档

    支持格式: PPTX, PDF, DOCX, XLSX, MD, JSON, 图片 (PNG, JPG, JPEG)
    自动解析内容并分类
    """
    # 支持的文件类型
    ALLOWED_EXTENSIONS = {
        ".pptx": "presentation",
        ".pdf": "document",
        ".docx": "document",
        ".xlsx": "spreadsheet",
        ".xls": "spreadsheet",
        ".md": "markdown",
        ".json": "data",
        ".png": "image",
        ".jpg": "image",
        ".jpeg": "image",
    }

    # 检查文件类型
    filename = file.filename
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式: {ext}。支持: PPTX, PDF, DOCX, XLSX, MD, JSON, PNG, JPG"
        )

    # 保存文件到 MinIO
    content = await file.read()
    doc_id = str(uuid.uuid4())
    storage_filename = f"{doc_id}{ext}"
    minio_object_name = f"documents/{storage_filename}"

    # 上传到 MinIO
    try:
        upload_file(
            file_data=content,
            object_name=minio_object_name,
            metadata={
                "original_filename": filename,
                "doc_id": doc_id
            }
        )
        logger.info(f"File uploaded to MinIO: {minio_object_name}")
    except Exception as e:
        logger.error(f"MinIO upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"文件上传失败: {str(e)}")

    # 临时保存到本地用于解析 (解析器需要文件路径)
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        # 解析文档
        parser = _get_parser()
        parsed = parser.parse(temp_path)

        # 存储到数据库
        store = _get_store()

        store.create_document({
            "id": doc_id,
            "filename": filename,
            "file_type": ext[1:],  # 去掉点
            "file_path": minio_object_name,  # 存储MinIO对象名
            "file_size": len(content),
            "project_id": project_id,
            "title": parsed.title,
            "author": parsed.author,
            "page_count": parsed.page_count,
            "metadata": parsed.metadata
        })

        # 存储页面
        for page in parsed.pages:
            store.create_page({
                "id": str(uuid.uuid4()),
                "document_id": doc_id,
                "page_number": page.page_number,
                "content": page.content,
                "sections": page.sections
            })

        # 自动分类
        classification = {}
        if auto_classify:
            classifier = _get_classifier(store)
            result = classifier.classify_document(doc_id, store, use_ai=use_ai)
            classification = {
                "dimension_l1": result.dimension_l1,
                "dimension_l1_name": result.dimension_l1_name,
                "dimension_l2": result.dimension_l2,
                "dimension_l2_name": result.dimension_l2_name,
                "dimension_l3": result.dimension_l3,
                "dimension_l3_name": result.dimension_l3_name,
                "confidence": result.confidence,
                "method": result.method
            }

        logger.info(f"Document uploaded: {doc_id}, {parsed.page_count} pages")

        return DocumentUploadResponse(
            document_id=doc_id,
            filename=filename,
            page_count=parsed.page_count,
            classification=classification
        )

    except Exception as e:
        logger.error(f"Document upload failed: {e}")
        # 删除 MinIO 中已上传的文件
        if minio_object_name:
            try:
                delete_file(minio_object_name)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"文档处理失败: {str(e)}")
    finally:
        # 清理临时文件
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.get("/documents")
async def list_documents(
    project_id: Optional[str] = None,
    dimension_l1: Optional[str] = None,
    limit: int = 50,
    offset: int = 0
):
    """获取文档列表"""
    store = _get_store()
    documents = store.list_documents(
        project_id=project_id,
        dimension_l1=dimension_l1,
        limit=limit,
        offset=offset
    )
    return {"documents": documents, "total": len(documents)}


@router.get("/documents/{doc_id}")
async def get_document(doc_id: str):
    """获取文档详情"""
    store = _get_store()
    document = store.get_document(doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    # 获取页面
    pages = store.get_pages(doc_id)
    document["pages"] = pages

    # 获取分类
    classification = store.get_classification(doc_id)
    document["classification"] = classification

    return document


@router.get("/documents/{doc_id}/pages")
async def get_document_pages(doc_id: str):
    """获取文档所有页面"""
    store = _get_store()
    pages = store.get_pages(doc_id)
    return {"pages": pages, "total": len(pages)}


@router.get("/documents/{doc_id}/pages/{page_number}")
async def get_document_page(doc_id: str, page_number: int):
    """获取单个页面"""
    store = _get_store()
    page = store.get_page(doc_id, page_number)
    if not page:
        raise HTTPException(status_code=404, detail="页面不存在")
    return page


@router.delete("/documents/{doc_id}")
async def delete_document(doc_id: str):
    """删除文档 - 同时删除 MinIO 中的文件"""
    store = _get_store()

    # 先获取文档信息以获得 MinIO 对象名
    document = store.get_document(doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    minio_object_name = document.get("file_path")

    # 删除数据库记录
    success = store.delete_document(doc_id)
    if not success:
        raise HTTPException(status_code=404, detail="文档删除失败")

    # 删除 MinIO 中的文件
    if minio_object_name:
        try:
            delete_file(minio_object_name)
            logger.info(f"Deleted file from MinIO: {minio_object_name}")
        except Exception as e:
            logger.warning(f"Failed to delete file from MinIO: {e}")
            # 不阻止数据库删除的成功响应

    return {"message": "文档删除成功"}


@router.get("/documents/{doc_id}/download")
async def download_document(doc_id: str):
    """下载文档文件 - 从 MinIO 获取"""
    store = _get_store()
    document = store.get_document(doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    minio_object_name = document.get("file_path")
    if not minio_object_name:
        raise HTTPException(status_code=404, detail="文件路径不存在")

    filename = document.get("filename", f"document.{document.get('file_type', 'bin')}")

    try:
        # 从 MinIO 下载文件
        file_content = download_file(minio_object_name)

        # 流式返回文件
        return StreamingResponse(
            iter([file_content]),
            media_type="application/octet-stream",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Failed to download from MinIO: {e}")
        raise HTTPException(status_code=404, detail=f"文件下载失败: {str(e)}")

    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream"
    )


@router.get("/documents/{doc_id}/preview")
async def preview_document(doc_id: str):
    """预览文档文件 (用于PDF等可嵌入格式) - 从 MinIO 获取"""
    store = _get_store()
    document = store.get_document(doc_id)
    if not document:
        raise HTTPException(status_code=404, detail="文档不存在")

    minio_object_name = document.get("file_path")
    if not minio_object_name:
        raise HTTPException(status_code=404, detail="文件路径不存在")

    file_type = document.get("file_type", "").lower()

    # 设置正确的 Content-Type
    content_types = {
        "pdf": "application/pdf",
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    }

    media_type = content_types.get(file_type, "application/octet-stream")

    try:
        # 从 MinIO 下载文件
        file_content = download_file(minio_object_name)

        # 流式返回文件
        return StreamingResponse(
            iter([file_content]),
            media_type=media_type
        )
    except Exception as e:
        logger.error(f"Failed to preview from MinIO: {e}")
        raise HTTPException(status_code=404, detail=f"文件预览失败: {str(e)}")


# ==================== 搜索 ====================

@router.get("/search")
async def search(
    q: str = Query(..., description="搜索关键词"),
    project_id: Optional[str] = None,
    dimension_l1: Optional[str] = None,
    dimension_l2: Optional[str] = None,
    dimension_l3: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100)
):
    """
    全文搜索

    搜索范围:
    - 所有关键词匹配的页面
    - 可按项目筛选
    - 可按五维维度筛选
    """
    store = _get_store()
    results = store.search(
        query=q,
        project_id=project_id,
        dimension_l1=dimension_l1,
        dimension_l2=dimension_l2,
        dimension_l3=dimension_l3,
        limit=limit
    )
    return {
        "query": q,
        "total": len(results),
        "results": results
    }


@router.post("/search")
async def search_post(request: SearchRequest):
    """全文搜索 (POST方式)"""
    store = _get_store()
    results = store.search(
        query=request.query,
        project_id=request.project_id,
        dimension_l1=request.dimension_l1,
        dimension_l2=request.dimension_l2,
        dimension_l3=request.dimension_l3,
        limit=request.limit
    )
    return {
        "query": request.query,
        "total": len(results),
        "results": results
    }


@router.get("/search/by-project/{project_id}")
async def search_by_project(project_id: str, q: Optional[str] = None, limit: int = 50):
    """按项目筛选"""
    store = _get_store()
    if q:
        results = store.search(query=q, project_id=project_id, limit=limit)
    else:
        documents = store.list_documents(project_id=project_id, limit=limit)
        results = documents
    return {
        "query": f"project:{project_id}" + (f" AND {q}" if q else ""),
        "total": len(results),
        "results": results
    }


@router.get("/search/by-dimension")
async def search_by_dimension(
    l1: Optional[str] = Query(None, alias="l1"),
    l2: Optional[str] = Query(None, alias="l2"),
    l3: Optional[str] = Query(None, alias="l3"),
    q: Optional[str] = Query(None, alias="q"),
    limit: int = 50
):
    """按五维维度筛选"""
    store = _get_store()
    if q:
        results = store.search(
            query=q,
            dimension_l1=l1,
            dimension_l2=l2,
            dimension_l3=l3,
            limit=limit
        )
    else:
        results = store.search_by_dimension(
            dimension_l1=l1,
            dimension_l2=l2,
            dimension_l3=l3,
            limit=limit
        )
    return {
        "query": f"dimension:{l1}/{l2}/{l3}" + (f" AND {q}" if q else ""),
        "total": len(results),
        "results": results
    }


# ==================== 五维分类 ====================

@router.get("/dimensions")
async def get_dimensions():
    """获取五维分类树"""
    store = _get_store()
    taxonomy = _get_taxonomy(store)
    tree = taxonomy.get_taxonomy_tree()
    return {"dimensions": tree}


@router.get("/dimensions/l1")
async def get_l1_dimensions():
    """获取 L1 维度列表"""
    store = _get_store()
    taxonomy = _get_taxonomy(store)
    dimensions = taxonomy.get_l1_dimensions()
    return {"dimensions": dimensions}


@router.get("/dimensions/l2")
async def get_l2_categories(l1_id: Optional[str] = None):
    """获取 L2 分类列表"""
    store = _get_store()
    taxonomy = _get_taxonomy(store)
    categories = taxonomy.get_l2_categories(l1_id=l1_id)
    return {"categories": categories}


@router.get("/dimensions/l3")
async def get_l3_items(l2_id: Optional[str] = None):
    """获取 L3 指标列表"""
    store = _get_store()
    taxonomy = _get_taxonomy(store)
    items = taxonomy.get_l3_items(l2_id=l2_id)
    return {"items": items}


# ==================== 统计 ====================

@router.get("/stats")
async def get_stats():
    """获取知识库统计"""
    store = _get_store()
    stats = store.get_stats()
    return stats


@router.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "service": "knowledge-base-v2"}
