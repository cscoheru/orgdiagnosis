"""
API 路由汇总
"""
from fastapi import APIRouter

from app.api import upload, analyze, diagnosis, export_pdf
from app.api import langgraph_diagnosis

# 新增: 报告生成 API
from api import requirement, report, knowledge

api_router = APIRouter()

# 注册各模块路由
api_router.include_router(upload.router, prefix="/upload", tags=["文件上传"])
api_router.include_router(analyze.router, prefix="/analyze", tags=["AI 分析"])
api_router.include_router(diagnosis.router, prefix="/diagnosis", tags=["诊断管理"])
api_router.include_router(export_pdf.router, prefix="/export", tags=["PDF 导出"])

# LangGraph 异步诊断 API
api_router.include_router(langgraph_diagnosis.router, prefix="/langgraph", tags=["LangGraph 诊断"])

# 新增: 需求管理 API
api_router.include_router(requirement.router, tags=["需求管理"])

# 新增: 报告生成 API
api_router.include_router(report.router, tags=["报告生成"])

# 新增: 知识库管理 API
api_router.include_router(knowledge.router, tags=["知识库管理"])

# 新增: 项目管理 API
from api import projects
api_router.include_router(projects.router, tags=["项目管理"])

# 新增: 布局推荐 API
from api import layout
api_router.include_router(layout.router, tags=["布局推荐"])

# 新增: 知识库 V2 API (简化版，无向量)
from api import knowledge_v2
api_router.include_router(knowledge_v2.router, tags=["知识库V2"])

# 新增: 文件夹管理 API
from backend.api import folders
api_router.include_router(folders.router, tags=["文件夹管理"])

# 新增: 文件管理 API
from backend.api import files
api_router.include_router(files.router, tags=["文件管理"])
