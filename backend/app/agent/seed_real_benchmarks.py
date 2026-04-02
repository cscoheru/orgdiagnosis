#!/usr/bin/env python3
"""
从真实标杆报告 PPTX 中提取逻辑骨架，创建 Logic_Node 和 Benchmark 种子数据。

先 seed 基础元模型，再创建领域特化的逻辑节点，最后组装标杆模板。
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.kernel.database import init_kernel_db, get_db
from scripts.seed_meta_models import seed_all_meta_models
from app.agent.blueprint_service import BlueprintService

BENCHMARKS_DIR = "/Users/kjonekong/Documents/org-diagnosis/data/benchmarks"

# ─── 新增领域特化逻辑节点 (通用种子之外的补充) ───

DOMAIN_LOGIC_NODES = [
    # ─── 战略规划领域 ───
    {
        "node_type": "external_environment",
        "display_name": "外部环境分析",
        "description": "分析宏观政策、经济环境、技术趋势对组织的影响",
        "dependencies": ["company_overview"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "macro_policy": {
                "label": "相关政策/法规",
                "type": "textarea",
                "required": True,
            },
            "economic_environment": {
                "label": "宏观经济环境",
                "type": "textarea",
                "required": False,
            },
            "technology_trend": {
                "label": "技术趋势与影响",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 10,
    },
    {
        "node_type": "competitor_landscape",
        "display_name": "竞争格局分析",
        "description": "识别主要竞争对手、市场份额、竞争动态",
        "dependencies": ["industry_analysis"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "main_competitors": {
                "label": "主要竞争对手",
                "type": "textarea",
                "required": True,
            },
            "market_share": {
                "label": "我方市场占有率",
                "type": "number",
                "required": False,
            },
            "competitive_dynamics": {
                "label": "近期竞争动态",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 11,
    },
    {
        "node_type": "client_analysis",
        "display_name": "客户分析",
        "description": "分析客户画像、需求变化、客户满意度",
        "dependencies": ["company_overview"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "target_customers": {
                "label": "目标客户群体",
                "type": "textarea",
                "required": True,
            },
            "customer_needs": {
                "label": "客户核心需求",
                "type": "textarea",
                "required": False,
            },
            "customer_satisfaction": {
                "label": "客户满意度现状",
                "type": "select",
                "options": ["高", "中", "低", "未调研"],
                "required": False,
            },
        },
        "display_order": 12,
    },
    {
        "node_type": "BCG_matrix",
        "display_name": "波士顿矩阵/业务组合分析",
        "description": "按市场增长率和份额将业务分类，确定战略优先级",
        "dependencies": ["SWOT"],
        "industry_tags": ["战略规划"],
        "required_data_schema": {
            "business_units": {
                "label": "业务单元列表",
                "type": "textarea",
                "required": True,
            },
            "star_products": {
                "label": "明星业务",
                "type": "textarea",
                "required": False,
            },
            "cash_cow_products": {
                "label": "现金牛业务",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 13,
    },
    {
        "node_type": "strategic_priorities",
        "display_name": "战略重点与优先级排序",
        "description": "基于 SWOT 匹配确定 SO/ST/WO/WT 战略组合",
        "dependencies": ["SWOT", "BCG_matrix"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "strategic_priorities": {
                "label": "战略优先级排序 (按重要性)",
                "type": "textarea",
                "required": True,
            },
            "strategic_rationale": {
                "label": "战略选择理由",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 14,
    },
    {
        "node_type": "key_initiatives",
        "display_name": "关键举措设计",
        "description": "围绕战略优先级设计具体的关键举措和重点任务",
        "dependencies": ["strategic_priorities"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "key_initiatives": {
                "label": "关键举措列表 (含目标和负责人)",
                "type": "textarea",
                "required": True,
            },
            "resource_allocation": {
                "label": "资源配置需求",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 15,
    },
    {
        "node_type": "milestone_roadmap",
        "display_name": "里程碑路线图",
        "description": "分阶段设定关键里程碑和时间节点",
        "dependencies": ["key_initiatives"],
        "industry_tags": ["战略规划", "通用"],
        "required_data_schema": {
            "phases": {
                "label": "阶段划分 (如: 短期/中期/长期)",
                "type": "textarea",
                "required": True,
            },
            "key_milestones": {
                "label": "关键里程碑",
                "type": "textarea",
                "required": True,
            },
            "timeline": {
                "label": "时间规划",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 16,
    },

    # ─── 人才管理领域 ───
    {
        "node_type": "competency_model",
        "display_name": "能力素质模型",
        "description": "定义岗位或层级所需的胜任力项，含行为锚定等级",
        "dependencies": ["company_overview", "organizational_structure"],
        "industry_tags": ["人才管理"],
        "required_data_schema": {
            "competency_categories": {
                "label": "能力维度划分",
                "type": "textarea",
                "required": True,
            },
            "behavioral_anchors": {
                "label": "关键行为锚定描述",
                "type": "textarea",
                "required": True,
            },
            "potential_factors": {
                "label": "潜力因子/个性特质要求",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 20,
    },
    {
        "node_type": "learning_map",
        "display_name": "学习地图设计",
        "description": "基于能力模型，分层分级设计学习内容与培养路径",
        "dependencies": ["competency_model"],
        "industry_tags": ["人才管理", "人才培训"],
        "required_data_schema": {
            "learning_principles": {
                "label": "学习地图设计原则",
                "type": "textarea",
                "required": True,
            },
            "tier_structure": {
                "label": "层级划分方式",
                "type": "textarea",
                "required": False,
            },
            "course_system": {
                "label": "课程体系概述",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 21,
    },
    {
        "node_type": "training_program_design",
        "display_name": "培养项目设计",
        "description": "为各层级设计具体的培养项目，含阶段、内容、师资",
        "dependencies": ["learning_map"],
        "industry_tags": ["人才培训"],
        "required_data_schema": {
            "target_tiers": {
                "label": "培养对象层级",
                "type": "textarea",
                "required": True,
            },
            "training_phases": {
                "label": "培养阶段划分",
                "type": "textarea",
                "required": True,
            },
            "delivery_methods": {
                "label": "培训方式 (面授/在线/在岗/行动学习)",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 22,
    },
    {
        "node_type": "training_implementation",
        "display_name": "培训落地与资源保障",
        "description": "师资、平台、执行流程、知识管理等落地支撑",
        "dependencies": ["training_program_design"],
        "industry_tags": ["人才培训"],
        "required_data_schema": {
            "facilitator_resources": {
                "label": "师资与内训师现状",
                "type": "textarea",
                "required": True,
            },
            "platform_needs": {
                "label": "平台/系统需求",
                "type": "textarea",
                "required": False,
            },
            "implementation_plan": {
                "label": "实施规划与时间表",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 23,
    },

    # ─── 绩效管理领域 ───
    {
        "node_type": "performance_system_design",
        "display_name": "绩效管理体系设计",
        "description": "设计绩效管理的总体目标、原则和组织/个人绩效方案",
        "dependencies": ["organizational_structure"],
        "industry_tags": ["绩效改进"],
        "required_data_schema": {
            "performance_principles": {
                "label": "绩效管理核心原则",
                "type": "textarea",
                "required": True,
            },
            "org_vs_individual": {
                "label": "组织绩效与个人绩效关系",
                "type": "textarea",
                "required": True,
            },
            "pbc_or_matrix": {
                "label": "考核方式 (PBC/矩阵式/混合)",
                "type": "select",
                "options": ["个人绩效承诺(PBC)", "矩阵式考核", "混合模式"],
                "required": True,
            },
        },
        "display_order": 30,
    },
    {
        "node_type": "performance_process",
        "display_name": "绩效管理流程",
        "description": "月度检视、季度考核、年度考评的全流程设计",
        "dependencies": ["performance_system_design"],
        "industry_tags": ["绩效改进"],
        "required_data_schema": {
            "monthly_review": {
                "label": "月度检视机制",
                "type": "textarea",
                "required": True,
            },
            "quarterly_review": {
                "label": "季度考核流程",
                "type": "textarea",
                "required": True,
            },
            "annual_review": {
                "label": "年度考评应用",
                "type": "textarea",
                "required": True,
            },
        },
        "display_order": 31,
    },
    {
        "node_type": "performance_evaluation",
        "display_name": "绩效评价标准",
        "description": "定义考核等级、评分标准、强制分布",
        "dependencies": ["performance_process"],
        "industry_tags": ["绩效改进"],
        "required_data_schema": {
            "rating_scale": {
                "label": "考核等级划分 (如 A/B/C/D)",
                "type": "textarea",
                "required": True,
            },
            "rating_criteria": {
                "label": "评分标准",
                "type": "textarea",
                "required": True,
            },
            "forced_distribution": {
                "label": "强制分布比例 (如 前10% A)",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 32,
    },
    {
        "node_type": "performance_application",
        "display_name": "考核结果应用",
        "description": "绩效结果与薪酬、晋升、发展的挂钩机制",
        "dependencies": ["performance_evaluation"],
        "industry_tags": ["绩效改进"],
        "required_data_schema": {
            "salary_linkage": {
                "label": "与薪酬挂钩方式",
                "type": "textarea",
                "required": True,
            },
            "promotion_linkage": {
                "label": "与晋升发展挂钩",
                "type": "textarea",
                "required": True,
            },
            "development_plan": {
                "label": "绩效改进计划",
                "type": "textarea",
                "required": False,
            },
        },
        "display_order": 33,
    },
]

# ─── 标杆报告模板 (基于真实 PPTX 的逻辑骨架) ───

REAL_BENCHMARKS = [
    {
        "title": "十四五战略规划调研诊断与规划报告",
        "industry": "金融/教育培训",
        "consulting_type": "战略规划",
        "description": "基于中银教育培训十四五规划报告的逻辑骨架：外部环境→SWOT→战略规划→五大举措→实施路线图",
        "source_file": "【战略规划】十四五规划调研诊断与 规划报告.pptx",
        "node_types": [
            "company_overview",
            "external_environment",
            "industry_analysis",
            "SWOT",
            "strategic_priorities",
            "key_initiatives",
            "milestone_roadmap",
            "organizational_structure",
        ],
    },
    {
        "title": "企业战略分析及规划",
        "industry": "制造业",
        "consulting_type": "战略规划",
        "description": "基于金鸿曲轴战略分析报告的逻辑骨架：行业分析→客户分析→SWOT→竞争策略→实施路线图",
        "source_file": "【战略规划】战略分析及规划-1205.pptx",
        "node_types": [
            "company_overview",
            "industry_analysis",
            "external_environment",
            "competitor_landscape",
            "client_analysis",
            "SWOT",
            "BCG_matrix",
            "strategic_priorities",
            "milestone_roadmap",
        ],
    },
    {
        "title": "领导力素质模型构建",
        "industry": "通用",
        "consulting_type": "人才管理",
        "description": "基于太极集团领导力素质报告的逻辑骨架：素质模型定义→行为锚定→潜力因子",
        "source_file": "【人才-能力模型】领导力素质模型.pptx",
        "node_types": [
            "company_overview",
            "organizational_structure",
            "competency_model",
        ],
    },
    {
        "title": "学习地图与培养项目设计",
        "industry": "金融",
        "consulting_type": "人才培训",
        "description": "基于建行客户经理学习地图报告的逻辑骨架：学习地图设计→分层培养项目→落地建议",
        "source_file": "【人才-培训】学习地图及实施建议.pptx",
        "node_types": [
            "company_overview",
            "organizational_structure",
            "competency_model",
            "learning_map",
            "training_program_design",
            "training_implementation",
        ],
    },
    {
        "title": "绩效管理体系设计",
        "industry": "通用",
        "consulting_type": "绩效改进",
        "description": "基于绩效总体目标报告的逻辑骨架：体系设计→管理流程→评价标准→结果应用",
        "source_file": "【绩效管理】绩效总体目标.pptx",
        "node_types": [
            "organizational_structure",
            "performance_system_design",
            "performance_process",
            "performance_evaluation",
            "performance_application",
        ],
    },
]


def seed_domain_nodes(svc: BlueprintService) -> dict[str, str]:
    """Create domain-specific logic nodes, return type→_key map."""
    node_id_map = {}
    for node_data in DOMAIN_LOGIC_NODES:
        existing = svc.get_logic_node_by_type(node_data["node_type"])
        if existing:
            node_id_map[node_data["node_type"]] = existing["_key"]
            print(f"  SKIP Logic_Node '{node_data['node_type']}' (already exists)")
            continue

        node = svc.create_logic_node(node_data)
        node_id_map[node_data["node_type"]] = node["_key"]
        print(f"  OK   Logic_Node '{node_data['display_name']}' ({node_data['node_type']})")
    return node_id_map


def seed_real_benchmarks(svc: BlueprintService, node_id_map: dict[str, str]):
    """Create benchmark templates based on real PPTX reports."""
    for bm_data in REAL_BENCHMARKS:
        existing_bms = svc.list_benchmarks(limit=500)
        already_exists = any(
            b.get("properties", {}).get("title") == bm_data["title"]
            for b in existing_bms
        )
        if already_exists:
            print(f"  SKIP Benchmark '{bm_data['title']}' (already exists)")
            continue

        node_ids = [
            node_id_map[t]
            for t in bm_data["node_types"]
            if t in node_id_map
        ]

        bm = svc.create_benchmark(
            {
                "title": bm_data["title"],
                "industry": bm_data["industry"],
                "consulting_type": bm_data["consulting_type"],
                "description": bm_data["description"],
            },
            logic_node_ids=node_ids,
        )
        print(f"  OK   Benchmark '{bm_data['title']}' ({len(node_ids)} nodes)")


def main():
    print("=" * 70)
    print("Seeding Real Benchmark Blueprints from PPTX Files...")
    print("=" * 70)

    init_kernel_db()
    seed_all_meta_models(verbose=False)

    # Seed generic blueprints (8 nodes + 2 benchmarks)
    from app.agent.seed_blueprints import seed_all as seed_generic_blueprints
    seed_generic_blueprints(verbose=False)

    db = get_db()
    svc = BlueprintService(db)

    # Seed domain-specific logic nodes
    print(f"\n--- Seeding {len(DOMAIN_LOGIC_NODES)} domain logic nodes ---")
    node_id_map = seed_domain_nodes(svc)

    # Seed real benchmark templates
    print(f"\n--- Seeding {len(REAL_BENCHMARKS)} real benchmark templates ---")
    seed_real_benchmarks(svc, node_id_map)

    # Summary
    print(f"\n{'=' * 70}")
    print("Summary")
    print(f"{'=' * 70}")

    all_nodes = svc.list_logic_nodes(limit=500)
    all_bms = svc.list_benchmarks(limit=500)
    print(f"Total logic nodes: {len(all_nodes)}")
    print(f"Total benchmarks:  {len(all_bms)}")

    # Show all benchmarks with their node counts
    print(f"\nAll Benchmarks:")
    for bm in all_bms:
        props = bm.get("properties", {})
        node_count = len(props.get("node_order", []))
        print(f"  [{props.get('consulting_type'):6s}] {props.get('title'):30s} ({node_count} nodes, {props.get('industry')})")

    # Show all logic nodes grouped by industry tag
    print(f"\nAll Logic Nodes ({len(all_nodes)}):")
    for n in sorted(all_nodes, key=lambda x: x.get("properties", {}).get("display_order", 999)):
        props = n.get("properties", {})
        tags = ", ".join(props.get("industry_tags", []))
        deps = ", ".join(props.get("dependencies", [])) or "none"
        fields = list(props.get("required_data_schema", {}).keys())
        print(f"  [{props.get('display_name'):16s}] {props.get('node_type'):25s} deps={deps:20s} fields={len(fields)}")


if __name__ == "__main__":
    main()
