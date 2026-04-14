"""
绩效管理 API — 绩效咨询设计工具 REST API

提供绩效方案、组织绩效、岗位绩效的生成/查询/编辑，
以及考核表单、评分模型、考核记录、校准、分析、报告的完整接口。

基础 CRUD 通过 /v1/kernel/objects 端点操作，
本模块提供业务逻辑端点（AI 生成、统计分析等）。
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Body
from pydantic import BaseModel
from typing import Any, Optional
import json

from app.kernel.database import get_db
from app.services.kernel.object_service import ObjectService
from app.services.kernel.relation_service import RelationService

router = APIRouter(tags=["绩效管理"])


# ── 请求/响应模型 ──────────────────────────────────────────────

class GenerateOrgPerfRequest(BaseModel):
    """AI 生成部门绩效请求"""
    plan_id: str
    org_unit_id: str


class GeneratePosPerfRequest(BaseModel):
    """一键生成岗位绩效请求"""
    org_perf_id: str


class GenerateTemplateRequest(BaseModel):
    """AI 生成考核表单请求"""
    pos_perf_id: str


class CalibrationAnalyzeRequest(BaseModel):
    """校准分析请求"""
    calibration_id: str


class GenerateReportRequest(BaseModel):
    """生成咨询报告请求"""
    project_id: str


class BatchImportReviewsRequest(BaseModel):
    """批量导入考核记录请求"""
    reviews: list[dict[str, Any]]


class EnrichContextRequest(BaseModel):
    """富化上下文请求"""
    context_type: str  # client_profile / business_review / market_insights / strategic_direction
    content: str


class BridgeStrategyRequest(BaseModel):
    """从战略解码导入数据请求"""
    project_id: str


class GenerateCompanyPerfRequest(BaseModel):
    """AI 生成公司绩效请求"""
    plan_id: str


class DecomposeInitiativeRequest(BaseModel):
    """战略举措分解请求"""
    initiative_id: str
    plan_id: str = ""


class CascadeGenerateRequest(BaseModel):
    """级联生成请求"""
    plan_id: str
    org_unit_id: str
    cascade_mode: str = "top_down"


class PeriodDecomposeRequest(BaseModel):
    """周期分解请求"""
    org_perf_id: str
    target_periods: list[str] = ["Q1", "Q2", "Q3", "Q4"]


class SetParentOrgRequest(BaseModel):
    """设置上级部门请求"""
    parent_org_ref: str


# ── 工具函数 ──────────────────────────────────────────────

def _get_service(db: Any = Depends(get_db)) -> tuple:
    """获取 object 和 relation service"""
    obj_svc = ObjectService(db)
    rel_svc = RelationService(db)
    return obj_svc, rel_svc


def _filter_by_project(objects: list[dict], project_id: str) -> list[dict]:
    """按 project_id 过滤对象列表"""
    if not project_id:
        return objects
    return [
        o for o in objects
        if o.get("properties", {}).get("project_id") == project_id
    ]


def _filter_by_field(
    objects: list[dict], field: str, value: str
) -> list[dict]:
    """按指定字段过滤对象列表（兼容 sys_objects/ 前缀）"""
    if not value:
        return objects
    prefixed = f"sys_objects/{value}"
    return [
        o for o in objects
        if o.get("properties", {}).get(field) in (value, prefixed)
    ]


# ── 绩效方案 ──────────────────────────────────────────────

@router.post("/plans", summary="创建绩效方案")
def create_plan(data: dict[str, Any], db: Any = Depends(get_db)):
    """创建绩效方案 (直接写入 kernel objects)"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj_data = ObjectCreate(model_key="Performance_Plan", properties=data)
    return svc.create_object(obj_data)


@router.get("/plans", summary="获取绩效方案列表")
def list_plans(
    project_id: str = Query(default="", description="按项目 ID 过滤"),
    db: Any = Depends(get_db),
):
    """获取绩效方案列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Performance_Plan", limit=100) or []
    if project_id:
        objects = _filter_by_project(objects, project_id)
    return objects


@router.get("/plans/{key}", summary="获取绩效方案详情")
def get_plan(key: str, db: Any = Depends(get_db)):
    """获取绩效方案详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="绩效方案不存在")
    return obj


