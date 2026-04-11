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

    obj = svc.update_object(key, ObjectUpdate(properties={"business_context": ctx}))
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

    # 查找项目下的战略目标
    goals = svc.list_objects("Strategic_Goal", limit=100) or []
    project_goals = [g for g in goals if g.get("properties", {}).get("project_id") == req.project_id]

    if project_goals:
        target_lines = []
        for g in project_goals:
            p = g.get("properties", {})
            target_lines.append(
                f"- {p.get('goal_name', '')} (优先级: {p.get('priority', '')}, "
                f"目标值: {p.get('target_value', '')}, 状态: {p.get('status', '')})"
            )
        ctx["targets"] = "\n".join(target_lines)

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

    obj = svc.update_object(key, ObjectUpdate(properties={"business_context": ctx}))
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


def _ref(key: str) -> str:
    """将裸 _key 转为 sys_objects/ 引用格式"""
    if not key:
        return ""
    return key if key.startswith("sys_objects/") else f"sys_objects/{key}"
