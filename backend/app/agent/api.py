"""
AI 顾问 Agent — API 路由

端点:
  Blueprint (M1):
    POST/GET  /blueprint/logic-nodes           — 创建/列表逻辑节点
    POST/GET  /blueprint/benchmarks            — 创建/列表标杆报告
    GET        /blueprint/benchmarks/{id}/tree  — 获取逻辑依赖树
    POST       /blueprint/benchmarks/{id}/missing — 获取缺失数据字段

  Agent Session (M2):
    POST       /sessions                        — 创建并启动 Agent 会话
    GET        /sessions                        — 列表会话
    GET        /sessions/{id}                   — 获取会话状态 + UI 指令
    POST       /sessions/{id}/resume            — 提交数据并恢复工作流
    GET        /sessions/{id}/messages          — 获取对话历史
    DELETE     /sessions/{id}                   — 删除会话

  Execution (M4):
    GET        /sessions/{id}/download          — 下载 PPTX
    GET        /sessions/{id}/spec              — 查看 Project_Spec
"""
import asyncio
import logging
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from typing import Any

from loguru import logger

from app.kernel.database import get_db
from app.agent.blueprint_service import BlueprintService
from app.agent.models import (
    LogicNodeCreate,
    LogicNodeUpdate,
    BenchmarkCreate,
    BenchmarkUpdate,
    AgentSessionCreate,
    AgentSessionResume,
)

router = APIRouter(prefix="/agent", tags=["AI 顾问 Agent"])


# ─── Helper ───

def _to_key(obj_id: str) -> str:
    """Normalize _id (sys_objects/1) to _key (1)."""
    if obj_id.startswith("sys_objects/"):
        return obj_id.split("/", 1)[1]
    return obj_id


# ═══════════════════════════════════════════════
# Milestone 1: Blueprint API
# ═══════════════════════════════════════════════

# ─── Logic Nodes ───


@router.post("/blueprint/logic-nodes", status_code=status.HTTP_201_CREATED, summary="创建逻辑节点")
def create_logic_node(data: LogicNodeCreate, db: Any = Depends(get_db)):
    svc = BlueprintService(db)
    node = svc.create_logic_node(data.model_dump())
    return node


@router.get("/blueprint/logic-nodes", summary="列表所有逻辑节点")
def list_logic_nodes(
    industry_tag: str | None = Query(default=None),
    limit: int = Query(default=200),
    db: Any = Depends(get_db),
):
    svc = BlueprintService(db)
    nodes = svc.list_logic_nodes(limit=limit)
    if industry_tag:
        nodes = [
            n for n in nodes
            if industry_tag in n.get("properties", {}).get("industry_tags", [])
        ]
    return nodes


# ─── Benchmarks ───


@router.post("/blueprint/benchmarks", status_code=status.HTTP_201_CREATED, summary="创建标杆报告模板")
def create_benchmark(data: BenchmarkCreate, db: Any = Depends(get_db)):
    svc = BlueprintService(db)
    benchmark = svc.create_benchmark(
        data.model_dump(exclude={"logic_node_ids"}),
        logic_node_ids=data.logic_node_ids,
    )
    return benchmark


@router.get("/blueprint/benchmarks", summary="列表标杆报告模板")
def list_benchmarks(
    consulting_type: str | None = Query(default=None),
    industry: str | None = Query(default=None),
    limit: int = Query(default=100),
    db: Any = Depends(get_db),
):
    svc = BlueprintService(db)
    benchmarks = svc.list_benchmarks(limit=limit)
    if consulting_type:
        benchmarks = [
            b for b in benchmarks
            if b.get("properties", {}).get("consulting_type") == consulting_type
        ]
    if industry:
        benchmarks = [
            b for b in benchmarks
            if b.get("properties", {}).get("industry") == industry
        ]
    return benchmarks


@router.get("/blueprint/benchmarks/{benchmark_id}/tree", summary="获取逻辑依赖树")
def get_dependency_tree(benchmark_id: str, db: Any = Depends(get_db)):
    svc = BlueprintService(db)
    try:
        return svc.get_dependency_tree(benchmark_id)
    except ValueError as e:
        raise HTTPException(404, str(e))


@router.post("/blueprint/benchmarks/{benchmark_id}/missing", summary="获取缺失数据字段")
def get_missing_fields(
    benchmark_id: str,
    collected_data: dict[str, Any],
    db: Any = Depends(get_db),
):
    svc = BlueprintService(db)
    try:
        return svc.get_missing_fields(benchmark_id, collected_data)
    except ValueError as e:
        raise HTTPException(404, str(e))


# ═══════════════════════════════════════════════
# Milestone 2: Agent Session API
# ═══════════════════════════════════════════════


