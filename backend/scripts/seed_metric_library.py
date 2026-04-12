#!/usr/bin/env python3
"""
种子数据：绩效指标库 (~670 个指标模板 + 18 个分类)

通过 HTTP API 创建 Metric_Category 和 Metric_Template 对象。

用法:
  python scripts/seed_metric_library.py [--base-url http://localhost:8000]
  python scripts/seed_metric_library.py --base-url https://org-diagnosis.3strategy.cc/api

前提: Metric_Category 和 Metric_Template 元模型已通过 seed_meta_models.py 创建。
"""
import requests
import json
import sys
import os
import argparse
import time

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000/api/v1/kernel")

# ═══════════════════════════════════════════════════════════════
# 1. 指标分类 (Metric_Category)
# ═══════════════════════════════════════════════════════════════

CATEGORIES = [
    # 行业分类
    {"category_name": "建筑工程", "category_type": "industry", "display_order": 1},
    {"category_name": "消费品", "category_type": "industry", "display_order": 2},
    {"category_name": "制造业", "category_type": "industry", "display_order": 3},
    {"category_name": "科技互联网", "category_type": "industry", "display_order": 4},
    {"category_name": "金融", "category_type": "industry", "display_order": 5},
    {"category_name": "房地产", "category_type": "industry", "display_order": 6},
    {"category_name": "医疗健康", "category_type": "industry", "display_order": 7},
    # 维度分类
    {"category_name": "财务", "category_type": "dimension", "display_order": 10},
    {"category_name": "客户", "category_type": "dimension", "display_order": 11},
    {"category_name": "内部流程", "category_type": "dimension", "display_order": 12},
    {"category_name": "学习与成长", "category_type": "dimension", "display_order": 13},
    {"category_name": "战略", "category_type": "dimension", "display_order": 14},
    {"category_name": "运营", "category_type": "dimension", "display_order": 15},
    {"category_name": "人才发展", "category_type": "dimension", "display_order": 16},
    {"category_name": "胜任力", "category_type": "dimension", "display_order": 17},
    # 层级分类
    {"category_name": "组织级", "category_type": "level", "display_order": 20},
    {"category_name": "部门级", "category_type": "level", "display_order": 21},
    {"category_name": "岗位级", "category_type": "level", "display_order": 22},
]

# ═══════════════════════════════════════════════════════════════
# 2. 指标模板 (Metric_Template) — 通用指标 (~60)
# ═══════════════════════════════════════════════════════════════

GENERAL_METRICS = [
    # ── 通用·组织级 (~15) ──
    {"metric_name": "营业收入达成率", "dimension": "财务", "applicable_level": "组织级",
     "industries": [], "default_weight": 15, "unit": "%", "target_template": ">=100%",
     "evaluation_criteria": "实际营业收入 / 目标营业收入 * 100%",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "净利润率", "dimension": "财务", "applicable_level": "组织级",
     "industries": [], "default_weight": 12, "unit": "%", "target_template": ">=行业平均",
     "evaluation_criteria": "净利润 / 营业收入 * 100%",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "成本费用利润率", "dimension": "财务", "applicable_level": "组织级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": ">=15%",
     "evaluation_criteria": "利润总额 / 成本费用总额 * 100%",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "客户满意度 (NPS)", "dimension": "客户", "applicable_level": "组织级",
     "industries": [], "default_weight": 10, "unit": "分", "target_template": ">=8.0",
     "evaluation_criteria": "通过问卷调查获取净推荐值",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "市场份额增长率", "dimension": "战略", "applicable_level": "组织级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": ">=5%",
     "evaluation_criteria": "本年度市场份额 / 上年度市场份额 - 1",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "新市场/新产品拓展数", "dimension": "战略", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "个", "target_template": ">=2",
     "evaluation_criteria": "成功进入的新市场或上线的新产品数量",
     "org_dimension_mapping": "strategic_kpis"},
    {"metric_name": "项目按期交付率", "dimension": "运营", "applicable_level": "组织级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": ">=90%",
     "evaluation_criteria": "按期交付项目数 / 总项目数 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "全员劳动生产率", "dimension": "运营", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "万元/人", "target_template": "同比提升5%",
     "evaluation_criteria": "营业收入 / 平均在岗人数",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "关键岗位人才储备率", "dimension": "人才发展", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": ">=70%",
     "evaluation_criteria": "已有继任者的关键岗位数 / 关键岗位总数 * 100%",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "员工流失率", "dimension": "人才发展", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "<=15%",
     "evaluation_criteria": "主动离职人数 / 平均在岗人数 * 100%",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "培训计划完成率", "dimension": "学习与成长", "applicable_level": "组织级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "已完成培训课时 / 计划培训课时 * 100%",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "员工敬业度得分", "dimension": "人才发展", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "年度敬业度调查问卷得分",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "审计整改完成率", "dimension": "运营", "applicable_level": "组织级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "已完成整改的审计发现数 / 审计发现总数 * 100%",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "安全生产事故率", "dimension": "运营", "applicable_level": "组织级",
     "industries": [], "default_weight": 8, "unit": "次/百万工时", "target_template": "0",
     "evaluation_criteria": "安全事故次数 / 总工时(百万) * 100%",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "合规培训覆盖率", "dimension": "内部流程", "applicable_level": "组织级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "已完成合规培训人数 / 应培训人数 * 100%",
     "org_dimension_mapping": "engagement_compliance"},

    # ── 通用·部门级 (~20) ──
    {"metric_name": "部门预算执行率", "dimension": "财务", "applicable_level": "部门级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": "90%-110%",
     "evaluation_criteria": "实际支出 / 预算 * 100%，偏离度控制在±10%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "部门人均产值", "dimension": "运营", "applicable_level": "部门级",
     "industries": [], "default_weight": 10, "unit": "万元/人", "target_template": "同比提升5%",
     "evaluation_criteria": "部门产出价值 / 部门平均人数",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "部门工作计划完成率", "dimension": "运营", "applicable_level": "部门级",
     "industries": [], "default_weight": 12, "unit": "%", "target_template": ">=90%",
     "evaluation_criteria": "按期完成的部门重点工作项 / 总重点工作项 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "流程效率提升率", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": ">=10%",
     "evaluation_criteria": "关键流程周期缩短百分比",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "内部客户满意度", "dimension": "客户", "applicable_level": "部门级",
     "industries": [], "default_weight": 10, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "跨部门协作满意度评分",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "部门关键岗位继任率", "dimension": "人才发展", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": ">=60%",
     "evaluation_criteria": "有继任者的关键岗位 / 部门关键岗位数 * 100%",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "部门员工培训时长", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "小时/人", "target_template": ">=40",
     "evaluation_criteria": "部门人均年度培训课时",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "部门员工满意度", "dimension": "人才发展", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "部门年度满意度调查得分",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "知识沉淀/文档贡献", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "篇", "target_template": "人均>=2",
     "evaluation_criteria": "部门知识库新增文档数 / 部门人数",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "跨部门协作响应时效", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "小时", "target_template": "<=24h",
     "evaluation_criteria": "跨部门协作请求平均响应时间",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "制度/规范遵从率", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "合规检查通过项 / 总检查项 * 100%",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "创新提案采纳数", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "个", "target_template": ">=3",
     "evaluation_criteria": "被采纳的改进提案数量",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "质量合格率", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "合格产出数 / 总产出数 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "部门费用节约率", "dimension": "财务", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": ">=5%",
     "evaluation_criteria": "实际费用节约额 / 预算费用 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "风险事件处置率", "dimension": "运营", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "已妥善处置的风险事件 / 发现风险事件 * 100%",
     "org_dimension_mapping": "engagement_compliance"},

    # ── 通用·岗位级 (~25) ──
    # 管理岗通用
    {"metric_name": "团队目标达成率", "dimension": "运营", "applicable_level": "岗位级",
     "industries": [], "default_weight": 15, "unit": "%", "target_template": ">=100%",
     "evaluation_criteria": "团队实际完成值 / 目标值 * 100%",
     "pos_section_mapping": "performance_goals", "tags": ["管理岗"]},
    {"metric_name": "团队人才培养完成率", "dimension": "人才发展", "applicable_level": "岗位级",
     "industries": [], "default_weight": 10, "unit": "%", "target_template": ">=80%",
     "evaluation_criteria": "完成培养计划的下属数 / 计划培养人数 * 100%",
     "pos_section_mapping": "performance_goals", "tags": ["管理岗"]},
    {"metric_name": "团队流失率", "dimension": "人才发展", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "<=10%",
     "evaluation_criteria": "团队主动离职人数 / 团队平均人数 * 100%",
     "pos_section_mapping": "performance_goals", "tags": ["管理岗"]},
    {"metric_name": "跨部门沟通协调效果", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "跨部门协作满意度评分(360度反馈)",
     "pos_section_mapping": "competency_items", "tags": ["管理岗"]},
    {"metric_name": "决策质量", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "决策及时性、准确性和影响力评估",
     "pos_section_mapping": "competency_items", "tags": ["管理岗"]},
    # 专业岗通用
    {"metric_name": "工作任务完成率", "dimension": "运营", "applicable_level": "岗位级",
     "industries": [], "default_weight": 15, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "按时按质完成的工作任务数 / 总分配任务数 * 100%",
     "pos_section_mapping": "performance_goals"},
    {"metric_name": "工作质量合格率", "dimension": "运营", "applicable_level": "岗位级",
     "industries": [], "default_weight": 12, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "一次验收通过的工作数 / 总工作数 * 100%",
     "pos_section_mapping": "performance_goals"},
    {"metric_name": "专业技能提升", "dimension": "学习与成长", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": "达标",
     "evaluation_criteria": "年度技能认证/考核通过情况",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "问题解决能力", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "独立解决问题的效率和质量评估",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "团队协作", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "团队协作意愿和能力评估(360度反馈)",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "自我发展计划完成率", "dimension": "学习与成长", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": ">=80%",
     "evaluation_criteria": "个人发展计划完成项 / 总计划项 * 100%",
     "pos_section_mapping": "development_goals"},
    {"metric_name": "出勤率", "dimension": "运营", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": ">=95%",
     "evaluation_criteria": "实际出勤天数 / 应出勤天数 * 100%",
     "pos_section_mapping": "values_items"},
    {"metric_name": "规章制度遵守", "dimension": "内部流程", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": "无违规",
     "evaluation_criteria": "年度违规违纪次数",
     "pos_section_mapping": "values_items"},
    {"metric_name": "沟通表达能力", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 6, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "书面和口头沟通的效果评估",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "责任心与主动性", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 6, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "工作主动性、责任心和执行力的综合评估",
     "pos_section_mapping": "values_items"},
    # Additional general·部门级
    {"metric_name": "创新改进提案采纳率", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": ">=30%",
     "evaluation_criteria": "被采纳的改进提案数 / 提交提案数 * 100%",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "数字化转型推进", "dimension": "战略", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": "达标",
     "evaluation_criteria": "数字化工具应用和流程线上化推进评估",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "外部审计/检查通过率", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "外部审计检查无重大发现的比例",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "部门人均产值同比", "dimension": "运营", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": ">=5%",
     "evaluation_criteria": "部门人均产值同比增长率",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "流程自动化率", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": "同比提升",
     "evaluation_criteria": "已自动化流程步骤 / 总流程步骤 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "知识管理成熟度", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": ">=3.0/5.0",
     "evaluation_criteria": "知识沉淀、共享和应用的综合评估",
     "org_dimension_mapping": "team_development"},
    {"metric_name": "供应商管理", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": "达标",
     "evaluation_criteria": "供应商评估、选择和绩效管理的综合评估",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "部门风险预警及时率", "dimension": "运营", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "及时预警的风险事件 / 总风险事件 * 100%",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "部门成本效率", "dimension": "财务", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": "同比提升",
     "evaluation_criteria": "单位产出成本同比变化",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "客户投诉率", "dimension": "客户", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "%", "target_template": "<=2%",
     "evaluation_criteria": "客户投诉次数 / 总服务/交付次数 * 100%",
     "org_dimension_mapping": "management_indicators"},
    {"metric_name": "安全意识培训覆盖率", "dimension": "学习与成长", "applicable_level": "部门级",
     "industries": [], "default_weight": 5, "unit": "%", "target_template": "100%",
     "evaluation_criteria": "完成安全意识培训人数 / 应培训人数 * 100%",
     "org_dimension_mapping": "engagement_compliance"},
    {"metric_name": "信息安全管理", "dimension": "内部流程", "applicable_level": "部门级",
     "industries": [], "default_weight": 8, "unit": "分", "target_template": "无安全事件",
     "evaluation_criteria": "部门信息安全管理合规性和安全事件情况",
     "org_dimension_mapping": "engagement_compliance"},
    # Additional general·岗位级
    {"metric_name": "创新思维能力", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 6, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "提出创新想法和解决方案的能力",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "抗压能力", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "在压力环境下保持工作质量和效率的能力",
     "pos_section_mapping": "values_items"},
    {"metric_name": "学习能力", "dimension": "学习与成长", "applicable_level": "岗位级",
     "industries": [], "default_weight": 6, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "快速学习新知识和新技能的能力评估",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "时间管理能力", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "工作优先级管理和时间分配合理性",
     "pos_section_mapping": "competency_items"},
    {"metric_name": "职业素养", "dimension": "胜任力", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": ">=4.0/5.0",
     "evaluation_criteria": "职业礼仪、形象、态度的综合评估",
     "pos_section_mapping": "values_items"},
    {"metric_name": "知识分享与传承", "dimension": "学习与成长", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "次/年", "target_template": ">=2",
     "evaluation_criteria": "年度知识分享/培训/带教次数",
     "pos_section_mapping": "development_goals"},
    {"metric_name": "数字化工具应用", "dimension": "学习与成长", "applicable_level": "岗位级",
     "industries": [], "default_weight": 5, "unit": "分", "target_template": "达标",
     "evaluation_criteria": "数字化办公工具使用熟练度和效率",
     "pos_section_mapping": "competency_items"},
]

# ═══════════════════════════════════════════════════════════════
# 3. 行业指标模板 — 每行业 ~95 个
# ═══════════════════════════════════════════════════════════════

# Helper to generate metrics with industry preset
def _m(name, dimension, level, weight=10, unit="", target="", criteria="",
        org_dim=None, pos_sec=None, tags=None):
    """Shorthand for creating a metric template dict.

    org_dim: maps to org_dimension_mapping (Org_Performance dimensions)
             valid values: strategic_kpis, management_indicators, team_development, engagement_compliance
    pos_sec: maps to pos_section_mapping (Position_Performance sections)
             valid values: performance_goals, competency_items, values_items, development_goals

    For convenience, if org_dim is passed with a pos_section value (e.g. performance_goals),
    and the level is 岗位级, it will be auto-redirected to pos_section_mapping.
    """
    ORG_DIMS = {"strategic_kpis", "management_indicators", "team_development", "engagement_compliance"}
    POS_SECS = {"performance_goals", "competency_items", "values_items", "development_goals"}

    d = {
        "metric_name": name, "dimension": dimension, "applicable_level": level,
        "default_weight": weight, "unit": unit, "target_template": target,
        "evaluation_criteria": criteria, "source": "best_practice", "is_verified": True,
    }
    if org_dim:
        if org_dim in POS_SECS:
            # Position section value passed as org_dim — auto-correct to pos_section_mapping
            d["pos_section_mapping"] = org_dim
        elif org_dim in ORG_DIMS:
            d["org_dimension_mapping"] = org_dim
        else:
            # Unknown value — try to assign based on level
            if level == "岗位级":
                d["pos_section_mapping"] = org_dim
            else:
                d["org_dimension_mapping"] = org_dim
    if pos_sec:
        d["pos_section_mapping"] = pos_sec
    if tags:
        d["tags"] = tags
    return d


