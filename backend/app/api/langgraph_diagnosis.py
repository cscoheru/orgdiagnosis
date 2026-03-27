"""
LangGraph Diagnosis API

Async diagnosis workflow using LangChain + LangGraph.
Uses SQLite TaskStore for persistence (survives restarts).
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
from pydantic import BaseModel
import uuid
from datetime import datetime
from loguru import logger

from lib.storage.task_store import get_task_store

router = APIRouter()


# === Request/Response Models ===
class AnalyzeRequest(BaseModel):
    """分析请求"""
    text: str
    project_id: Optional[str] = None


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    progress_percentage: float
    current_dimension: str
    completed_dimensions: list
    project_id: Optional[str] = None
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class AnalyzeResponse(BaseModel):
    """分析响应"""
    success: bool
    task_id: str
    message: str


# === Background Task ===
async def run_diagnosis_task(task_id: str, raw_text: str, project_id: Optional[str] = None):
    """后台诊断任务 - 运行 LangGraph 工作流"""
    store = get_task_store()
    try:
        # 更新状态为 processing
        state = store.get_state(task_id) or {}
        state.update({
            "status": "processing",
            "started_at": datetime.now().isoformat(),
            "project_id": project_id,
        })
        store.update_state(task_id, state)

        # 导入 LangGraph 工作流
        from lib.langgraph import run_diagnosis

        result = await run_diagnosis(
            task_id=task_id,
            raw_text=raw_text,
            checkpointer_path=f"./checkpoints/{task_id}.db"
        )

        # 更新状态为 completed
        state.update({
            "status": "completed",
            "progress_percentage": 100.0,
            "current_dimension": "completed",
            "completed_dimensions": ["strategy", "structure", "performance", "compensation", "talent"],
            "result": result.get("final_report"),
            "overall_score": result.get("overall_score", 0),
            "completed_at": datetime.now().isoformat(),
        })

        # 持久化到 Supabase
        try:
            from app.services.storage import storage
            diagnosis_data = result.get("final_report", {})
            record = await storage.create_diagnosis(raw_text, diagnosis_data)
            state["supabase_id"] = record.get("id")
            logger.info(f"Task {task_id} saved to Supabase: {record.get('id')}")
        except Exception as e:
            logger.warning(f"Task {task_id} Supabase save failed (non-critical): {e}")

        store.update_state(task_id, state)

        logger.info(f"Task {task_id} completed with score {result.get('overall_score', 0):.1f}")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        state = store.get_state(task_id) or {}
        state.update({
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now().isoformat(),
        })
        store.update_state(task_id, state)


async def run_diagnosis_from_file(task_id: str, file_path: str, project_id: Optional[str] = None):
    """后台诊断任务（从文件）"""
    store = get_task_store()
    try:
        state = store.get_state(task_id) or {}
        state.update({
            "status": "processing",
            "started_at": datetime.now().isoformat(),
            "project_id": project_id,
        })
        store.update_state(task_id, state)

        with open(file_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        from lib.langgraph import run_diagnosis
        result = await run_diagnosis(
            task_id=task_id,
            raw_text=raw_text,
            checkpointer_path=f"./checkpoints/{task_id}.db"
        )

        state.update({
            "status": "completed",
            "progress_percentage": 100.0,
            "current_dimension": "completed",
            "completed_dimensions": ["strategy", "structure", "performance", "compensation", "talent"],
            "project_id": project_id,
            "result": result.get("final_report"),
            "overall_score": result.get("overall_score", 0),
            "completed_at": datetime.now().isoformat(),
        })
        store.update_state(task_id, state)

        logger.info(f"Task {task_id} completed with score {result.get('overall_score', 0):.1f}")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        state = store.get_state(task_id) or {}
        state.update({
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now().isoformat(),
        })
        store.update_state(task_id, state)


# === API Endpoints ===
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks
):
    """分析文本（异步）- 接收文本后返回 task_id，后台分析"""
    task_id = str(uuid.uuid4())
    store = get_task_store()

    store.create_task(task_id, {
        "status": "pending",
        "progress_percentage": 0.0,
        "current_dimension": "initializing",
        "completed_dimensions": [],
        "created_at": datetime.now().isoformat(),
        "project_id": request.project_id,
    })

    background_tasks.add_task(run_diagnosis_task, task_id, request.text, request.project_id)
    logger.info(f"Started analysis task: {task_id} for project: {request.project_id}")

    return AnalyzeResponse(
        success=True,
        task_id=task_id,
        message="分析任务已启动，请使用 /status/{task_id} 查询进度"
    )


@router.post("/analyze-file", response_model=AnalyzeResponse)
async def analyze_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    project_id: Optional[str] = Form(default=None)
):
    """分析上传的文件（异步）- 支持 .txt, .md, .pdf"""
    task_id = str(uuid.uuid4())
    store = get_task_store()

    allowed_types = [".txt", ".md", ".pdf"]
    file_ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""

    if f".{file_ext}" not in allowed_types:
        raise HTTPException(status_code=400, detail=f"不支持的文件类型。支持: {', '.join(allowed_types)}")

    import os
    os.makedirs("/tmp/diagnosis_uploads", exist_ok=True)
    file_path = f"/tmp/diagnosis_uploads/{task_id}.{file_ext}"

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    store.create_task(task_id, {
        "status": "pending",
        "progress_percentage": 0.0,
        "current_dimension": "initializing",
        "completed_dimensions": [],
        "file_name": file.filename,
        "project_id": project_id,
        "created_at": datetime.now().isoformat(),
    })

    background_tasks.add_task(run_diagnosis_from_file, task_id, file_path, project_id)
    logger.info(f"Started file analysis task: {task_id} ({file.filename})")

    return AnalyzeResponse(
        success=True,
        task_id=task_id,
        message=f"文件 '{file.filename}' 分析任务已启动"
    )


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """获取任务状态 - 返回进度、已完成的维度、结果等"""
    store = get_task_store()
    state = store.get_state(task_id)

    if state is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    return TaskStatusResponse(
        task_id=task_id,
        status=state.get("status", "unknown"),
        progress_percentage=state.get("progress_percentage", 0),
        current_dimension=state.get("current_dimension", ""),
        completed_dimensions=state.get("completed_dimensions", []),
        error=state.get("error"),
        result=state.get("result"),
    )


@router.get("/result/{task_id}")
async def get_task_result(task_id: str):
    """获取完整诊断结果 - 仅当任务完成时返回"""
    store = get_task_store()
    state = store.get_state(task_id)

    if state is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    if state.get("status") != "completed":
        raise HTTPException(status_code=400, detail=f"任务尚未完成，当前状态: {state.get('status')}")

    return JSONResponse(content={
        "success": True,
        "task_id": task_id,
        "result": state.get("result"),
        "overall_score": state.get("overall_score"),
        "completed_at": state.get("completed_at"),
    })


@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """取消/删除任务"""
    store = get_task_store()
    state = store.get_state(task_id)

    if state is None:
        raise HTTPException(status_code=404, detail="任务不存在")

    store.delete_task(task_id)
    logger.info(f"Task {task_id} cancelled")

    return {"success": True, "message": "任务已取消"}


@router.get("/tasks")
async def list_tasks():
    """列出所有任务 - 用于调试和监控"""
    store = get_task_store()
    tasks = store.list_tasks(limit=50)
    return {"tasks": tasks, "count": len(tasks)}
