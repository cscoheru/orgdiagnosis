"""
订单 API — 合同、团队成员、项目排期

通过 kernel ObjectService 操作 Contract / Team_Member meta-model。
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.kernel.database import get_db
from app.services.kernel.object_service import ObjectService
from app.models.kernel.meta_model import ObjectCreate, ObjectUpdate

router = APIRouter(prefix="/projects/{project_id}/order", tags=["订单管理"])


# ── Request / Response Models ──

class PaymentMilestoneInput(BaseModel):
    percentage: float
    trigger_event: str
    expected_date: Optional[str] = None


class ContractInput(BaseModel):
    contract_number: str
    total_amount: float
    currency: str = "CNY"
    payment_schedule: List[PaymentMilestoneInput]
    signed_date: Optional[str] = None
    client_signatory: Optional[str] = None
    description: Optional[str] = None


class TeamMemberInput(BaseModel):
    name: str
    role: str = "member"
    specialization: Optional[str] = None
    is_external: bool = False


class SaveOrderRequest(BaseModel):
    contract: ContractInput
    team: List[TeamMemberInput]
    project_start: str
    project_end: str
    milestone_dates: Optional[List[Dict[str, Any]]] = None


def _get_obj_service() -> ObjectService:
    db = get_db()
    return ObjectService(db)


# ── Endpoints ──

@router.post("")
async def save_order(project_id: str, req: SaveOrderRequest):
    """保存合同 + 团队 + 更新项目排期"""
    svc = _get_obj_service()

    # 1. 验证项目存在
    projects = svc.list_objects("Consulting_Engagement")
    project_obj = None
    for p in projects:
        if p.get("_key") == project_id or p.get("properties", {}).get("_key") == project_id:
            project_obj = p
            break
    if not project_obj:
        # 也可能是通过 properties 中的 id 字段
        for p in projects:
            props = p.get("properties", p)
            if props.get("_key") == project_id or props.get("id") == project_id:
                project_obj = p
                break
    # If still not found, just proceed (project may be in SQLite, not kernel)

    # 2. 创建/更新 Contract 对象
    contract_data = req.contract.model_dump()
    contract_data["project_id"] = project_id
    # Convert empty strings to None for optional fields (datetime, text, etc.)
    for field in ("signed_date", "client_signatory", "description"):
        if not contract_data.get(field):
            contract_data.pop(field, None)

    # Check if contract already exists
    existing_contracts = svc.list_objects("Contract")
    contract_key = None
    for c in existing_contracts:
        props = c.get("properties", c)
        pid = props.get("project_id", "")
        if pid == project_id:
            contract_key = c.get("_key")
            svc.update_object(contract_key, ObjectUpdate(properties=contract_data))
            break

    if not contract_key:
        result = svc.create_object(ObjectCreate(model_key="Contract", properties=contract_data))
        contract_key = result.get("_key")

    # 3. 创建 Team_Member 对象
    team_keys = []
    # Delete old team members first
    existing_team = svc.list_objects("Team_Member")
    for tm in existing_team:
        props = tm.get("properties", tm)
        if props.get("project_id") == project_id:
            svc.delete_object(tm.get("_key"))

    for member in req.team:
        member_data = member.model_dump()
        member_data["project_id"] = project_id
        result = svc.create_object(ObjectCreate(model_key="Team_Member", properties=member_data))
        team_keys.append(result.get("_key"))

    # 4. 更新项目日期
    if project_obj:
        update_props = {}
        obj_props = project_obj.get("properties", project_obj)
        if req.project_start:
            update_props["start_date"] = req.project_start
        if req.project_end:
            update_props["end_date"] = req.project_end
        if update_props:
            pk = project_obj.get("_key")
            if pk:
                svc.update_object(pk, ObjectUpdate(properties=update_props))

    return {"success": True, "data": {"contract_key": contract_key, "team_keys": team_keys}}


@router.get("")
async def get_order(project_id: str):
    """获取项目的合同 + 团队信息"""
    svc = _get_obj_service()

    # Find contract
    contract = None
    for c in svc.list_objects("Contract"):
        props = c.get("properties", c)
        if props.get("project_id") == project_id:
            contract = props
            break

    # Find team members
    team = []
    for tm in svc.list_objects("Team_Member"):
        props = tm.get("properties", tm)
        if props.get("project_id") == project_id:
            team.append({
                "_key": tm.get("_key"),
                **{k: v for k, v in props.items() if k != "project_id"},
            })

    # Find project dates
    project_start = None
    project_end = None
    for p in svc.list_objects("Consulting_Engagement"):
        props = p.get("properties", p)
        if props.get("_key") == project_id or props.get("id") == project_id:
            project_start = props.get("start_date")
            project_end = props.get("end_date")
            break

    return {
        "success": True,
        "data": {
            "contract": contract,
            "team": team,
            "project_start": project_start,
            "project_end": project_end,
        },
    }


@router.patch("")
async def update_order(project_id: str, req: SaveOrderRequest):
    """更新订单（同 save，覆盖式）"""
    return await save_order(project_id, req)