# ─────────────────────────────────────────────────────────────
# 3.1 建筑工程行业 (~95)
# ─────────────────────────────────────────────────────────────
CONSTRUCTION_METRICS = [
    # 组织级 (~20)
    _m("合同签约额", "财务", "组织级", 15, "万元", ">=年度目标",
       "年度实际签约合同总额 / 目标签约额 * 100%", "strategic_kpis"),
    _m("工程结算收入", "财务", "组织级", 12, "万元", ">=年度目标",
       "已结算工程收入 / 目标结算收入 * 100%", "strategic_kpis"),
    _m("应收账款回收率", "财务", "组织级", 10, "%", ">=85%",
       "已回收应收款 / 应收账款总额 * 100%", "strategic_kpis"),
    _m("项目毛利率", "财务", "组织级", 10, "%", ">=12%",
       "(工程收入 - 工程成本) / 工程收入 * 100%", "strategic_kpis"),
    _m("工程合格率", "运营", "组织级", 12, "%", "100%",
       "质量验收合格工程数 / 总验收工程数 * 100%", "management_indicators"),
    _m("工程进度偏差率", "运营", "组织级", 10, "%", "<=5%",
       "|实际进度 - 计划进度| / 计划进度 * 100%", "management_indicators"),
    _m("安全事故零发生天数", "运营", "组织级", 10, "天", ">=300天",
       "连续无安全事故的天数", "engagement_compliance"),
    _m("安全事故率", "运营", "组织级", 10, "次/百万工时", "0",
       "安全事故次数 / 总工时(百万)", "engagement_compliance"),
    _m("客户投诉率", "客户", "组织级", 8, "%", "<=2%",
       "客户投诉项目数 / 总项目数 * 100%", "management_indicators"),
    _m("业主满意度", "客户", "组织级", 8, "分", ">=85/100",
       "业主满意度调查问卷得分", "strategic_kpis"),
    _m("新市场开拓项目数", "战略", "组织级", 8, "个", ">=3",
       "成功进入新区域/新领域项目数", "strategic_kpis"),
    _m("资质升级完成", "战略", "组织级", 8, "项", "按计划完成",
       "企业资质升级计划完成情况", "strategic_kpis"),
    _m("一级建造师通过率", "人才发展", "组织级", 8, "%", ">=30%",
       "通过一级建造师考试人数 / 参加考试人数 * 100%", "team_development"),
    _m("关键岗位人才储备率", "人才发展", "组织级", 8, "%", ">=70%",
       "有继任者的关键岗位 / 总关键岗位 * 100%", "team_development"),
    _m("劳务分包合规率", "运营", "组织级", 8, "%", "100%",
       "合规分包项目数 / 总分包项目数 * 100%", "engagement_compliance"),
    _m("材料损耗率", "运营", "组织级", 8, "%", "<=3%",
       "材料损耗金额 / 材料总金额 * 100%", "management_indicators"),
    _m("竣工资料归档率", "运营", "组织级", 5, "%", "100%",
       "按时归档竣工资料的项目数 / 总竣工项目数 * 100%", "engagement_compliance"),
    _m("安全生产投入率", "运营", "组织级", 5, "%", ">=2%",
       "安全投入金额 / 工程合同额 * 100%", "engagement_compliance"),
    _m("绿色施工达标率", "内部流程", "组织级", 5, "%", ">=80%",
       "绿色施工达标项目 / 总在建项目 * 100%", "management_indicators"),
    _m("BIM技术应用率", "学习与成长", "组织级", 5, "%", ">=60%",
       "应用BIM技术项目数 / 总项目数 * 100%", "team_development"),

    # 部门级 (~35)
    _m("部门合同额", "财务", "部门级", 15, "万元", ">=部门目标",
       "部门实际签约合同额 / 目标合同额 * 100%", "management_indicators"),
    _m("部门预算执行率", "财务", "部门级", 10, "%", "90%-110%",
       "部门实际支出 / 预算 * 100%", "management_indicators"),
    _m("项目按期交付率", "运营", "部门级", 12, "%", ">=85%",
       "按期交付项目数 / 部门总项目数 * 100%", "management_indicators"),
    _m("施工计划完成率", "运营", "部门级", 10, "%", ">=90%",
       "完成施工节点数 / 计划施工节点数 * 100%", "management_indicators"),
    _m("质量一次验收通过率", "运营", "部门级", 10, "%", ">=90%",
       "一次验收通过次数 / 总验收次数 * 100%", "management_indicators"),
    _m("安全事故次数", "运营", "部门级", 10, "次", "0",
       "部门管辖项目年度安全事故总次数", "engagement_compliance"),
    _m("安全隐患整改率", "运营", "部门级", 8, "%", "100%",
       "已整改隐患数 / 发现隐患数 * 100%", "engagement_compliance"),
    _m("成本偏差率", "财务", "部门级", 10, "%", "<=5%",
       "|实际成本 - 预算成本| / 预算成本 * 100%", "management_indicators"),
    _m("变更索赔金额", "财务", "部门级", 8, "万元", ">=目标",
       "年度变更索赔确认金额", "management_indicators"),
    _m("分包管理合规率", "运营", "部门级", 8, "%", "100%",
       "合规分包项目数 / 部门分包项目总数 * 100%", "engagement_compliance"),
    _m("技术方案评审通过率", "内部流程", "部门级", 8, "%", ">=95%",
       "一次通过评审的方案数 / 总提交方案数 * 100%", "management_indicators"),
    _m("部门培训计划完成率", "学习与成长", "部门级", 5, "%", ">=90%",
       "已完成培训课时 / 部门计划培训课时 * 100%", "team_development"),
    _m("部门员工流失率", "人才发展", "部门级", 8, "%", "<=12%",
       "部门主动离职人数 / 部门平均人数 * 100%", "team_development"),
    _m("创优创奖项目数", "战略", "部门级", 8, "个", ">=2",
       "获得市级以上工程奖项项目数", "management_indicators"),
    _m("客户回访满意度", "客户", "部门级", 8, "分", ">=80/100",
       "客户回访满意度评分", "management_indicators"),
    _m("供应商评价合格率", "内部流程", "部门级", 5, "%", ">=90%",
       "评价合格供应商数 / 总评价供应商数 * 100%", "management_indicators"),

    # 岗位级 (~40)
    # 项目经理
    _m("项目进度控制", "运营", "岗位级", 15, "%", "偏差<=5%",
       "项目实际进度与计划进度的偏差率", "performance_goals", tags=["项目经理"]),
    _m("项目成本控制", "财务", "岗位级", 15, "%", "偏差<=5%",
       "项目实际成本与预算成本的偏差率", "performance_goals", tags=["项目经理"]),
    _m("项目质量合格率", "运营", "岗位级", 12, "%", "100%",
       "项目质量验收合格率", "performance_goals", tags=["项目经理"]),
    _m("客户满意度", "客户", "岗位级", 10, "分", ">=85/100",
       "业主/客户对项目满意度评分", "performance_goals", tags=["项目经理"]),
    _m("安全管理", "运营", "岗位级", 10, "次", "0事故",
       "项目安全事故次数", "performance_goals", tags=["项目经理"]),
    _m("团队管理能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "团队建设、人员调配和激励效果", "competency_items", tags=["项目经理"]),
    _m("沟通协调能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与业主、监理、分包的沟通协调效果", "competency_items", tags=["项目经理"]),
    _m("风险预判与应对", "胜任力", "岗位级", 7, "分", ">=4.0/5.0",
       "项目风险识别、预警和应对能力", "competency_items", tags=["项目经理"]),
    _m("合同管理能力", "胜任力", "岗位级", 7, "分", ">=4.0/5.0",
       "合同履约管理、变更索赔处理能力", "competency_items", tags=["项目经理"]),
    _m("一级建造师取证", "学习与成长", "岗位级", 5, "项", "通过",
       "年度内一级建造师考试通过情况", "development_goals", tags=["项目经理"]),
    # 招投标专员
    _m("投标文件编制及时率", "运营", "岗位级", 15, "%", "100%",
       "按时提交投标文件数 / 总投标项目数 * 100%", "performance_goals", tags=["招投标"]),
    _m("废标率", "运营", "岗位级", 12, "%", "0%",
       "废标项目数 / 总投标项目数 * 100%", "performance_goals", tags=["招投标"]),
    _m("中标率", "财务", "岗位级", 15, "%", ">=30%",
       "中标项目数 / 总投标项目数 * 100%", "performance_goals", tags=["招投标"]),
    _m("投标成本控制率", "财务", "岗位级", 10, "%", "<=预算",
       "投标实际成本 / 投标预算 * 100%", "performance_goals", tags=["招投标"]),
    _m("标书质量合格率", "内部流程", "岗位级", 10, "%", ">=95%",
       "标书一次评审通过率", "performance_goals", tags=["招投标"]),
    # 造价工程师
    _m("预算编制准确率", "财务", "岗位级", 15, "%", "偏差<=3%",
       "预算与结算的偏差率", "performance_goals", tags=["造价"]),
    _m("结算审核完成率", "运营", "岗位级", 12, "%", ">=90%",
       "按时完成结算审核数 / 总结算数 * 100%", "performance_goals", tags=["造价"]),
    _m("变更索赔确认率", "财务", "岗位级", 12, "%", ">=80%",
       "已确认变更索赔金额 / 提报金额 * 100%", "performance_goals", tags=["造价"]),
    _m("造价数据积累", "学习与成长", "岗位级", 8, "项", ">=10项/年",
       "年度积累的造价分析数据条目数", "development_goals", tags=["造价"]),
    # 安全员
    _m("安全培训覆盖率", "运营", "岗位级", 15, "%", "100%",
       "接受安全培训人数 / 应培训人数 * 100%", "performance_goals", tags=["安全"]),
    _m("隐患排查整改率", "运营", "岗位级", 15, "%", "100%",
       "已整改隐患 / 发现隐患 * 100%", "performance_goals", tags=["安全"]),
    _m("安全检查频次达标率", "运营", "岗位级", 10, "%", ">=95%",
       "实际检查次数 / 计划检查次数 * 100%", "performance_goals", tags=["安全"]),
    _m("安全事故响应时间", "运营", "岗位级", 10, "分钟", "<=30分钟",
       "安全事故发生后到启动应急预案的时间", "performance_goals", tags=["安全"]),
    # 资料员
    _m("竣工资料完整率", "运营", "岗位级", 15, "%", "100%",
       "竣工资料齐全项目数 / 总竣工项目数 * 100%", "performance_goals", tags=["资料"]),
    _m("资料归档及时率", "运营", "岗位级", 12, "%", ">=95%",
       "按时归档资料数 / 应归档资料数 * 100%", "performance_goals", tags=["资料"]),
    _m("资料与实际一致性", "内部流程", "岗位级", 10, "%", "100%",
       "资料审核一次通过率", "performance_goals", tags=["资料"]),
    # 施工员
    _m("施工工序合格率", "运营", "岗位级", 15, "%", ">=95%",
       "施工工序一次验收合格率", "performance_goals", tags=["施工员"]),
    _m("施工日志完整率", "内部流程", "岗位级", 10, "%", "100%",
       "施工日志按时填写完整率", "performance_goals", tags=["施工员"]),
    _m("材料使用合规率", "运营", "岗位级", 10, "%", "100%",
       "按图纸和规范使用材料的比例", "performance_goals", tags=["施工员"]),
    # 技术负责人
    _m("技术方案编制质量", "胜任力", "岗位级", 15, "分", ">=4.0/5.0",
       "施工组织设计/专项方案评审通过率", "performance_goals", tags=["技术负责人"]),
    _m("技术交底执行率", "运营", "岗位级", 10, "%", "100%",
       "完成技术交底工序 / 总工序 * 100%", "performance_goals", tags=["技术负责人"]),
    _m("科技创新成果", "学习与成长", "岗位级", 8, "项", ">=2",
       "年度工法/专利/QC成果数", "development_goals", tags=["技术负责人"]),
    _m("BIM应用深度", "学习与成长", "岗位级", 8, "分", "达标",
       "BIM技术在项目的应用深度评估", "competency_items", tags=["技术负责人"]),
    # 材料员
    _m("材料进场合格率", "运营", "岗位级", 15, "%", "100%",
       "进场材料检验合格率", "performance_goals", tags=["材料员"]),
    _m("材料台账准确率", "内部流程", "岗位级", 12, "%", ">=98%",
       "材料台账账实相符率", "performance_goals", tags=["材料员"]),
    _m("材料成本控制", "财务", "岗位级", 10, "%", "偏差<=3%",
       "实际材料成本与预算偏差率", "performance_goals", tags=["材料员"]),
    # 劳务管理员
    _m("劳务实名制覆盖率", "运营", "岗位级", 15, "%", "100%",
       "实名制登记劳务人员 / 总劳务人员 * 100%", "performance_goals", tags=["劳务管理"]),
    _m("劳务工资发放合规率", "内部流程", "岗位级", 15, "%", "100%",
       "按时足额发放工资次数 / 总发放次数 * 100%", "performance_goals", tags=["劳务管理"]),
    _m("劳务纠纷处置率", "运营", "岗位级", 10, "%", "100%",
       "已处置劳务纠纷 / 总劳务纠纷 * 100%", "performance_goals", tags=["劳务管理"]),
    # 合同管理员
    _m("合同评审及时率", "运营", "岗位级", 12, "%", "100%",
       "按时完成合同评审数 / 总合同数 * 100%", "performance_goals", tags=["合同管理"]),
    _m("合同履约跟踪完整率", "内部流程", "岗位级", 12, "%", ">=95%",
       "完整跟踪合同履约情况比例", "performance_goals", tags=["合同管理"]),
    _m("合同档案管理", "内部流程", "岗位级", 8, "分", "达标",
       "合同档案完整性、及时性评估", "competency_items", tags=["合同管理"]),
    # 财务(项目)
    _m("项目资金计划准确率", "财务", "岗位级", 15, "%", ">=90%",
       "实际资金使用与计划偏差率", "performance_goals", tags=["项目财务"]),
    _m("税务合规率", "内部流程", "岗位级", 12, "%", "100%",
       "税务申报和缴纳合规率", "performance_goals", tags=["项目财务"]),
    _m("成本核算及时率", "运营", "岗位级", 10, "%", "100%",
       "按时完成成本核算比例", "performance_goals", tags=["项目财务"]),
]

# ─────────────────────────────────────────────────────────────
# 3.2 消费品行业 (~95)
# ─────────────────────────────────────────────────────────────
CONSUMER_METRICS = [
    # 组织级 (~20)
    _m("营业收入增长率", "财务", "组织级", 15, "%", ">=10%",
       "本年度营业收入 / 上年度营业收入 - 1", "strategic_kpis"),
    _m("毛利率", "财务", "组织级", 12, "%", ">=35%",
       "(营业收入 - 营业成本) / 营业收入 * 100%", "strategic_kpis"),
    _m("市场份额变化", "战略", "组织级", 10, "%", "同比增长",
       "本年度市场份额 vs 上年度市场份额", "strategic_kpis"),
    _m("品牌知名度提升率", "客户", "组织级", 10, "%", ">=5%",
       "品牌认知度调查同比提升", "strategic_kpis"),
    _m("品牌健康度评分", "客户", "组织级", 8, "分", ">=80/100",
       "品牌资产评估综合得分", "strategic_kpis"),
    _m("新品上市成功率", "战略", "组织级", 10, "%", ">=50%",
       "成功新品数(存活>6月) / 总上市新品数 * 100%", "strategic_kpis"),
    _m("会员数增长率", "客户", "组织级", 8, "%", ">=20%",
       "本年度会员数 / 上年度会员数 - 1", "strategic_kpis"),
    _m("NPS净推荐值", "客户", "组织级", 8, "分", ">=50",
       "净推荐值 = 推荐者% - 贬损者%", "strategic_kpis"),
    _m("渠道销售额达成率", "运营", "组织级", 10, "%", ">=95%",
       "实际渠道销售额 / 目标销售额 * 100%", "management_indicators"),
    _m("线上GMV占比", "运营", "组织级", 8, "%", ">=30%",
       "线上销售额 / 总销售额 * 100%", "management_indicators"),
    _m("库存周转天数", "运营", "组织级", 10, "天", "<=60天",
       "平均库存 / 日均销售成本", "management_indicators"),
    _m("退货率", "运营", "组织级", 8, "%", "<=3%",
       "退货金额 / 销售金额 * 100%", "management_indicators"),
    _m("客诉响应时效", "客户", "组织级", 8, "小时", "<=24h",
       "客户投诉首次响应平均时间", "management_indicators"),
    _m("复购率", "客户", "组织级", 8, "%", ">=40%",
       "复购客户数 / 总购买客户数 * 100%", "management_indicators"),
    _m("员工人均培训时长", "学习与成长", "组织级", 5, "小时", ">=40",
       "全员年度人均培训课时", "team_development"),
    _m("关键岗位继任率", "人才发展", "组织级", 8, "%", ">=60%",
       "有继任者关键岗位 / 总关键岗位 * 100%", "team_development"),
    _m("管培生转正率", "人才发展", "组织级", 5, "%", ">=85%",
       "通过试用期管培生 / 入职管培生 * 100%", "team_development"),
    _m("供应链准时交付率", "运营", "组织级", 8, "%", ">=95%",
       "供应商准时交付订单数 / 总订单数 * 100%", "management_indicators"),
    _m("采购成本优化率", "财务", "组织级", 8, "%", ">=5%",
       "(上年度采购成本 - 本年度采购成本) / 上年度采购成本 * 100%", "management_indicators"),
    _m("合规审计通过率", "内部流程", "组织级", 5, "%", "100%",
       "内部/外部审计无重大发现", "engagement_compliance"),

    # 部门级 (~35)
    _m("部门销售额达成率", "财务", "部门级", 15, "%", ">=100%",
       "部门实际销售额 / 目标销售额 * 100%", "management_indicators"),
    _m("部门毛利率", "财务", "部门级", 10, "%", ">=目标",
       "部门毛利 / 部门销售额 * 100%", "management_indicators"),
    _m("新品上架率", "战略", "部门级", 8, "%", ">=80%",
       "按时上架新品数 / 计划上架新品数 * 100%", "management_indicators"),
    _m("渠道拓展完成率", "战略", "部门级", 8, "%", ">=90%",
       "实际拓展渠道数 / 目标拓展渠道数 * 100%", "management_indicators"),
    _m("库存周转天数", "运营", "部门级", 10, "天", "<=45天",
       "部门平均库存 / 部门日均销售成本", "management_indicators"),
    _m("缺货率", "运营", "部门级", 8, "%", "<=2%",
       "缺货SKU数 / 总SKU数 * 100%", "management_indicators"),
    _m("渠道冲突处理时效", "内部流程", "部门级", 8, "天", "<=7天",
       "渠道冲突从发现到解决的平均时间", "management_indicators"),
    _m("经销商满意度", "客户", "部门级", 8, "分", ">=80/100",
       "经销商满意度调查得分", "management_indicators"),
    _m("促销活动ROI", "财务", "部门级", 10, "倍", ">=3倍",
       "促销活动增量销售额 / 促销投入金额", "management_indicators"),
    _m("营销费用率", "财务", "部门级", 8, "%", "<=15%",
       "营销费用 / 销售额 * 100%", "management_indicators"),
    _m("品牌曝光量", "客户", "部门级", 8, "万次", ">=目标",
       "品牌全渠道曝光总量", "management_indicators"),
    _m("会员活跃度", "客户", "部门级", 8, "%", ">=30%",
       "活跃会员数 / 总会员数 * 100%", "management_indicators"),
    _m("部门员工培训时长", "学习与成长", "部门级", 5, "小时/人", ">=40",
       "部门人均年度培训课时", "team_development"),
    _m("部门员工满意度", "人才发展", "部门级", 5, "分", ">=4.0/5.0",
       "部门满意度调查得分", "team_development"),
    _m("产品投诉处理时效", "客户", "部门级", 8, "小时", "<=48h",
       "产品投诉平均处理时间", "management_indicators"),
    _m("供应商交付准时率", "运营", "部门级", 8, "%", ">=95%",
       "准时交付订单 / 总订单 * 100%", "management_indicators"),

    # 岗位级 (~40)
    # 品牌经理
    _m("品牌知名度提升", "客户", "岗位级", 15, "%", ">=5%",
       "品牌认知度调查同比提升", "performance_goals", tags=["品牌经理"]),
    _m("市场份额增长", "战略", "岗位级", 15, "%", ">=3%",
       "品牌市场份额年度增长", "performance_goals", tags=["品牌经理"]),
    _m("品牌健康度评分", "客户", "岗位级", 12, "分", ">=80/100",
       "品牌资产评估综合得分", "performance_goals", tags=["品牌经理"]),
    _m("新品上市成功率", "战略", "岗位级", 10, "%", ">=50%",
       "成功新品数 / 总上市新品数 * 100%", "performance_goals", tags=["品牌经理"]),
    _m("品牌策略制定能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "品牌战略规划的质量和执行效果", "competency_items", tags=["品牌经理"]),
    _m("跨部门协同能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与研发、销售、渠道等部门的协作效果", "competency_items", tags=["品牌经理"]),
    _m("市场洞察力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "市场趋势分析和消费者洞察的准确性", "competency_items", tags=["品牌经理"]),
    # 渠道经理
    _m("渠道拓展完成率", "战略", "岗位级", 15, "%", ">=90%",
       "实际拓展渠道 / 目标渠道 * 100%", "performance_goals", tags=["渠道经理"]),
    _m("渠道销售额达成率", "财务", "岗位级", 15, "%", ">=100%",
       "渠道实际销售额 / 目标销售额 * 100%", "performance_goals", tags=["渠道经理"]),
    _m("经销商满意度", "客户", "岗位级", 10, "分", ">=80/100",
       "经销商满意度调查得分", "performance_goals", tags=["渠道经理"]),
    _m("渠道冲突处理时效", "内部流程", "岗位级", 10, "天", "<=7天",
       "渠道冲突解决平均时间", "performance_goals", tags=["渠道经理"]),
    # 产品经理
    _m("新品开发周期", "运营", "岗位级", 12, "天", "<=180天",
       "从概念到上市的平均开发周期", "performance_goals", tags=["产品经理"]),
    _m("上市成功率", "战略", "岗位级", 12, "%", ">=50%",
       "成功新品数 / 总上市新品数 * 100%", "performance_goals", tags=["产品经理"]),
    _m("产品毛利率", "财务", "岗位级", 12, "%", ">=35%",
       "产品毛利 / 产品销售额 * 100%", "performance_goals", tags=["产品经理"]),
    _m("退货率/客诉率", "运营", "岗位级", 10, "%", "<=3%",
       "产品退货金额 / 销售金额 * 100%", "performance_goals", tags=["产品经理"]),
    # 电商运营
    _m("GMV达成率", "财务", "岗位级", 15, "%", ">=100%",
       "实际GMV / 目标GMV * 100%", "performance_goals", tags=["电商运营"]),
    _m("转化率", "运营", "岗位级", 12, "%", ">=3%",
       "订单数 / 访客数 * 100%", "performance_goals", tags=["电商运营"]),
    _m("客单价", "财务", "岗位级", 10, "元", ">=目标",
       "平均每笔订单金额", "performance_goals", tags=["电商运营"]),
    _m("复购率", "客户", "岗位级", 10, "%", ">=40%",
       "复购客户数 / 总客户数 * 100%", "performance_goals", tags=["电商运营"]),
    _m("ROI", "财务", "岗位级", 10, "倍", ">=3倍",
       "投入产出比", "performance_goals", tags=["电商运营"]),
    # 供应链经理
    _m("库存周转率", "运营", "岗位级", 15, "次", ">=6次/年",
       "年度销售成本 / 平均库存", "performance_goals", tags=["供应链"]),
    _m("缺货率", "运营", "岗位级", 12, "%", "<=2%",
       "缺货SKU数 / 总SKU数 * 100%", "performance_goals", tags=["供应链"]),
    _m("供应商交付准时率", "运营", "岗位级", 12, "%", ">=95%",
       "准时交付订单 / 总订单 * 100%", "performance_goals", tags=["供应链"]),
    _m("采购成本优化率", "财务", "岗位级", 10, "%", ">=5%",
       "同比采购成本降低率", "performance_goals", tags=["供应链"]),
    # 客服主管
    _m("客诉处理时效", "客户", "岗位级", 15, "小时", "<=24h",
       "客户投诉平均首次响应时间", "performance_goals", tags=["客服"]),
    _m("首次解决率", "运营", "岗位级", 12, "%", ">=80%",
       "首次联系即解决的投诉 / 总投诉 * 100%", "performance_goals", tags=["客服"]),
    _m("客户满意度(NPS)", "客户", "岗位级", 12, "分", ">=50",
       "净推荐值", "performance_goals", tags=["客服"]),
    _m("工单积压率", "运营", "岗位级", 10, "%", "<=5%",
       "积压工单数 / 总工单数 * 100%", "performance_goals", tags=["客服"]),
    # 市场研究专员
    _m("市场研究报告质量", "胜任力", "岗位级", 15, "分", ">=4.0/5.0",
       "市场研究报告评审评分", "performance_goals", tags=["市场研究"]),
    _m("消费者洞察准确度", "胜任力", "岗位级", 12, "分", ">=4.0/5.0",
       "消费者调研预测与实际市场表现匹配度", "competency_items", tags=["市场研究"]),
    _m("竞品分析覆盖度", "学习与成长", "岗位级", 8, "分", "达标",
       "竞品分析报告覆盖主要竞品比例", "development_goals", tags=["市场研究"]),
    # 市场推广专员
    _m("活动执行完成率", "运营", "岗位级", 15, "%", ">=95%",
       "按时完成推广活动数 / 计划活动数 * 100%", "performance_goals", tags=["市场推广"]),
    _m("社交媒体增长", "客户", "岗位级", 12, "%", ">=10%/月",
       "社交媒体粉丝/互动月增长率", "performance_goals", tags=["市场推广"]),
    _m("内容产出量", "运营", "岗位级", 10, "篇/月", ">=目标",
       "月均内容产出数量", "performance_goals", tags=["市场推广"]),
    # 零售店长
    _m("门店销售达成率", "财务", "岗位级", 15, "%", ">=100%",
       "门店实际销售额 / 目标销售额 * 100%", "performance_goals", tags=["零售店长"]),
    _m("门店坪效", "财务", "岗位级", 12, "元/㎡", ">=目标",
       "门店销售额 / 门店营业面积", "performance_goals", tags=["零售店长"]),
    _m("门店损耗率", "运营", "岗位级", 10, "%", "<=1%",
       "门店商品损耗金额 / 销售金额 * 100%", "performance_goals", tags=["零售店长"]),
    _m("员工排班优化", "运营", "岗位级", 8, "分", "达标",
       "排班与客流匹配度评估", "competency_items", tags=["零售店长"]),
    # 物流主管
    _m("配送准时率", "运营", "岗位级", 15, "%", ">=98%",
       "准时配送订单数 / 总订单数 * 100%", "performance_goals", tags=["物流"]),
    _m("物流成本率", "财务", "岗位级", 12, "%", "<=8%",
       "物流费用 / 销售额 * 100%", "performance_goals", tags=["物流"]),
    _m("仓库利用率", "运营", "岗位级", 10, "%", ">=80%",
       "实际使用仓储面积 / 总面积 * 100%", "performance_goals", tags=["物流"]),
    _m("配送破损率", "运营", "岗位级", 10, "%", "<=0.5%",
       "破损配送订单 / 总配送订单 * 100%", "performance_goals", tags=["物流"]),
    # 市场总监
    _m("品牌资产增值", "客户", "岗位级", 15, "分", ">=目标",
       "品牌价值评估年度增长", "performance_goals", tags=["市场总监"]),
    _m("市场份额目标", "战略", "岗位级", 12, "%", ">=目标",
       "品牌市场份额变化", "performance_goals", tags=["市场总监"]),
    _m("营销ROI", "财务", "岗位级", 10, "倍", ">=3",
       "营销投入产出比", "performance_goals", tags=["市场总监"]),
    _m("市场团队管理", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "市场团队建设和人才培养效果", "competency_items", tags=["市场总监"]),
    _m("全渠道整合", "战略", "岗位级", 8, "分", "达标",
       "线上线下渠道整合效果评估", "competency_items", tags=["市场总监"]),
    # 销售总监
    _m("区域销售目标达成", "财务", "岗位级", 15, "%", ">=100%",
       "区域实际销售额 / 目标销售额 * 100%", "performance_goals", tags=["销售总监"]),
    _m("渠道管理效果", "运营", "岗位级", 12, "分", ">=4.0/5.0",
       "渠道健康度和增长评估", "performance_goals", tags=["销售总监"]),
    _m("销售团队效能", "运营", "岗位级", 10, "分", "同比提升",
       "销售团队人均产出变化", "performance_goals", tags=["销售总监"]),
    _m("大客户管理", "客户", "岗位级", 8, "分", "达标",
       "大客户关系维护和满意度", "competency_items", tags=["销售总监"]),
    # 电商总监
    _m("平台GMV达成率", "财务", "岗位级", 15, "%", ">=100%",
       "平台实际GMV / 目标GMV * 100%", "performance_goals", tags=["电商总监"]),
    _m("流量获取成本", "财务", "岗位级", 12, "元", "同比下降",
       "获客成本同比变化", "performance_goals", tags=["电商总监"]),
    _m("平台用户增长", "客户", "岗位级", 10, "%", ">=目标",
       "平台月活/注册用户增长率", "performance_goals", tags=["电商总监"]),
    _m("电商团队管理", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "电商团队建设和人员管理效果", "competency_items", tags=["电商总监"]),
    # 新媒体运营
    _m("内容产出质量", "运营", "岗位级", 12, "分", ">=4.0/5.0",
       "内容质量评估得分", "performance_goals", tags=["新媒体"]),
    _m("粉丝增长", "客户", "岗位级", 12, "%", ">=10%/月",
       "社交媒体粉丝月增长率", "performance_goals", tags=["新媒体"]),
    _m("互动率", "运营", "岗位级", 10, "%", ">=目标",
       "内容互动率(点赞+评论+转发)/曝光 * 100%", "performance_goals", tags=["新媒体"]),
    _m("直播/短视频效果", "运营", "岗位级", 10, "分", "达标",
       "直播带货/短视频引流效果", "performance_goals", tags=["新媒体"]),
    # 采购经理
    _m("采购成本优化", "财务", "岗位级", 15, "%", ">=5%",
       "同比采购成本降低率", "performance_goals", tags=["采购经理"]),
    _m("供应商管理", "内部流程", "岗位级", 12, "分", "达标",
       "供应商评估和关系管理效果", "performance_goals", tags=["采购经理"]),
    _m("供应链响应速度", "运营", "岗位级", 10, "天", "<=目标",
       "从需求提出到物料到货的平均周期", "performance_goals", tags=["采购经理"]),
    _m("采购合规率", "内部流程", "岗位级", 8, "%", "100%",
       "采购流程合规检查通过率", "performance_goals", tags=["采购经理"]),
]

# ─────────────────────────────────────────────────────────────
# 3.3 制造业行业 (~95)
# ─────────────────────────────────────────────────────────────
MANUFACTURING_METRICS = [
    # 组织级 (~20)
    _m("产能利用率", "运营", "组织级", 12, "%", ">=85%",
       "实际产出 / 设计产能 * 100%", "management_indicators"),
    _m("设备综合效率(OEE)", "运营", "组织级", 12, "%", ">=75%",
       "可用率 * 性能率 * 良品率", "management_indicators"),
    _m("产品良品率", "运营", "组织级", 12, "%", ">=98%",
       "合格品数量 / 总生产数量 * 100%", "management_indicators"),
    _m("单位产品制造成本", "财务", "组织级", 10, "元/件", "同比下降",
       "总制造成本 / 合格品数量", "management_indicators"),
    _m("制造周期", "运营", "组织级", 10, "天", "同比缩短",
       "从下单到交付的平均周期", "management_indicators"),
    _m("库存周转率", "运营", "组织级", 10, "次/年", ">=8",
       "年度销售成本 / 平均库存", "management_indicators"),
    _m("准时交付率(OTD)", "客户", "组织级", 10, "%", ">=95%",
       "准时交付订单数 / 总订单数 * 100%", "strategic_kpis"),
    _m("安全事故率", "运营", "组织级", 10, "次/百万工时", "0",
       "安全事故次数 / 总工时(百万)", "engagement_compliance"),
    _m("能耗降低率", "内部流程", "组织级", 8, "%", ">=5%",
       "单位产品能耗同比降低率", "engagement_compliance"),
    _m("环保合规率", "内部流程", "组织级", 8, "%", "100%",
       "环保检测达标次数 / 总检测次数 * 100%", "engagement_compliance"),
    _m("新产品研发周期", "战略", "组织级", 8, "月", "同比缩短",
       "从立项到量产的平均周期", "strategic_kpis"),
    _m("专利申请/授权数", "学习与成长", "组织级", 5, "件", ">=目标",
       "年度专利申请和授权数量", "team_development"),
    _m("员工技能认证通过率", "学习与成长", "组织级", 5, "%", ">=85%",
       "通过技能认证人数 / 参加认证人数 * 100%", "team_development"),
    _m("营业收入达成率", "财务", "组织级", 12, "%", ">=100%",
       "实际营业收入 / 目标营业收入 * 100%", "strategic_kpis"),
    _m("出口额达成率", "财务", "组织级", 8, "%", ">=100%",
       "实际出口额 / 目标出口额 * 100%", "strategic_kpis"),
    _m("客户退货率", "客户", "组织级", 8, "%", "<=1%",
       "退货数量 / 交付数量 * 100%", "management_indicators"),
    _m("质量事故次数", "运营", "组织级", 10, "次", "0",
       "重大质量事故次数", "engagement_compliance"),
    _m("供应商合格率", "内部流程", "组织级", 5, "%", ">=95%",
       "合格供应商数 / 总供应商数 * 100%", "management_indicators"),
    _m("员工满意度", "人才发展", "组织级", 5, "分", ">=4.0/5.0",
       "全员满意度调查得分", "team_development"),

    # 部门级 (~35)
    _m("车间OEE", "运营", "部门级", 15, "%", ">=75%",
       "车间设备综合效率", "management_indicators"),
    _m("车间良品率", "运营", "部门级", 12, "%", ">=98%",
       "车间合格品数量 / 总生产数量 * 100%", "management_indicators"),
    _m("生产计划完成率", "运营", "部门级", 12, "%", ">=95%",
       "按计划完成的生产批次数 / 总批次 * 100%", "management_indicators"),
    _m("设备故障停机率", "运营", "部门级", 10, "%", "<=3%",
       "设备故障停机时间 / 总计划时间 * 100%", "management_indicators"),
    _m("物料损耗率", "财务", "部门级", 10, "%", "<=2%",
       "物料损耗金额 / 物料总金额 * 100%", "management_indicators"),
    _m("部门安全事故次数", "运营", "部门级", 10, "次", "0",
       "部门年度安全事故次数", "engagement_compliance"),
    _m("5S管理达标率", "内部流程", "部门级", 8, "%", ">=90%",
       "5S检查达标项 / 总检查项 * 100%", "management_indicators"),
    _m("精益改善提案数", "学习与成长", "部门级", 8, "件", "人均>=1",
       "部门员工提交的改善提案数", "team_development"),
    _m("在制品库存周转", "运营", "部门级", 8, "天", "同比缩短",
       "在制品平均库存天数", "management_indicators"),
    _m("换线时间", "运营", "部门级", 8, "分钟", "同比缩短",
       "产品切换平均时间", "management_indicators"),
    _m("工艺改进项目完成数", "学习与成长", "部门级", 5, "个", ">=3",
       "完成的工艺改进项目数", "team_development"),
    _m("部门成本节约额", "财务", "部门级", 8, "万元", ">=目标",
       "部门成本节约金额", "management_indicators"),

    # 岗位级 (~40)
    # 生产主管
    _m("班次产量达成率", "运营", "岗位级", 15, "%", ">=95%",
       "实际产量 / 计划产量 * 100%", "performance_goals", tags=["生产主管"]),
    _m("班组良品率", "运营", "岗位级", 12, "%", ">=98%",
       "班组合格品数 / 总生产数 * 100%", "performance_goals", tags=["生产主管"]),
    _m("安全事故次数", "运营", "岗位级", 10, "次", "0",
       "班组安全事故次数", "performance_goals", tags=["生产主管"]),
    _m("班组员工技能提升", "学习与成长", "岗位级", 8, "分", "达标",
       "班组员工技能矩阵覆盖率", "performance_goals", tags=["生产主管"]),
    _m("现场管理能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "5S/精益生产现场管理能力", "competency_items", tags=["生产主管"]),
    _m("团队管理能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "班组人员管理和激励效果", "competency_items", tags=["生产主管"]),
    # 质量工程师
    _m("质量检验及时率", "运营", "岗位级", 15, "%", ">=95%",
       "按时完成检验批次 / 总批次 * 100%", "performance_goals", tags=["质量工程师"]),
    _m("质量异常处理时效", "运营", "岗位级", 12, "小时", "<=4h",
       "质量异常发现到处理的平均时间", "performance_goals", tags=["质量工程师"]),
    _m("供应商质量审核完成率", "内部流程", "岗位级", 10, "%", "100%",
       "完成审核供应商数 / 计划审核数 * 100%", "performance_goals", tags=["质量工程师"]),
    _m("质量改进项目完成数", "学习与成长", "岗位级", 8, "个", ">=4",
       "年度完成的质量改进项目", "development_goals", tags=["质量工程师"]),
    # 设备工程师
    _m("设备故障率", "运营", "岗位级", 15, "%", "<=3%",
       "设备故障停机时间 / 总计划时间 * 100%", "performance_goals", tags=["设备工程师"]),
    _m("预防性维护完成率", "运营", "岗位级", 12, "%", ">=95%",
       "完成预防维护次数 / 计划次数 * 100%", "performance_goals", tags=["设备工程师"]),
    _m("设备维修响应时间", "运营", "岗位级", 10, "分钟", "<=30",
       "故障报修到开始维修的平均时间", "performance_goals", tags=["设备工程师"]),
    _m("备件库存准确率", "运营", "岗位级", 8, "%", ">=95%",
       "账实相符备件数 / 总备件数 * 100%", "performance_goals", tags=["设备工程师"]),
    # 采购专员
    _m("采购及时率", "运营", "岗位级", 15, "%", ">=95%",
       "按时交付采购订单数 / 总订单数 * 100%", "performance_goals", tags=["采购"]),
    _m("采购降本率", "财务", "岗位级", 12, "%", ">=5%",
       "同比采购成本降低率", "performance_goals", tags=["采购"]),
    _m("供应商开发数", "战略", "岗位级", 8, "个", ">=3",
       "年度新开发合格供应商数", "performance_goals", tags=["采购"]),
    _m("采购质量合格率", "运营", "岗位级", 10, "%", ">=98%",
       "来料检验合格批次 / 总批次 * 100%", "performance_goals", tags=["采购"]),
    # 仓储主管
    _m("库存准确率", "运营", "岗位级", 15, "%", ">=99%",
       "账实相符物料数 / 总物料数 * 100%", "performance_goals", tags=["仓储"]),
    _m("仓库作业效率", "运营", "岗位级", 12, "%", "同比提升",
       "单位时间出入库操作量", "performance_goals", tags=["仓储"]),
    _m("呆滞库存占比", "财务", "岗位级", 10, "%", "<=5%",
       "呆滞库存金额 / 总库存金额 * 100%", "performance_goals", tags=["仓储"]),
    _m("仓库安全事故次数", "运营", "岗位级", 8, "次", "0",
       "仓库安全事故次数", "performance_goals", tags=["仓储"]),
    # 计划员
    _m("生产计划准确率", "运营", "岗位级", 15, "%", ">=90%",
       "生产计划与实际需求偏差率", "performance_goals", tags=["计划员"]),
    _m("物料齐套率", "运营", "岗位级", 12, "%", ">=95%",
       "物料按时齐套批次数 / 总批次 * 100%", "performance_goals", tags=["计划员"]),
    _m("呆滞物料预警及时率", "财务", "岗位级", 10, "%", ">=90%",
       "及时预警呆滞物料比例", "performance_goals", tags=["计划员"]),
    # IE工程师
    _m("工时定额准确率", "运营", "岗位级", 15, "%", "偏差<=5%",
       "实际工时与定额偏差率", "performance_goals", tags=["IE工程师"]),
    _m("产线平衡率", "运营", "岗位级", 12, "%", ">=85%",
       "产线各工位负荷均衡度", "performance_goals", tags=["IE工程师"]),
    _m("精益项目完成数", "学习与成长", "岗位级", 10, "个", ">=3",
       "年度完成精益改善项目数", "development_goals", tags=["IE工程师"]),
    _m("工艺优化效果", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "工艺优化带来的效率提升评估", "competency_items", tags=["IE工程师"]),
    # 生产计划主管
    _m("主生产计划达成率", "运营", "岗位级", 15, "%", ">=95%",
       "MPS按时完成率", "performance_goals", tags=["生产计划主管"]),
    _m("产能利用率", "运营", "岗位级", 12, "%", ">=85%",
       "实际产出 / 设计产能 * 100%", "performance_goals", tags=["生产计划主管"]),
    _m("订单交付准时率", "客户", "岗位级", 10, "%", ">=95%",
       "按时交付订单 / 总订单 * 100%", "performance_goals", tags=["生产计划主管"]),
    _m("生产异常响应时效", "运营", "岗位级", 8, "分钟", "<=30",
       "生产异常发现到处理时间", "performance_goals", tags=["生产计划主管"]),
    # EHS经理
    _m("EHS管理体系运行", "内部流程", "岗位级", 15, "分", "达标",
       "ISO45001/ISO14001体系运行有效性", "performance_goals", tags=["EHS经理"]),
    _m("安全培训覆盖率", "运营", "岗位级", 12, "%", "100%",
       "接受安全培训人数 / 应培训人数 * 100%", "performance_goals", tags=["EHS经理"]),
    _m("环保指标达标率", "内部流程", "岗位级", 12, "%", "100%",
       "废水/废气/固废排放达标率", "performance_goals", tags=["EHS经理"]),
    _m("应急预案演练完成率", "运营", "岗位级", 8, "%", "100%",
       "按时完成应急演练次数 / 计划次数 * 100%", "performance_goals", tags=["EHS经理"]),
    # 质量经理
    _m("质量体系运行有效性", "内部流程", "岗位级", 15, "分", "达标",
       "ISO9001体系审核通过情况", "performance_goals", tags=["质量经理"]),
    _m("客户投诉处理率", "客户", "岗位级", 12, "%", "100%",
       "已处理客户投诉 / 总投诉 * 100%", "performance_goals", tags=["质量经理"]),
    _m("质量改进效果", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "8D/六西格玛项目带来的质量提升", "competency_items", tags=["质量经理"]),
    _m("质量成本控制", "财务", "岗位级", 10, "%", "同比下降",
       "质量成本(预防+鉴定+内/外失败)占总成本比例", "performance_goals", tags=["质量经理"]),
    # 生产总监
    _m("全厂产能利用率", "运营", "岗位级", 15, "%", ">=85%",
       "全厂实际产出 / 设计产能 * 100%", "performance_goals", tags=["生产总监"]),
    _m("全厂OEE", "运营", "岗位级", 12, "%", ">=75%",
       "全厂设备综合效率", "performance_goals", tags=["生产总监"]),
    _m("制造成本降低", "财务", "岗位级", 12, "%", ">=5%",
       "单位产品制造成本同比降低率", "performance_goals", tags=["生产总监"]),
    _m("生产安全管理", "运营", "岗位级", 10, "分", "0事故",
       "全厂安全事故次数", "performance_goals", tags=["生产总监"]),
    _m("精益生产推进", "学习与成长", "岗位级", 8, "分", "达标",
       "精益生产项目推进效果评估", "competency_items", tags=["生产总监"]),
    # 研发工程师(制造)
    _m("新品开发按时完成率", "运营", "岗位级", 15, "%", ">=80%",
       "按时完成开发新品数 / 计划新品数 * 100%", "performance_goals", tags=["研发工程师"]),
    _m("产品测试通过率", "运营", "岗位级", 12, "%", ">=95%",
       "产品测试一次通过率", "performance_goals", tags=["研发工程师"]),
    _m("研发成本控制", "财务", "岗位级", 10, "%", "偏差<=10%",
       "实际研发成本与预算偏差率", "performance_goals", tags=["研发工程师"]),
    _m("技术创新成果", "学习与成长", "岗位级", 8, "项", ">=2",
       "年度专利/技术改进成果数", "development_goals", tags=["研发工程师"]),
    # 工艺工程师(补充)
    _m("工艺文件完整率", "内部流程", "岗位级", 10, "%", "100%",
       "工艺文件按时归档率", "performance_goals", tags=["工艺工程师"]),
    _m("工艺问题解决率", "运营", "岗位级", 10, "%", ">=95%",
       "及时解决的工艺问题 / 总问题 * 100%", "performance_goals", tags=["工艺工程师"]),
    # 包装/物流(制造)
    _m("包装合格率", "运营", "岗位级", 12, "%", ">=99%",
       "包装检验合格率", "performance_goals", tags=["包装物流"]),
    _m("发货准时率", "运营", "岗位级", 12, "%", ">=98%",
       "按时发货订单 / 总订单 * 100%", "performance_goals", tags=["包装物流"]),
    _m("运输破损率", "运营", "岗位级", 10, "%", "<=0.5%",
       "运输破损件数 / 总发运件数 * 100%", "performance_goals", tags=["包装物流"]),
    _m("物流成本控制", "财务", "岗位级", 8, "%", "同比下降",
       "单位产品物流成本同比变化", "performance_goals", tags=["包装物流"]),
]
TECH_METRICS = [
    # 组织级 (~20)
    _m("ARR(年度经常性收入)", "财务", "组织级", 15, "万元", ">=年度目标",
       "Annual Recurring Revenue", "strategic_kpis"),
    _m("MRR增长率", "财务", "组织级", 12, "%", ">=10%/月",
       "Monthly Recurring Revenue 月环比增长率", "strategic_kpis"),
    _m("客户流失率(Churn)", "客户", "组织级", 12, "%", "<=5%",
       "月度流失客户数 / 月初总客户数 * 100%", "strategic_kpis"),
    _m("NPS净推荐值", "客户", "组织级", 8, "分", ">=50",
       "净推荐值 = 推荐者% - 贬损者%", "strategic_kpis"),
    _m("DAU/MAU比值", "运营", "组织级", 10, "%", ">=30%",
       "日活跃用户 / 月活跃用户 * 100%", "management_indicators"),
    _m("用户留存率(D7/D30)", "客户", "组织级", 10, "%", "D7>=40%, D30>=20%",
       "第7日/第30日留存用户 / 新增用户 * 100%", "management_indicators"),
    _m("系统可用性(SLA)", "运营", "组织级", 10, "%", ">=99.9%",
       "系统正常运行时间 / 总时间 * 100%", "management_indicators"),
    _m("代码部署频率", "运营", "组织级", 5, "次/周", ">=2",
       "每周成功部署到生产环境的次数", "management_indicators"),
    _m("P0/P1故障次数", "运营", "组织级", 8, "次", "<=2/季度",
       "严重/高危故障次数", "engagement_compliance"),
    _m("平均故障恢复时间(MTTR)", "运营", "组织级", 8, "分钟", "<=30",
       "从故障到恢复服务的平均时间", "management_indicators"),
    _m("研发投入占比", "战略", "组织级", 8, "%", ">=15%",
       "研发费用 / 营业收入 * 100%", "strategic_kpis"),
    _m("人均产出", "运营", "组织级", 8, "万元/人", "同比提升",
       "营业收入 / 平均在岗人数", "management_indicators"),
    _m("员工净推荐值(eNPS)", "人才发展", "组织级", 8, "分", ">=30",
       "员工净推荐值", "team_development"),
    _m("关键人才保留率", "人才发展", "组织级", 8, "%", ">=90%",
       "关键岗位在职人数 / 年初关键岗位人数 * 100%", "team_development"),
    _m("安全事故/数据泄露次数", "内部流程", "组织级", 10, "次", "0",
       "安全事件和数据泄露事件次数", "engagement_compliance"),
    _m("等保合规达标率", "内部流程", "组织级", 5, "%", "100%",
       "安全等保测评达标情况", "engagement_compliance"),
    _m("毛利率", "财务", "组织级", 10, "%", ">=60%",
       "(收入 - 直接成本) / 收入 * 100%", "strategic_kpis"),
    _m("获客成本(CAC)", "财务", "组织级", 8, "元", "同比下降",
       "营销+销售费用 / 新增客户数", "management_indicators"),
    _m("客户生命周期价值(LTV)", "财务", "组织级", 8, "元", "LTV/CAC>=3",
       "平均客户生命周期贡献收入", "strategic_kpis"),
    _m("知识产权申请数", "学习与成长", "组织级", 5, "件", ">=目标",
       "年度专利/软著申请数量", "team_development"),

    # 部门级 (~35)
    _m("部门OKR完成率", "运营", "部门级", 15, "%", ">=70%",
       "部门OKR关键结果平均完成率", "management_indicators"),
    _m("Sprint交付准时率", "运营", "部门级", 12, "%", ">=90%",
       "按时交付Sprint数 / 总Sprint数 * 100%", "management_indicators"),
    _m("缺陷逃逸率", "运营", "部门级", 10, "%", "<=5%",
       "生产环境缺陷数 / 总缺陷数 * 100%", "management_indicators"),
    _m("代码评审覆盖率", "内部流程", "部门级", 8, "%", ">=80%",
       "经过代码评审的PR数 / 总PR数 * 100%", "management_indicators"),
    _m("技术债务减少率", "学习与成长", "部门级", 8, "%", "同比减少",
       "技术债务评分降低率", "team_development"),
    _m("自动化测试覆盖率", "内部流程", "部门级", 10, "%", ">=70%",
       "自动化测试用例覆盖率", "management_indicators"),
    _m("API响应时间(P99)", "运营", "部门级", 10, "ms", "<=500ms",
       "99分位API响应时间", "management_indicators"),
    _m("部门人员利用率", "运营", "部门级", 8, "%", "75%-85%",
       "计费工时 / 可用工时 * 100%", "management_indicators"),
    _m("部门员工流失率", "人才发展", "部门级", 8, "%", "<=15%",
       "部门主动离职人数 / 平均人数 * 100%", "team_development"),
    _m("知识分享次数", "学习与成长", "部门级", 5, "次", "人均>=2",
       "部门内技术分享/培训次数", "team_development"),
    _m("部门安全事故次数", "内部流程", "部门级", 8, "次", "0",
       "部门安全相关事故次数", "engagement_compliance"),

    # 岗位级 (~40)
    # 产品经理
    _m("PRD按时交付率", "运营", "岗位级", 12, "%", ">=90%",
       "按时交付PRD数 / 总PRD数 * 100%", "performance_goals", tags=["产品经理"]),
    _m("需求变更率", "运营", "岗位级", 10, "%", "<=15%",
       "需求变更次数 / 总需求数 * 100%", "performance_goals", tags=["产品经理"]),
    _m("功能上线后满意度", "客户", "岗位级", 10, "分", ">=4.0/5.0",
       "用户对新功能的满意度评分", "performance_goals", tags=["产品经理"]),
    _m("产品数据分析能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "数据驱动决策的能力评估", "competency_items", tags=["产品经理"]),
    # 开发工程师
    _m("代码质量评分", "运营", "岗位级", 15, "分", ">=B",
       "SonarQube/CodeClimate等代码质量评分", "performance_goals", tags=["开发工程师"]),
    _m("Bug修复时效", "运营", "岗位级", 12, "小时", "P1<=4h, P2<=24h",
       "按优先级的Bug平均修复时间", "performance_goals", tags=["开发工程师"]),
    _m("代码产出量", "运营", "岗位级", 10, "故事点", ">=团队平均",
       "Sprint完成故事点数", "performance_goals", tags=["开发工程师"]),
    _m("技术方案设计能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "技术方案评审通过率和质量", "competency_items", tags=["开发工程师"]),
    # 测试工程师
    _m("测试用例覆盖率", "运营", "岗位级", 15, "%", ">=85%",
       "测试用例覆盖需求数 / 总需求数 * 100%", "performance_goals", tags=["测试工程师"]),
    _m("漏测率", "运营", "岗位级", 12, "%", "<=5%",
       "生产环境缺陷数 / 总缺陷数 * 100%", "performance_goals", tags=["测试工程师"]),
    _m("自动化测试编写量", "运营", "岗位级", 10, "个", ">=目标",
       "年度新增自动化测试用例数", "performance_goals", tags=["测试工程师"]),
    # 运维/SRE工程师
    _m("系统可用性", "运营", "岗位级", 15, "%", ">=99.9%",
       "负责系统的SLA达标率", "performance_goals", tags=["运维"]),
    _m("故障响应时间", "运营", "岗位级", 12, "分钟", "<=15",
       "故障告警到开始处理的平均时间", "performance_goals", tags=["运维"]),
    _m("变更成功率", "运营", "岗位级", 10, "%", ">=99%",
       "成功变更次数 / 总变更次数 * 100%", "performance_goals", tags=["运维"]),
    _m("成本优化金额", "财务", "岗位级", 8, "万元", ">=目标",
       "云资源/基础设施成本节约金额", "performance_goals", tags=["运维"]),
    # UI/UX设计师
    _m("设计交付及时率", "运营", "岗位级", 12, "%", ">=90%",
       "按时交付设计稿数 / 总设计稿数 * 100%", "performance_goals", tags=["设计师"]),
    _m("设计走查通过率", "运营", "岗位级", 10, "%", ">=85%",
       "设计走查一次通过率", "performance_goals", tags=["设计师"]),
    _m("用户测试满意度", "客户", "岗位级", 10, "分", ">=4.0/5.0",
       "用户可用性测试满意度", "performance_goals", tags=["设计师"]),
    _m("设计规范维护", "胜任力", "岗位级", 8, "分", "达标",
       "设计系统组件库的完整性和更新及时性", "competency_items", tags=["设计师"]),
    # 数据工程师
    _m("数据管道可用性", "运营", "岗位级", 15, "%", ">=99.5%",
       "数据管道正常运行时间比例", "performance_goals", tags=["数据工程师"]),
    _m("数据质量评分", "运营", "岗位级", 12, "分", ">=95/100",
       "数据完整性、准确性、及时性综合评分", "performance_goals", tags=["数据工程师"]),
    _m("数据交付及时率", "运营", "岗位级", 10, "%", ">=95%",
       "按时交付数据需求 / 总需求 * 100%", "performance_goals", tags=["数据工程师"]),
    _m("数据架构优化", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "数据模型和架构优化效果评估", "competency_items", tags=["数据工程师"]),
    # 前端工程师
    _m("页面性能评分", "运营", "岗位级", 15, "分", ">=90/100",
       "Lighthouse性能评分", "performance_goals", tags=["前端工程师"]),
    _m("组件复用率", "学习与成长", "岗位级", 10, "%", ">=60%",
       "复用组件数 / 总组件数 * 100%", "development_goals", tags=["前端工程师"]),
    _m("跨端兼容性", "运营", "岗位级", 10, "%", "100%",
       "支持浏览器/设备覆盖率", "performance_goals", tags=["前端工程师"]),
    _m("前端安全合规", "内部流程", "岗位级", 8, "分", "达标",
       "XSS/CSRF等安全漏洞数为0", "performance_goals", tags=["前端工程师"]),
    # 后端工程师
    _m("API设计规范性", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "RESTful API设计规范评估", "competency_items", tags=["后端工程师"]),
    _m("数据库优化效果", "运营", "岗位级", 10, "分", "达标",
       "慢查询优化、索引优化效果", "performance_goals", tags=["后端工程师"]),
    _m("系统架构能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "系统设计和技术选型能力评估", "competency_items", tags=["后端工程师"]),
    # 技术主管/TL
    _m("团队交付效率", "运营", "岗位级", 15, "%", "同比提升",
       "团队Sprint速率变化", "performance_goals", tags=["技术主管"]),
    _m("代码质量管控", "运营", "岗位级", 12, "分", ">=B",
       "团队代码质量评分", "performance_goals", tags=["技术主管"]),
    _m("技术规划执行", "战略", "岗位级", 10, "%", ">=80%",
       "技术路线图执行完成率", "performance_goals", tags=["技术主管"]),
    _m("团队人才培养", "人才发展", "岗位级", 10, "分", "达标",
       "团队成员能力提升评估", "competency_items", tags=["技术主管"]),
    _m("跨团队协作", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与其他产品/技术团队的协作效果", "competency_items", tags=["技术主管"]),
    # 增长/运营专员
    _m("用户增长率", "客户", "岗位级", 15, "%", ">=目标",
       "月度新增用户增长率", "performance_goals", tags=["增长运营"]),
    _m("活动转化率", "运营", "岗位级", 12, "%", ">=目标",
       "运营活动用户转化率", "performance_goals", tags=["增长运营"]),
    _m("留存提升效果", "客户", "岗位级", 10, "%", "同比提升",
       "负责用户群体的留存率变化", "performance_goals", tags=["增长运营"]),
    _m("数据分析能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "数据驱动运营决策的能力", "competency_items", tags=["增长运营"]),
    # 数据产品经理
    _m("数据产品交付率", "运营", "岗位级", 15, "%", ">=90%",
       "按时交付数据产品数 / 计划数 * 100%", "performance_goals", tags=["数据产品经理"]),
    _m("数据产品质量", "运营", "岗位级", 12, "分", ">=90/100",
       "数据产品用户满意度评分", "performance_goals", tags=["数据产品经理"]),
    _m("数据治理能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "数据标准、数据质量治理效果", "competency_items", tags=["数据产品经理"]),
    # DevOps工程师
    _m("CI/CD流水线成功率", "运营", "岗位级", 15, "%", ">=95%",
       "成功构建次数 / 总构建次数 * 100%", "performance_goals", tags=["DevOps"]),
    _m("基础设施自动化率", "运营", "岗位级", 12, "%", ">=80%",
       "自动化管理的基础设施比例", "performance_goals", tags=["DevOps"]),
    _m("监控覆盖率", "运营", "岗位级", 10, "%", ">=95%",
       "有监控覆盖的服务 / 总服务 * 100%", "performance_goals", tags=["DevOps"]),
    # 安全工程师
    _m("安全漏洞修复率", "运营", "岗位级", 15, "%", "100%",
       "已修复漏洞 / 发现漏洞 * 100%", "performance_goals", tags=["安全工程师"]),
    _m("安全审计通过率", "内部流程", "岗位级", 12, "%", "100%",
       "安全审计无重大发现", "performance_goals", tags=["安全工程师"]),
    _m("安全培训完成率", "学习与成长", "岗位级", 8, "%", "100%",
       "组织安全培训完成率", "development_goals", tags=["安全工程师"]),
    # AI/算法工程师
    _m("模型准确率", "运营", "岗位级", 15, "%", ">=目标",
       "算法模型预测/分类准确率", "performance_goals", tags=["算法工程师"]),
    _m("模型上线及时率", "运营", "岗位级", 12, "%", ">=90%",
       "按时上线模型数 / 计划上线数 * 100%", "performance_goals", tags=["算法工程师"]),
    _m("模型推理性能", "运营", "岗位级", 10, "ms", "<=目标",
       "模型推理延迟", "performance_goals", tags=["算法工程师"]),
    _m("算法创新能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "提出新颖算法方案的能力", "competency_items", tags=["算法工程师"]),
    # 客户成功经理
    _m("客户续费率", "客户", "岗位级", 15, "%", ">=90%",
       "续费客户数 / 到期客户数 * 100%", "performance_goals", tags=["客户成功"]),
    _m("客户健康度", "客户", "岗位级", 12, "分", ">=80/100",
       "客户活跃度和健康度评分", "performance_goals", tags=["客户成功"]),
    _m("增购/交叉销售", "财务", "岗位级", 10, "万元", ">=目标",
       "客户增购和交叉销售收入", "performance_goals", tags=["客户成功"]),
    _m("客户流失预警准确率", "运营", "岗位级", 8, "%", ">=70%",
       "正确预警流失客户 / 总预警客户 * 100%", "performance_goals", tags=["客户成功"]),
]

# ─────────────────────────────────────────────────────────────
# 3.5 金融行业 (~95)
# ─────────────────────────────────────────────────────────────
FINANCE_METRICS = [
    # 组织级 (~20)
    _m("资产回报率(ROA)", "财务", "组织级", 12, "%", ">=1.2%",
       "净利润 / 平均总资产 * 100%", "strategic_kpis"),
    _m("净资产收益率(ROE)", "财务", "组织级", 12, "%", ">=15%",
       "净利润 / 平均净资产 * 100%", "strategic_kpis"),
    _m("不良贷款率(NPL)", "财务", "组织级", 15, "%", "<=1.5%",
       "不良贷款余额 / 贷款总额 * 100%", "strategic_kpis"),
    _m("拨备覆盖率", "财务", "组织级", 10, "%", ">=150%",
       "贷款损失准备金 / 不良贷款余额 * 100%", "management_indicators"),
    _m("成本收入比", "运营", "组织级", 10, "%", "<=40%",
       "业务及管理费用 / 营业收入 * 100%", "management_indicators"),
    _m("资本充足率(CAR)", "内部流程", "组织级", 12, "%", ">=10.5%",
       "资本净额 / 风险加权资产 * 100%", "engagement_compliance"),
    _m("流动性覆盖率(LCR)", "内部流程", "组织级", 10, "%", ">=100%",
       "优质流动性资产 / 未来30天净现金流出 * 100%", "engagement_compliance"),
    _m("客户满意度(NPS)", "客户", "组织级", 8, "分", ">=50",
       "客户净推荐值", "strategic_kpis"),
    _m("新增客户数", "客户", "组织级", 8, "万户", ">=目标",
       "年度新增有效客户数", "strategic_kpis"),
    _m("数字渠道交易占比", "战略", "组织级", 8, "%", ">=60%",
       "线上交易笔数 / 总交易笔数 * 100%", "strategic_kpis"),
    _m("反洗钱合规率", "内部流程", "组织级", 10, "%", "100%",
       "反洗钱可疑交易报告及时率和准确率", "engagement_compliance"),
    _m("监管处罚次数", "内部流程", "组织级", 10, "次", "0",
       "年度监管处罚次数", "engagement_compliance"),
    _m("风险事件损失金额", "财务", "组织级", 8, "万元", "0",
       "年度风险事件造成的实际损失", "engagement_compliance"),
    _m("员工合规培训覆盖率", "学习与成长", "组织级", 5, "%", "100%",
       "完成合规培训人数 / 应培训人数 * 100%", "engagement_compliance"),
    _m("客户经理人均产能", "运营", "组织级", 8, "万元/人", "同比提升",
       "客户经理管户资产 / 客户经理人数", "management_indicators"),
    _m("金融科技专利数", "学习与成长", "组织级", 5, "件", ">=目标",
       "年度金融科技相关专利申请数", "team_development"),

    # 部门级 (~35)
    _m("部门利润贡献", "财务", "部门级", 15, "万元", ">=目标",
       "部门利润总额", "management_indicators"),
    _m("部门不良率", "财务", "部门级", 12, "%", "<=1%",
       "部门不良资产率", "management_indicators"),
    _m("审批时效", "运营", "部门级", 10, "小时", "<=24h",
       "业务审批平均处理时间", "management_indicators"),
    _m("合规检查通过率", "内部流程", "部门级", 10, "%", "100%",
       "内部合规检查通过率", "engagement_compliance"),
    _m("客户投诉处理满意度", "客户", "部门级", 10, "分", ">=85/100",
       "客户投诉处理满意度评分", "management_indicators"),
    _m("部门培训完成率", "学习与成长", "部门级", 5, "%", ">=95%",
       "部门员工完成合规/业务培训比例", "team_development"),
    _m("操作风险事件数", "运营", "部门级", 10, "次", "0",
       "部门操作风险事件次数", "engagement_compliance"),
    _m("系统运行可用性", "运营", "部门级", 8, "%", ">=99.9%",
       "部门业务系统SLA达标率", "management_indicators"),

    # 岗位级 (~40)
    # 客户经理
    _m("新增管户资产", "财务", "岗位级", 15, "万元", ">=目标",
       "年度新增管户客户资产总额", "performance_goals", tags=["客户经理"]),
    _m("中间业务收入", "财务", "岗位级", 15, "万元", ">=目标",
       "年度中间业务创收金额", "performance_goals", tags=["客户经理"]),
    _m("客户满意度", "客户", "岗位级", 10, "分", ">=85/100",
       "管户客户满意度评分", "performance_goals", tags=["客户经理"]),
    _m("合规销售率", "内部流程", "岗位级", 10, "%", "100%",
       "合规销售记录 / 总销售记录 * 100%", "performance_goals", tags=["客户经理"]),
    _m("客户流失率", "客户", "岗位级", 10, "%", "<=5%",
       "管户客户流失率", "performance_goals", tags=["客户经理"]),
    # 风控专员
    _m("风险预警准确率", "运营", "岗位级", 15, "%", ">=90%",
       "正确预警的风险事件数 / 总预警数 * 100%", "performance_goals", tags=["风控"]),
    _m("风险评估时效", "运营", "岗位级", 12, "小时", "<=48h",
       "风险评估报告平均出具时间", "performance_goals", tags=["风控"]),
    _m("反洗钱可疑报告及时率", "内部流程", "岗位级", 10, "%", "100%",
       "按时提交可疑交易报告比例", "performance_goals", tags=["风控"]),
    _m("风险模型准确率", "运营", "岗位级", 10, "%", ">=85%",
       "风险模型预测准确率", "performance_goals", tags=["风控"]),
    # 合规专员
    _m("合规检查完成率", "内部流程", "岗位级", 15, "%", "100%",
       "按时完成合规检查数 / 计划检查数 * 100%", "performance_goals", tags=["合规"]),
    _m("合规培训组织完成率", "学习与成长", "岗位级", 12, "%", "100%",
       "按时完成合规培训场次 / 计划场次 * 100%", "performance_goals", tags=["合规"]),
    _m("监管报告及时率", "内部流程", "岗位级", 10, "%", "100%",
       "按时提交监管报告比例", "performance_goals", tags=["合规"]),
    _m("合规事件处置率", "运营", "岗位级", 10, "%", "100%",
       "妥善处置合规事件比例", "performance_goals", tags=["合规"]),
    # IT开发(金融)
    _m("系统交付准时率", "运营", "岗位级", 15, "%", ">=85%",
       "按时交付项目数 / 总项目数 * 100%", "performance_goals", tags=["IT开发"]),
    _m("生产缺陷率", "运营", "岗位级", 12, "%", "<=3%",
       "生产环境缺陷数 / 总需求数 * 100%", "performance_goals", tags=["IT开发"]),
    _m("安全漏洞修复时效", "内部流程", "岗位级", 10, "小时", "高危<=4h",
       "安全漏洞平均修复时间", "performance_goals", tags=["IT开发"]),
    # 理财经理
    _m("理财销售达成率", "财务", "岗位级", 15, "%", ">=100%",
       "理财销售额 / 目标销售额 * 100%", "performance_goals", tags=["理财经理"]),
    _m("高净值客户拓展", "客户", "岗位级", 12, "位", ">=目标",
       "年度新增高净值客户数", "performance_goals", tags=["理财经理"]),
    _m("理财客户满意度", "客户", "岗位级", 10, "分", ">=90/100",
       "理财服务满意度评分", "performance_goals", tags=["理财经理"]),
    _m("合规销售", "内部流程", "岗位级", 10, "分", "无违规",
       "销售行为合规检查结果", "performance_goals", tags=["理财经理"]),
    _m("客户资产配置优化", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "客户资产配置合理性评估", "competency_items", tags=["理财经理"]),
    # 授信审批
    _m("审批时效", "运营", "岗位级", 15, "天", "<=5天",
       "贷款审批平均处理时间", "performance_goals", tags=["授信审批"]),
    _m("审批决策质量", "胜任力", "岗位级", 12, "分", ">=4.0/5.0",
       "审批决策与实际风险表现匹配度", "competency_items", tags=["授信审批"]),
    _m("审批通过率合理性", "运营", "岗位级", 10, "分", "达标",
       "审批通过率在合理区间内", "performance_goals", tags=["授信审批"]),
    # 信贷经理
    _m("贷款投放目标达成", "财务", "岗位级", 15, "%", ">=100%",
       "实际贷款投放 / 目标投放 * 100%", "performance_goals", tags=["信贷经理"]),
    _m("贷款质量(逾期率)", "财务", "岗位级", 12, "%", "<=1%",
       "经手贷款逾期率", "performance_goals", tags=["信贷经理"]),
    _m("贷前调查质量", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "贷前调查报告质量评估", "competency_items", tags=["信贷经理"]),
    _m("贷后管理及时性", "运营", "岗位级", 10, "分", "达标",
       "贷后检查按时完成率", "performance_goals", tags=["信贷经理"]),
    # 数据分析师(金融)
    _m("分析报告质量", "胜任力", "岗位级", 15, "分", ">=4.0/5.0",
       "数据分析报告评审评分", "performance_goals", tags=["数据分析师"]),
    _m("数据模型准确率", "运营", "岗位级", 12, "%", ">=85%",
       "预测模型实际准确率", "performance_goals", tags=["数据分析师"]),
    _m("报表交付及时率", "运营", "岗位级", 10, "%", "100%",
       "按时交付报表数 / 总报表数 * 100%", "performance_goals", tags=["数据分析师"]),
    _m("业务洞察价值", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "分析结论对业务决策的实际影响", "competency_items", tags=["数据分析师"]),
    # 柜面人员
    _m("业务办理准确率", "运营", "岗位级", 15, "%", ">=99.9%",
       "准确办理业务笔数 / 总笔数 * 100%", "performance_goals", tags=["柜面人员"]),
    _m("业务办理时效", "运营", "岗位级", 12, "分钟", "<=标准时效",
       "平均每笔业务办理时间", "performance_goals", tags=["柜面人员"]),
    _m("客户服务满意度", "客户", "岗位级", 10, "分", ">=90/100",
       "柜面服务满意度评分", "performance_goals", tags=["柜面人员"]),
    _m("合规操作率", "内部流程", "岗位级", 10, "%", "100%",
       "合规操作记录 / 总操作记录 * 100%", "performance_goals", tags=["柜面人员"]),
    # 支行行长
    _m("支行利润目标达成", "财务", "岗位级", 15, "%", ">=100%",
       "支行实际利润 / 目标利润 * 100%", "performance_goals", tags=["支行行长"]),
    _m("支行存款增长", "财务", "岗位级", 12, "%", ">=目标",
       "支行存款余额同比增长率", "performance_goals", tags=["支行行长"]),
    _m("支行客户满意度", "客户", "岗位级", 10, "分", ">=90/100",
       "支行客户满意度调查得分", "performance_goals", tags=["支行行长"]),
    _m("支行合规经营", "内部流程", "岗位级", 10, "分", "无违规",
       "支行合规检查结果", "performance_goals", tags=["支行行长"]),
    _m("支行团队管理", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "支行人员管理和激励效果", "competency_items", tags=["支行行长"]),
    # 交易员
    _m("交易盈利目标达成", "财务", "岗位级", 20, "%", ">=100%",
       "实际交易盈利 / 目标盈利 * 100%", "performance_goals", tags=["交易员"]),
    _m("交易风险控制", "运营", "岗位级", 15, "分", "无超限",
       "交易风险敞口控制在限额内", "performance_goals", tags=["交易员"]),
    _m("市场分析能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "市场分析和预测准确性", "competency_items", tags=["交易员"]),
    # 运营管理
    _m("运营效率指标", "运营", "岗位级", 15, "%", "同比提升",
       "业务处理效率提升率", "performance_goals", tags=["运营管理"]),
    _m("运营差错率", "运营", "岗位级", 12, "%", "<=0.1%",
       "运营操作差错次数 / 总操作次数 * 100%", "performance_goals", tags=["运营管理"]),
    _m("系统优化项目完成", "学习与成长", "岗位级", 8, "个", ">=3",
       "年度完成运营系统优化项目数", "development_goals", tags=["运营管理"]),
    # HR
    _m("招聘计划完成率", "人才发展", "岗位级", 15, "%", ">=90%",
       "按时完成招聘岗位数 / 计划招聘数 * 100%", "performance_goals", tags=["HR"]),
    _m("培训满意度", "学习与成长", "岗位级", 10, "分", ">=4.0/5.0",
       "培训满意度调查得分", "performance_goals", tags=["HR"]),
    _m("员工关系管理", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "员工关系和劳动争议处理效果", "competency_items", tags=["HR"]),
    # 品牌公关
    _m("品牌曝光量", "客户", "岗位级", 12, "万次", ">=目标",
       "品牌全渠道曝光总量", "performance_goals", tags=["品牌公关"]),
    _m("舆情管理", "运营", "岗位级", 12, "分", "达标",
       "舆情监测和危机公关效果评估", "performance_goals", tags=["品牌公关"]),
    _m("媒体关系维护", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与媒体的关系维护和合作效果", "competency_items", tags=["品牌公关"]),
]

# ─────────────────────────────────────────────────────────────
# 3.6 房地产行业 (~95)
# ─────────────────────────────────────────────────────────────
REAL_ESTATE_METRICS = [
    # 组织级 (~20)
    _m("合同销售额", "财务", "组织级", 15, "亿元", ">=年度目标",
       "年度实际合同销售总额", "strategic_kpis"),
    _m("回款率", "财务", "组织级", 12, "%", ">=90%",
       "实际回款金额 / 合同销售金额 * 100%", "strategic_kpis"),
    _m("毛利率", "财务", "组织级", 10, "%", ">=25%",
       "(销售收入 - 销售成本) / 销售收入 * 100%", "strategic_kpis"),
    _m("净利率", "财务", "组织级", 10, "%", ">=8%",
       "净利润 / 销售收入 * 100%", "strategic_kpis"),
    _m("去化率", "运营", "组织级", 12, "%", ">=80%",
       "已售套数 / 可售套数 * 100%", "management_indicators"),
    _m("项目开发周期", "运营", "组织级", 8, "月", "同比缩短",
       "从拿地到开盘的平均周期", "management_indicators"),
    _m("工程质量合格率", "运营", "组织级", 10, "%", "100%",
       "质量验收合格面积 / 总验收面积 * 100%", "management_indicators"),
    _m("客户满意度", "客户", "组织级", 8, "分", ">=85/100",
       "业主满意度调查得分", "strategic_kpis"),
    _m("客户投诉率", "客户", "组织级", 8, "%", "<=3%",
       "投诉户数 / 总户数 * 100%", "management_indicators"),
    _m("安全事故率", "运营", "组织级", 10, "次/百万工时", "0",
       "安全事故次数 / 总工时(百万)", "engagement_compliance"),
    _m("土地储备货值", "战略", "组织级", 8, "亿元", ">=2年去化",
       "储备土地预计可售货值", "strategic_kpis"),
    _m("融资成本", "财务", "组织级", 8, "%", "同比下降",
       "综合融资成本率", "management_indicators"),
    _m("三道红线达标", "内部流程", "组织级", 10, "项", "全部达标",
       "剔除预收款后资产负债率/净负债率/现金短债比", "engagement_compliance"),
    _m("交付准时率", "客户", "组织级", 10, "%", ">=95%",
       "按时交付项目数 / 总交付项目数 * 100%", "management_indicators"),
    _m("品牌影响力指数", "战略", "组织级", 8, "分", ">=行业Top10",
       "行业品牌排名和影响力评分", "strategic_kpis"),

    # 部门级 (~35)
    _m("部门销售目标达成率", "财务", "部门级", 15, "%", ">=100%",
       "部门实际销售额 / 目标销售额 * 100%", "management_indicators"),
    _m("部门回款率", "财务", "部门级", 12, "%", ">=90%",
       "部门实际回款 / 合同金额 * 100%", "management_indicators"),
    _m("营销费用率", "财务", "部门级", 8, "%", "<=3%",
       "营销费用 / 销售额 * 100%", "management_indicators"),
    _m("到访转化率", "运营", "部门级", 10, "%", ">=15%",
       "成交客户数 / 到访客户数 * 100%", "management_indicators"),
    _m("蓄客量", "运营", "部门级", 8, "组", ">=目标",
       "认筹/验资客户总数", "management_indicators"),
    _m("工程质量一次验收通过率", "运营", "部门级", 10, "%", ">=90%",
       "一次通过验收次数 / 总验收次数 * 100%", "management_indicators"),
    _m("工程进度偏差率", "运营", "部门级", 10, "%", "<=5%",
       "实际进度与计划进度的偏差", "management_indicators"),
    _m("设计变更率", "运营", "部门级", 8, "%", "<=5%",
       "设计变更金额 / 合同金额 * 100%", "management_indicators"),
    _m("招采节支率", "财务", "部门级", 8, "%", ">=5%",
       "实际采购成本低于预算的比例", "management_indicators"),
    _m("物业管理满意度", "客户", "部门级", 8, "分", ">=80/100",
       "物业服务满意度调查得分", "management_indicators"),

    # 岗位级 (~40)
    # 策划经理
    _m("营销方案质量", "战略", "岗位级", 15, "分", ">=4.0/5.0",
       "营销方案评审得分", "performance_goals", tags=["策划"]),
    _m("推广效果ROI", "财务", "岗位级", 15, "倍", ">=3",
       "推广带来客户成交金额 / 推广费用", "performance_goals", tags=["策划"]),
    _m("活动组织效果", "运营", "岗位级", 10, "分", ">=4.0/5.0",
       "营销活动执行效果评估", "performance_goals", tags=["策划"]),
    _m("市场分析准确度", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "市场分析和预测的准确性", "competency_items", tags=["策划"]),
    # 销售经理
    _m("个人销售目标达成率", "财务", "岗位级", 20, "%", ">=100%",
       "个人实际销售额 / 目标销售额 * 100%", "performance_goals", tags=["销售经理"]),
    _m("客户转化率", "运营", "岗位级", 15, "%", ">=10%",
       "成交客户数 / 接触客户数 * 100%", "performance_goals", tags=["销售经理"]),
    _m("客户满意度", "客户", "岗位级", 10, "分", ">=85/100",
       "成交客户满意度评分", "performance_goals", tags=["销售经理"]),
    _m("回款率", "财务", "岗位级", 10, "%", ">=90%",
       "个人负责客户回款率", "performance_goals", tags=["销售经理"]),
    # 工程经理
    _m("工程进度控制", "运营", "岗位级", 15, "%", "偏差<=5%",
       "项目实际进度与计划偏差", "performance_goals", tags=["工程经理"]),
    _m("工程质量合格率", "运营", "岗位级", 15, "%", "100%",
       "负责项目质量验收合格率", "performance_goals", tags=["工程经理"]),
    _m("安全事故次数", "运营", "岗位级", 12, "次", "0",
       "负责项目安全事故次数", "performance_goals", tags=["工程经理"]),
    _m("成本控制偏差", "财务", "岗位级", 10, "%", "<=5%",
       "实际成本与预算偏差率", "performance_goals", tags=["工程经理"]),
    # 成本经理
    _m("目标成本编制准确率", "财务", "岗位级", 15, "%", "偏差<=3%",
       "目标成本与结算成本偏差率", "performance_goals", tags=["成本经理"]),
    _m("动态成本监控", "财务", "岗位级", 12, "分", "无超支",
       "项目动态成本是否在目标范围内", "performance_goals", tags=["成本经理"]),
    _m("结算审核完成率", "运营", "岗位级", 10, "%", ">=90%",
       "按时完成结算审核比例", "performance_goals", tags=["成本经理"]),
    # 设计经理
    _m("设计方案评审通过率", "运营", "岗位级", 15, "%", ">=90%",
       "一次通过评审方案数 / 总方案数 * 100%", "performance_goals", tags=["设计经理"]),
    _m("设计进度控制", "运营", "岗位级", 12, "%", "偏差<=10%",
       "设计进度与计划偏差率", "performance_goals", tags=["设计经理"]),
    _m("标准化设计应用率", "学习与成长", "岗位级", 10, "%", ">=70%",
       "采用标准化模块的设计面积 / 总设计面积 * 100%", "performance_goals", tags=["设计经理"]),
    # 物业经理
    _m("物业服务满意度", "客户", "岗位级", 15, "分", ">=85/100",
       "物业服务满意度调查得分", "performance_goals", tags=["物业经理"]),
    _m("物业费收缴率", "财务", "岗位级", 12, "%", ">=95%",
       "实际收缴物业费 / 应收物业费 * 100%", "performance_goals", tags=["物业经理"]),
    _m("报修处理时效", "运营", "岗位级", 10, "小时", "<=24h",
       "业主报修平均处理时间", "performance_goals", tags=["物业经理"]),
    _m("设施设备完好率", "运营", "岗位级", 10, "%", ">=95%",
       "正常使用设施设备数 / 总数 * 100%", "performance_goals", tags=["物业经理"]),
    _m("安全事故/事件", "运营", "岗位级", 8, "次", "0",
       "物业管理区域安全事故次数", "performance_goals", tags=["物业经理"]),
    _m("社区活动组织", "客户", "岗位级", 8, "次/季", ">=2",
       "季度社区活动组织次数", "performance_goals", tags=["物业经理"]),
    # 招采经理
    _m("招标完成率", "运营", "岗位级", 15, "%", "100%",
       "按时完成招标项目数 / 计划招标数 * 100%", "performance_goals", tags=["招采经理"]),
    _m("采购成本节约率", "财务", "岗位级", 12, "%", ">=5%",
       "实际采购成本低于预算的比例", "performance_goals", tags=["招采经理"]),
    _m("供应商评估完成率", "内部流程", "岗位级", 10, "%", "100%",
       "完成供应商评估数 / 计划评估数 * 100%", "performance_goals", tags=["招采经理"]),
    _m("合规招标率", "内部流程", "岗位级", 8, "%", "100%",
       "合规招标项目数 / 总招标项目数 * 100%", "performance_goals", tags=["招采经理"]),
    # 投资发展经理
    _m("拿地目标达成率", "战略", "岗位级", 15, "%", ">=80%",
       "成功拿地数 / 目标拿地数 * 100%", "performance_goals", tags=["投资发展"]),
    _m("投资分析报告质量", "胜任力", "岗位级", 12, "分", ">=4.0/5.0",
       "投资分析报告评审评分", "competency_items", tags=["投资发展"]),
    _m("项目测算准确率", "财务", "岗位级", 10, "%", "偏差<=10%",
       "投资测算与实际偏差率", "performance_goals", tags=["投资发展"]),
    _m("政府关系维护", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与政府部门沟通协调效果", "competency_items", tags=["投资发展"]),
    # 客服主管
    _m("投诉处理及时率", "运营", "岗位级", 15, "%", "100%",
       "按时处理投诉数 / 总投诉数 * 100%", "performance_goals", tags=["客服主管"]),
    _m("投诉处理满意度", "客户", "岗位级", 12, "分", ">=85/100",
       "投诉处理满意度评分", "performance_goals", tags=["客服主管"]),
    _m("交付维保修处理率", "运营", "岗位级", 10, "%", ">=95%",
       "已处理维保修数 / 总报修数 * 100%", "performance_goals", tags=["客服主管"]),
    _m("客户回访覆盖率", "客户", "岗位级", 8, "%", ">=90%",
       "完成回访客户数 / 应回访客户数 * 100%", "performance_goals", tags=["客服主管"]),
    # 财务经理
    _m("资金计划准确率", "财务", "岗位级", 15, "%", ">=90%",
       "资金实际使用与计划偏差率", "performance_goals", tags=["财务经理"]),
    _m("融资计划完成率", "财务", "岗位级", 12, "%", ">=80%",
       "实际融资金额 / 计划融资金额 * 100%", "performance_goals", tags=["财务经理"]),
    _m("税务筹划效果", "财务", "岗位级", 10, "万元", ">=目标",
       "税务筹划节约金额", "performance_goals", tags=["财务经理"]),
    _m("财务报表及时率", "运营", "岗位级", 10, "%", "100%",
       "按时出具财务报表比例", "performance_goals", tags=["财务经理"]),
    # 土地拓展专员
    _m("土地信息获取量", "战略", "岗位级", 12, "块", ">=目标",
       "年度获取土地信息数量", "performance_goals", tags=["土地拓展"]),
    _m("可研报告编制质量", "胜任力", "岗位级", 12, "分", ">=4.0/5.0",
       "可研报告评审通过率", "competency_items", tags=["土地拓展"]),
    _m("政府关系沟通", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与政府相关部门沟通协调效果", "competency_items", tags=["土地拓展"]),
    # 精装设计经理
    _m("精装设计方案通过率", "运营", "岗位级", 15, "%", ">=90%",
       "精装方案一次评审通过率", "performance_goals", tags=["精装设计"]),
    _m("精装成本控制", "财务", "岗位级", 12, "%", "偏差<=5%",
       "精装实际成本与预算偏差率", "performance_goals", tags=["精装设计"]),
    _m("精装交付质量", "运营", "岗位级", 10, "分", ">=90/100",
       "精装交付质量验收评分", "performance_goals", tags=["精装设计"]),
    _m("供应商管理能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "精装材料供应商选择和管理效果", "competency_items", tags=["精装设计"]),
    # 景观设计经理
    _m("景观设计方案通过率", "运营", "岗位级", 15, "%", ">=90%",
       "景观方案一次评审通过率", "performance_goals", tags=["景观设计"]),
    _m("景观成本控制", "财务", "岗位级", 12, "%", "偏差<=5%",
       "景观实际成本与预算偏差率", "performance_goals", tags=["景观设计"]),
    _m("景观交付效果", "客户", "岗位级", 10, "分", ">=85/100",
       "景观交付后客户满意度", "performance_goals", tags=["景观设计"]),
    # 报建专员
    _m("报建手续完成率", "运营", "岗位级", 15, "%", "100%",
       "按时完成报建手续比例", "performance_goals", tags=["报建"]),
    _m("报建时效", "运营", "岗位级", 12, "天", "<=标准时效",
       "各项报建平均办理时间", "performance_goals", tags=["报建"]),
    _m("政府关系维护", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "与审批部门的沟通协调效果", "competency_items", tags=["报建"]),
    # 人力资源(房地产)
    _m("招聘计划完成率", "人才发展", "岗位级", 15, "%", ">=90%",
       "按时完成招聘岗位数 / 计划数 * 100%", "performance_goals", tags=["HR"]),
    _m("培训计划执行率", "学习与成长", "岗位级", 10, "%", ">=90%",
       "按时完成培训场次 / 计划场次 * 100%", "performance_goals", tags=["HR"]),
    _m("员工流失率控制", "人才发展", "岗位级", 10, "%", "<=15%",
       "年度主动离职率", "performance_goals", tags=["HR"]),
    _m("薪酬福利方案优化", "人才发展", "岗位级", 8, "分", "达标",
       "薪酬方案竞争力评估", "performance_goals", tags=["HR"]),
]

# ─────────────────────────────────────────────────────────────
# 3.7 医疗健康行业 (~95)
# ─────────────────────────────────────────────────────────────
HEALTHCARE_METRICS = [
    # 组织级 (~20)
    _m("门诊量增长率", "运营", "组织级", 12, "%", ">=10%",
       "本年度门诊量 / 上年度门诊量 - 1", "strategic_kpis"),
    _m("手术量", "运营", "组织级", 10, "台", ">=年度目标",
       "年度手术总台数", "strategic_kpis"),
    _m("床位使用率", "运营", "组织级", 12, "%", ">=85%",
       "实际占用床日数 / 开放床日数 * 100%", "management_indicators"),
    _m("平均住院日", "运营", "组织级", 8, "天", "同比缩短",
       "出院者占用总床日数 / 出院人数", "management_indicators"),
    _m("医疗收入增长率", "财务", "组织级", 12, "%", ">=8%",
       "本年度医疗收入 / 上年度医疗收入 - 1", "strategic_kpis"),
    _m("药占比", "财务", "组织级", 8, "%", "<=30%",
       "药品收入 / 医疗总收入 * 100%", "management_indicators"),
    _m("医疗服务收入占比", "财务", "组织级", 8, "%", ">=60%",
       "医疗服务收入 / 医疗总收入 * 100%", "management_indicators"),
    _m("医疗事故发生率", "运营", "组织级", 10, "次/万诊次", "0",
       "医疗事故次数 / 总诊疗人次(万)", "engagement_compliance"),
    _m("院感发生率", "运营", "组织级", 10, "%", "<=2%",
       "院内感染例数 / 出院人数 * 100%", "engagement_compliance"),
    _m("患者满意度", "客户", "组织级", 10, "分", ">=90/100",
       "患者满意度调查得分", "strategic_kpis"),
    _m("临床路径入径率", "内部流程", "组织级", 8, "%", ">=70%",
       "进入临床路径病例数 / 符合入径条件病例数 * 100%", "management_indicators"),
    _m("医保合规率", "内部流程", "组织级", 10, "%", "100%",
       "医保检查合规率", "engagement_compliance"),
    _m("科研论文发表数", "学习与成长", "组织级", 5, "篇", ">=目标",
       "年度SCI/核心期刊论文发表数", "team_development"),
    _m("重点学科建设", "战略", "组织级", 8, "个", "按计划推进",
       "重点学科建设里程碑完成情况", "strategic_kpis"),
    _m("人才引进/培养完成率", "人才发展", "组织级", 8, "%", ">=80%",
       "完成引进/培养人才数 / 计划数 * 100%", "team_development"),
    _m("医疗设备利用率", "运营", "组织级", 8, "%", ">=70%",
       "设备实际使用时间 / 可用时间 * 100%", "management_indicators"),

    # 部门级 (~35)
    _m("科室业务量", "运营", "部门级", 15, "%", ">=目标",
       "科室门诊量/手术量/出院人次目标达成", "management_indicators"),
    _m("科室收入", "财务", "部门级", 12, "万元", ">=目标",
       "科室医疗收入总额", "management_indicators"),
    _m("科室成本控制", "财务", "部门级", 10, "%", "偏差<=5%",
       "科室实际支出与预算偏差率", "management_indicators"),
    _m("病历书写合格率", "内部流程", "部门级", 10, "%", ">=95%",
       "甲级病历数 / 检查病历数 * 100%", "engagement_compliance"),
    _m("医疗纠纷发生率", "运营", "部门级", 10, "次", "0",
       "科室医疗纠纷次数", "engagement_compliance"),
    _m("临床路径执行率", "内部流程", "部门级", 8, "%", ">=80%",
       "科室临床路径执行率", "management_indicators"),
    _m("科室患者满意度", "客户", "部门级", 8, "分", ">=90/100",
       "科室患者满意度调查得分", "management_indicators"),
    _m("科室科研产出", "学习与成长", "部门级", 5, "分", "达标",
       "科室科研课题、论文、专利完成情况", "team_development"),
    _m("科室培训完成率", "学习与成长", "部门级", 5, "%", ">=90%",
       "科室培训计划完成率", "team_development"),
    _m("院感防控达标率", "运营", "部门级", 8, "%", "100%",
       "科室院感防控检查达标率", "engagement_compliance"),

    # 岗位级 (~40)
    # 临床医生
    _m("门诊量", "运营", "岗位级", 15, "人次/月", ">=科室平均",
       "月均门诊接诊人次", "performance_goals", tags=["临床医生"]),
    _m("手术量", "运营", "岗位级", 12, "台/月", ">=科室平均",
       "月均主刀/一助手术台数", "performance_goals", tags=["临床医生"]),
    _m("病历质量评分", "内部流程", "岗位级", 10, "分", ">=90/100",
       "病历书写质量评分", "performance_goals", tags=["临床医生"]),
    _m("临床路径执行率", "内部流程", "岗位级", 8, "%", ">=80%",
       "个人临床路径执行率", "performance_goals", tags=["临床医生"]),
    _m("医疗质量指标达标", "运营", "岗位级", 10, "项", "全部达标",
       "合理用药、手术安全核查等质量指标", "performance_goals", tags=["临床医生"]),
    _m("患者满意度", "客户", "岗位级", 8, "分", ">=90/100",
       "个人接诊患者满意度评分", "performance_goals", tags=["临床医生"]),
    _m("科研产出", "学习与成长", "岗位级", 8, "分", "达标",
       "论文、课题、学术报告完成情况", "development_goals", tags=["临床医生"]),
    _m("临床技能", "胜任力", "岗位级", 10, "分", "达标",
       "临床操作技能考核评估", "competency_items", tags=["临床医生"]),
    _m("医患沟通能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "医患沟通满意度评估", "competency_items", tags=["临床医生"]),
    # 护理人员
    _m("护理质量合格率", "运营", "岗位级", 15, "%", ">=95%",
       "护理质量检查合格率", "performance_goals", tags=["护理人员"]),
    _m("护理不良事件", "运营", "岗位级", 12, "次", "0",
       "护理相关不良事件次数", "performance_goals", tags=["护理人员"]),
    _m("患者满意度", "客户", "岗位级", 10, "分", ">=90/100",
       "护理服务满意度评分", "performance_goals", tags=["护理人员"]),
    _m("护理文书合格率", "内部流程", "岗位级", 10, "%", ">=95%",
       "护理记录书写合格率", "performance_goals", tags=["护理人员"]),
    _m("护理技能考核", "胜任力", "岗位级", 10, "分", "达标",
       "护理操作技能考核成绩", "competency_items", tags=["护理人员"]),
    # 医技人员
    _m("检验报告及时率", "运营", "岗位级", 15, "%", ">=95%",
       "按时出具报告数 / 总检验数 * 100%", "performance_goals", tags=["医技"]),
    _m("检验准确率", "运营", "岗位级", 15, "%", ">=99%",
       "检验结果准确率(质控合格率)", "performance_goals", tags=["医技"]),
    _m("设备维护保养完成率", "运营", "岗位级", 10, "%", "100%",
       "按时完成设备维护保养次数 / 计划次数 * 100%", "performance_goals", tags=["医技"]),
    # 行政管理
    _m("制度执行合规率", "内部流程", "岗位级", 15, "%", "100%",
       "制度检查合规通过率", "performance_goals", tags=["行政管理"]),
    _m("投诉处理满意度", "客户", "岗位级", 12, "分", ">=85/100",
       "投诉/纠纷处理满意度评分", "performance_goals", tags=["行政管理"]),
    _m("工作效率", "运营", "岗位级", 10, "分", ">=4.0/5.0",
       "工作任务按时完成率评估", "performance_goals", tags=["行政管理"]),
    # 药剂师
    _m("处方审核合格率", "内部流程", "岗位级", 15, "%", ">=99%",
       "正确审核处方数 / 总处方数 * 100%", "performance_goals", tags=["药剂师"]),
    _m("调配差错率", "运营", "岗位级", 15, "%", "0",
       "药品调配差错次数 / 总调配次数 * 100%", "performance_goals", tags=["药剂师"]),
    _m("药品库存管理", "运营", "岗位级", 10, "分", "达标",
       "药品库存周转和效期管理评估", "performance_goals", tags=["药剂师"]),
    _m("合理用药干预", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "不合理用药干预效果评估", "competency_items", tags=["药剂师"]),
    # 科室主任
    _m("科室管理目标达成率", "运营", "岗位级", 15, "%", ">=90%",
       "科室综合目标完成率", "performance_goals", tags=["科室主任"]),
    _m("学科建设推进", "战略", "岗位级", 12, "分", "达标",
       "学科发展规划执行评估", "performance_goals", tags=["科室主任"]),
    _m("医疗质量管理", "运营", "岗位级", 12, "分", "达标",
       "科室医疗质量控制指标达标率", "performance_goals", tags=["科室主任"]),
    _m("团队管理能力", "胜任力", "岗位级", 10, "分", ">=4.0/5.0",
       "科室人员管理和团队建设效果", "competency_items", tags=["科室主任"]),
    _m("教学带教质量", "学习与成长", "岗位级", 8, "分", "达标",
       "规培生/实习生带教质量评估", "development_goals", tags=["科室主任"]),
    # 医务科/质控
    _m("医疗质量检查覆盖率", "内部流程", "岗位级", 15, "%", "100%",
       "完成质量检查科室 / 应检查科室 * 100%", "performance_goals", tags=["医务科"]),
    _m("医疗纠纷处理率", "运营", "岗位级", 12, "%", "100%",
       "已妥善处理纠纷 / 总纠纷 * 100%", "performance_goals", tags=["医务科"]),
    _m("质控指标达标率", "运营", "岗位级", 10, "%", ">=90%",
       "全院质控指标达标项 / 总检查项 * 100%", "performance_goals", tags=["医务科"]),
    _m("制度修订完成率", "内部流程", "岗位级", 8, "%", "100%",
       "按时修订医疗制度比例", "performance_goals", tags=["医务科"]),
    # 信息科
    _m("系统可用性", "运营", "岗位级", 15, "%", ">=99.9%",
       "HIS/LIS/PACS等核心系统可用性", "performance_goals", tags=["信息科"]),
    _m("故障响应时间", "运营", "岗位级", 12, "分钟", "<=15",
       "IT故障平均响应时间", "performance_goals", tags=["信息科"]),
    _m("信息化项目完成率", "运营", "岗位级", 10, "%", ">=80%",
       "按时完成信息化项目比例", "performance_goals", tags=["信息科"]),
    _m("数据安全合规", "内部流程", "岗位级", 10, "分", "达标",
       "数据安全和隐私保护合规情况", "performance_goals", tags=["信息科"]),
    # 后勤管理
    _m("设施设备完好率", "运营", "岗位级", 15, "%", ">=95%",
       "正常使用设施设备 / 总数 * 100%", "performance_goals", tags=["后勤管理"]),
    _m("能耗管理", "财务", "岗位级", 12, "分", "达标",
       "水电气能耗控制评估", "performance_goals", tags=["后勤管理"]),
    _m("环境清洁达标率", "运营", "岗位级", 10, "%", ">=95%",
       "院感环境清洁检查达标率", "performance_goals", tags=["后勤管理"]),
    _m("应急响应能力", "胜任力", "岗位级", 8, "分", ">=4.0/5.0",
       "突发事件后勤保障响应能力", "competency_items", tags=["后勤管理"]),
    # 科研管理人员
    _m("课题申报组织完成率", "运营", "岗位级", 15, "%", "100%",
       "按时组织完成课题申报比例", "performance_goals", tags=["科研管理"]),
    _m("科研经费管理", "财务", "岗位级", 12, "分", "合规",
       "科研经费使用合规性评估", "performance_goals", tags=["科研管理"]),
    _m("伦理审查及时率", "内部流程", "岗位级", 10, "%", "100%",
       "按时完成伦理审查比例", "performance_goals", tags=["科研管理"]),
    _m("科研成果转化", "学习与成长", "岗位级", 8, "项", ">=目标",
       "科研成果转化项目数", "development_goals", tags=["科研管理"]),
    # 医疗设备管理
    _m("设备巡检完成率", "运营", "岗位级", 15, "%", "100%",
       "按时完成设备巡检比例", "performance_goals", tags=["设备管理"]),
    _m("设备故障修复时效", "运营", "岗位级", 12, "小时", "<=4h",
       "设备故障平均修复时间", "performance_goals", tags=["设备管理"]),
    _m("设备质控合格率", "运营", "岗位级", 10, "%", ">=99%",
       "设备质控检测合格率", "performance_goals", tags=["设备管理"]),
    _m("设备采购预算执行", "财务", "岗位级", 8, "%", "90%-110%",
       "设备采购实际支出与预算偏差率", "performance_goals", tags=["设备管理"]),
    # 医院感染管理
    _m("院感监测覆盖率", "运营", "岗位级", 15, "%", "100%",
       "完成院感监测科室 / 应监测科室 * 100%", "performance_goals", tags=["院感管理"]),
    _m("院感培训覆盖率", "学习与成长", "岗位级", 12, "%", "100%",
       "完成院感培训人数 / 应培训人数 * 100%", "performance_goals", tags=["院感管理"]),
    _m("院感指标达标", "运营", "岗位级", 10, "分", "达标",
       "各项院感监测指标达标率", "performance_goals", tags=["院感管理"]),
    _m("暴发疫情处置", "运营", "岗位级", 8, "分", "达标",
       "院感暴发事件应急处置效果", "performance_goals", tags=["院感管理"]),
    # 医保管理
    _m("医保结算准确率", "财务", "岗位级", 15, "%", ">=99%",
       "医保结算金额准确率", "performance_goals", tags=["医保管理"]),
    _m("医保拒付率", "财务", "岗位级", 12, "%", "<=2%",
       "医保拒付金额 / 总申报金额 * 100%", "performance_goals", tags=["医保管理"]),
    _m("DRG/DIP管理", "运营", "岗位级", 10, "分", "达标",
       "DRG/DIP付费管理效果评估", "performance_goals", tags=["医保管理"]),
    _m("医保政策培训", "学习与成长", "岗位级", 8, "%", "100%",
       "医保政策培训覆盖率", "performance_goals", tags=["医保管理"]),
    # 营养师
    _m("营养评估完成率", "运营", "岗位级", 15, "%", ">=90%",
       "完成营养评估患者 / 应评估患者 * 100%", "performance_goals", tags=["营养师"]),
    _m("营养方案满意度", "客户", "岗位级", 12, "分", ">=4.0/5.0",
       "患者对营养方案的满意度", "performance_goals", tags=["营养师"]),
    _m("营养宣教完成", "学习与成长", "岗位级", 8, "次", ">=目标",
       "年度营养宣教活动次数", "development_goals", tags=["营养师"]),
    # 康复治疗师
    _m("康复治疗计划完成率", "运营", "岗位级", 15, "%", ">=90%",
       "完成康复治疗计划患者 / 总患者 * 100%", "performance_goals", tags=["康复治疗师"]),
    _m("康复效果评估", "运营", "岗位级", 12, "分", "达标",
       "患者康复功能改善评估", "performance_goals", tags=["康复治疗师"]),
    _m("康复治疗安全性", "运营", "岗位级", 10, "分", "无事故",
       "康复治疗过程中安全事故次数", "performance_goals", tags=["康复治疗师"]),
    # 医院财务
    _m("预算编制准确率", "财务", "岗位级", 15, "%", "偏差<=5%",
       "预算与实际偏差率", "performance_goals", tags=["医院财务"]),
    _m("成本核算及时率", "运营", "岗位级", 12, "%", "100%",
       "按时完成科室成本核算比例", "performance_goals", tags=["医院财务"]),
    _m("收费合规率", "内部流程", "岗位级", 10, "%", "100%",
       "收费合规检查通过率", "performance_goals", tags=["医院财务"]),
    _m("医保回款管理", "财务", "岗位级", 10, "%", ">=95%",
       "医保回款到账率", "performance_goals", tags=["医院财务"]),
]

# ═══════════════════════════════════════════════════════════════
# 4. 汇总所有行业指标
# ═══════════════════════════════════════════════════════════════

INDUSTRY_METRICS = {
    "建筑工程": CONSTRUCTION_METRICS,
    "消费品": CONSUMER_METRICS,
    "制造业": MANUFACTURING_METRICS,
    "科技互联网": TECH_METRICS,
    "金融": FINANCE_METRICS,
    "房地产": REAL_ESTATE_METRICS,
    "医疗健康": HEALTHCARE_METRICS,
}


def _post_with_retry(url, payload, max_retries=3, verbose=False, label=""):
    """POST with exponential backoff retry."""
    for attempt in range(max_retries):
        try:
            r = requests.post(url, json=payload, timeout=15)
            if r.status_code in (200, 201):
                return True
            if r.status_code == 409:
                if verbose:
                    print(f"  SKIP (exists) {label}")
                return True
            if r.status_code == 400 and attempt < max_retries - 1:
                time.sleep(0.3 * (2 ** attempt))
                continue
            if verbose:
                print(f"  FAIL {label} {r.status_code} {r.text[:120]}")
            return False
        except Exception as e:
            if attempt < max_retries - 1:
                time.sleep(0.3 * (2 ** attempt))
                continue
            if verbose:
                print(f"  ERROR {label} {e}")
            return False
    return False


def seed_categories(verbose=False):
    """Seed Metric_Category objects with retry and dedup."""
    url = f"{BASE_URL}/objects"
    list_url = f"{BASE_URL}/objects?model_key=Metric_Category"
    # Fetch existing category names to avoid duplicates
    existing = set()
    try:
        r = requests.get(list_url, timeout=10)
        if r.ok:
            data = r.json()
            if isinstance(data, list):
                for obj in data:
                    existing.add(obj.get("properties", {}).get("category_name", ""))
    except Exception:
        pass

    if verbose:
        print(f"  Existing categories: {len(existing)}")

    success = 0
    skipped = 0
    for cat in CATEGORIES:
        if cat["category_name"] in existing:
            skipped += 1
            continue
        payload = {
            "model_key": "Metric_Category",
            "properties": cat,
        }
        label = f"Category: {cat['category_name']} ({cat['category_type']})"
        if _post_with_retry(url, payload, verbose=verbose, label=label):
            success += 1
        time.sleep(0.05)
    if verbose and skipped:
        print(f"  Skipped {skipped} existing categories")
    return success


def seed_templates(verbose=False):
    """Seed Metric_Template objects with retry, rate limiting, and dedup."""
    url = f"{BASE_URL}/objects"
    list_url = f"{BASE_URL}/objects?model_key=Metric_Template"
    # Fetch existing metric names to avoid duplicates
    existing = set()
    try:
        r = requests.get(list_url, timeout=30)
        if r.ok:
            data = r.json()
            if isinstance(data, list):
                for obj in data:
                    existing.add(obj.get("properties", {}).get("metric_name", ""))
    except Exception:
        pass

    if verbose:
        print(f"  Existing templates: {len(existing)}")

    total = 0
    success = 0
    skipped = 0
    batch_delay = 0.05  # 50ms between requests to avoid rate limiting

    # General metrics
    for metric in GENERAL_METRICS:
        metric["industries"] = metric.get("industries", [])
        name = metric["metric_name"]
        if name in existing:
            skipped += 1
            continue
        payload = {
            "model_key": "Metric_Template",
            "properties": metric,
        }
        total += 1
        if _post_with_retry(url, payload, verbose=verbose, label=name):
            success += 1
            existing.add(name)
        time.sleep(batch_delay)

    if verbose:
        print(f"  General metrics: {success}/{total}")

    # Industry metrics
    industry_success = 0
    industry_total = 0
    for industry_name, metrics in INDUSTRY_METRICS.items():
        ind_success = 0
        for metric in metrics:
            name = metric["metric_name"]
            if name in existing:
                skipped += 1
                continue
            # Add industry to industries list
            industries = list(metric.get("industries", []))
            if industry_name not in industries:
                industries.append(industry_name)
            metric["industries"] = industries

            payload = {
                "model_key": "Metric_Template",
                "properties": metric,
            }
            industry_total += 1
            label = f"[{industry_name}] {name}"
            if _post_with_retry(url, payload, verbose=verbose, label=label):
                ind_success += 1
                existing.add(name)
            time.sleep(batch_delay)
        industry_success += ind_success
        if verbose:
            print(f"  {industry_name}: {ind_success}/{len(metrics)}")

    total += industry_total
    success += industry_success

    if verbose:
        print(f"\n  Total templates: {success}/{total}, skipped {skipped} existing")

    return success, total


def main():
    parser = argparse.ArgumentParser(description="Seed metrics library data")
    parser.add_argument("--base-url", default="http://localhost:8000/api/v1/kernel",
                        help="Kernel API base URL")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    args = parser.parse_args()

    global BASE_URL
    BASE_URL = args.base_url

    print("=" * 60)
    print("Seeding Metrics Library (~725 templates)")
    print(f"Target: {BASE_URL}")
    print("=" * 60)

    # 1. Seed categories
    print("\n[1/2] Seeding categories...")
    cat_count = seed_categories(verbose=args.verbose)
    print(f"  Result: {cat_count}/{len(CATEGORIES)} categories")

    # 2. Seed templates
    print(f"\n[2/2] Seeding templates...")
    tpl_count, tpl_total = seed_templates(verbose=args.verbose)
    print(f"  Result: {tpl_count}/{tpl_total} templates")

    # Summary
    print(f"\n{'=' * 60}")
    print(f"Categories: {cat_count}/{len(CATEGORIES)}")
    print(f"Templates:  {tpl_count}/{tpl_total}")
    print(f"Total:      {cat_count + tpl_count}/{len(CATEGORIES) + tpl_total}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
