"""
Competency Co-pilot — API 端点

提供预计算数据的查询和最终模型的保存接口。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
from datetime import datetime, timezone
from pathlib import Path
import json

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