@router.patch("/plans/{key}", summary="更新绩效方案")
def update_plan(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """更新绩效方案"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="绩效方案不存在")
    return obj


# ── 组织绩效（公司级）─────────────────────────────────────

@router.post("/org-perf/generate-company", summary="AI 生成公司绩效")
async def generate_company_performance(
    req: GenerateCompanyPerfRequest,
    db: Any = Depends(get_db),
):
    """AI 生成公司级绩效（财务指标 + 战略指标）

    读取绩效方案的 business_context（含三档目标、3力3平台计划），
    结合 Strategic_Goal，AI 生成公司级 2 维度 KPI。
    """
    svc = ObjectService(db)

    # 1. 读取绩效方案
    plan = svc.get_object(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")

    props = plan.get("properties", {})
    ctx = props.get("business_context", {}) or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except (json.JSONDecodeError, TypeError):
            ctx = {}

    # 2. 读取战略目标
    goals = svc.list_objects("Strategic_Goal", limit=100) or []
    project_goals = [g for g in goals if g.get("properties", {}).get("plan_ref") == req.plan_id]
    if not project_goals:
        project_goals = [g for g in goals if g.get("properties", {}).get("project_id") == props.get("project_id")]
    if not project_goals:
        project_goals = goals

    goals_text = ""
    if project_goals:
        lines = []
        for g in project_goals:
            gp = g.get("properties", {})
            lines.append(
                f"- [{gp.get('priority', '')}] {gp.get('goal_name', '')} "
                f"(目标值: {gp.get('target_value', '')}, 状态: {gp.get('status', '')})"
            )
            if gp.get("description"):
                lines.append(f"  描述: {gp['description']}")
        goals_text = "\n".join(lines)
    else:
        goals_text = "暂无战略目标"

    # 3. 读取 3力3平台行动计划
    action_plans_text = ""
    action_plans_raw = ctx.get("action_plans", "")
    if action_plans_raw:
        try:
            action_plans = json.loads(action_plans_raw) if isinstance(action_plans_raw, str) else action_plans_raw
            if isinstance(action_plans, list) and len(action_plans) > 0:
                plan_lines = []
                for row in action_plans:
                    plan_lines.append(
                        f"- {row.get('customerGroup', '')}/{row.get('product', '')}: "
                        f"营收{row.get('revenueTarget', 0)}万\n"
                        f"  销售力: {row.get('salesForce', '')}\n"
                        f"  产品力: {row.get('productForce', '')}\n"
                        f"  交付力: {row.get('deliveryForce', '')}\n"
                        f"  人力: {row.get('hr', '')}\n"
                        f"  财务: {row.get('financeAssets', '')}\n"
                        f"  数字化: {row.get('digitalProcess', '')}"
                    )
                action_plans_text = "\n".join(plan_lines)
        except (json.JSONDecodeError, TypeError):
            pass

    # 4. 构建 prompt 并调用 AI
    prompt = f"""你是一位资深的绩效管理顾问。请根据以下战略信息，为公司层面生成绩效指标。

## 战略目标
{goals_text}

## 3力3平台行动计划
{action_plans_text or '暂无'}

## 业务背景
{ctx.get('business_review', '')}

## 市场洞察
{ctx.get('market_insights', '')}

## 战略方向
{ctx.get('strategic_direction', '')}

请生成以下 2 个维度的公司级绩效指标，以 JSON 格式返回：

1. **strategic_kpis**（财务指标）: 4-6 个指标，每个包含 name, weight, target
   - 基于三档目标设定营收/利润/回款等财务指标
   - weight 总和 = 50%

2. **management_indicators**（战略指标）: 4-6 个指标，每个包含 name, weight, target
   - 基于 3力3平台行动计划设定战略举措指标
   - weight 总和 = 50%

返回格式（纯 JSON，不要 markdown）：
{{
  "strategic_kpis": [
    {{"name": "指标名称", "weight": 25, "target": "目标值描述"}}
  ],
  "management_indicators": [
    {{"name": "指标名称", "weight": 25, "target": "目标值描述"}}
  ]
}}"""

    try:
        from app.services.ai_client import AIClient
        ai = AIClient()
        result = await ai.chat_json(
            system_prompt="你是一位绩效管理专家，请严格返回JSON格式。",
            user_prompt=prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 生成失败: {str(e)}")

    # 5. 创建 Org_Performance 对象
    from app.models.kernel.meta_model import ObjectUpdate

    company_perf = svc.create_object("Org_Performance", {
        "org_unit_ref": "__company__",
        "org_unit_name": "公司绩效",
        "plan_ref": req.plan_id,
        "project_id": props.get("project_id", ""),
        "strategic_kpis": result.get("strategic_kpis", []),
        "management_indicators": result.get("management_indicators", []),
        "team_development": [],
        "engagement_compliance": [],
        "dimension_weights": {"strategic": 50, "management": 50, "team_development": 0, "engagement": 0},
        "status": "待确认",
        "perf_type": "company",
    })

    if not company_perf:
        raise HTTPException(status_code=500, detail="创建公司绩效失败")

    return company_perf


# ── 三力三平台任务 AI 整合 ─────────────────────────────────

class ConsolidateTasksRequest(BaseModel):
    """AI 整合任务请求"""
    plan_id: str


@router.post("/tasks/consolidate", summary="AI 整合三力三平台任务")
async def consolidate_tasks(
    req: ConsolidateTasksRequest,
    db: Any = Depends(get_db),
):
    """AI 将 3力3平台行动计划中的 18 个任务整合为每维度 3-5 个关键任务。

    读取 plan 的 action_plans JSON，按维度聚合原始任务，
    调用 AI 做去重、合并、提炼，返回每维度 3-5 个关键任务。
    """
    svc = ObjectService(db)

    plan = svc.get_object(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")

    props = plan.get("properties", {})
    ctx = props.get("business_context", {}) or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except (json.JSONDecodeError, TypeError):
            ctx = {}

    action_plans_raw = ctx.get("action_plans", "")
    if not action_plans_raw:
        raise HTTPException(status_code=400, detail="尚未导入行动计划，请先从战略解码导入")

    try:
        action_plans = json.loads(action_plans_raw) if isinstance(action_plans_raw, str) else action_plans_raw
    except (json.JSONDecodeError, TypeError):
        raise HTTPException(status_code=400, detail="行动计划数据格式错误")

    if not isinstance(action_plans, list) or len(action_plans) == 0:
        raise HTTPException(status_code=400, detail="行动计划为空")

    # 按维度收集原始任务
    dimension_keys = {
        "salesForce": "销售力",
        "productForce": "产品力",
        "deliveryForce": "交付力",
        "hr": "人力资源",
        "financeAssets": "财务&资产",
        "digitalProcess": "数字化&流程",
    }

    dimension_tasks = {}
    for key, label in dimension_keys.items():
        tasks = []
        for row in action_plans:
            content = str(row.get(key, "")).strip()
            if content:
                tasks.append(f"[{row.get('customerGroup', '')}/{row.get('product', '')}] {content}")
        if tasks:
            dimension_tasks[label] = tasks

    if not dimension_tasks:
        raise HTTPException(status_code=400, detail="行动计划中无有效任务内容")

    # 构建 AI prompt
    dim_sections = []
    for label, tasks in dimension_tasks.items():
        dim_sections.append(f"### {label}\n" + "\n".join(f"- {t}" for t in tasks))

    prompt = f"""你是一位资深的战略管理顾问。以下是从多个客户群/产品线收集的"三力三平台"行动计划任务，存在大量重复和冗余。

请对每个维度进行整合：去重、合并相似任务、提炼核心要点，每个维度保留 3-5 个关键任务。

{chr(10).join(dim_sections)}

请以 JSON 格式返回，格式如下（纯 JSON，不要 markdown 代码块）：
{{
  "销售力": ["关键任务1", "关键任务2", "关键任务3"],
  "产品力": ["关键任务1", "关键任务2", "关键任务3"],
  "交付力": ["关键任务1", "关键任务2", "关键任务3"],
  "人力资源": ["关键任务1", "关键任务2", "关键任务3"],
  "财务&资产": ["关键任务1", "关键任务2", "关键任务3"],
  "数字化&流程": ["关键任务1", "关键任务2", "关键任务3"]
}}

要求：
- 每个维度的关键任务不超过 5 个
- 去掉客户名和产品名前缀，合并为通用的战略任务描述
- 任务描述简洁有力，便于直接用于组织绩效设计"""

    try:
        from app.services.ai_client import AIClient
        ai = AIClient()
        result = await ai.chat_json(
            system_prompt="你是一位战略管理专家，擅长从杂乱的任务列表中提炼关键战略任务。请严格返回JSON格式。",
            user_prompt=prompt,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 整合失败: {str(e)}")

    return {
        "success": True,
        "consolidated": result,
        "source_count": len(action_plans),
    }


# ── 组织绩效（部门级）─────────────────────────────────────

@router.post("/org-perf/generate", summary="AI 生成部门绩效")
async def generate_org_performance(
    req: GenerateOrgPerfRequest,
):
    """AI 生成部门绩效 (四维度)

    调用 generate_org_performance_node，
    基于 Strategic_Goal + Org_Unit 生成四维度部门绩效。
    """
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import generate_org_performance_node

    state = create_workflow_state(
        task_id="org_perf_gen",
        plan_id=req.plan_id,
        org_unit_id=req.org_unit_id,
    )

    result_state = await generate_org_performance_node(state)
    result = result_state.get("results", {}).get("org_performance", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "生成失败"))

    return result


@router.get("/org-perf", summary="获取部门绩效列表")
def list_org_performances(
    plan_id: str = Query(default="", description="按方案 ID 过滤"),
    db: Any = Depends(get_db),
):
    """获取部门绩效列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Org_Performance", limit=100) or []
    if plan_id:
        objects = _filter_by_field(objects, "plan_ref", plan_id)
    return objects


@router.get("/org-perf/{key}", summary="获取部门绩效详情")
def get_org_performance(key: str, db: Any = Depends(get_db)):
    """获取部门绩效详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="部门绩效不存在")
    return obj


@router.patch("/org-perf/{key}", summary="编辑部门绩效")
def update_org_performance(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """编辑确认部门绩效"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="部门绩效不存在")
    return obj


# ── 岗位绩效（一键生成）─────────────────────────────────────

@router.post("/pos-perf/generate", summary="一键生成岗位绩效")
async def generate_position_performance(
    req: GeneratePosPerfRequest,
):
    """一键生成岗位绩效 (四分区)

    调用 generate_position_performance_node，
    基于部门绩效 + 岗位列表批量生成岗位绩效。
    管理岗自动设置双重评估。
    """
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import generate_position_performance_node

    state = create_workflow_state(
        task_id="pos_perf_gen",
        org_perf_id=req.org_perf_id,
    )

    result_state = await generate_position_performance_node(state)
    result = result_state.get("results", {}).get("position_performance", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "生成失败"))

    return result


