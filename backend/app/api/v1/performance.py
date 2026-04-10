"""
绩效管理 API — 绩效咨询设计工具 REST API

提供绩效方案、组织绩效、岗位绩效的生成/查询/编辑，
以及考核表单、评分模型、考核记录、校准、分析、报告的完整接口。

基础 CRUD 通过 /v1/kernel/objects 端点操作，
本模块提供业务逻辑端点（AI 生成、统计分析等）。
"""
from fastapi import APIRouter, HTTPException, Query, Depends
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
    """按指定字段过滤对象列表"""
    if not value:
        return objects
    return [
        o for o in objects
        if o.get("properties", {}).get(field) == value
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


@router.patch("/pos-perf/batch-update", summary="批量编辑岗位绩效")
def batch_update_position_performance(
    updates: list[dict[str, Any]],
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
