"""
AI 分析 API
"""
from fastapi import APIRouter, HTTPException
import time

from app.services.ai_extractor import ai_extractor
from app.models.schemas import AnalyzeRequest, AnalyzeResponse

router = APIRouter()


@router.post("", response_model=AnalyzeResponse)
async def analyze_text(request: AnalyzeRequest):
    """
    AI 文本分析

    将原始文本分析为五维诊断数据

    Args:
        request.text: 待分析的文本（至少50字符）

    Returns:
        success: 是否成功
        data: 五维诊断数据
        error: 错误信息（如果失败）
        processing_time: 处理时间（毫秒）
    """
    start_time = time.time()

    # 检查文本长度
    if len(request.text) < 50:
        raise HTTPException(
            status_code=400,
            detail="文本长度不足 50 字符"
        )

    # 调用 AI 服务
    try:
        data = await ai_extractor.extract(request.text)

        processing_time = int((time.time() - start_time) * 1000)

        return AnalyzeResponse(
            success=True,
            data=data,
            processing_time=processing_time
        )

    except TimeoutError as e:
        return AnalyzeResponse(
            success=False,
            error=str(e),
            processing_time=int((time.time() - start_time) * 1000)
        )

    except Exception as e:
        return AnalyzeResponse(
            success=False,
            error=f"AI 分析失败: {str(e)}",
            processing_time=int((time.time() - start_time) * 1000)
        )