@router.get("/pos-perf", summary="获取岗位绩效列表")
def list_position_performances(
    org_perf_id: str = Query(default="", description="按部门绩效 ID 过滤"),
    plan_id: str = Query(default="", description="按方案 ID 过滤"),
    db: Any = Depends(get_db),
):
    """获取岗位绩效列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Position_Performance", limit=200) or []
    if org_perf_id:
        objects = _filter_by_field(objects, "org_perf_ref", org_perf_id)
    elif plan_id:
        objects = _filter_by_field(objects, "plan_ref", plan_id)
    return objects


@router.patch("/pos-perf/batch-update", summary="批量编辑岗位绩效")
def batch_update_position_performance(
    updates: list[dict[str, Any]] = Body(...),
    db: Any = Depends(get_db),
):
    """批量编辑岗位绩效

    每个更新项需包含: key (对象 _key) + 要更新的字段。
    自动标记 is_edited=true。
    """
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    results = []
    for item in updates:
        key = item.pop("key", "")
        if not key:
            results.append({"key": "", "status": "skipped", "error": "缺少 key"})
            continue
        item["is_edited"] = True
        obj = svc.update_object(key, ObjectUpdate(properties=item))
        results.append({
            "key": key,
            "status": "updated" if obj else "not_found",
        })
    return {"updated": len([r for r in results if r["status"] == "updated"]), "results": results}


@router.get("/pos-perf/{key}", summary="获取岗位绩效详情")
def get_position_performance(key: str, db: Any = Depends(get_db)):
    """获取岗位绩效详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="岗位绩效不存在")
    return obj


@router.patch("/pos-perf/{key}", summary="编辑岗位绩效")
def update_position_performance(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """编辑岗位绩效 (标记 is_edited=true)"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)

    # 标记为已编辑
    data["is_edited"] = True
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="岗位绩效不存在")
    return obj


# ── 考核表单模板 ──────────────────────────────────────

@router.post("/templates/generate", summary="AI 生成考核表单")
async def generate_review_template(
    req: GenerateTemplateRequest,
):
    """AI 生成考核表单模板

    调用 generate_review_template_node，
    基于岗位绩效生成完整考核表单 + 评分模型。
    """
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import generate_review_template_node

    state = create_workflow_state(
        task_id="template_gen",
        pos_perf_id=req.pos_perf_id,
    )

    result_state = await generate_review_template_node(state)
    result = result_state.get("results", {}).get("review_template", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "生成失败"))

    return result


@router.get("/templates", summary="获取考核表单列表")
def list_templates(
    plan_id: str = Query(default="", description="按方案 ID 过滤"),
    db: Any = Depends(get_db),
):
    """获取考核表单模板列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Review_Template", limit=100) or []
    if plan_id:
        objects = _filter_by_field(objects, "plan_ref", plan_id)
    return objects


@router.get("/templates/{key}", summary="获取考核表单详情")
def get_template(key: str, db: Any = Depends(get_db)):
    """获取考核表单详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="考核表单不存在")
    return obj


@router.patch("/templates/{key}", summary="编辑考核表单")
def update_template(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """编辑考核表单"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="考核表单不存在")
    return obj


# ── 评分模型 ──────────────────────────────────────

@router.post("/rating-models", summary="创建评分模型")
def create_rating_model(data: dict[str, Any], db: Any = Depends(get_db)):
    """创建评分模型"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj_data = ObjectCreate(model_key="Rating_Model", properties=data)
    return svc.create_object(obj_data)


@router.get("/rating-models", summary="获取评分模型列表")
def list_rating_models(db: Any = Depends(get_db)):
    """获取评分模型列表"""
    svc = ObjectService(db)
    return svc.list_objects("Rating_Model", limit=50) or []


@router.get("/rating-models/{key}", summary="获取评分模型详情")
def get_rating_model(key: str, db: Any = Depends(get_db)):
    """获取评分模型详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="评分模型不存在")
    return obj


