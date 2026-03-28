"""
工作流 API v2

配置驱动的统一工作流 API，支持三类咨询交付流程。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List

router = APIRouter(prefix="/v2/workflow", tags=["workflow"])


# ============================================================
# Pydantic Models
# ============================================================

class StartWorkflowRequest(BaseModel):
    project_id: str = Field(..., description="项目 ID")
    workflow_type: str = Field(..., description="工作流类型: proposal/diagnosis/delivery")
    input_data: Optional[Dict[str, Any]] = Field(None, description="初始输入数据")
    session_id: Optional[str] = Field(None, description="恢复已有会话 ID")


class AdvanceStepRequest(BaseModel):
    step_data: Optional[Dict[str, Any]] = Field(None, description="当前步骤的人工编辑/确认数据")


class ExecuteStepRequest(BaseModel):
    step_id: Optional[str] = Field(None, description="要执行的步骤 ID (默认当前步骤)")
    input_data: Optional[Dict[str, Any]] = Field(None, description="步骤输入数据")


class SmartExtractRequest(BaseModel):
    text: str = Field(..., min_length=10, description="客户原始文本")


class SmartQuestionRequest(BaseModel):
    questionnaire_data: Dict[str, Any] = Field(..., description="已填写的问卷数据")


class GenerateOutlineSectionRequest(BaseModel):
    section_index: int = Field(..., description="阶段索引")


class GenerateOutlineActivityRequest(BaseModel):
    section_index: int = Field(..., description="阶段索引")
    activity_index: int = Field(..., description="活动索引")


# ============================================================
# Endpoints
# ============================================================

# Static routes (must be before {session_id} to avoid path conflicts)
@router.get("/configs")
async def list_workflow_configs():
    """列出所有可用的工作流类型配置"""
    from lib.workflow_engine.workflow_config import WORKFLOW_CONFIGS

    configs = []
    for key, config in WORKFLOW_CONFIGS.items():
        configs.append({
            "key": config.key,
            "name": config.name,
            "description": config.description,
            "steps": [
                {
                    "id": s.id,
                    "name": s.name,
                    "type": s.type,
                    "is_manual": s.is_manual,
                    "depends_on": s.depends_on,
                }
                for s in config.steps
            ],
            "initial_step": config.initial_step,
        })

    return {"success": True, "workflows": configs}


@router.post("/start")
async def start_workflow(request: StartWorkflowRequest):
    """启动工作流"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps

        register_all_steps()

        result = await workflow_engine.start_workflow(
            project_id=request.project_id,
            workflow_type=request.workflow_type,
            input_data=request.input_data,
            session_id=request.session_id,
        )
        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}")
async def get_workflow(session_id: str):
    """获取工作流当前步骤状态"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps

        register_all_steps()
        result = await workflow_engine.get_step(session_id)
        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/advance")
async def advance_workflow(session_id: str, request: AdvanceStepRequest):
    """推进到下一步 (附人工编辑数据)"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps

        register_all_steps()
        result = await workflow_engine.advance_step(
            session_id=session_id,
            step_data=request.step_data,
        )
        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/execute")
async def execute_workflow_step(session_id: str, request: ExecuteStepRequest):
    """手动触发执行指定步骤 (用于 AI 生成等需要触发的步骤)"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps

        register_all_steps()
        result = await workflow_engine.execute_step(
            session_id=session_id,
            step_id=request.step_id,
            input_data=request.input_data,
        )
        return {"success": result.success, "data": result.data, "error": result.error}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{session_id}/state")
async def get_workflow_state(session_id: str):
    """获取工作流完整状态 (含所有步骤历史数据)"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps

        register_all_steps()
        result = await workflow_engine.get_state(session_id)
        return {"success": True, **result}

    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/generate-outline-section")
async def generate_outline_section(session_id: str, request: GenerateOutlineSectionRequest):
    """按阶段生成大纲（避免一次性全量超时）"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps
        from lib.workflow_engine.steps.ai_generate import AIGenerateHandler

        register_all_steps()

        session = workflow_engine._sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        step_data = session.step_data
        plan = step_data.get("milestone_plan", {})
        phases = plan.get("phases", []) if isinstance(plan, dict) else []
        idx = request.section_index

        if idx >= len(phases):
            raise HTTPException(status_code=400, detail=f"阶段索引 {idx} 超出范围")

        phase = phases[idx]
        handler = AIGenerateHandler()

        result = await handler.execute(
            step_id="impl_outline_section",
            input_data={
                **step_data,
                "section_context": {
                    "section_name": phase.get("phase_name", ""),
                    "goals": phase.get("goals", ""),
                    "key_activities": phase.get("key_activities", []),
                    "deliverables": phase.get("deliverables", []),
                },
            },
            context={"step_config": {}},
        )

        if result.success:
            return {"success": True, "data": result.data, "section_index": idx}
        else:
            return {"success": False, "error": result.error}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{session_id}/generate-outline-activity")
async def generate_outline_activity(session_id: str, request: GenerateOutlineActivityRequest):
    """按关键活动生成大纲（最小粒度）"""
    try:
        from lib.workflow_engine import workflow_engine, register_all_steps
        from lib.workflow_engine.steps.ai_generate import AIGenerateHandler

        register_all_steps()

        session = workflow_engine._sessions.get(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="会话不存在")

        step_data = session.step_data
        plan = step_data.get("milestone_plan", {})
        phases = plan.get("phases", []) if isinstance(plan, dict) else []
        si = request.section_index
        ai = request.activity_index

        if si >= len(phases):
            raise HTTPException(status_code=400, detail=f"阶段索引 {si} 超出范围")

        phase = phases[si]
        activities = phase.get("key_activities", [])
        if ai >= len(activities):
            raise HTTPException(status_code=400, detail=f"活动索引 {ai} 超出范围")

        handler = AIGenerateHandler()

        result = await handler.execute(
            step_id="impl_outline_activity",
            input_data={
                **step_data,
                "section_context": {
                    "section_name": phase.get("phase_name", ""),
                    "goals": phase.get("goals", ""),
                },
                "activity_context": {
                    "activity_name": activities[ai],
                    "section_name": phase.get("phase_name", ""),
                },
            },
            context={"step_config": {}},
        )

        if result.success:
            return {"success": True, "data": result.data, "section_index": si, "activity_index": ai}
        else:
            return {"success": False, "error": result.error}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/smart-extract")
async def smart_extract(request: SmartExtractRequest):
    """AI 智能提取：从客户文本中提取结构化需求信息"""
    try:
        from lib.workflow_engine import register_all_steps
        from lib.workflow_engine.steps.ai_extract_form import AIExtractFormHandler

        register_all_steps()
        handler = AIExtractFormHandler()

        result = await handler.execute(
            step_id="smart_extract",
            input_data={"smart_extract": {"text": request.text}},
            context={},
        )

        if result.success:
            return {"success": True, "data": result.data}
        else:
            raise HTTPException(status_code=400, detail=result.error)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/smart-question")
async def smart_question(request: SmartQuestionRequest):
    """AI 智能补问：基于已填问卷发现缺失信息"""
    try:
        from lib.workflow_engine import register_all_steps
        from lib.workflow_engine.steps.smart_questionnaire import SmartQuestionnaireHandler

        register_all_steps()
        handler = SmartQuestionnaireHandler()
        result = await handler.smart_question(request.questionnaire_data)

        if result.success:
            return {"success": True, "data": result.data}
        else:
            raise HTTPException(status_code=400, detail=result.error)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