@router.post("/sessions", status_code=status.HTTP_201_CREATED, summary="创建并启动 Agent 会话")
async def create_agent_session(data: AgentSessionCreate, db: Any = Depends(get_db)):
    """
    创建 Agent 会话并启动工作流。

    返回会话对象 + 初始交互指令 (InteractionResponse)。
    工作流会运行 init → planner，如果需要数据则暂停在 interact。
    """
    from app.services.kernel.object_service import ObjectService
    from app.models.kernel.meta_model import ObjectCreate
    from app.agent.workflow import get_agent_workflow

    # 1. 验证 benchmark 存在
    bp_svc = BlueprintService(db)
    benchmark = bp_svc.get_benchmark(_to_key(data.benchmark_id))
    if not benchmark:
        raise HTTPException(404, f"标杆报告不存在: {data.benchmark_id}")

    # 2. 创建 Agent_Session 记录
    obj_svc = ObjectService(db)
    session = obj_svc.create_object(ObjectCreate(
        model_key="Agent_Session",
        properties={
            "project_goal": data.project_goal,
            "benchmark_id": data.benchmark_id,
            **({"project_id": data.project_id} if data.project_id else {}),
            "status": "plan",
            "progress": 0.0,
            "interaction_count": 0,
        },
    ))
    session_key = session["_key"]

    # 3. 启动 LangGraph 工作流
    try:
        wf = get_agent_workflow()
        result = await wf.start(
            session_id=session_key,
            benchmark_id=_to_key(data.benchmark_id),
            project_goal=data.project_goal,
            project_id=data.project_id,
        )
    except Exception as e:
        logger.error(f"Failed to start workflow: {e}")
        raise HTTPException(500, f"工作流启动失败: {str(e)}")

    # 4. 更新 session 状态
    mode = result.get("mode", "plan")
    progress = result.get("progress", 0.0)
    try:
        from app.models.kernel.meta_model import ObjectUpdate
        # update_object 是全量替换，需要保留原始必填字段
        orig_props = session.get("properties", {})
        obj_svc.update_object(session_key, ObjectUpdate(properties={
            "project_goal": orig_props.get("project_goal", data.project_goal),
            "benchmark_id": orig_props.get("benchmark_id", data.benchmark_id),
            **({"project_id": orig_props.get("project_id") or data.project_id} if orig_props.get("project_id") or data.project_id else {}),
            "status": mode,
            "progress": progress,
            "interaction_count": orig_props.get("interaction_count", 0),
        }))
    except Exception as e:
        logger.warning(f"Failed to update session status: {e}")

    # 5. 返回 session + 交互指令
    ui_response = wf.get_missing_ui(result)

    return {
        "session": session,
        "interaction": ui_response,
        "mode": mode,
        "progress": progress,
    }


@router.get("/sessions", summary="列表 Agent 会话")
def list_agent_sessions(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=50),
    db: Any = Depends(get_db),
):
    from app.services.kernel.object_service import ObjectService
    svc = ObjectService(db)
    sessions = svc.list_objects(model_key="Agent_Session", limit=limit)
    if project_id:
        sessions = [
            s for s in sessions
            if s.get("properties", {}).get("project_id") == project_id
        ]
    return sessions


@router.get("/sessions/{session_id}", summary="获取 Agent 会话状态 + 当前交互指令")
async def get_agent_session(session_id: str, db: Any = Depends(get_db)):
    """
    获取会话状态。

    如果工作流处于 INTERACT 模式，同时返回当前交互指令。
    """
    from app.services.kernel.object_service import ObjectService
    from app.agent.workflow import get_agent_workflow

    svc = ObjectService(db)
    session = svc.get_object(_to_key(session_id))
    if not session:
        raise HTTPException(404, "会话不存在")

    # 获取 LangGraph 状态
    wf = get_agent_workflow()
    graph_state = await wf.get_state(session_id)

    response = {"session": session}

    if graph_state:
        response["mode"] = graph_state.get("mode", "")
        response["progress"] = graph_state.get("progress", 0.0)

        # 如果处于 INTERACT 模式，返回 UI 指令
        if graph_state.get("mode") == "interact":
            response["interaction"] = wf.get_missing_ui(graph_state)

    return response