@router.patch("/rating-models/{key}", summary="更新评分模型")
def update_rating_model(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """更新评分模型"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="评分模型不存在")
    return obj


# ── 考核记录 ──────────────────────────────────────

@router.post("/reviews", summary="创建考核记录")
def create_review(data: dict[str, Any], db: Any = Depends(get_db)):
    """创建考核记录"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj_data = ObjectCreate(model_key="Performance_Review", properties=data)
    return svc.create_object(obj_data)


@router.post("/reviews/batch", summary="批量导入考核记录")
def batch_import_reviews(
    req: BatchImportReviewsRequest,
    db: Any = Depends(get_db),
):
    """批量导入考核记录"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    created = []
    for review_data in req.reviews:
        obj_data = ObjectCreate(model_key="Performance_Review", properties=review_data)
        obj = svc.create_object(obj_data)
        created.append(obj.get("_id", ""))
    return {"count": len(created), "ids": created}


@router.get("/reviews", summary="获取考核记录列表")
def list_reviews(
    project_id: str = Query(default="", description="按项目 ID 过滤"),
    cycle_id: str = Query(default="", description="按考核周期过滤"),
    db: Any = Depends(get_db),
):
    """获取考核记录列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Performance_Review", limit=500) or []
    if project_id:
        objects = _filter_by_field(objects, "project_id", project_id)
    if cycle_id:
        objects = _filter_by_field(objects, "cycle_ref", cycle_id)
    return objects


@router.get("/reviews/{key}", summary="获取考核记录详情")
def get_review(key: str, db: Any = Depends(get_db)):
    """获取考核记录详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="考核记录不存在")
    return obj


# ── 校准 ──────────────────────────────────────

@router.post("/calibrations", summary="创建校准会话")
def create_calibration(data: dict[str, Any], db: Any = Depends(get_db)):
    """创建校准会话"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj_data = ObjectCreate(model_key="Calibration_Session", properties=data)
    return svc.create_object(obj_data)


@router.get("/calibrations/{key}", summary="获取校准会话详情")
def get_calibration(key: str, db: Any = Depends(get_db)):
    """获取校准会话详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="校准会话不存在")
    return obj


@router.post("/calibrations/{key}/analyze", summary="AI 校准分析")
async def analyze_calibration(key: str):
    """AI 校准分析"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import calibration_analysis_node

    state = create_workflow_state(
        task_id="cal_analysis",
        calibration_id=key,
    )

    result_state = await calibration_analysis_node(state)
    result = result_state.get("results", {}).get("calibration", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "分析失败"))

    return result


@router.get("/calibrations/{key}/nine-box", summary="获取九宫格数据")
def get_nine_box_data(key: str, db: Any = Depends(get_db)):
    """获取校准会话的九宫格数据"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj:
        raise HTTPException(status_code=404, detail="校准会话不存在")
    props = obj.get("properties", {})
    nine_box = props.get("nine_box_data", "[]")
    return {"nine_box_data": json.loads(nine_box) if isinstance(nine_box, str) else nine_box}


# ── 统计分析 ──────────────────────────────────────

@router.get("/analytics/distribution", summary="评分分布统计")
def get_distribution(
    project_id: str = Query(default="", description="项目 ID"),
    db: Any = Depends(get_db),
):
    """评分分布统计"""
    svc = ObjectService(db)
    reviews = svc.list_objects("Performance_Review", limit=500) or []

    if project_id:
        reviews = _filter_by_field(reviews, "project_id", project_id)

    ratings = {}
    scores = []
    for r in reviews:
        rating = r.get("properties", {}).get("overall_rating")
        score = r.get("properties", {}).get("overall_score")
        if rating:
            ratings[rating] = ratings.get(rating, 0) + 1
        if score is not None:
            scores.append(score)

    import statistics
    stats = {}
    if scores:
        stats = {
            "count": len(scores),
            "mean": round(statistics.mean(scores), 2),
            "median": round(statistics.median(scores), 2),
            "std_dev": round(statistics.stdev(scores), 2) if len(scores) > 1 else 0,
            "min": min(scores),
            "max": max(scores),
        }

    return {"rating_distribution": ratings, "score_statistics": stats, "total_reviews": len(reviews)}


@router.get("/analytics/bias", summary="偏差分析")
async def get_bias_analysis(
    project_id: str = Query(default="", description="项目 ID"),
):
    """AI 偏差分析"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import analyze_review_patterns_node

    state = create_workflow_state(
        task_id="bias_analysis",
        project_id=project_id,
    )

    result_state = await analyze_review_patterns_node(state)
    result = result_state.get("results", {}).get("review_patterns", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "分析失败"))

    return result


@router.get("/analytics/overview", summary="项目绩效全景")
def get_performance_overview(
    project_id: str = Query(default="", description="项目 ID"),
    db: Any = Depends(get_db),
):
    """项目绩效全景概览"""
    svc = ObjectService(db)

    plans = svc.list_objects("Performance_Plan", limit=10) or []
    org_perfs = svc.list_objects("Org_Performance", limit=50) or []
    pos_perfs = svc.list_objects("Position_Performance", limit=200) or []
    templates = svc.list_objects("Review_Template", limit=50) or []
    reviews = svc.list_objects("Performance_Review", limit=500) or []
    calibrations = svc.list_objects("Calibration_Session", limit=10) or []

    if project_id:
        plans = _filter_by_project(plans, project_id)
        org_perfs = _filter_by_project(org_perfs, project_id)
        pos_perfs = _filter_by_project(pos_perfs, project_id)
        reviews = _filter_by_project(reviews, project_id)
        calibrations = _filter_by_project(calibrations, project_id)

    leader_count = sum(
        1 for pp in pos_perfs
        if pp.get("properties", {}).get("is_leader")
    )

    return {
        "plans": len(plans),
        "org_performances": len(org_perfs),
        "position_performances": len(pos_perfs),
        "leaders": leader_count,
        "professionals": len(pos_perfs) - leader_count,
        "templates": len(templates),
        "reviews": len(reviews),
        "calibrations": len(calibrations),
        "auto_generated": sum(
            1 for pp in pos_perfs
            if pp.get("properties", {}).get("auto_generated")
        ),
        "edited": sum(
            1 for pp in pos_perfs
            if pp.get("properties", {}).get("is_edited")
        ),
    }


