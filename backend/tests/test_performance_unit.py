"""
后端单元测试 — 绩效领域节点函数

覆盖:
- _ref / _unref 引用格式转换
- _call_ai JSON 解析
- _safe_json_dumps 序列化
- _build_context 上下文格式化
- _query_performance_data kernel 查询
- 7 个节点函数的完整流程

Mock 策略: unittest.mock.patch 替换模块级 _bridge 和 ai_client.chat
运行: pytest backend/tests/test_performance_unit.py -v
"""
import json
import statistics
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ── 导入被测模块 ──────────────────────────────────────

from lib.domain.performance.nodes import (
    _ref,
    _unref,
    _call_ai,
    _safe_json_dumps,
    _build_context,
    _query_performance_data,
    analyze_performance_node,
    generate_org_performance_node,
    generate_position_performance_node,
    generate_review_template_node,
    analyze_review_patterns_node,
    calibration_analysis_node,
    generate_performance_report_node,
)


# ── 固定 Mock 数据 ─────────────────────────────────────

SAMPLE_METRICS = [
    {
        "_id": "sys_objects/m1",
        "properties": {
            "metric_name": "营收增长率",
            "formula": "收入/上期收入",
            "review_cycle": "年度",
            "weight": 30,
            "target_value": 15,
            "unit": "%",
        },
    },
]

SAMPLE_COMPETENCIES = [
    {
        "_id": "sys_objects/c1",
        "properties": {
            "competency_name": "领导力",
            "dimension": "管理",
            "definition": "带领团队达成目标",
            "behavioral_indicators": ["决策果断", "善于激励"],
        },
    },
]

SAMPLE_CYCLES = [
    {
        "_id": "sys_objects/rc1",
        "properties": {
            "cycle_name": "2025年度考核",
            "cycle_type": "年度",
            "start_date": "2025-01-01",
            "end_date": "2025-12-31",
            "status": "进行中",
            "completion_rate": 60,
        },
    },
]

SAMPLE_PLAN = {
    "_id": "sys_objects/plan1",
    "_key": "plan1",
    "properties": {
        "plan_name": "测试方案",
        "client_name": "测试客户",
        "industry": "制造业",
        "methodology": "KPI",
        "cycle_type": "年度",
        "project_id": "proj1",
    },
}

SAMPLE_ORG_UNIT = {
    "_id": "sys_objects/org1",
    "_key": "org1",
    "properties": {
        "unit_name": "技术部",
        "unit_type": "职能部门",
        "level": "二级",
        "budget": 5000000,
        "headcount": 50,
        "manager": "张三",
    },
}

SAMPLE_STRATEGIC_GOALS = [
    {
        "_id": "sys_objects/g1",
        "properties": {
            "goal_name": "提升市场份额",
            "priority": "P0",
            "target_value": "30%",
            "status": "进行中",
        },
    },
]

SAMPLE_JOB_ROLES = [
    {
        "_id": "sys_objects/jr1",
        "properties": {
            "role_name": "技术总监",
            "job_family": "管理M",
            "level_range": "L5-L7",
            "is_key_position": True,
            "org_unit_id": "org1",
            "competency_requirements": ["领导力"],
        },
    },
    {
        "_id": "sys_objects/jr2",
        "properties": {
            "role_name": "高级工程师",
            "job_family": "专业P",
            "level_range": "L3-L5",
            "is_key_position": False,
            "org_unit_id": "org1",
            "competency_requirements": ["技术能力"],
        },
    },
]

MOCK_AI_ORG_PERF = json.dumps({
    "strategic_kpis": [{"name": "市场份额", "weight": 30}],
    "management_indicators": [{"name": "预算控制", "weight": 25}],
    "team_development": [{"name": "培训完成率", "weight": 15}],
    "engagement_compliance": [{"name": "出勤率", "weight": 10}],
    "dimension_weights": {"strategic": 50, "management": 25, "team_development": 15, "engagement": 10},
    "strategic_alignment": [{"goal": "提升市场份额", "kpi": "市场份额", "contribution": "高"}],
})

MOCK_AI_POS_PERF = json.dumps({
    "performance_goals": [{"name": "项目交付", "weight": 55, "target": "100%"}],
    "competency_items": [{"name": "技术能力", "weight": 25, "required_level": "L4"}],
    "values_items": [{"name": "团队协作", "weight": 10}],
    "development_goals": [{"name": "管理培训", "timeline": "Q2"}],
    "section_weights": {"performance": 55, "competency": 25, "values": 10, "development": 10},
    "leader_config": {"personal_weight": 70, "team_weight": 30},
    "team_performance": [{"name": "团队产出", "weight": 30}],
})

MOCK_AI_POS_PERF_NON_LEADER = json.dumps({
    "performance_goals": [{"name": "代码质量", "weight": 60, "target": "A级"}],
    "competency_items": [{"name": "编码能力", "weight": 25, "required_level": "L3"}],
    "values_items": [{"name": "创新", "weight": 10}],
    "development_goals": [{"name": "新技术学习", "timeline": "Q3"}],
    "section_weights": {"performance": 60, "competency": 25, "values": 10, "development": 5},
})

MOCK_AI_TEMPLATE = json.dumps({
    "sections": [{"section_name": "业绩目标", "weight": 55, "items": []}],
    "total_weight": 100,
    "reviewer_config": {"self_review": True, "manager_review": True},
    "rating_recommendation": {
        "scale_type": "行为锚定",
        "min_value": 1,
        "max_value": 5,
        "scale_definitions": [],
        "distribution_guide": {},
    },
})

MOCK_AI_REVIEW_PATTERNS = json.dumps({
    "bias_detected": [{"type": "宽大效应", "severity": "medium"}],
    "recommendations": ["加强评分校准"],
})

