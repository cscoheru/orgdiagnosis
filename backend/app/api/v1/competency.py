"""
Competency Co-pilot — API 端点

提供预计算数据的查询、AI 校准对话和最终模型的保存接口。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pathlib import Path
import json
import logging

from app.services.ai_client import AIClient

logger = logging.getLogger(__name__)
router = APIRouter()

DATA_DIR = Path(__file__).resolve().parents[3] / "data" / "competency_output"


# ── 响应模型 ──────────────────────────────────────────────

class FinalModelRequest(BaseModel):
    confirmed_at: Optional[str] = None
    l1_terms: List[str]
    l2_terms: Dict[str, List[str]]
    behaviors: Dict[str, Dict[str, List[str]]]
    resources: List[str] = []


# ── 工具函数 ──────────────────────────────────────────────

def _load_json(filename: str):
    path = DATA_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"数据文件不存在: {filename}")
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _save_json(filename: str, data):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    path = DATA_DIR / filename
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


# ── 端点 ──────────────────────────────────────────────

@router.get("/competency/materials")
async def get_competency_materials():
    """获取所有预计算的能力模型数据（一次性加载）"""
    try:
        data = _load_json("result.json")
        return {"success": True, "data": data}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/competency/final-model")
async def get_final_model():
    """获取专家确认的最终模型（如果有）"""
    try:
        data = _load_json("final_model.json")
        return {"success": True, "data": data}
    except HTTPException:
        return {"success": True, "data": None}


@router.post("/competency/model/final")
async def save_final_model(model: FinalModelRequest):
    """保存专家确认的最终能力模型"""
    data = model.model_dump()
    if not data.get("confirmed_at"):
        data["confirmed_at"] = datetime.now(timezone.utc).isoformat()

    try:
        _save_json("final_model.json", data)
        return {"success": True, "message": "最终模型已保存"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── AI 校准端点 ──────────────────────────────────────

class CalibrateRequest(BaseModel):
    messages: List[Dict[str, str]]  # [{"role": "user"|"assistant", "content": "..."}]


@router.post("/competency/calibrate")
async def calibrate_chat(req: CalibrateRequest):
    """能力模型校准 — AI 对话端点

    支持多轮对话，system prompt 自动注入能力模型概要。
    """
    ai = AIClient()
    if not ai.is_configured():
        raise HTTPException(status_code=503, detail="AI 服务未配置，请联系管理员")

    # 加载能力模型概要作为 system prompt 上下文
    try:
        data = _load_json("result.json")
        competencies = data.get("competencies", [])
    except Exception:
        competencies = []

    model_summary_lines = []
    for label, key in [("交付管理", "delivery_management"), ("项目管理", "business_management")]:
        items = [c for c in competencies if c.get("model") == key]
        model_summary_lines.append(f"## {label}（{len(items)} 项 L1）")
        for c in items:
            l2s = ", ".join(
                f"{s.get('code', '')} {s.get('term', '')}" for s in c.get("secondary_terms", [])
            )
            model_summary_lines.append(f"- {c.get('code', '')} {c.get('term', '')}: {l2s}")
        model_summary_lines.append("")

    system_prompt = (
        "你是一位资深的数字化人才能力模型专家，正在协助泸州老窖数字化发展中心优化技术岗位的能力模型。\n\n"
        "**当前能力模型概要：**\n\n"
        + "\n".join(model_summary_lines)
        + "你的职责：\n"
        "1. 基于用户需求，对能力模型的 L2/L3 层级提出具体的优化建议\n"
        "2. L3 行为描述必须是'能力描述'而非'任务描述'（能力=能做到什么程度，任务=做什么）\n"
        "3. L3 编写公式：行为动词 + 具体场景 + 可衡量结果 + 复杂度标识\n"
        "4. 交付管理(DM)只有中级和高级两个层级，没有初级\n"
        "5. 项目管理(BM)有初级、中级、高级三个层级\n\n"
        "**输出要求：**\n"
        "- 具体可操作，给出可直接使用的文本\n"
        "- 标注修改的是哪个 L1/L2 的哪条 L3\n"
        "- 如有删除或合并建议，说明理由"
    )

    # 构建 messages（system + 用户历史）
    api_messages = [{"role": "system", "content": system_prompt}]
    for msg in req.messages:
        role = msg.get("role", "user")
        if role in ("user", "assistant"):
            api_messages.append({"role": role, "content": msg.get("content", "")})

    try:
        reply = await ai.chat(
            system_prompt=system_prompt,
            user_prompt=req.messages[-1].get("content", "") if req.messages else "",
            messages=api_messages,
            temperature=0.7,
            max_tokens=4096,
        )
        return {"success": True, "content": reply}
    except Exception as e:
        logger.error(f"AI calibrate error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 调用失败: {e}")


# ── AI 结构化分析端点 ──────────────────────────────────────

class AnalyzeRequest(BaseModel):
    prompt: str = ""  # 空字符串 = 使用默认分析条件


@router.post("/competency/calibrate/analyze")
async def calibrate_analyze(req: AnalyzeRequest = AnalyzeRequest()):
    """能力模型校准 — AI 结构化分析

    返回 L1→L2→L3 完整树形 JSON。
    支持自定义 prompt 控制分析方向。
    """
    ai = AIClient()
    if not ai.is_configured():
        raise HTTPException(status_code=503, detail="AI 服务未配置，请联系管理员")

    try:
        data = _load_json("result.json")
        competencies = data.get("competencies", [])
    except Exception:
        competencies = []

    # 构建模型概要（L1 + L2 名称）
    model_summary_lines = []
    for label, key in [("交付管理", "delivery_management"), ("项目管理", "business_management")]:
        items = [c for c in competencies if c.get("model") == key]
        model_summary_lines.append(f"## {label}（{len(items)} 项 L1）")
        for c in items:
            l2s = ", ".join(
                f"{s.get('code', '')} {s.get('term', '')}" for s in c.get("secondary_terms", [])
            )
            model_summary_lines.append(f"- {c.get('code', '')} {c.get('term', '')}: {l2s}")
        model_summary_lines.append("")

    default_prompt = (
        "请对当前能力模型进行全面分析和优化，返回优化后的完整 JSON。\n"
        "重点：\n"
        "1. 将 DM 所有 L3 从任务描述改为能力描述\n"
        "2. 优化所有 L2 命名为能力导向\n"
        "3. 确保 DM-26 质量与运行保障 有完整的 L2+L3\n"
        "4. 检查整体结构完整性"
    )

    system_prompt = (
        "你是一位资深的数字化人才能力模型专家，正在协助泸州老窖数字化发展中心优化技术岗位的能力模型。\n\n"
        "**当前能力模型概要：**\n\n"
        + "\n".join(model_summary_lines)
        + "**优化要求：**\n"
        "1. L2 命名必须是能力导向（如"能独立设计技术方案"）而非任务导向（如"编写技术文档"）\n"
        "2. L3 行为描述公式：行为动词 + 具体场景 + 可衡量结果\n"
        "3. 交付管理(DM)的 L3 只有中级和高级，没有初级\n"
        "4. 项目管理(BM)的 L3 有初级、中级、高级\n"
        "5. 每个 L2 至少编写 2 条 L3 行为描述\n\n"
        "**JSON 输出格式要求：**\n"
        "请严格返回一个 JSON 数组，不要包含其他文本或 markdown 标记。\n"
        "每个元素是一个 L1 能力项：\n"
        '[{"code":"DM-01","term":"技术方案解决","model":"delivery_management",'
        '"secondary_terms":[{"code":"DM-01-01","term":"需求分析","description":"描述",'
        '"behaviors":[{"level":"中级","description":"能力描述"},{"level":"高级","description":"能力描述"}]}]}]\n\n'
        "**重要约束：**\n"
        "- 只返回 JSON 数组，不要 ```json 标记或其他文本\n"
        "- 包含所有 L1 项，不要遗漏\n"
        "- model 字段只能是 delivery_management 或 business_management\n"
        "- DM 的 behaviors 只有 中级 和 高级\n"
        "- BM 的 behaviors 有 初级、中级、高级\n"
    )

    user_prompt = req.prompt or default_prompt

    try:
        result = await ai.chat_json(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            temperature=0.3,
            max_tokens=8192,
        )
        # 处理 AI 可能返回的包装结构
        if isinstance(result, dict):
            for key in ("data", "competencies", "items", "results"):
                if key in result and isinstance(result[key], list):
                    result = result[key]
                    break
            else:
                result = [result]
        if not isinstance(result, list):
            result = [result]
        return {"success": True, "data": result}
    except Exception as e:
        logger.error(f"AI calibrate analyze error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 结构化分析失败: {e}")