# ── 报告生成（交付成果）─────────────────────────────────────

@router.post("/reports/generate", summary="AI 生成咨询报告")
async def generate_report(req: GenerateReportRequest):
    """AI 生成绩效管理咨询报告"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.nodes import generate_performance_report_node

    state = create_workflow_state(
        task_id="report_gen",
        project_id=req.project_id,
    )

    result_state = await generate_performance_report_node(state)
    result = result_state.get("results", {}).get("performance_report", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "报告生成失败"))

    return result


# ── 战略上下文富化 ──────────────────────────────────────

@router.post("/plans/{key}/enrich-context", summary="富化方案上下文（文本粘贴）")
def enrich_plan_context(
    key: str,
    req: EnrichContextRequest,
    db: Any = Depends(get_db),
):
    """将文本内容保存到绩效方案的 business_context 对应分区"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)

    plan = svc.get_object(key)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")

    ctx = plan.get("properties", {}).get("business_context", {}) or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except (json.JSONDecodeError, TypeError):
            ctx = {}

    ctx[req.context_type] = req.content

    # Merge with existing properties to pass required field validation
    existing_props = plan.get("properties", {})
    merged_props = {**existing_props, "business_context": ctx}

    obj = svc.update_object(key, ObjectUpdate(properties=merged_props))
    if not obj:
        raise HTTPException(status_code=500, detail="更新失败")
    return {"success": True, "context_type": req.context_type}


# ── 战略目标 CRUD (Phase 3) ──────────────────────────────────────

@router.post("/strategic-goals", summary="创建战略目标")
def create_strategic_goal(data: dict[str, Any], db: Any = Depends(get_db)):
    """创建战略目标（支持 goal_type/milestones/target_metrics 等新字段）"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj_data = ObjectCreate(model_key="Strategic_Goal", properties=data)
    return svc.create_object(obj_data)


@router.get("/strategic-goals", summary="获取战略目标列表")
def list_strategic_goals(
    project_id: str = Query(default="", description="按 project_id 过滤"),
    goal_type: str = Query(default="", description="按 goal_type 过滤"),
    db: Any = Depends(get_db),
):
    """获取战略目标列表"""
    svc = ObjectService(db)
    objects = svc.list_objects("Strategic_Goal", limit=100) or []
    if project_id:
        objects = _filter_by_field(objects, "project_id", project_id)
    if goal_type:
        objects = [o for o in objects if o.get("properties", {}).get("goal_type") == goal_type]
    return objects


@router.patch("/strategic-goals/{key}", summary="更新战略目标")
def update_strategic_goal(key: str, data: dict[str, Any], db: Any = Depends(get_db)):
    """更新战略目标"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    if not obj:
        raise HTTPException(status_code=404, detail="战略目标不存在")
    return obj


@router.post("/strategic-goals/decompose", summary="AI 分解战略举措")
async def decompose_initiative(req: DecomposeInitiativeRequest):
    """AI 将战略举措分解为里程碑 + 关联KPI"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.goal_decomposer import decompose_initiative_node

    state = create_workflow_state(
        task_id="initiative_decompose",
        initiative_id=req.initiative_id,
        plan_id=req.plan_id,
    )

    result_state = await decompose_initiative_node(state)
    result = result_state.get("results", {}).get("initiative_decomposition", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "分解失败"))

    return result


@router.post("/plans/{key}/bridge-strategy", summary="从战略解码导入数据")
def bridge_strategy_data(
    key: str,
    req: BridgeStrategyRequest,
    db: Any = Depends(get_db),
):
    """从战略解码 wizard 导出数据映射到绩效方案的 business_context。

    映射规则:
    - step1 (业绩诊断) → business_review
    - step2 (市场洞察) → market_insights + swot_data
    - step3 (目标设定) → targets
    - step4 (战略执行) → bsc_cards + action_plans
    """
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)

    plan = svc.get_object(key)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")

    ctx = plan.get("properties", {}).get("business_context", {}) or {}
    if isinstance(ctx, str):
        try:
            ctx = json.loads(ctx)
        except (json.JSONDecodeError, TypeError):
            ctx = {}

    imported_any = False

    # 查找战略目标（Strategic_Goal 无 project_id 字段，直接使用全部）
    goals = svc.list_objects("Strategic_Goal", limit=100) or []
    # 优先按 project_id 过滤，若无匹配则使用全部
    project_goals = [g for g in goals if g.get("properties", {}).get("project_id") == req.project_id]
    if not project_goals:
        project_goals = goals

    if project_goals:
        target_lines = []
        for g in project_goals:
            p = g.get("properties", {})
            target_lines.append(
                f"- {p.get('goal_name', '')} (优先级: {p.get('priority', '')}, "
                f"目标值: {p.get('target_value', '')}, 状态: {p.get('status', '')})"
            )
        ctx["targets"] = "\n".join(target_lines)
        imported_any = True

    # 查找市场环境数据
    markets = svc.list_objects("Market_Context", limit=50) or []
    if markets:
        market = markets[0]
        mp = market.get("properties", {})
        insights_parts = []
        if mp.get("competitor_landscape"):
            insights_parts.append(f"竞争格局:\n{mp['competitor_landscape']}")
        if mp.get("customer_profile"):
            insights_parts.append(f"客户画像:\n{mp['customer_profile']}")
        if mp.get("market_position"):
            insights_parts.append(f"市场地位: {mp['market_position']}")
        if mp.get("growth_rate"):
            insights_parts.append(f"增长率: {mp['growth_rate']}%")
        if insights_parts:
            ctx["market_insights"] = "\n\n".join(insights_parts)
            imported_any = True

    # 查找战略举措
    initiatives = svc.list_objects("Strategic_Initiative", limit=50) or []
    if initiatives:
        init_lines = []
        for ini in initiatives:
            ip = ini.get("properties", {})
            init_lines.append(
                f"- {ip.get('initiative_name', '')} (状态: {ip.get('status', '')}, "
                f"描述: {ip.get('description', '')})"
            )
        ctx["strategic_direction"] = "\n".join(init_lines)
        imported_any = True

    # 未导入任何数据时返回提示
    if not imported_any:
        return {
            "success": False,
            "imported_sections": [],
            "message": "暂无战略解码数据可导入。请先在「战略解码」模块中完成战略目标设定，或直接在下方编辑框中粘贴内容。",
        }

    # Merge with existing properties to pass required field validation
    existing_props = plan.get("properties", {})
    merged_props = {**existing_props, "business_context": ctx}

    obj = svc.update_object(key, ObjectUpdate(properties=merged_props))
    if not obj:
        raise HTTPException(status_code=500, detail="更新失败")

    imported_sections = [k for k, v in ctx.items() if v]
    return {
        "success": True,
        "imported_sections": imported_sections,
        "context_summary": {k: (len(v) if isinstance(v, str) else "object") for k, v in ctx.items()},
    }


# ── 级联管理 (Phase 4) ──────────────────────────────────────

@router.post("/cascade/generate", summary="一键级联生成")
async def cascade_generate(req: CascadeGenerateRequest):
    """一键级联生成：公司目标 → 部门目标 → 岗位目标"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.cascade_orchestrator import generate_full_cascade

    state = create_workflow_state(
        task_id="cascade_gen",
        plan_id=req.plan_id,
        org_unit_id=req.org_unit_id,
        cascade_mode=req.cascade_mode,
    )

    result_state = await generate_full_cascade(state)
    result = result_state.get("results", {}).get("cascade", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "级联生成失败"))

    return result