MOCK_AI_CALIBRATION = json.dumps({
    "distribution_assessment": {"before": "偏态", "after": "正态"},
    "adjustment_recommendations": ["降低A等比例"],
    "nine_box_analysis": {"high_potential_low_perf": ["员工A"]},
    "calibration_guidance": "建议进一步校准",
})

MOCK_AI_REPORT = json.dumps({
    "executive_summary": "绩效管理体系总体良好",
    "issues": ["评分标准不统一"],
    "recommendations": ["引入强制分布"],
})


# ══════════════════════════════════════════════════════
# Test: _ref / _unref helpers
# ══════════════════════════════════════════════════════

class TestRefHelpers:
    def test_ref_bare_key_adds_prefix(self):
        assert _ref("plan1") == "sys_objects/plan1"

    def test_ref_already_prefixed_unchanged(self):
        assert _ref("sys_objects/plan1") == "sys_objects/plan1"

    def test_ref_empty_string(self):
        assert _ref("") == ""

    def test_unref_removes_prefix(self):
        assert _unref("sys_objects/plan1") == "plan1"

    def test_unref_bare_key_unchanged(self):
        assert _unref("plan1") == "plan1"

    def test_unref_none(self):
        assert _unref(None) == ""


# ══════════════════════════════════════════════════════
# Test: _call_ai
# ══════════════════════════════════════════════════════

class TestCallAI:
    @pytest.mark.asyncio
    async def test_parses_json_string(self):
        with patch("app.services.ai_client.ai_client", new_callable=AsyncMock) as mock_ai:
            mock_ai.chat.return_value = '{"key": "value"}'
            result = await _call_ai("sys", "user")
            assert result == {"key": "value"}

    @pytest.mark.asyncio
    async def test_extracts_json_from_markdown(self):
        with patch("app.services.ai_client.ai_client", new_callable=AsyncMock) as mock_ai:
            mock_ai.chat.return_value = 'Here is the result:\n```json\n{"key": "value"}\n```\nDone.'
            result = await _call_ai("sys", "user")
            assert result == {"key": "value"}

    @pytest.mark.asyncio
    async def test_handles_non_json_string(self):
        with patch("app.services.ai_client.ai_client", new_callable=AsyncMock) as mock_ai:
            mock_ai.chat.return_value = "No JSON here at all"
            result = await _call_ai("sys", "user")
            assert result.get("parse_error") is True

    @pytest.mark.asyncio
    async def test_handles_dict_response(self):
        with patch("app.services.ai_client.ai_client", new_callable=AsyncMock) as mock_ai:
            mock_ai.chat.return_value = {"already": "dict"}
            result = await _call_ai("sys", "user")
            assert result == {"already": "dict"}


# ══════════════════════════════════════════════════════
# Test: _safe_json_dumps
# ══════════════════════════════════════════════════════

class TestSafeJsonDumps:
    def test_dumps_dict(self):
        assert _safe_json_dumps({"a": 1}) == '{"a": 1}'

    def test_dumps_list(self):
        assert _safe_json_dumps([1, 2]) == '[1, 2]'

    def test_dumps_string_passthrough(self):
        assert _safe_json_dumps("hello") == "hello"

    def test_dumps_none(self):
        assert _safe_json_dumps(None) == ""


# ══════════════════════════════════════════════════════
# Test: _build_context
# ══════════════════════════════════════════════════════

class TestBuildContext:
    def test_formats_metrics(self):
        data = {"metrics": SAMPLE_METRICS, "competencies": [], "cycles": []}
        m, c, r = _build_context(data)
        assert "营收增长率" in m
        assert "15 %" in m

    def test_formats_competencies_with_indicators(self):
        data = {"metrics": [], "competencies": SAMPLE_COMPETENCIES, "cycles": []}
        m, c, r = _build_context(data)
        assert "领导力" in c
        assert "决策果断" in c

    def test_returns_placeholder_for_empty_data(self):
        data = {"metrics": [], "competencies": [], "cycles": []}
        m, c, r = _build_context(data)
        assert "暂无绩效指标数据" in m
        assert "暂无能力素质数据" in c
        assert "暂无考核周期数据" in r


# ══════════════════════════════════════════════════════
# Test: _query_performance_data
# ══════════════════════════════════════════════════════

class TestQueryPerformanceData:
    @pytest.mark.asyncio
    async def test_queries_three_models(self):
        with patch("lib.domain.performance.nodes._bridge", new_callable=AsyncMock) as mock_bridge:
            mock_bridge.get_objects_by_model = AsyncMock(side_effect=[
                SAMPLE_METRICS,
                SAMPLE_COMPETENCIES,
                SAMPLE_CYCLES,
            ])
            data = await _query_performance_data()
            assert len(data["metrics"]) == 1
            assert len(data["competencies"]) == 1
            assert len(data["cycles"]) == 1
            assert mock_bridge.get_objects_by_model.call_count == 3


# ══════════════════════════════════════════════════════
# Helper: create mock bridge
# ══════════════════════════════════════════════════════

def _mock_bridge(**overrides):
    bridge = AsyncMock()
    bridge.create_object.return_value = {"_id": "sys_objects/new1", "_key": "new1"}
    bridge.get_object.return_value = None
    bridge.get_objects_by_model.return_value = []
    bridge.create_relation.return_value = {"_id": "sys_relations/r1"}
    for k, v in overrides.items():
        setattr(bridge, k, v)
    return bridge


def _mock_ai_response(json_str: str):
    """返回 AsyncMock，.chat() 返回指定 JSON 字符串"""
    mock = AsyncMock()
    mock.chat.return_value = json_str
    return mock


