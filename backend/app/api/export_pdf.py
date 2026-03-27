"""
PDF 导出 API
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.pdf_generator import pdf_generator

router = APIRouter()


@router.get("/{session_id}")
async def export_pdf(session_id: str):
    """
    导出诊断报告为 PDF

    Args:
        session_id: 会话 ID (LangGraph task_id)

    Returns:
        PDF 文件（下载）
    """
    # Import task_status from langgraph_diagnosis
    from app.api.langgraph_diagnosis import task_status

    # 获取 LangGraph 任务结果
    task = task_status.get(session_id)

    if not task:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    if task.get("status") != "completed":
        raise HTTPException(status_code=400, detail="诊断尚未完成")

    result = task.get("result", {})
    dimensions = result.get("dimensions", [])

    # 将 LangGraph 格式转换为 PDF 生成器期望的格式
    diagnosis_data = {
        "overall_score": result.get("overall_score", 0),
        "summary": result.get("overall_insight", ""),
    }

    # 映射维度名称
    dimension_map = {
        "strategy": "strategy",
        "structure": "structure",
        "performance": "performance",
        "compensation": "compensation",
        "talent": "talent",
    }

    for dim in dimensions:
        category = dim.get("category", "")
        key = dimension_map.get(category, category)
        diagnosis_data[key] = {
            "score": dim.get("total_score", 0),
            "summary": dim.get("summary_insight", ""),
            "L2_categories": {}
        }

        # 处理 secondary_metrics
        for metric in dim.get("secondary_metrics", []):
            metric_name = metric.get("name", "")
            diagnosis_data[key]["L2_categories"][metric_name] = {
                "label": metric.get("display_name", metric_name),
                "score": metric.get("avg_score", 0),
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
