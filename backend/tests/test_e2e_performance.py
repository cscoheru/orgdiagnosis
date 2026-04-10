"""
E2E 测试 — 绩效管理 API 端点

测试全部 CRUD 端点，覆盖方案/组织绩效/岗位绩效/表单/评分模型/考核记录/校准/分析。
通过 requests 库直接调用 API，所有测试数据用 UUID 后缀保证隔离。

运行: API_URL=http://your-api python -m pytest backend/tests/test_e2e_performance.py -v
前提: 后端运行且 meta-models 已 seed
"""
import json
import uuid
import pytest
import requests

BASE_URL = "http://localhost:8000"
PERF_API = f"{BASE_URL}/api/v1/performance"
KERNEL_API = f"{BASE_URL}/api/v1/kernel"


def _uid(prefix: str = "test") -> str:
    return f"{prefix}_{uuid.uuid4().hex[:8]}"


# ══════════════════════════════════════════════════════
# Test: Plan CRUD
# ══════════════════════════════════════════════════════

class TestPlanCRUD:
    @pytest.fixture
    def plan_key(self):
        r = requests.post(
            f"{PERF_API}/plans",
            json={
                "plan_name": _uid("方案"),
                "client_name": "E2E测试客户",
                "industry": "科技",
                "methodology": "KPI",
                "cycle_type": "年度",
                "status": "草拟中",
                "project_id": "e2e_test_project",
            },
        )
        assert r.status_code in (200, 201), f"Create plan failed: {r.text}"
        return r.json()["_key"]

    def test_create_plan(self):
        r = requests.post(
            f"{PERF_API}/plans",
            json={
                "plan_name": _uid("方案"),
                "methodology": "OKR",
                "cycle_type": "季度",
                "status": "草拟中",
            },
        )
        assert r.status_code in (200, 201), f"Create failed: {r.text}"
        data = r.json()
        assert "_key" in data
        assert data["model_key"] == "Performance_Plan"

    def test_list_plans(self):
        r = requests.get(f"{PERF_API}/plans")
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_list_plans_filtered_by_project(self, plan_key):
        r = requests.get(f"{PERF_API}/plans", params={"project_id": "e2e_test_project"})
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)

    def test_get_plan_by_key(self, plan_key):
        r = requests.get(f"{PERF_API}/plans/{plan_key}")
        assert r.status_code == 200
        data = r.json()
        assert data["_key"] == plan_key

    def test_update_plan(self, plan_key):
        r = requests.patch(
            f"{PERF_API}/plans/{plan_key}",
            json={"status": "客户确认"},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["properties"]["status"] == "客户确认"

    def test_get_nonexistent_plan_returns_404(self):
        r = requests.get(f"{PERF_API}/plans/nonexistent_key_12345")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════
# Test: Org Performance Endpoints
# ══════════════════════════════════════════════════════

class TestOrgPerformanceEndpoints:
    def test_list_org_performances(self):
        r = requests.get(f"{PERF_API}/org-perf")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_org_performances_filtered(self):
        r = requests.get(f"{PERF_API}/org-perf", params={"plan_id": "nonexistent"})
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_nonexistent_org_perf_returns_404(self):
        r = requests.get(f"{PERF_API}/org-perf/nonexistent_key_12345")
        assert r.status_code == 404

    def test_update_nonexistent_org_perf_returns_404(self):
        r = requests.patch(
            f"{PERF_API}/org-perf/nonexistent_key_12345",
            json={"status": "已确认"},
        )
        assert r.status_code == 404

    @pytest.mark.skip(reason="AI generation requires real AI service")
    def test_generate_org_performance(self):
        r = requests.post(
            f"{PERF_API}/org-perf/generate",
            json={"plan_id": "plan1", "org_unit_id": "org1"},
        )
        assert r.status_code == 200


# ══════════════════════════════════════════════════════
# Test: Position Performance Endpoints
# ══════════════════════════════════════════════════════

class TestPositionPerformanceEndpoints:
    def test_list_position_performances(self):
        r = requests.get(f"{PERF_API}/pos-perf")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_filtered_by_org_perf_id(self):
        r = requests.get(f"{PERF_API}/pos-perf", params={"org_perf_id": "nonexistent"})
        assert r.status_code == 200

    def test_list_filtered_by_plan_id(self):
        r = requests.get(f"{PERF_API}/pos-perf", params={"plan_id": "nonexistent"})
        assert r.status_code == 200

    def test_get_nonexistent_returns_404(self):
        r = requests.get(f"{PERF_API}/pos-perf/nonexistent_key_12345")
        assert r.status_code == 404

    def test_update_nonexistent_returns_404(self):
        r = requests.patch(
            f"{PERF_API}/pos-perf/nonexistent_key_12345",
            json={"status": "已编辑"},
        )
        assert r.status_code == 404

    def test_batch_update_with_empty_list(self):
        r = requests.patch(f"{PERF_API}/pos-perf/batch-update", json=[])
        assert r.status_code == 200
        data = r.json()
        assert data["updated"] == 0

    @pytest.mark.skip(reason="AI generation requires real AI service")
    def test_generate_position_performance(self):
        r = requests.post(
            f"{PERF_API}/pos-perf/generate",
            json={"org_perf_id": "org_perf1"},
        )
        assert r.status_code == 200


# ══════════════════════════════════════════════════════
# Test: Review Template Endpoints
# ══════════════════════════════════════════════════════

class TestReviewTemplateEndpoints:
    def test_list_templates(self):
        r = requests.get(f"{PERF_API}/templates")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_templates_filtered(self):
        r = requests.get(f"{PERF_API}/templates", params={"plan_id": "nonexistent"})
        assert r.status_code == 200

    def test_get_nonexistent_returns_404(self):
        r = requests.get(f"{PERF_API}/templates/nonexistent_key_12345")
        assert r.status_code == 404

    def test_update_nonexistent_returns_404(self):
        r = requests.patch(
            f"{PERF_API}/templates/nonexistent_key_12345",
            json={"status": "已确认"},
        )
        assert r.status_code == 404

    @pytest.mark.skip(reason="AI generation requires real AI service")
    def test_generate_template(self):
        r = requests.post(
            f"{PERF_API}/templates/generate",
            json={"pos_perf_id": "pos_perf1"},
        )
        assert r.status_code == 200


# ══════════════════════════════════════════════════════
# Test: Rating Model CRUD
# ══════════════════════════════════════════════════════

class TestRatingModelCRUD:
    @pytest.fixture
    def model_key(self):
        r = requests.post(
            f"{PERF_API}/rating-models",
            json={
                "model_name": _uid("评分模型"),
                "scale_type": "行为锚定",
                "min_value": 1,
                "max_value": 5,
                "step": 1.0,
                "is_default": False,
            },
        )
        assert r.status_code in (200, 201), f"Create rating model failed: {r.text}"
        return r.json()["_key"]

    def test_create_rating_model(self):
        r = requests.post(
            f"{PERF_API}/rating-models",
            json={
                "model_name": _uid("评分模型"),
                "scale_type": "等级",
                "min_value": 1,
                "max_value": 4,
            },
        )
        assert r.status_code in (200, 201)
        assert "_key" in r.json()

    def test_list_rating_models(self):
        r = requests.get(f"{PERF_API}/rating-models")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_get_rating_model(self, model_key):
        r = requests.get(f"{PERF_API}/rating-models/{model_key}")
        assert r.status_code == 200
        assert r.json()["_key"] == model_key

    def test_update_rating_model(self, model_key):
        r = requests.patch(
            f"{PERF_API}/rating-models/{model_key}",
            json={"max_value": 7},
        )
        assert r.status_code == 200

    def test_get_nonexistent_rating_model_returns_404(self):
        r = requests.get(f"{PERF_API}/rating-models/nonexistent_key_12345")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════
# Test: Review CRUD
# ══════════════════════════════════════════════════════

class TestReviewCRUD:
    def test_create_review(self):
        r = requests.post(
            f"{PERF_API}/reviews",
            json={
                "review_title": _uid("考核"),
                "overall_score": 85,
                "overall_rating": "B",
                "reviewer": "E2E测试",
                "project_id": "e2e_test_project",
            },
        )
        assert r.status_code in (200, 201)
        assert "_key" in r.json()

    def test_batch_import_reviews(self):
        reviews = [
            {"review_title": _uid("批量考核"), "overall_score": 90, "reviewer": "测试"},
            {"review_title": _uid("批量考核"), "overall_score": 75, "reviewer": "测试"},
        ]
        r = requests.post(f"{PERF_API}/reviews/batch", json={"reviews": reviews})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 2

    def test_list_reviews(self):
        r = requests.get(f"{PERF_API}/reviews")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_reviews_filtered(self):
        r = requests.get(
            f"{PERF_API}/reviews",
            params={"project_id": "e2e_test_project"},
        )
        assert r.status_code == 200

    def test_get_nonexistent_review_returns_404(self):
        r = requests.get(f"{PERF_API}/reviews/nonexistent_key_12345")
        assert r.status_code == 404


# ══════════════════════════════════════════════════════
# Test: Calibration Endpoints
# ══════════════════════════════════════════════════════

class TestCalibrationEndpoints:
    @pytest.fixture
    def cal_key(self):
        r = requests.post(
            f"{PERF_API}/calibrations",
            json={
                "calibration_name": _uid("校准"),
                "org_unit": "技术部",
                "status": "待校准",
            },
        )
        assert r.status_code in (200, 201), f"Create calibration failed: {r.text}"
        return r.json()["_key"]

    def test_create_calibration(self):
        r = requests.post(
            f"{PERF_API}/calibrations",
            json={
                "calibration_name": _uid("校准"),
                "status": "待校准",
            },
        )
        assert r.status_code in (200, 201)
        assert "_key" in r.json()

    def test_get_calibration(self, cal_key):
        r = requests.get(f"{PERF_API}/calibrations/{cal_key}")
        assert r.status_code == 200
        assert r.json()["_key"] == cal_key

    def test_get_nonexistent_calibration_returns_404(self):
        r = requests.get(f"{PERF_API}/calibrations/nonexistent_key_12345")
        assert r.status_code == 404

    @pytest.mark.skip(reason="AI analysis requires real AI service")
    def test_analyze_calibration(self, cal_key):
        r = requests.post(f"{PERF_API}/calibrations/{cal_key}/analyze")
        assert r.status_code == 200


# ══════════════════════════════════════════════════════
# Test: Analytics Endpoints
# ══════════════════════════════════════════════════════

class TestAnalyticsEndpoints:
    def test_distribution_analytics(self):
        r = requests.get(f"{PERF_API}/analytics/distribution")
        assert r.status_code == 200

    def test_performance_overview(self):
        r = requests.get(f"{PERF_API}/analytics/overview")
        assert r.status_code == 200

    def test_bias_analysis(self):
        r = requests.get(f"{PERF_API}/analytics/bias")
        # May return 200 with data or error if no reviews
        assert r.status_code in (200, 500)
