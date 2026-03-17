"""
PDF 导出 API
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.storage import storage
from app.services.pdf_generator import pdf_generator

router = APIRouter()


@router.get("/{session_id}")
async def export_pdf(session_id: str):
    """
    导出诊断报告为 PDF

    Args:
        session_id: 会话 ID

    Returns:
        PDF 文件（下载）
    """
    # 获取诊断数据
    diagnosis = await storage.get_diagnosis(session_id)

    if not diagnosis:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    # 构建 PDF 数据结构
    diagnosis_data = {
        "strategy": diagnosis.get("strategy", {}),
        "structure": diagnosis.get("structure", {}),
        "performance": diagnosis.get("performance", {}),
        "compensation": diagnosis.get("compensation", {}),
        "talent": diagnosis.get("talent", {}),
        "overall_score": diagnosis.get("overall_score", 0),
        "summary": diagnosis.get("summary", "")
    }

    # 生成 PDF
    pdf_bytes = await pdf_generator.generate(diagnosis_data, session_id)

    # 返回 PDF 响应
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=diagnosis-report-{session_id[:8]}.pdf"
        }
    )
