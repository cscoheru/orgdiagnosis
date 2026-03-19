"""
API 路由汇总
"""
from fastapi import APIRouter

from app.api import upload, analyze, diagnosis, export_pdf
from app.api import langgraph_diagnosis

api_router = APIRouter()

# 注册各模块路由
api_router.include_router(upload.router, prefix="/upload", tags=["文件上传"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["AI 分析"])
api_router.include_router(diagnosis.router, prefix="/diagnosis", tags=["诊断管理"])
api_router.include_router(export_pdf.router, prefix="/export", tags=["PDF 导出"])

# LangGraph 异步诊断 API (新增)
api_router.include_router(langgraph_diagnosis.router, prefix="/langgraph", tags=["LangGraph 诊断"])
