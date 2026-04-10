"""
API 路由汇总
"""
from fastapi import APIRouter
from fastapi.responses import FileResponse

from app.api import (
    upload, analyze, diagnosis, export_pdf, langgraph_diagnosis,
    requirement, report, knowledge, projects, layout, knowledge_v2, folders,
    templates, orders, feature_flags, memory, tasks,
)
from lib.api import files as lib_files
from app.api.v1.kernel import router as kernel_router
from app.api.v1.competency import router as competency_router
from app.api.v1.tasks import router as tasks_router
from app.api.v1.meetings import router as meetings_router
from app.api.v1.deliverables import router as deliverables_router
from app.api.v2.workflow import router as workflow_router
from app.api.v1.workshop import router as workshop_router
from app.api.v1.performance import router as performance_router
from app.agent.api import router as agent_router

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
api_router.include_router(orders.router, tags=["订单管理"])
api_router.include_router(layout.router, tags=["布局推荐"])
api_router.include_router(knowledge_v2.router, tags=["知识库V2"])
api_router.include_router(folders.router, tags=["文件夹管理"])
api_router.include_router(lib_files.router, tags=["文件管理"])
api_router.include_router(templates.router, prefix="/templates", tags=["PPT 模板"])

# 内核 API (ConsultingOS)
api_router.include_router(kernel_router, prefix="/v1/kernel")

# Competency Co-pilot API
api_router.include_router(competency_router, prefix="/v1")

# 项目管理 CRUD (Task / Meeting / Deliverable)
# 路由自身已包含 /projects/{id}/... 路径，不加额外 prefix
api_router.include_router(tasks_router)
api_router.include_router(meetings_router)
api_router.include_router(deliverables_router)

# 工作流 API v2 (配置驱动)
api_router.include_router(workflow_router)

# 工作坊共创套件 API
api_router.include_router(workshop_router, prefix="/v1")

# 绩效管理 API
api_router.include_router(performance_router, prefix="/v1/performance")

# AI 顾问 Agent API (Consulting OS 2.0)
api_router.include_router(agent_router, prefix="/v1")

# 功能开关管理 API
api_router.include_router(feature_flags.router, prefix="/v1")

# 知识库 API
api_router.include_router(memory.router)

# 后台任务 API
api_router.include_router(tasks.router)

# PPTX 文件下载（本地 output 目录）
@api_router.get("/output/pptx/{filename}")
async def download_pptx(filename: str):
    """下载生成的 PPTX 文件"""
    from pathlib import Path
    filepath = Path("./output/pptx") / filename
    if not filepath.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="文件不存在")
    return FileResponse(
        str(filepath),
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename,
    )
