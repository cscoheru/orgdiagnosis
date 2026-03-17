"""
诊断管理 API
"""
from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List

from app.services.storage import storage, StorageError
from app.models.schemas import (
    DiagnosisCreate,
    DiagnosisResponse,
    DiagnosisListItem
)

router = APIRouter()


@router.post("", response_model=DiagnosisResponse)
async def create_diagnosis(request: DiagnosisCreate):
    """
    创建诊断记录

    Args:
        request: 包含原始输入和诊断数据

    Returns:
        创建的诊断记录（包含 id）
    """
    try:
        # 准备数据 - 使用 model_dump() 转换 Pydantic 模型为字典
        data = {
            "strategy": request.data.strategy.model_dump(),
            "structure": request.data.structure.model_dump(),
            "performance": request.data.performance.model_dump(),
            "compensation": request.data.compensation.model_dump(),
            "talent": request.data.talent.model_dump(),
            "overall_score": request.data.overall_score,
            "summary": request.data.summary or "",
        }

        # 存储到数据库
        record = await storage.create_diagnosis(request.raw_input, data)

        return DiagnosisResponse(
            success=True,
            data=record
        )

    except StorageError as e:
        return DiagnosisResponse(
            success=False,
            error=str(e)
        )

    except Exception as e:
        return DiagnosisResponse(
            success=False,
            error=f"创建记录失败: {str(e)}"
        )


@router.get("/{session_id}", response_model=DiagnosisResponse)
async def get_diagnosis(session_id: str):
    """
    获取诊断记录

    Args:
        session_id: 会话 ID

    Returns:
        诊断记录
    """
    try:
        record = await storage.get_diagnosis(session_id)

        if not record:
            raise HTTPException(status_code=404, detail="诊断记录不存在")

        return DiagnosisResponse(
            success=True,
            data=record
        )

    except HTTPException:
        raise
    except StorageError as e:
        return DiagnosisResponse(
            success=False,
            error=str(e)
        )


@router.get("", response_model=List[DiagnosisListItem])
async def list_diagnoses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    获取诊断记录列表

    Args:
        limit: 返回数量（1-100）
        offset: 偏移量

    Returns:
        诊断记录列表
    """
    try:
        records = await storage.list_diagnoses(limit=limit, offset=offset)
        return records

    except StorageError as e:
        return []