@router.get("/cascade/tree", summary="获取级联树")
async def get_cascade_tree(
    plan_id: str = Query(default="", description="绩效方案 ID"),
    db: Any = Depends(get_db),
):
    """获取级联树结构（组织绩效层级关系）"""
    from app.services.kernel.object_service import ObjectService

    svc = ObjectService(db)
    org_perfs = svc.list_objects("Org_Performance", limit=100) or []

    if plan_id:
        org_perfs = _filter_by_field(org_perfs, "plan_ref", plan_id)

    # 构建树
    from collections import defaultdict

    children_map: dict[str, list] = defaultdict(list)
    roots = []

    for op in org_perfs:
        props = op.get("properties", {})
        parent_ref = props.get("parent_goal_ref", "")
        parent_key = parent_ref.removeprefix("sys_objects/") if parent_ref else ""

        node = {
            "_key": op["_key"],
            "type": "org_performance",
            "name": props.get("org_unit_name", ""),
            "perf_type": props.get("perf_type", "department"),
            "period_target": props.get("period_target", ""),
            "status": props.get("status", ""),
            "dimension_weights": props.get("dimension_weights", {}),
            "children": [],
        }

        if parent_key:
            children_map[parent_key].append(node)
        else:
            roots.append(node)

    # Attach children
    def attach_children(nodes: list):
        for node in nodes:
            node["children"] = children_map.get(node["_key"], [])
            attach_children(node["children"])

    attach_children(roots)

    # Also fetch position performances
    pos_perfs = svc.list_objects("Position_Performance", limit=200) or []
    if plan_id:
        pos_perfs = _filter_by_field(pos_perfs, "plan_ref", plan_id)

    for op_node in _flatten_tree(roots):
        op_key = op_node["_key"]
        for pp in pos_perfs:
            pp_props = pp.get("properties", {})
            org_ref = pp_props.get("org_perf_ref", "")
            if org_ref in (op_key, f"sys_objects/{op_key}"):
                op_node.setdefault("children", []).append({
                    "_key": pp["_key"],
                    "type": "position_performance",
                    "name": pp_props.get("job_role_name", ""),
                    "is_leader": pp_props.get("is_leader", False),
                    "status": pp_props.get("status", ""),
                    "period_target": pp_props.get("period_target", ""),
                    "children": [],
                })

    return {"tree": roots, "total_org_perfs": len(org_perfs), "total_pos_perfs": len(pos_perfs)}


def _flatten_tree(nodes: list) -> list:
    """将嵌套树扁平化为列表"""
    result = []
    for node in nodes:
        result.append(node)
        result.extend(_flatten_tree(node.get("children", [])))
    return result


@router.post("/org-perf/{key}/decompose-period", summary="周期分解")
async def decompose_period(req: PeriodDecomposeRequest, key: str):
    """将年度部门绩效分解为季度/月度目标"""
    from lib.workflow.base_state import create_workflow_state
    from lib.domain.performance.period_decomposer import decompose_period_node

    state = create_workflow_state(
        task_id="period_decompose",
        org_perf_id=key,
        target_periods=req.target_periods,
    )

    result_state = await decompose_period_node(state)
    result = result_state.get("results", {}).get("period_decomposition", {})

    if result.get("status") == "failed":
        raise HTTPException(status_code=500, detail=result.get("error", "周期分解失败"))

    return result