# ══════════════════════════════════════════════════════
# Test: analyze_performance_node
# ══════════════════════════════════════════════════════

class TestAnalyzePerformanceNode:
    @pytest.mark.asyncio
    async def test_queries_three_models_and_calls_ai(self):
        bridge = _mock_bridge(
            get_objects_by_model=AsyncMock(side_effect=[
                SAMPLE_METRICS, SAMPLE_COMPETENCIES, SAMPLE_CYCLES,
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/analysis1", "properties": {},
            }),
        )
        ai = _mock_ai_response('{"diagnosis": "体系良好", "maturity_level": 3, "key_issues": [], "recommendations": []}')

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1"}
            result = await analyze_performance_node(state)
            assert result["results"]["performance"]["status"] == "completed"
            assert result["results"]["performance"]["maturity_level"] == 3

    @pytest.mark.asyncio
    async def test_creates_relations_to_source_objects(self):
        bridge = _mock_bridge(
            get_objects_by_model=AsyncMock(side_effect=[
                SAMPLE_METRICS, SAMPLE_COMPETENCIES, SAMPLE_CYCLES,
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/analysis1", "properties": {},
            }),
        )
        ai = _mock_ai_response('{"diagnosis": "ok", "maturity_level": 1, "key_issues": [], "recommendations": []}')

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1"}
            await analyze_performance_node(state)
            assert bridge.create_relation.call_count >= 3  # 1 metric + 1 competency + 1 cycle

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_objects_by_model = AsyncMock(side_effect=RuntimeError("DB down"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1"}
            result = await analyze_performance_node(state)
            assert result["results"]["performance"]["status"] == "failed"
            assert "DB down" in result["results"]["performance"]["error"]


# ══════════════════════════════════════════════════════
# Test: generate_org_performance_node
# ══════════════════════════════════════════════════════

class TestGenerateOrgPerformanceNode:
    @pytest.mark.asyncio
    async def test_creates_org_perf_with_ref_prefixed(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_PLAN, SAMPLE_ORG_UNIT]),
            get_objects_by_model=AsyncMock(return_value=SAMPLE_STRATEGIC_GOALS),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/org_perf1", "_key": "org_perf1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "org1"}
            result = await generate_org_performance_node(state)

            assert result["results"]["org_performance"]["status"] == "completed"
            # Verify _ref was applied
            create_call = bridge.create_object.call_args
            props = create_call[0][1]
            assert props["org_unit_ref"] == "sys_objects/org1"
            assert props["plan_ref"] == "sys_objects/plan1"

    @pytest.mark.asyncio
    async def test_tracks_created_object(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_PLAN, SAMPLE_ORG_UNIT]),
            get_objects_by_model=AsyncMock(return_value=SAMPLE_STRATEGIC_GOALS),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/org_perf1", "_key": "org_perf1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "org1"}
            result = await generate_org_performance_node(state)

            assert "sys_objects/org_perf1" in result["kernel_context"]["objects_created"]

    @pytest.mark.asyncio
    async def test_creates_goal_aligned_relations(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_PLAN, SAMPLE_ORG_UNIT]),
            get_objects_by_model=AsyncMock(return_value=SAMPLE_STRATEGIC_GOALS),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/org_perf1", "_key": "org_perf1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "org1"}
            await generate_org_performance_node(state)
            bridge.create_relation.assert_called()
            call_kwargs = bridge.create_relation.call_args[1]
            assert call_kwargs["relation_type"] == "Goal_Aligned"

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "org1"}
            result = await generate_org_performance_node(state)
            assert result["results"]["org_performance"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Test: generate_position_performance_node
# ══════════════════════════════════════════════════════

class TestGeneratePositionPerformanceNode:
    @pytest.mark.asyncio
    async def test_unrefs_org_unit_ref_on_read(self):
        org_perf = {
            "_id": "sys_objects/op1",
            "_key": "op1",
            "properties": {
                "org_unit_ref": "sys_objects/org1",
                "plan_ref": "sys_objects/plan1",
                "project_id": "proj1",
                "strategic_kpis": "[]",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                org_perf,  # org_perf query
                SAMPLE_PLAN,  # plan query
            ]),
            get_objects_by_model=AsyncMock(side_effect=[
                SAMPLE_JOB_ROLES,  # Job_Role query
                [],  # Competency query
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/pp1", "_key": "pp1",
            }),
        )
        # Alternate AI responses for leader and non-leader
        ai = AsyncMock()
        ai.chat = AsyncMock(side_effect=[MOCK_AI_POS_PERF, MOCK_AI_POS_PERF_NON_LEADER])

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await generate_position_performance_node(state)

            assert result["results"]["position_performance"]["status"] == "completed"
            assert result["results"]["position_performance"]["count"] == 2

    @pytest.mark.asyncio
    async def test_returns_failed_when_no_dept_roles(self):
        org_perf = {
            "_id": "sys_objects/op1",
            "properties": {
                "org_unit_ref": "sys_objects/org1",
                "plan_ref": "",
                "project_id": "",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=org_perf),
            get_objects_by_model=AsyncMock(return_value=[]),
        )

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await generate_position_performance_node(state)
            assert result["results"]["position_performance"]["status"] == "failed"
            assert "无岗位数据" in result["results"]["position_performance"]["error"]

    @pytest.mark.asyncio
    async def test_sets_is_leader_for_management_roles(self):
        org_perf = {
            "_id": "sys_objects/op1",
            "properties": {
                "org_unit_ref": "sys_objects/org1",
                "plan_ref": "",
                "project_id": "proj1",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=org_perf),
            get_objects_by_model=AsyncMock(side_effect=[
                [SAMPLE_JOB_ROLES[0]],  # only the leader role
                [],
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/pp1", "_key": "pp1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_POS_PERF)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await generate_position_performance_node(state)

            # Verify create_object was called with is_leader=True
            create_call = bridge.create_object.call_args
            props = create_call[0][1]
            assert props["is_leader"] is True

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await generate_position_performance_node(state)
            assert result["results"]["position_performance"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Test: generate_review_template_node
# ══════════════════════════════════════════════════════

class TestGenerateReviewTemplateNode:
    @pytest.mark.asyncio
    async def test_creates_template_with_ref_prefixed(self):
        pos_perf = {
            "_id": "sys_objects/pp1",
            "properties": {
                "job_role_ref": "sys_objects/jr1",
                "plan_ref": "sys_objects/plan1",
                "is_leader": False,
                "performance_goals": "[]",
                "section_weights": "{}",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                pos_perf,
                SAMPLE_JOB_ROLES[0],  # job_role
                SAMPLE_PLAN,  # plan
            ]),
            get_objects_by_model=AsyncMock(return_value=[]),
            create_object=AsyncMock(side_effect=[
                {"_id": "sys_objects/rm1", "_key": "rm1"},  # rating model
                {"_id": "sys_objects/tpl1", "_key": "tpl1"},  # template
            ]),
        )
        ai = _mock_ai_response(MOCK_AI_TEMPLATE)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "pos_perf_id": "pp1"}
            result = await generate_review_template_node(state)

            assert result["results"]["review_template"]["status"] == "completed"
            assert result["results"]["review_template"]["template_type"] == "KPI考核"
            # Verify _ref on template
            template_call = bridge.create_object.call_args_list[1]
            props = template_call[0][1]
            assert props["plan_ref"] == "sys_objects/plan1"
            assert props["position_ref"] == "sys_objects/pp1"

    @pytest.mark.asyncio
    async def test_creates_rating_model_when_none_exist(self):
        pos_perf = {
            "_id": "sys_objects/pp1",
            "properties": {
                "job_role_ref": "sys_objects/jr1",
                "plan_ref": "",
                "is_leader": True,
                "performance_goals": "[]",
                "section_weights": "{}",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                pos_perf,
                SAMPLE_JOB_ROLES[0],
                None,  # no plan
            ]),
            get_objects_by_model=AsyncMock(return_value=[]),  # no rating models
            create_object=AsyncMock(side_effect=[
                {"_id": "sys_objects/rm1", "_key": "rm1"},
                {"_id": "sys_objects/tpl1", "_key": "tpl1"},
            ]),
        )
        ai = _mock_ai_response(MOCK_AI_TEMPLATE)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "pos_perf_id": "pp1"}
            result = await generate_review_template_node(state)

            assert result["results"]["review_template"]["rating_model_id"] == "sys_objects/rm1"
            assert result["results"]["review_template"]["template_type"] == "综合考核"  # leader

    @pytest.mark.asyncio
    async def test_reuses_existing_rating_model(self):
        pos_perf = {
            "_id": "sys_objects/pp1",
            "properties": {
                "job_role_ref": "sys_objects/jr1",
                "plan_ref": "",
                "is_leader": False,
                "performance_goals": "[]",
                "section_weights": "{}",
            },
        }
        existing_rating = {
            "_id": "sys_objects/existing_rm",
            "properties": {"model_name": "现有模型"},
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                pos_perf,
                SAMPLE_JOB_ROLES[0],
                None,
            ]),
            get_objects_by_model=AsyncMock(return_value=[existing_rating]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/tpl1", "_key": "tpl1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_TEMPLATE)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "pos_perf_id": "pp1"}
            result = await generate_review_template_node(state)

            assert result["results"]["review_template"]["rating_model_id"] == "sys_objects/existing_rm"
            # Should only create template, not rating model
            assert bridge.create_object.call_count == 1

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "pos_perf_id": "pp1"}
            result = await generate_review_template_node(state)
            assert result["results"]["review_template"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Test: analyze_review_patterns_node
# ══════════════════════════════════════════════════════

class TestAnalyzeReviewPatternsNode:
    @pytest.mark.asyncio
    async def test_returns_failed_when_no_reviews(self):
        bridge = _mock_bridge(get_objects_by_model=AsyncMock(return_value=[]))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "project_id": "proj1"}
            result = await analyze_review_patterns_node(state)
            assert result["results"]["review_patterns"]["status"] == "failed"
            assert "无考核数据" in result["results"]["review_patterns"]["error"]

    @pytest.mark.asyncio
    async def test_computes_statistics_and_calls_ai(self):
        reviews = [
            {"_id": "sys_objects/r1", "properties": {"overall_score": 80, "reviewer": "张三"}},
            {"_id": "sys_objects/r2", "properties": {"overall_score": 90, "reviewer": "张三"}},
            {"_id": "sys_objects/r3", "properties": {"overall_score": 70, "reviewer": "李四"}},
        ]
        bridge = _mock_bridge(get_objects_by_model=AsyncMock(return_value=reviews))
        ai = _mock_ai_response(MOCK_AI_REVIEW_PATTERNS)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "project_id": "proj1"}
            result = await analyze_review_patterns_node(state)

            assert result["results"]["review_patterns"]["status"] == "completed"
            stats = result["results"]["review_patterns"]["statistics"]
            assert stats["count"] == 3
            assert stats["mean"] == 80.0

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_objects_by_model = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1"}
            result = await analyze_review_patterns_node(state)
            assert result["results"]["review_patterns"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Test: calibration_analysis_node
# ══════════════════════════════════════════════════════

class TestCalibrationAnalysisNode:
    @pytest.mark.asyncio
    async def test_queries_calibration_and_calls_ai(self):
        cal_session = {
            "_id": "sys_objects/cal1",
            "properties": {
                "distribution_before": '{"A": 10}',
                "distribution_after": '{"A": 5}',
                "nine_box_data": "[]",
                "org_unit": "技术部",
            },
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=cal_session),
            get_objects_by_model=AsyncMock(return_value=[]),
        )
        ai = _mock_ai_response(MOCK_AI_CALIBRATION)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "calibration_id": "cal1"}
            result = await calibration_analysis_node(state)

            assert result["results"]["calibration"]["status"] == "completed"
            assert "nine_box_analysis" in result["results"]["calibration"]

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "calibration_id": "cal1"}
            result = await calibration_analysis_node(state)
            assert result["results"]["calibration"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Test: generate_performance_report_node
# ══════════════════════════════════════════════════════

class TestGeneratePerformanceReportNode:
    @pytest.mark.asyncio
    async def test_aggregates_all_models_and_generates_report(self):
        bridge = _mock_bridge(
            get_objects_by_model=AsyncMock(side_effect=[
                [SAMPLE_PLAN],  # Performance_Plan
                [],  # Org_Performance
                [],  # Position_Performance
                [],  # Review_Template
                [],  # Performance_Review
                [],  # Calibration_Session
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/del1", "_key": "del1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_REPORT)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "project_id": "proj1", "results": {}}
            result = await generate_performance_report_node(state)

            assert result["results"]["performance_report"]["status"] == "completed"
            assert result["results"]["performance_report"]["deliverable_id"] == "sys_objects/del1"
            assert "sys_objects/del1" in result["kernel_context"]["objects_created"]

    @pytest.mark.asyncio
    async def test_includes_diagnosis_data_from_state(self):
        bridge = _mock_bridge(
            get_objects_by_model=AsyncMock(side_effect=[
                [], [], [], [], [], [],
            ]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/del1", "_key": "del1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_REPORT)

        with (
            patch("lib.domain.performance.nodes._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {
                "task_id": "t1",
                "project_id": "proj1",
                "results": {
                    "performance": {"diagnosis": "绩效体系需改进"},
                },
            }
            result = await generate_performance_report_node(state)
            assert result["results"]["performance_report"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_returns_failed_on_exception(self):
        bridge = _mock_bridge()
        bridge.get_objects_by_model = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.nodes._bridge", bridge):
            state = {"task_id": "t1", "project_id": "proj1"}
            result = await generate_performance_report_node(state)
            assert result["results"]["performance_report"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Phase 2: Test _build_enriched_context
# ══════════════════════════════════════════════════════

from lib.domain.performance.nodes import _build_enriched_context


class TestBuildEnrichedContext:
    def test_empty_business_context_returns_client_name(self):
        result = _build_enriched_context({"client_name": "测试客户"})
        assert result == "客户: 测试客户"

    def test_missing_client_name_returns_empty(self):
        result = _build_enriched_context({})
        assert result == "客户: "

    def test_json_string_context_parsed(self):
        ctx = json.dumps({"client_profile": "一家制造业企业"})
        result = _build_enriched_context({"business_context": ctx, "client_name": "X"})
        assert "## 客户概况" in result
        assert "一家制造业企业" in result

    def test_dict_context_with_single_section(self):
        result = _build_enriched_context({
            "business_context": {"client_profile": "大型企业"},
            "client_name": "Y",
        })
        assert "## 客户概况" in result
        assert "大型企业" in result

    def test_dict_context_with_multiple_sections(self):
        result = _build_enriched_context({
            "business_context": {
                "client_profile": "概况",
                "business_review": "复盘",
                "market_insights": "市场",
            },
        })
        assert "## 客户概况" in result
        assert "## 业务复盘" in result
        assert "## 市场洞察" in result
        # Sections appear in SECTION_LABELS order
        pos_review = result.index("## 业务复盘")
        pos_market = result.index("## 市场洞察")
        assert pos_review < pos_market

    def test_dict_context_all_keys_empty_returns_client_name(self):
        result = _build_enriched_context({
            "business_context": {"client_profile": "", "business_review": None},
            "client_name": "Z",
        })
        assert result == "客户: Z"

    def test_invalid_json_string_falls_back(self):
        result = _build_enriched_context({
            "business_context": "not json at all",
            "client_name": "W",
        })
        assert result == "客户: W"

    def test_swot_and_bsc_sections_rendered(self):
        result = _build_enriched_context({
            "business_context": {
                "swot_data": "优势: ...",
                "bsc_cards": "财务: ...",
                "action_plans": "行动1",
                "targets": "目标1",
            },
        })
        assert "## SWOT 分析" in result
        assert "## BSC 战略地图" in result
        assert "## 行动计划" in result
        assert "## 战略目标" in result


# ══════════════════════════════════════════════════════
# Phase 3: Test goal_decomposer
# ══════════════════════════════════════════════════════

from lib.domain.performance.goal_decomposer import decompose_initiative_node

MOCK_AI_DECOMPOSE = json.dumps({
    "milestones": [
        {"phase": "阶段1", "date": "2026-03", "deliverable": "需求分析"},
        {"phase": "阶段2", "date": "2026-06", "deliverable": "系统上线"},
    ],
    "linked_kpis": [
        {"kpi_goal_name": "系统上线率", "target_value": 95, "unit": "%"},
    ],
})

SAMPLE_INITIATIVE = {
    "_id": "sys_objects/ini1",
    "_key": "ini1",
    "properties": {
        "initiative_name": "数字化转型",
        "description": "全面推进数字化",
        "status": "进行中",
        "start_date": "2026-01",
        "end_date": "2026-12",
    },
}


class TestDecomposeInitiativeNode:
    @pytest.mark.asyncio
    async def test_returns_failed_when_initiative_not_found(self):
        bridge = _mock_bridge(get_object=AsyncMock(return_value=None))

        with (
            patch("lib.domain.performance.goal_decomposer._bridge", bridge),
        ):
            state = {"task_id": "t1", "initiative_id": "nonexistent"}
            result = await decompose_initiative_node(state)
            assert result["results"]["initiative_decomposition"]["status"] == "failed"
            assert "不存在" in result["results"]["initiative_decomposition"]["error"]

    @pytest.mark.asyncio
    async def test_full_decompose_creates_kpis_and_relations(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_INITIATIVE, SAMPLE_PLAN]),
            get_objects_by_model=AsyncMock(return_value=[]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/kpi1", "_key": "kpi1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_DECOMPOSE)

        with (
            patch("lib.domain.performance.goal_decomposer._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.goal_decomposer.ObjectService") as MockObjSvc,
            patch("lib.domain.performance.goal_decomposer.get_db"),
        ):
            mock_svc = MagicMock()
            MockObjSvc.return_value = mock_svc
            mock_svc.update_object = MagicMock()

            state = {"task_id": "t1", "initiative_id": "ini1", "plan_id": "plan1"}
            result = await decompose_initiative_node(state)

            assert result["results"]["initiative_decomposition"]["status"] == "completed"
            assert result["results"]["initiative_decomposition"]["milestones_count"] == 2
            assert result["results"]["initiative_decomposition"]["linked_kpis_count"] == 1
            # KPI object created
            bridge.create_object.assert_called()
            create_args = bridge.create_object.call_args
            assert create_args[0][0] == "Strategic_Goal"
            assert create_args[0][1]["goal_type"] == "operational_kpi"
            # LINKED_KPI relation created
            bridge.create_relation.assert_called()
            rel_kwargs = bridge.create_relation.call_args[1]
            assert rel_kwargs["relation_type"] == "Linked_KPI"
            # Initiative updated with milestones
            mock_svc.update_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_empty_milestones_and_kpis_still_succeeds(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_INITIATIVE, SAMPLE_PLAN]),
            get_objects_by_model=AsyncMock(return_value=[]),
        )
        ai = _mock_ai_response('{"milestones": [], "linked_kpis": []}')

        with (
            patch("lib.domain.performance.goal_decomposer._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.goal_decomposer.ObjectService") as MockObjSvc,
            patch("lib.domain.performance.goal_decomposer.get_db"),
        ):
            mock_svc = MagicMock()
            MockObjSvc.return_value = mock_svc
            mock_svc.update_object = MagicMock()

            state = {"task_id": "t1", "initiative_id": "ini1", "plan_id": "plan1"}
            result = await decompose_initiative_node(state)

            assert result["results"]["initiative_decomposition"]["status"] == "completed"
            assert result["results"]["initiative_decomposition"]["milestones_count"] == 0
            assert result["results"]["initiative_decomposition"]["linked_kpis_count"] == 0

    @pytest.mark.asyncio
    async def test_no_plan_id_skips_enriched_context(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=SAMPLE_INITIATIVE),
            get_objects_by_model=AsyncMock(return_value=[]),
        )
        ai = _mock_ai_response('{"milestones": [], "linked_kpis": []}')

        with (
            patch("lib.domain.performance.goal_decomposer._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.goal_decomposer.ObjectService") as MockObjSvc,
            patch("lib.domain.performance.goal_decomposer.get_db"),
        ):
            mock_svc = MagicMock()
            MockObjSvc.return_value = mock_svc
            mock_svc.update_object = MagicMock()

            state = {"task_id": "t1", "initiative_id": "ini1", "plan_id": ""}
            result = await decompose_initiative_node(state)

            assert result["results"]["initiative_decomposition"]["status"] == "completed"
            # get_object only called once (for initiative, not plan)
            assert bridge.get_object.call_count == 1

    @pytest.mark.asyncio
    async def test_exception_returns_failed(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("DB error"))

        with patch("lib.domain.performance.goal_decomposer._bridge", bridge):
            state = {"task_id": "t1", "initiative_id": "ini1"}
            result = await decompose_initiative_node(state)
            assert result["results"]["initiative_decomposition"]["status"] == "failed"
            assert "DB error" in result["results"]["initiative_decomposition"]["error"]


# ══════════════════════════════════════════════════════
# Phase 4: Test period_decomposer
# ══════════════════════════════════════════════════════

from lib.domain.performance.period_decomposer import decompose_period_node

MOCK_AI_PERIOD_DECOMPOSE = json.dumps({
    "periods": [
        {"period_target": "2026-Q1", "strategic_kpis": [{"name": "Q1指标"}], "management_indicators": [], "team_development": [], "engagement_compliance": [], "dimension_weights": {"strategic": 50}},
        {"period_target": "2026-Q2", "strategic_kpis": [{"name": "Q2指标"}], "management_indicators": [], "team_development": [], "engagement_compliance": [], "dimension_weights": {"strategic": 50}},
        {"period_target": "2026-Q3", "strategic_kpis": [{"name": "Q3指标"}], "management_indicators": [], "team_development": [], "engagement_compliance": [], "dimension_weights": {"strategic": 50}},
        {"period_target": "2026-Q4", "strategic_kpis": [{"name": "Q4指标"}], "management_indicators": [], "team_development": [], "engagement_compliance": [], "dimension_weights": {"strategic": 50}},
    ],
})

SAMPLE_ANNUAL_ORG_PERF = {
    "_id": "sys_objects/op1",
    "_key": "op1",
    "properties": {
        "org_unit_ref": "sys_objects/org1",
        "org_unit_name": "技术部",
        "plan_ref": "sys_objects/plan1",
        "project_id": "proj1",
        "strategic_kpis": [{"name": "年度指标"}],
        "management_indicators": [],
        "team_development": [],
        "engagement_compliance": [],
        "dimension_weights": {"strategic": 50},
    },
}


class TestDecomposePeriodNode:
    @pytest.mark.asyncio
    async def test_creates_quarterly_perfs_with_relations(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=SAMPLE_ANNUAL_ORG_PERF),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/qp1", "_key": "qp1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_PERIOD_DECOMPOSE)

        with (
            patch("lib.domain.performance.period_decomposer._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "org_perf_id": "op1", "target_periods": ["Q1", "Q2", "Q3", "Q4"]}
            result = await decompose_period_node(state)

            assert result["results"]["period_decomposition"]["status"] == "completed"
            assert result["results"]["period_decomposition"]["periods_created"] == 4
            # Each period creates a child + DECOMPOSED_FROM relation
            assert bridge.create_object.call_count == 4
            assert bridge.create_relation.call_count == 4
            # Verify child has DECOMPOSED_FROM relation
            rel_call = bridge.create_relation.call_args
            assert rel_call[1]["relation_type"] == "Decomposed_From"

    @pytest.mark.asyncio
    async def test_returns_failed_when_org_perf_not_found(self):
        bridge = _mock_bridge(get_object=AsyncMock(return_value=None))

        with patch("lib.domain.performance.period_decomposer._bridge", bridge):
            state = {"task_id": "t1", "org_perf_id": "nonexistent"}
            result = await decompose_period_node(state)
            assert result["results"]["period_decomposition"]["status"] == "failed"
            assert "不存在" in result["results"]["period_decomposition"]["error"]

    @pytest.mark.asyncio
    async def test_empty_periods_still_succeeds(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=SAMPLE_ANNUAL_ORG_PERF),
        )
        ai = _mock_ai_response('{"periods": []}')

        with (
            patch("lib.domain.performance.period_decomposer._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
        ):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await decompose_period_node(state)
            assert result["results"]["period_decomposition"]["status"] == "completed"
            assert result["results"]["period_decomposition"]["periods_created"] == 0

    @pytest.mark.asyncio
    async def test_exception_returns_failed(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("fail"))

        with patch("lib.domain.performance.period_decomposer._bridge", bridge):
            state = {"task_id": "t1", "org_perf_id": "op1"}
            result = await decompose_period_node(state)
            assert result["results"]["period_decomposition"]["status"] == "failed"


# ══════════════════════════════════════════════════════
# Phase 4: Test cascade_orchestrator
# ══════════════════════════════════════════════════════

from lib.domain.performance.cascade_orchestrator import generate_full_cascade

SAMPLE_ROOT_ORG = {
    "_id": "sys_objects/root1",
    "_key": "root1",
    "properties": {"unit_name": "总公司", "unit_type": "公司", "level": 1},
}

SAMPLE_CHILD_ORG = {
    "_id": "sys_objects/child1",
    "_key": "child1",
    "properties": {"unit_name": "技术部", "unit_type": "职能部门", "level": 2, "parent_org_ref": "root1"},
}


class TestCascadeOrchestrator:
    @pytest.mark.asyncio
    async def test_single_root_generates_one_org_perf(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[SAMPLE_PLAN, SAMPLE_ROOT_ORG]),
            get_objects_by_model=AsyncMock(side_effect=[[], []]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/op1", "_key": "op1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        mock_pos_node = AsyncMock(return_value={
            "results": {"position_performance": {"status": "completed", "count": 0}},
        })

        with (
            patch("lib.domain.performance.cascade_orchestrator._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.cascade_orchestrator.get_org_tree", new_callable=AsyncMock, return_value=[{
                "_key": "root1", "properties": SAMPLE_ROOT_ORG["properties"], "children": [],
            }]),
            patch("lib.domain.performance.cascade_orchestrator.generate_position_performance_node", mock_pos_node),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "root1", "cascade_mode": "top_down"}
            result = await generate_full_cascade(state)

            assert result["results"]["cascade"]["status"] == "completed"
            assert result["results"]["cascade"]["org_performances"] == 1
            # Verify perf_type = "company" for level 1
            create_call = bridge.create_object.call_args
            assert create_call[0][1]["perf_type"] == "company"

    @pytest.mark.asyncio
    async def test_nested_orgs_create_decomposed_from_relations(self):
        org_tree = [{
            "_key": "root1",
            "properties": SAMPLE_ROOT_ORG["properties"],
            "children": [{
                "_key": "child1",
                "properties": SAMPLE_CHILD_ORG["properties"],
                "children": [],
            }],
        }]

        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                SAMPLE_PLAN,        # plan read
                SAMPLE_ROOT_ORG,    # parent context for child
            ]),
            get_objects_by_model=AsyncMock(side_effect=[[], []]),
            create_object=AsyncMock(side_value=[
                {"_id": "sys_objects/op1", "_key": "op1"},  # root org perf
                {"_id": "sys_objects/op2", "_key": "op2"},  # child org perf
            ]),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        mock_pos_node = AsyncMock(return_value={
            "results": {"position_performance": {"status": "completed", "count": 0}},
        })

        with (
            patch("lib.domain.performance.cascade_orchestrator._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.cascade_orchestrator.get_org_tree", new_callable=AsyncMock, return_value=org_tree),
            patch("lib.domain.performance.cascade_orchestrator.generate_position_performance_node", mock_pos_node),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "root1"}
            result = await generate_full_cascade(state)

            assert result["results"]["cascade"]["org_performances"] == 2
            # DECOMPOSED_FROM should be created for child (not root)
            assert bridge.create_relation.call_count >= 1
            rel_call = bridge.create_relation.call_args
            assert rel_call[1]["relation_type"] == "Decomposed_From"

    @pytest.mark.asyncio
    async def test_empty_plan_id_does_not_error(self):
        bridge = _mock_bridge(
            get_objects_by_model=AsyncMock(side_effect=[[], []]),
            create_object=AsyncMock(return_value={
                "_id": "sys_objects/op1", "_key": "op1",
            }),
        )
        ai = _mock_ai_response(MOCK_AI_ORG_PERF)

        with (
            patch("lib.domain.performance.cascade_orchestrator._bridge", bridge),
            patch("app.services.ai_client.ai_client", ai),
            patch("lib.domain.performance.cascade_orchestrator.get_org_tree", new_callable=AsyncMock, return_value=[{
                "_key": "root1", "properties": SAMPLE_ROOT_ORG["properties"], "children": [],
            }]),
            patch("lib.domain.performance.cascade_orchestrator.generate_position_performance_node", new_callable=AsyncMock, return_value={
                "results": {"position_performance": {"status": "completed", "count": 0}},
            }),
        ):
            state = {"task_id": "t1", "plan_id": "", "org_unit_id": "root1"}
            result = await generate_full_cascade(state)
            assert result["results"]["cascade"]["status"] == "completed"

    @pytest.mark.asyncio
    async def test_ai_exception_returns_failed(self):
        bridge = _mock_bridge()
        bridge.get_object = AsyncMock(side_effect=RuntimeError("AI fail"))

        with (
            patch("lib.domain.performance.cascade_orchestrator._bridge", bridge),
            patch("lib.domain.performance.cascade_orchestrator.get_org_tree", new_callable=AsyncMock, return_value=[]),
        ):
            state = {"task_id": "t1", "plan_id": "plan1", "org_unit_id": "root1"}
            result = await generate_full_cascade(state)
            assert result["results"]["cascade"]["status"] == "failed"
            assert "AI fail" in result["results"]["cascade"]["error"]


# ══════════════════════════════════════════════════════
# Phase 4: Test hierarchy_utils
# ══════════════════════════════════════════════════════

from lib.workflow.hierarchy_utils import get_org_tree, get_goal_cascade_chain


class TestHierarchyUtils:
    @pytest.mark.asyncio
    async def test_get_org_tree_root_not_found_returns_empty(self):
        bridge = _mock_bridge(get_object=AsyncMock(return_value=None))
        result = await get_org_tree(bridge, "nonexistent")
        assert result == []

    @pytest.mark.asyncio
    async def test_get_org_tree_single_root_no_children(self):
        bridge = _mock_bridge(
            get_object=AsyncMock(return_value=SAMPLE_ROOT_ORG),
            get_objects_by_model=AsyncMock(return_value=[SAMPLE_ROOT_ORG]),
        )
        result = await get_org_tree(bridge, "root1")
        assert len(result) == 1
        assert result[0]["_key"] == "root1"
        assert result[0]["children"] == []

    @pytest.mark.asyncio
    async def test_get_org_tree_with_children(self):
        child_with_parent = {
            "_id": "sys_objects/child1",
            "_key": "child1",
            "properties": {"unit_name": "子部门", "parent_org_ref": "root1"},
        }
        bridge = _mock_bridge(
            get_object=AsyncMock(side_effect=[
                SAMPLE_ROOT_ORG,   # root lookup
                child_with_parent,  # child recursive lookup
            ]),
            get_objects_by_model=AsyncMock(return_value=[SAMPLE_ROOT_ORG, child_with_parent]),
        )
        result = await get_org_tree(bridge, "root1")
        assert len(result) == 1
        assert len(result[0]["children"]) == 1
        assert result[0]["children"][0]["_key"] == "child1"

    @pytest.mark.asyncio
    async def test_get_goal_cascade_chain_delegates_to_bridge(self):
        bridge = _mock_bridge(
            get_ancestors=AsyncMock(return_value=[
                {"_id": "sys_objects/parent1", "_key": "parent1"},
                {"_id": "sys_objects/grandparent1", "_key": "grandparent1"},
            ]),
        )
        result = await get_goal_cascade_chain(bridge, "goal1")
        assert len(result) == 2
        assert result[0]["_key"] == "parent1"
        bridge.get_ancestors.assert_called_once_with("sys_objects/goal1", "Decomposed_From", 10)


# ══════════════════════════════════════════════════════
# Phase 1: Test KernelBridge new methods
# ══════════════════════════════════════════════════════

class TestKernelBridgeNewMethods:
    @pytest.mark.asyncio
    async def test_get_objects_by_field_returns_matching(self):
        from lib.workflow.kernel_bridge import KernelBridge

        bridge = KernelBridge()
        mock_result = [{"_key": "obj1", "properties": {"status": "active"}}]

        with patch.object(bridge, "_run_sync", new_callable=AsyncMock, return_value=mock_result):
            result = await bridge.get_objects_by_field("Org_Performance", "status", "active")
            assert len(result) == 1
            assert result[0]["_key"] == "obj1"

    @pytest.mark.asyncio
    async def test_get_ancestors_returns_chain(self):
        from lib.workflow.kernel_bridge import KernelBridge

        bridge = KernelBridge()
        mock_result = [
            {"_id": "sys_objects/parent1", "_key": "parent1"},
        ]

        with patch.object(bridge, "_run_sync", new_callable=AsyncMock, return_value=mock_result):
            result = await bridge.get_ancestors("sys_objects/child1", "Decomposed_From")
            assert len(result) == 1
            assert result[0]["_key"] == "parent1"
