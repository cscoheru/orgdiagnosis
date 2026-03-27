"""
API 路由汇总
"""
from fastapi import APIRouter

from app.api import (
    upload, analyze, diagnosis, export_pdf, langgraph_diagnosis,
    requirement, report, knowledge, projects, layout, knowledge_v2, folders
)

api_router = APIRouter()

# 注册各模块路由
api_router.include_router(upload.router, prefix="/upload", tags=["文件上传"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["AI 分析"])
api_router.include_router(diagnosis.router, prefix="/diagnosis", tags=["诊断管理"])
api_router.include_router(export_pdf.router, prefix="/export", tags=["PDF 导出"])
api_router.include_router(langgraph_diagnosis.router, prefix="/langgraph", tags=["LangGraph 诊断"])
api_router.include_router(requirement.router, tags=["需求管理"])
api_router.include_router(report.router, tags=["报告生成"])
api_router.include_router(knowledge.router, tags=["知识库管理"])
api_router.include_router(projects.router, tags=["项目管理"])
api_router.include_router(layout.router, tags=["布局推荐"])
api_router.include_router(knowledge_v2.router, tags=["知识库V2"])
api_router.include_router(folders.router, tags=["文件夹管理"])