@router.post("/sessions/{session_id}/resume", summary="提交数据并恢复工作流")
async def resume_agent_session(
    session_id: str,
    data: AgentSessionResume,
    db: Any = Depends(get_db),
):
    """
    提交用户数据并从中断点恢复工作流。

    工作流会执行 collect → planner → (可能再次中断在 interact)。
    """
    from app.services.kernel.object_service import ObjectService
    from app.agent.workflow import get_agent_workflow

    # 验证 session 存在
    svc = ObjectService(db)
    session = svc.get_object(_to_key(session_id))
    if not session:
        raise HTTPException(404, "会话不存在")

    # 恢复工作流
    try:
        wf = get_agent_workflow()
        result = await wf.submit_data(session_id, data.data)
    except Exception as e:
        logger.error(f"Failed to resume workflow: {e}")
        raise HTTPException(500, f"工作流恢复失败: {str(e)}")

    # 更新 session 状态
    mode = result.get("mode", "")
    progress = result.get("progress", 0.0)
    interaction_count = result.get("interaction_count", 0)
    try:
        from app.models.kernel.meta_model import ObjectUpdate
        orig_props = session.get("properties", {})
        update_props = {
            "project_goal": orig_props.get("project_goal", ""),
            "benchmark_id": orig_props.get("benchmark_id", ""),
            **({"project_id": orig_props.get("project_id")} if orig_props.get("project_id") else {}),
            "status": mode,
            "progress": progress,
            "interaction_count": interaction_count,
        }
        if result.get("pptx_path"):
            update_props["pptx_path"] = result["pptx_path"]
        svc.update_object(session_id, ObjectUpdate(properties=update_props))
    except Exception as e:
        logger.warning(f"Failed to update session: {e}")

    # 返回结果
    response = {
        "mode": mode,
        "progress": progress,
        "interaction_count": interaction_count,
    }

    # 如果再次进入 INTERACT 模式，返回 UI 指令
    if mode == "interact":
        response["interaction"] = wf.get_missing_ui(result)

    # 如果完成，返回 distilled_spec
    if mode == "completed":
        response["distilled_spec"] = result.get("distilled_spec")
        # 从最后一条 assistant 消息提取 kernel_objects_created
        for msg in reversed(result.get("messages", [])):
            if msg.get("role") == "assistant":
                metadata = msg.get("metadata", {})
                if metadata.get("kernel_objects_created"):
                    response["kernel_objects_created"] = metadata["kernel_objects_created"]
                break

    # 如果失败，返回错误信息
    if mode == "failed":
        response["error"] = result.get("error_message", "未知错误")

    return response


@router.get("/sessions/{session_id}/messages", summary="获取对话历史")
async def get_agent_messages(session_id: str):
    """获取 Agent 会话的完整对话历史"""
    from app.agent.workflow import get_agent_workflow

    wf = get_agent_workflow()
    messages = await wf.get_history(session_id)

    # 过滤掉 system 消息中的内部元数据
    clean_messages = []
    for msg in messages:
        clean = {
            "role": msg.get("role", ""),
            "content": msg.get("content", ""),
        }
        if msg.get("metadata"):
            clean["metadata"] = msg["metadata"]
        clean_messages.append(clean)

    return {"messages": clean_messages, "count": len(clean_messages)}


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT, summary="删除 Agent 会话")
def delete_agent_session(session_id: str, db: Any = Depends(get_db)):
    from app.services.kernel.object_service import ObjectService
    svc = ObjectService(db)
    svc.delete_object(_to_key(session_id))


# ═══════════════════════════════════════════════
# Milestone 4: Download & Spec
# ═══════════════════════════════════════════════


@router.get("/sessions/{session_id}/spec", summary="查看 Project_Spec")
async def get_session_spec(session_id: str):
    """获取会话的蒸馏后 Project_Spec 数据"""
    from app.agent.workflow import get_agent_workflow

    wf = get_agent_workflow()
    state = await wf.get_state(session_id)
    if not state:
        raise HTTPException(404, "会话不存在")

    distilled = state.get("distilled_spec")
    if not distilled:
        # 从最后一条 assistant 消息中提取
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "assistant":
                metadata = msg.get("metadata", {})
                if metadata.get("distilled_spec"):
                    distilled = metadata["distilled_spec"]
                    break

    if not distilled:
        raise HTTPException(404, "Project_Spec 尚未生成（数据收集未完成）")

    return {
        "session_id": session_id,
        "spec": distilled,
    }


@router.get("/sessions/{session_id}/download", summary="下载 PPTX 报告")
async def download_pptx(session_id: str):
    """下载 Agent 生成的 PPTX 报告文件"""
    import os
    from fastapi.responses import FileResponse

    from app.agent.workflow import get_agent_workflow

    wf = get_agent_workflow()
    state = await wf.get_state(session_id)
    if not state:
        raise HTTPException(404, "会话不存在")

    # 查找 pptx_path
    pptx_path = state.get("pptx_path")
    if not pptx_path:
        # 从消息中提取
        for msg in reversed(state.get("messages", [])):
            if msg.get("role") == "assistant":
                metadata = msg.get("metadata", {})
                if metadata.get("pptx_path"):
                    pptx_path = metadata["pptx_path"]
                    break

    if not pptx_path or not os.path.exists(pptx_path):
        raise HTTPException(404, "PPTX 报告尚未生成")

    filename = os.path.basename(pptx_path)
    return FileResponse(
        path=pptx_path,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        filename=filename,
    )