@router.patch("/org-units/{key}/set-parent", summary="设置上级部门")
def set_parent_org(key: str, req: SetParentOrgRequest, db: Any = Depends(get_db)):
    """设置部门的上级部门（建立组织层级）"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)

    # 验证上级部门存在
    parent_key = req.parent_org_ref.removeprefix("sys_objects/")
    parent = svc.get_object(parent_key)
    if not parent:
        raise HTTPException(status_code=404, detail=f"上级部门 {req.parent_org_ref} 不存在")

    obj = svc.update_object(key, ObjectUpdate(properties={"parent_org_ref": _ref(req.parent_org_ref)}))
    if not obj:
        raise HTTPException(status_code=404, detail="部门不存在")

    return {"success": True, "org_unit": key, "parent": req.parent_org_ref}


# ═══════════════════════════════════════════════════════════════
# 指标库 API (Metrics Library)
# ═══════════════════════════════════════════════════════════════

class MetricTemplateCreateRequest(BaseModel):
    """创建指标模板"""
    metric_name: str
    dimension: str = ""
    applicable_level: str = ""
    industries: list[str] = []
    default_weight: float = 10.0
    unit: str = ""
    target_template: str = ""
    evaluation_criteria: str = ""
    description: str = ""
    metric_formula: str = ""
    data_source_hint: str = ""
    tags: list[str] = []
    org_dimension_mapping: str = ""
    pos_section_mapping: str = ""
    source: str = "user_created"
    status: str = "draft"


class MetricTemplateApplyRequest(BaseModel):
    """从指标库应用到绩效方案"""
    plan_id: str
    org_unit_id: str
    template_keys: list[str]  # Metric_Template 的 _key 列表
    mode: str = "org"  # "org" 或 "pos"


class AiSuggestRequest(BaseModel):
    """AI 建议指标"""
    plan_id: str
    org_unit_id: str
    context: str = ""


@router.get("/metric-categories", summary="获取指标分类列表")
def list_metric_categories(
    category_type: Optional[str] = Query(None, description="分类类型过滤: industry/dimension/level/custom"),
    db: Any = Depends(get_db),
):
    """获取指标分类列表"""
    svc = ObjectService(db)
    results = svc.list_objects("Metric_Category", limit=200)

    if category_type:
        results = [r for r in results if r.get("properties", {}).get("category_type") == category_type]

    # 按 display_order 排序
    results.sort(key=lambda r: r.get("properties", {}).get("display_order", 999))
    return [{"_key": r["_key"], **r.get("properties", {})} for r in results]


@router.post("/metric-categories", summary="创建指标分类")
def create_metric_category(
    data: dict[str, Any] = Body(...),
    db: Any = Depends(get_db),
):
    """创建指标分类"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    obj = svc.create_object(ObjectCreate(model_key="Metric_Category", properties=data))
    return {"success": True, "_key": obj["_key"]}


@router.get("/metric-templates", summary="搜索指标模板")
def list_metric_templates(
    keyword: Optional[str] = Query(None, description="关键词搜索"),
    dimension: Optional[str] = Query(None, description="维度过滤"),
    level: Optional[str] = Query(None, description="适用层级过滤"),
    industry: Optional[str] = Query(None, description="行业过滤"),
    tag: Optional[str] = Query(None, description="标签过滤"),
    source: Optional[str] = Query(None, description="来源过滤"),
    status: Optional[str] = Query(None, description="状态过滤 (published/draft/all)"),
    org_dim: Optional[str] = Query(None, description="组织绩效维度映射过滤"),
    pos_sec: Optional[str] = Query(None, description="岗位绩效分区映射过滤"),
    limit: int = Query(50, le=200),
    offset: int = Query(0, ge=0),
    db: Any = Depends(get_db),
):
    """搜索指标模板（支持多维度过滤，默认只返回已发布）"""
    if status is None:
        status = "published"

    svc = ObjectService(db)
    all_results = svc.list_objects("Metric_Template", limit=500)

    # 过滤 (使用列表推导避免迭代中删除的 bug)
    def match(r):
        p = r.get("properties", {})
        if keyword:
            # 精准匹配：仅搜索 metric_name
            if keyword.lower() not in (p.get("metric_name") or "").lower():
                return False
        if dimension and p.get("dimension") != dimension:
            return False
        if level and p.get("applicable_level") != level:
            return False
        if industry and industry not in (p.get("industries") or []):
            return False
        if tag and tag not in (p.get("tags") or []):
            return False
        if source and p.get("source") != source:
            return False
        # status 过滤: 字段不存在时视为 published
        if status and status != "all":
            obj_status = p.get("status") or "published"
            if obj_status != status:
                return False
        if org_dim and p.get("org_dimension_mapping") != org_dim:
            return False
        if pos_sec and p.get("pos_section_mapping") != pos_sec:
            return False
        return True

    results = [r for r in all_results if match(r)]

    total = len(results)
    results = results[offset:offset + limit]
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "data": [{"_key": r["_key"], **r.get("properties", {})} for r in results],
    }


@router.get("/metric-templates/{key}", summary="获取指标模板详情")
def get_metric_template(key: str, db: Any = Depends(get_db)):
    """获取指标模板详情"""
    svc = ObjectService(db)
    obj = svc.get_object(key)
    if not obj or obj.get("model_key") != "Metric_Template":
        raise HTTPException(status_code=404, detail="指标模板不存在")
    return {"_key": obj["_key"], **obj.get("properties", {})}


@router.post("/metric-templates", summary="创建指标模板")
def create_metric_template(req: MetricTemplateCreateRequest, db: Any = Depends(get_db)):
    """创建指标模板（用户自定义）"""
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)
    props = req.model_dump(exclude_none=True)
    obj = svc.create_object(ObjectCreate(model_key="Metric_Template", properties=props))
    return {"success": True, "_key": obj["_key"]}


@router.patch("/metric-templates/{key}", summary="更新指标模板")
def update_metric_template(key: str, data: dict[str, Any] = Body(...), db: Any = Depends(get_db)):
    """更新指标模板"""
    from app.models.kernel.meta_model import ObjectUpdate
    svc = ObjectService(db)
    existing = svc.get_object(key)
    if not existing or existing.get("model_key") != "Metric_Template":
        raise HTTPException(status_code=404, detail="指标模板不存在")
    obj = svc.update_object(key, ObjectUpdate(properties=data))
    return {"success": True, "_key": obj["_key"]}


@router.delete("/metric-templates/{key}", summary="删除指标模板")
def delete_metric_template(key: str, db: Any = Depends(get_db)):
    """删除指标模板（仅允许 user_created 来源）"""
    svc = ObjectService(db)
    existing = svc.get_object(key)
    if not existing or existing.get("model_key") != "Metric_Template":
        raise HTTPException(status_code=404, detail="指标模板不存在")
    source = existing.get("properties", {}).get("source", "")
    if source not in ("user_created",):
        raise HTTPException(status_code=403, detail="仅允许删除用户创建的指标模板")
    svc.delete_object(key)
    return {"success": True}


