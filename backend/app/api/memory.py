"""
知识库 API — Knowledge_Entry CRUD
"""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query

from app.services.memory.memory_service import MemoryService
from app.services.memory.types import MemoryType
from app.kernel.database import get_db

router = APIRouter(prefix="/agent/memory", tags=["知识库"])


@router.get("/list", summary="列出知识条目")
def list_memory(
    project_id: str | None = Query(default=None),
    memory_type: str | None = Query(default=None),
    limit: int = Query(default=50),
    db: Any = Depends(get_db),
):
    svc = MemoryService(db)
    mtype = MemoryType(memory_type) if memory_type else None
    return {"items": svc.list(project_id=project_id, memory_type=mtype, limit=limit)}


@router.get("/index", summary="获取知识索引")
def get_memory_index(
    project_id: str | None = Query(default=None),
    db: Any = Depends(get_db),
):
    svc = MemoryService(db)
    return svc.get_index(project_id=project_id)


@router.post("/save", summary="保存知识条目")
def save_memory(
    memory_type: str,
    title: str,
    content: str,
    project_id: str | None = None,
    session_id: str | None = None,
    source_type: str = "manual",
    tags: list[str] | None = None,
    confidence: float = 1.0,
    db: Any = Depends(get_db),
):
    try:
        mtype = MemoryType(memory_type)
    except ValueError:
        raise HTTPException(400, f"无效的记忆类型: {memory_type}. 有效值: {[t.value for t in MemoryType]}")

    svc = MemoryService(db)
    obj = svc.save(
        memory_type=mtype,
        title=title,
        content=content,
        project_id=project_id,
        session_id=session_id,
        source_type=source_type,
        tags=tags,
        confidence=confidence,
    )
    return {"saved": obj}


@router.delete("/{memory_key}", summary="删除知识条目")
def delete_memory(memory_key: str, db: Any = Depends(get_db)):
    svc = MemoryService(db)
    obj = svc.get(memory_key)
    if not obj:
        raise HTTPException(404, "知识条目不存在")
    svc.delete(memory_key)
    return {"deleted": memory_key}
