#!/usr/bin/env python3
"""
种子数据：创建预置逻辑节点和标杆报告模板

用法: KERNEL_MODE=demo python3 -m app.agent.seed_blueprints
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.kernel.database import init_kernel_db, get_db
from app.agent.blueprint_service import BlueprintService


# ─── 8 个预置逻辑节点 ───

LOGIC_NODES = [
    {
        "node_type": "company_overview",
        "display_name": "企业概况",
        "description": "了解企业基本信息、规模、发展阶段和核心业务",
        "dependencies": [],
        "industry_tags": ["通用"],
        "required_data_schema": {
            "company_name": {
                "label": "企业名称",
                "type": "input",
                "required": True,
            },
            "industry": {
                "label": "所属行业",
                "type": "input",
                "required": True,
            },
            "revenue": {
                "label": "年营收规模 (万元)",
                "type": "number",
                "required": True,
            },
            "employee_count": {
                "label": "员工人数",
                "type": "number",
                "required": True,
            },
            "founding_year": {
                "label": "成立年份",
                "type": "number",
                "required": False,
            },
            "core_business": {
                "label": "核心业务描述",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 1,
    },
    {
        "node_type": "industry_analysis",
        "display_name": "行业分析",
        "description": "分析行业趋势、竞争格局和市场机会",
        "dependencies": ["company_overview"],
        "industry_tags": ["通用"],
        "required_data_schema": {
            "market_size": {
                "label": "市场规模 (亿元)",
                "type": "number",
                "required": False,
            },
            "growth_rate": {
                "label": "行业增长率 (%)",
                "type": "number",
                "required": False,
            },
            "competitor_name": {
                "label": "主要竞争对手",
                "type": "input",
                "required": True,
            },
            "market_position": {
                "label": "市场地位",
                "type": "select",
                "options": ["领导者", "挑战者", "跟随者", "利基者"],
                "required": True,
            },
            "industry_trend": {
                "label": "行业发展趋势",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 2,
    },
    {
        "node_type": "SWOT",
        "display_name": "SWOT 分析",
        "description": "从优势、劣势、机会、威胁四个维度全面评估",
        "dependencies": ["company_overview", "industry_analysis"],
        "industry_tags": ["通用"],
        "required_data_schema": {
            "strengths": {
                "label": "核心优势 (S)",
                "type": "textarea",
                "required": True,
            },
            "weaknesses": {
                "label": "主要劣势 (W)",
                "type": "textarea",
                "required": True,
            },
            "opportunities": {
                "label": "市场机会 (O)",
                "type": "textarea",
                "required": True,
            },
            "threats": {
                "label": "外部威胁 (T)",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 3,
    },
    {
        "node_type": "organizational_structure",
        "display_name": "组织结构评估",
        "description": "评估组织架构、层级设计和管理幅度",
        "dependencies": ["company_overview"],
        "industry_tags": ["组织诊断", "通用"],
        "required_data_schema": {
            "org_type": {
                "label": "组织类型",
                "type": "select",
                "options": ["职能制", "事业部制", "矩阵制", "网络制", "混合制"],
                "required": True,
            },
            "hierarchy_levels": {
                "label": "管理层级数",
                "type": "number",
                "required": True,
            },
            "span_of_control": {
                "label": "管理幅度 (平均直接下属数)",
                "type": "number",
                "required": False,
            },
            "org_pain_points": {
                "label": "组织结构痛点",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 4,
    },
    {
        "node_type": "talent_assessment",
        "display_name": "人才梯队评估",
        "description": "评估人才结构、关键岗位胜任力和继任计划",
        "dependencies": ["company_overview", "organizational_structure"],
        "industry_tags": ["人才管理", "通用"],
        "required_data_schema": {
            "key_positions": {
                "label": "关键岗位数量",
                "type": "number",
                "required": False,
            },
            "vacancy_rate": {
                "label": "关键岗位空缺率 (%)",
                "type": "number",
                "required": False,
            },
            "talent_pain_points": {
                "label": "人才痛点",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 5,
    },
    {
        "node_type": "performance_diagnosis",
        "display_name": "绩效诊断",
        "description": "诊断绩效管理体系和关键指标达成情况",
        "dependencies": ["organizational_structure"],
        "industry_tags": ["绩效改进", "通用"],
        "required_data_schema": {
            "has_kpi_system": {
                "label": "是否建立 KPI 体系",
                "type": "select",
                "options": ["已建立", "部分建立", "未建立"],
                "required": True,
            },
            "performance_pain_points": {
                "label": "绩效管理痛点",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 6,
    },
    {
        "node_type": "strategic_recommendations",
        "display_name": "战略建议",
        "description": "基于分析结果提出战略方向和关键举措",
        "dependencies": ["SWOT", "performance_diagnosis"],
        "industry_tags": ["通用"],
        "required_data_schema": {
            "strategic_priorities": {
                "label": "战略优先级排序",
                "type": "textarea",
                "required": True,
            },
            "expected_outcomes": {
                "label": "期望成果",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 7,
    },
    {
        "node_type": "implementation_roadmap",
        "display_name": "实施路线图",
        "description": "制定分阶段实施计划和时间表",
        "dependencies": ["strategic_recommendations"],
        "industry_tags": ["通用"],
        "required_data_schema": {
            "phases": {
                "label": "实施阶段 (如: 短期/中期/长期)",
                "type": "textarea",
                "required": True,
            },
            "timeline": {
                "label": "时间规划",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 8,
    },
]

# ─── 2 个预置标杆报告模板 ───

BENCHMARKS = [
    {
        "title": "通用组织诊断",
        "industry": "通用",
        "consulting_type": "组织诊断",
        "description": "覆盖企业概况、行业分析、SWOT、组织结构、人才、绩效、战略建议、实施路线图的完整诊断模板",
        "node_types": [
            "company_overview", "industry_analysis", "SWOT",
            "organizational_structure", "talent_assessment",
            "performance_diagnosis", "strategic_recommendations",
            "implementation_roadmap",
        ],
    },
    {
        "title": "战略规划",
        "industry": "通用",
        "consulting_type": "战略规划",
        "description": "聚焦战略分析，从企业概况到 SWOT 到战略建议再到实施路线图",
        "node_types": [
            "company_overview", "industry_analysis", "SWOT",
            "strategic_recommendations", "implementation_roadmap",
        ],
    },
]


def seed_all(verbose: bool = False):
    """Seed all logic nodes and benchmarks."""
    init_kernel_db()
    db = get_db()
    svc = BlueprintService(db)

    # Seed logic nodes (skip if already exists)
    node_id_map = {}  # node_type -> _key
    for node_data in LOGIC_NODES:
        existing = svc.get_logic_node_by_type(node_data["node_type"])
        if existing:
            node_id_map[node_data["node_type"]] = existing["_key"]
            if verbose:
                print(f"  SKIP Logic_Node '{node_data['node_type']}' (already exists)")
            continue

        node = svc.create_logic_node(node_data)
        node_id_map[node_data["node_type"]] = node["_key"]
        if verbose:
            print(f"  OK   Logic_Node '{node_data['node_type']}' (_key={node['_key']})")

    # Seed benchmarks
    for bm_data in BENCHMARKS:
        node_ids = [node_id_map[t] for t in bm_data["node_types"] if t in node_id_map]

        existing_bms = svc.list_benchmarks(limit=500)
        already_exists = any(
            b.get("properties", {}).get("title") == bm_data["title"]
            for b in existing_bms
        )
        if already_exists:
            if verbose:
                print(f"  SKIP Benchmark '{bm_data['title']}' (already exists)")
            continue

        bm = svc.create_benchmark(bm_data, logic_node_ids=node_ids)
        if verbose:
            print(f"  OK   Benchmark '{bm_data['title']}' (_key={bm['_key']})")

    return node_id_map


def main():
    print("=" * 60)
    print("Seeding Agent Blueprints (Logic Nodes + Benchmarks)...")
    print("=" * 60)

    node_id_map = seed_all(verbose=True)

    print(f"\nSeeded {len(LOGIC_NODES)} logic nodes, {len(BENCHMARKS)} benchmarks")

    # Verify
    db = get_db()
    svc = BlueprintService(db)
    benchmarks = svc.list_benchmarks(limit=100)
    print(f"\nVerification: {len(benchmarks)} benchmarks in database")
    for bm in benchmarks:
        props = bm.get("properties", {})
        node_order = props.get("node_order", [])
        print(f"  {props.get('title'):20s} ({len(node_order)} nodes)")

    # Test dependency tree
    if benchmarks:
        first_bm = benchmarks[0]
        tree = svc.get_dependency_tree(first_bm["_key"])
        print(f"\nDependency tree for '{tree['title']}':")
        print(f"  Execution order: {' → '.join(tree['execution_order'])}")
        print(f"  Total nodes: {len(tree['nodes'])}")


if __name__ == "__main__":
    main()
