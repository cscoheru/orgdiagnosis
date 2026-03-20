"""
LangGraph Diagnosis API

Async diagnosis workflow using LangChain + LangGraph.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, UploadFile, File
from fastapi.responses import JSONResponse
from typing import Optional, Dict, Any
from pydantic import BaseModel
import uuid
from datetime import datetime
from loguru import logger

router = APIRouter()


# === 任务状态存储 ===
# 生产环境应该使用 Redis 或数据库
task_status: Dict[str, Dict[str, Any]] = {}


# === Request/Response Models ===
class AnalyzeRequest(BaseModel):
    """分析请求"""
    text: str


class TaskStatusResponse(BaseModel):
    """任务状态响应"""
    task_id: str
    status: str
    progress_percentage: float
    current_dimension: str
    completed_dimensions: list
    error: Optional[str] = None
    result: Optional[Dict[str, Any]] = None


class AnalyzeResponse(BaseModel):
    """分析响应"""
    success: bool
    task_id: str
    message: str


# === Background Task ===
async def run_diagnosis_task(task_id: str, raw_text: str):
    """
    后台诊断任务

    运行 LangGraph 工作流进行诊断分析
    """
    try:
        task_status[task_id]["status"] = "processing"
        task_status[task_id]["started_at"] = datetime.now().isoformat()

        # 导入 LangGraph 工作流
        from lib.langgraph import run_diagnosis

        # 运行工作流
        result = await run_diagnosis(
            task_id=task_id,
            raw_text=raw_text,
            checkpointer_path=f"./checkpoints/{task_id}.db"
        )

        # 更新状态
        task_status[task_id] = {
            "status": "completed",
            "progress_percentage": 100.0,
            "current_dimension": "completed",
            "completed_dimensions": ["strategy", "structure", "performance", "compensation", "talent"],
            "result": result.get("final_report"),
            "overall_score": result.get("overall_score", 0),
            "completed_at": datetime.now().isoformat(),
        }

        logger.info(f"Task {task_id} completed with score {result.get('overall_score', 0):.1f}")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        task_status[task_id] = {
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now().isoformat(),
        }


async def run_diagnosis_from_file(task_id: str, file_path: str):
    """
    后台诊断任务（从文件）
    """
    try:
        task_status[task_id]["status"] = "processing"
        task_status[task_id]["started_at"] = datetime.now().isoformat()

        # 读取文件内容
        with open(file_path, "r", encoding="utf-8") as f:
            raw_text = f.read()

        # 运行工作流
        from lib.langgraph import run_diagnosis

        result = await run_diagnosis(
            task_id=task_id,
            raw_text=raw_text,
            checkpointer_path=f"./checkpoints/{task_id}.db"
        )

        task_status[task_id] = {
            "status": "completed",
            "progress_percentage": 100.0,
            "current_dimension": "completed",
            "completed_dimensions": ["strategy", "structure", "performance", "compensation", "talent"],
            "result": result.get("final_report"),
            "overall_score": result.get("overall_score", 0),
            "completed_at": datetime.now().isoformat(),
        }

        logger.info(f"Task {task_id} completed with score {result.get('overall_score', 0):.1f}")

    except Exception as e:
        logger.error(f"Task {task_id} failed: {e}")
        task_status[task_id] = {
            "status": "failed",
            "error": str(e),
            "failed_at": datetime.now().isoformat(),
        }


# === API Endpoints ===
@router.post("/analyze", response_model=AnalyzeResponse)
async def analyze_text(
    request: AnalyzeRequest,
    background_tasks: BackgroundTasks
):
    """
    分析文本（异步）

    接收文本后立即返回 task_id，分析在后台进行。
    使用 /status/{task_id} 轮询获取进度和结果。
    """
    task_id = str(uuid.uuid4())

    # 初始化状态
    task_status[task_id] = {
        "status": "pending",
        "progress_percentage": 0.0,
        "current_dimension": "initializing",
        "completed_dimensions": [],
        "created_at": datetime.now().isoformat(),
    }

    # 启动后台任务
    background_tasks.add_task(run_diagnosis_task, task_id, request.text)

    logger.info(f"Started analysis task: {task_id}")

    return AnalyzeResponse(
        success=True,
        task_id=task_id,
        message="分析任务已启动，请使用 /status/{task_id} 查询进度"
    )


@router.post("/analyze-file", response_model=AnalyzeResponse)
async def analyze_file(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    """
    分析上传的文件（异步）

    支持 .txt, .md, .pdf 文件
    """
    task_id = str(uuid.uuid4())

    # 检查文件类型
    allowed_types = [".txt", ".md", ".pdf"]
    file_ext = file.filename.lower().split(".")[-1] if "." in file.filename else ""

    if f".{file_ext}" not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件类型。支持: {', '.join(allowed_types)}"
        )

    # 保存文件
    import os
    os.makedirs("/tmp/diagnosis_uploads", exist_ok=True)
    file_path = f"/tmp/diagnosis_uploads/{task_id}.{file_ext}"

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # 初始化状态
    task_status[task_id] = {
        "status": "pending",
        "progress_percentage": 0.0,
        "current_dimension": "initializing",
        "completed_dimensions": [],
        "file_name": file.filename,
        "created_at": datetime.now().isoformat(),
    }

    # 启动后台任务
    background_tasks.add_task(run_diagnosis_from_file, task_id, file_path)

    logger.info(f"Started file analysis task: {task_id} ({file.filename})")

    return AnalyzeResponse(
        success=True,
        task_id=task_id,
        message=f"文件 '{file.filename}' 分析任务已启动"
    )


@router.get("/status/{task_id}", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    获取任务状态

    返回当前进度、已完成的维度、最终结果等
    """
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="任务不存在")

    status = task_status[task_id]

    return TaskStatusResponse(
        task_id=task_id,
        status=status.get("status", "unknown"),
        progress_percentage=status.get("progress_percentage", 0),
        current_dimension=status.get("current_dimension", ""),
        completed_dimensions=status.get("completed_dimensions", []),
        error=status.get("error"),
        result=status.get("result"),
    )


@router.get("/result/{task_id}")
async def get_task_result(task_id: str):
    """
    获取完整诊断结果

    仅当任务完成时返回结果
    """
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="任务不存在")

    status = task_status[task_id]

    if status.get("status") != "completed":
        raise HTTPException(
            status_code=400,
            detail=f"任务尚未完成，当前状态: {status.get('status')}"
        )

    return JSONResponse(
        content={
            "success": True,
            "task_id": task_id,
            "result": status.get("result"),
            "overall_score": status.get("overall_score"),
            "completed_at": status.get("completed_at"),
        }
    )


@router.delete("/task/{task_id}")
async def cancel_task(task_id: str):
    """
    取消/删除任务

    删除任务状态（不会停止正在运行的任务）
    """
    if task_id not in task_status:
        raise HTTPException(status_code=404, detail="任务不存在")

    # 标记为已取消
    task_status[task_id]["status"] = "cancelled"
    del task_status[task_id]

    logger.info(f"Task {task_id} cancelled")

    return {"success": True, "message": "任务已取消"}


@router.get("/tasks")
async def list_tasks():
    """
    列出所有任务

    用于调试和监控
    """
    tasks = []
    for task_id, status in task_status.items():
        tasks.append({
            "task_id": task_id,
            "status": status.get("status"),
            "progress": status.get("progress_percentage", 0),
            "created_at": status.get("created_at"),
        })

    # 按创建时间降序
    tasks.sort(key=lambda x: x.get("created_at", ""), reverse=True)

    return {"tasks": tasks, "count": len(tasks)}