@router.post("/metric-templates/apply", summary="从指标库应用到绩效方案")
def apply_metric_templates(req: MetricTemplateApplyRequest, db: Any = Depends(get_db)):
    """从指标库选取指标，结构化组装为 Org_Performance 或 Position_Performance。

    纯结构化操作，不调用 AI。
    """
    from app.models.kernel.meta_model import ObjectCreate
    svc = ObjectService(db)

    # 1. 加载所有选中的指标模板
    templates = []
    for key in req.template_keys:
        obj = svc.get_object(key)
        if not obj or obj.get("model_key") != "Metric_Template":
            continue
        templates.append(obj)

    if not templates:
        raise HTTPException(status_code=400, detail="未找到有效的指标模板")

    # 2. 读取绩效方案获取 project_id
    plan = svc.get_object(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")
    project_id = plan.get("properties", {}).get("project_id", "")

    # 3. 读取组织单元
    org_unit = svc.get_object(req.org_unit_id)
    org_unit_name = org_unit.get("properties", {}).get("unit_name", "") if org_unit else ""

    if req.mode == "org":
        # 4a. 按 org_dimension_mapping 分组
        groups: dict[str, list] = {
            "strategic_kpis": [],
            "management_indicators": [],
            "team_development": [],
            "engagement_compliance": [],
        }
        for tpl in templates:
            p = tpl.get("properties", {})
            dim = p.get("org_dimension_mapping", "management_indicators")
            if dim not in groups:
                dim = "management_indicators"
            groups[dim].append({
                "name": p.get("metric_name", ""),
                "metric": p.get("metric_formula", ""),
                "weight": p.get("default_weight", 10),
                "target": p.get("target_template", ""),
                "unit": p.get("unit", ""),
                "source_template": tpl["_key"],
            })

        # 5a. 计算维度权重
        total_w = sum(
            sum(item["weight"] for item in items)
            for items in groups.values()
        ) or 1
        dim_weights = {
            "strategic": round(sum(i["weight"] for i in groups["strategic_kpis"]) / total_w * 100),
            "management": round(sum(i["weight"] for i in groups["management_indicators"]) / total_w * 100),
            "team_development": round(sum(i["weight"] for i in groups["team_development"]) / total_w * 100),
            "engagement": round(sum(i["weight"] for i in groups["engagement_compliance"]) / total_w * 100),
        }

        # 6a. 创建 Org_Performance
        org_perf = svc.create_object(ObjectCreate(model_key="Org_Performance", properties={
            "org_unit_ref": _ref(req.org_unit_id),
            "org_unit_name": org_unit_name,
            "plan_ref": _ref(req.plan_id),
            "project_id": project_id,
            "strategic_kpis": groups["strategic_kpis"] or [],
            "management_indicators": groups["management_indicators"] or [],
            "team_development": groups["team_development"] or [],
            "engagement_compliance": groups["engagement_compliance"] or [],
            "dimension_weights": dim_weights,
            "period": "年度",
            "status": "待确认",
            "perf_type": "department",
        }))

        return {
            "success": True,
            "mode": "org",
            "org_perf_key": org_perf["_key"],
            "dimensions": {k: len(v) for k, v in groups.items()},
            "dimension_weights": dim_weights,
        }

    else:
        raise HTTPException(status_code=400, detail="目前仅支持 org 模式，pos 模式开发中")


@router.post("/metric-templates/ai-suggest", summary="AI 建议指标（轻量级）")
async def ai_suggest_metrics(req: AiSuggestRequest, db: Any = Depends(get_db)):
    """AI 建议指标（返回 3-5 个，不持久化）。

    读取方案上下文 + 行业信息，从指标库检索匹配模板作为参考，
    AI 生成/定制建议，返回建议列表供用户审核。
    """
    from app.services.ai_client import AIClient

    svc = ObjectService(db)

    # 1. 读取方案上下文
    plan = svc.get_object(req.plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="绩效方案不存在")
    plan_props = plan.get("properties", {})
    industry = plan_props.get("industry", "")
    client_name = plan_props.get("client_name", "")
    context = req.context or ""

    # 2. 从指标库检索匹配模板
    existing = svc.list_objects("Metric_Template", limit=500)
    matched = []
    for r in existing:
        p = r.get("properties", {})
        if industry and industry in p.get("industries", []):
            matched.append(p)
    # 最多取 10 个参考
    ref_metrics = matched[:10]

    # 3. 调用 AI
    ai = AIClient()
    prompt = f"""你是一位资深的绩效管理顾问。请为以下场景建议 3-5 个绩效指标。

行业: {industry}
客户: {client_name}
补充说明: {context}

参考指标库中的指标（格式: 名称|维度|层级|权重）:
{chr(10).join(f"- {m.get('metric_name','')}|{m.get('dimension','')}|{m.get('applicable_level','')}|{m.get('default_weight',10)}%" for m in ref_metrics)}

请以 JSON 格式输出建议指标:
[
  {{
    "metric_name": "指标名称",
    "dimension": "维度",
    "applicable_level": "层级",
    "default_weight": 10,
    "unit": "计量单位",
    "target_template": "目标值模板",
    "evaluation_criteria": "评估标准",
    "org_dimension_mapping": "strategic_kpis",
    "reason": "推荐理由"
  }}
]

要求:
1. 指标要具体、可量化
2. 优先参考指标库中匹配的行业指标
3. 权重合计建议 100
4. 给出推荐理由"""

    try:
        result = await ai.chat("你是一位资深的绩效管理顾问。", prompt, temperature=0.3)
        if isinstance(result, str):
            # 尝试解析 JSON
            text = result.strip()
            if text.startswith("```"):
                first_nl = text.find("\n")
                if first_nl >= 0:
                    text = text[first_nl + 1:]
                if text.endswith("```"):
                    text = text[:-3]
                text = text.strip()
            import json
            suggestions = json.loads(text)
        else:
            suggestions = result

        return {
            "success": True,
            "suggestions": suggestions,
            "ref_count": len(ref_metrics),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI 建议失败: {str(e)}")


def _ref(key: str) -> str:
    """将裸 _key 转为 sys_objects/ 引用格式"""
    if not key:
        return ""
    return key if key.startswith("sys_objects/") else f"sys_objects/{key}"
