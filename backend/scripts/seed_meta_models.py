#!/usr/bin/env python3
"""
种子数据：创建 32 个咨询体系元模型 (5 大领域 + 项目管理 + 交付管理 + 智能共创套件 + AI 顾问 Agent)

直接调用 service 层，无需 HTTP。

用法: KERNEL_MODE=demo python3 scripts/seed_meta_models.py
"""
import sys
import os

# 确保可以导入 app 模块
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.kernel.database import init_kernel_db, get_db
from app.services.kernel.meta_service import MetaModelService

# 18 个元模型定义 (5 大领域 + 项目管理)
META_MODELS = [
    # ========== 战略 Strategy (3) ==========
    {
        "model_key": "Strategic_Goal",
        "name": "战略目标",
        "fields": [
            {"field_name": "goal_name", "field_type": "string", "is_required": True, "description": "目标名称"},
            {"field_name": "owner", "field_type": "string", "is_required": False, "description": "负责人"},
            {"field_name": "priority", "field_type": "enum", "is_required": False, "enum_options": ["P0", "P1", "P2", "P3"], "default_value": "P2", "description": "优先级"},
            {"field_name": "progress", "field_type": "float", "is_required": False, "default_value": 0.0, "description": "进度百分比 (0-100)"},
            {"field_name": "period", "field_type": "string", "is_required": True, "description": "周期"},
            {"field_name": "metric_type", "field_type": "string", "is_required": False, "description": "指标类型 (财务/市场/技术)"},
            {"field_name": "target_value", "field_type": "float", "is_required": False, "description": "预期数值"},
            {"field_name": "actual_value", "field_type": "float", "is_required": False, "description": "实际数值"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["进行中", "已完成", "延期", "暂停"], "default_value": "进行中", "description": "状态"},
            {"field_name": "goal_type", "field_type": "enum", "is_required": False, "enum_options": ["revenue_target", "profit_target", "strategic_initiative", "operational_kpi", "capability_building"], "default_value": "operational_kpi", "description": "目标类型"},
            {"field_name": "milestones", "field_type": "object", "is_required": False, "description": "里程碑 JSON [{phase, date, deliverable}]"},
            {"field_name": "target_metrics", "field_type": "object", "is_required": False, "description": "多指标 JSON [{metric_name, unit, target_value, actual_value}]"},
            {"field_name": "linked_kpis", "field_type": "object", "is_required": False, "description": "关联KPI JSON [{kpi_goal_id, weight}]"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "目标详细描述"},
            {"field_name": "parent_goal_ref", "field_type": "reference", "reference_model": "Strategic_Goal", "is_required": False, "description": "上级目标 (层级分解)"},
            {"field_name": "period_type", "field_type": "enum", "is_required": False, "enum_options": ["annual", "quarterly", "monthly"], "default_value": "annual", "description": "目标周期类型"},
            {"field_name": "owner_org_ref", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "责任组织单元"},
        ],
        "description": "战略 — 战略目标/关键任务",
    },
    {
        "model_key": "Strategic_Initiative",
        "name": "战略举措",
        "fields": [
            {"field_name": "initiative_name", "field_type": "string", "is_required": True, "description": "举措名称"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "举措描述"},
            {"field_name": "owner_org", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "责任组织单元"},
            {"field_name": "start_date", "field_type": "datetime", "is_required": False, "description": "开始日期"},
            {"field_name": "end_date", "field_type": "datetime", "is_required": False, "description": "结束日期"},
            {"field_name": "budget", "field_type": "money", "is_required": False, "description": "预算"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["规划中", "执行中", "已完成", "取消"], "description": "状态"},
        ],
        "description": "战略 — 战略举措 (目标→行动的桥梁)",
    },
    {
        "model_key": "Market_Context",
        "name": "市场环境",
        "fields": [
            {"field_name": "industry", "field_type": "string", "is_required": True, "description": "行业"},
            {"field_name": "market_position", "field_type": "string", "is_required": False, "description": "市场地位"},
            {"field_name": "competitor_landscape", "field_type": "text", "is_required": False, "description": "竞争格局"},
            {"field_name": "customer_profile", "field_type": "text", "is_required": False, "description": "客户画像"},
            {"field_name": "growth_rate", "field_type": "float", "is_required": False, "description": "增长率 (%)"},
            {"field_name": "analysis_date", "field_type": "datetime", "is_required": False, "description": "分析日期"},
        ],
        "description": "战略 — 市场环境分析",
    },

    # ========== 组织 Organization (3) ==========
    {
        "model_key": "Org_Unit",
        "name": "组织单元",
        "fields": [
            {"field_name": "unit_name", "field_type": "string", "is_required": True, "description": "部门名称"},
            {"field_name": "unit_type", "field_type": "enum", "is_required": False, "enum_options": ["事业部", "职能中心", "子公司", "项目组"], "description": "部门类型"},
            {"field_name": "level", "field_type": "integer", "is_required": False, "description": "层级 (1=总部, 2=一级部门...)"},
            {"field_name": "budget", "field_type": "money", "is_required": False, "description": "年度预算"},
            {"field_name": "manager", "field_type": "string", "is_required": False, "description": "负责人"},
            {"field_name": "headcount", "field_type": "integer", "is_required": False, "description": "编制数"},
            {"field_name": "cost_center", "field_type": "string", "is_required": False, "description": "成本中心"},
            {"field_name": "parent_org_ref", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "上级部门 (组织层级)"},
        ],
        "description": "组织 — 组织单元/部门",
    },
    {
        "model_key": "Job_Role",
        "name": "岗位",
        "fields": [
            {"field_name": "role_name", "field_type": "string", "is_required": True, "description": "岗位名称"},
            {"field_name": "job_family", "field_type": "enum", "is_required": True, "enum_options": ["管理M", "专业P", "操作O", "营销S"], "description": "职位序列"},
            {"field_name": "level_range", "field_type": "string", "is_required": False, "description": "职级范围"},
            {"field_name": "org_unit_id", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "所属组织单元"},
            {"field_name": "salary_grade", "field_type": "reference", "reference_model": "Salary_Band", "is_required": False, "description": "关联薪级"},
            {"field_name": "is_key_position", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否关键岗位"},
            {"field_name": "competency_requirements", "field_type": "array", "is_required": False, "description": "胜任力要求"},
        ],
        "description": "组织 — 岗位/职位 (核心枢纽)",
    },
    {
        "model_key": "Process_Flow",
        "name": "业务流程",
        "fields": [
            {"field_name": "process_name", "field_type": "string", "is_required": True, "description": "流程名称"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "流程描述"},
            {"field_name": "owner_org", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "归属部门"},
            {"field_name": "steps", "field_type": "array", "is_required": False, "description": "流程步骤"},
            {"field_name": "efficiency_score", "field_type": "float", "is_required": False, "description": "效率评分 (0-100)"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["正常运行", "需优化", "待审批", "已废弃"], "description": "流程状态"},
        ],
        "description": "组织 — 跨部门业务流程",
    },

    # ========== 绩效 Performance (10) ==========
    {
        "model_key": "Performance_Metric",
        "name": "绩效指标",
        "fields": [
            {"field_name": "metric_name", "field_type": "string", "is_required": True, "description": "指标名称"},
            {"field_name": "formula", "field_type": "string", "is_required": False, "description": "计算公式"},
            {"field_name": "review_cycle", "field_type": "enum", "is_required": False, "enum_options": ["月度", "季度", "半年度", "年度"], "description": "考核周期"},
            {"field_name": "weight", "field_type": "float", "is_required": False, "description": "权重 (%)"},
            {"field_name": "target_value", "field_type": "float", "is_required": False, "description": "目标值"},
            {"field_name": "unit", "field_type": "string", "is_required": False, "description": "计量单位"},
        ],
        "description": "绩效 — 绩效指标/KPI",
    },
    {
        "model_key": "Competency",
        "name": "胜任力",
        "fields": [
            {"field_name": "competency_name", "field_type": "string", "is_required": True, "description": "能力名称"},
            {"field_name": "dimension", "field_type": "enum", "is_required": True, "enum_options": ["通用能力", "专业能力", "领导力", "数字能力"], "description": "能力维度"},
            {"field_name": "definition", "field_type": "text", "is_required": False, "description": "定义描述"},
            {"field_name": "behavioral_indicators", "field_type": "array", "is_required": False, "description": "行为指标"},
            {"field_name": "level_description", "field_type": "object", "is_required": False, "description": "各级别描述"},
        ],
        "description": "绩效 — 胜任力/能力标签",
    },
    {
        "model_key": "Review_Cycle",
        "name": "考核周期实例",
        "fields": [
            {"field_name": "cycle_name", "field_type": "string", "is_required": True, "description": "周期名称 (如 2025Q1 绩效考核)"},
            {"field_name": "cycle_type", "field_type": "enum", "is_required": True, "enum_options": ["月度", "季度", "半年度", "年度"], "description": "周期类型"},
            {"field_name": "start_date", "field_type": "datetime", "is_required": True, "description": "开始日期"},
            {"field_name": "end_date", "field_type": "datetime", "is_required": True, "description": "结束日期"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["未开始", "进行中", "已完成"], "description": "状态"},
            {"field_name": "completion_rate", "field_type": "float", "is_required": False, "default_value": 0.0, "description": "完成率 (%)"},
        ],
        "description": "绩效 — 考核周期实例",
    },
    {
        "model_key": "Performance_Plan",
        "name": "绩效方案",
        "fields": [
            {"field_name": "plan_name", "field_type": "string", "is_required": True, "description": "方案名称"},
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "client_name", "field_type": "string", "is_required": False, "description": "客户名称"},
            {"field_name": "industry", "field_type": "string", "is_required": False, "description": "所属行业"},
            {"field_name": "employee_count", "field_type": "integer", "is_required": False, "description": "涉及员工人数"},
            {"field_name": "methodology", "field_type": "enum", "is_required": False, "enum_options": ["KPI", "OKR", "360度评估", "混合"], "description": "方法论框架"},
            {"field_name": "cycle_type", "field_type": "enum", "is_required": False, "enum_options": ["月度", "季度", "半年度", "年度"], "description": "考核周期类型"},
            {"field_name": "weight_config", "field_type": "object", "is_required": False, "description": "权重分配规则 JSON {performance_weight, competency_weight, values_weight}"},
            {"field_name": "calibration_required", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否需要校准"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["草拟中", "客户确认", "执行中", "评估中", "已完成"], "description": "方案状态"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "方案概述"},
            {"field_name": "scope", "field_type": "array", "is_required": False, "description": "适用范围 (部门/职级列表)"},
            {"field_name": "business_context", "field_type": "object", "is_required": False, "description": "战略上下文 JSON {client_profile, business_review, market_insights, swot_data, strategic_direction, bsc_cards, action_plans, targets, source_files}"},
        ],
        "description": "绩效 — 绩效管理方案 (咨询交付物)",
    },
    {
        "model_key": "Org_Performance",
        "name": "组织绩效",
        "fields": [
            {"field_name": "org_unit_ref", "field_type": "reference", "reference_model": "Org_Unit", "is_required": True, "description": "关联部门"},
            {"field_name": "plan_ref", "field_type": "reference", "reference_model": "Performance_Plan", "is_required": True, "description": "所属绩效方案"},
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联项目"},
            {"field_name": "strategic_kpis", "field_type": "object", "is_required": True, "description": "战略KPI JSON [{name, metric, weight, target, unit, source_goal}]"},
            {"field_name": "management_indicators", "field_type": "object", "is_required": True, "description": "部门管理指标 JSON [{name, metric, weight, target, unit, description}]"},
            {"field_name": "team_development", "field_type": "object", "is_required": True, "description": "团队发展指标 JSON [{name, metric, weight, target, unit, description}]"},
            {"field_name": "engagement_compliance", "field_type": "object", "is_required": True, "description": "敬业度/合规指标 JSON [{name, metric, weight, target, unit, description}]"},
            {"field_name": "dimension_weights", "field_type": "object", "is_required": False, "description": "四维度权重配置 JSON {strategic, management, team_development, engagement}"},
            {"field_name": "strategic_alignment", "field_type": "object", "is_required": False, "description": "战略对齐 JSON [{strategic_goal_id, alignment_desc}]"},
            {"field_name": "period", "field_type": "enum", "is_required": False, "enum_options": ["年度", "季度", "月度"], "description": "考核周期"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["生成中", "待确认", "已确认", "已分解"], "description": "状态"},
            {"field_name": "generated_at", "field_type": "datetime", "is_required": False, "description": "AI生成时间"},
            {"field_name": "perf_type", "field_type": "enum", "is_required": False, "enum_options": ["company", "department"], "default_value": "department", "description": "绩效类型 (公司级/部门级)"},
            {"field_name": "parent_goal_ref", "field_type": "reference", "reference_model": "Org_Performance", "is_required": False, "description": "上级绩效 (分解链)"},
            {"field_name": "period_target", "field_type": "string", "is_required": False, "description": "周期目标 e.g. 2026-Q1"},
        ],
        "description": "绩效 — 部门组织绩效 (四维度: 战略KPI+管理指标+团队发展+敬业度合规)",
    },
    {
        "model_key": "Position_Performance",
        "name": "岗位绩效",
        "fields": [
            {"field_name": "job_role_ref", "field_type": "reference", "reference_model": "Job_Role", "is_required": True, "description": "关联岗位"},
            {"field_name": "org_perf_ref", "field_type": "reference", "reference_model": "Org_Performance", "is_required": True, "description": "来源部门绩效"},
            {"field_name": "plan_ref", "field_type": "reference", "reference_model": "Performance_Plan", "is_required": True, "description": "所属方案"},
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联项目"},
            {"field_name": "performance_goals", "field_type": "object", "is_required": True, "description": "业绩目标 JSON [{name, metric, weight, target, unit, source_dept_kpi, evaluation_criteria}]"},
            {"field_name": "competency_items", "field_type": "object", "is_required": True, "description": "能力评估 JSON [{competency_id, name, required_level, weight, behavioral_indicators}]"},
            {"field_name": "values_items", "field_type": "object", "is_required": True, "description": "价值观指标 JSON [{name, description, weight, behavioral_examples}]"},
            {"field_name": "development_goals", "field_type": "object", "is_required": True, "description": "发展目标 JSON [{name, action_items, timeline, weight}]"},
            {"field_name": "section_weights", "field_type": "object", "is_required": False, "description": "四分区权重 JSON {performance, competency, values, development}"},
            {"field_name": "is_leader", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否管理岗 (含正职、副职)"},
            {"field_name": "leader_config", "field_type": "object", "is_required": False, "description": "管理岗配置 JSON {personal_weight, team_weight, team_kpi_source}"},
            {"field_name": "team_performance", "field_type": "object", "is_required": False, "description": "团队业绩 JSON (仅管理岗)"},
            {"field_name": "auto_generated", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否AI自动生成"},
            {"field_name": "is_edited", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否已被人工编辑"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["已生成", "已编辑", "已确认"], "description": "状态"},
            {"field_name": "period_target", "field_type": "string", "is_required": False, "description": "周期目标 e.g. 2026-Q1"},
        ],
        "description": "绩效 — 岗位绩效 (四分区: 业绩目标+能力评估+价值观+发展目标, 管理岗支持双重评估)",
    },
    {
        "model_key": "Review_Template",
        "name": "考核表单模板",
        "fields": [
            {"field_name": "template_name", "field_type": "string", "is_required": True, "description": "模板名称"},
            {"field_name": "template_type", "field_type": "enum", "is_required": True, "enum_options": ["KPI考核", "OKR评估", "360度评估", "综合考核", "试用期考核"], "description": "表单类型"},
            {"field_name": "applicable_roles", "field_type": "array", "is_required": False, "description": "适用岗位类型 (管理M/专业P/操作O/营销S)"},
            {"field_name": "sections", "field_type": "object", "is_required": True, "description": "表单分区定义 JSON [{section_name, weight, items}]"},
            {"field_name": "total_weight", "field_type": "float", "is_required": False, "default_value": 100.0, "description": "总权重"},
            {"field_name": "rating_model_ref", "field_type": "reference", "reference_model": "Rating_Model", "is_required": False, "description": "关联评分模型"},
            {"field_name": "reviewer_config", "field_type": "object", "is_required": False, "description": "评估人配置 JSON {self_review, manager_review, peer_review, subordinate_review}"},
            {"field_name": "plan_ref", "field_type": "reference", "reference_model": "Performance_Plan", "is_required": False, "description": "所属绩效方案"},
            {"field_name": "position_ref", "field_type": "reference", "reference_model": "Position_Performance", "is_required": False, "description": "关联岗位绩效"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["草拟", "客户确认", "使用中", "已归档"], "description": "模板状态"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "模板说明"},
        ],
        "description": "绩效 — 考核表单模板 (支持自定义分区、权重、评估人配置)",
    },
    {
        "model_key": "Rating_Model",
        "name": "评分模型",
        "fields": [
            {"field_name": "model_name", "field_type": "string", "is_required": True, "description": "评分模型名称 (如: 5级行为锚定评分)"},
            {"field_name": "scale_type", "field_type": "enum", "is_required": True, "enum_options": ["行为锚定", "数值等级", "百分比", "描述性"], "description": "量表类型"},
            {"field_name": "min_value", "field_type": "float", "is_required": True, "description": "最小值 (如 1.0)"},
            {"field_name": "max_value", "field_type": "float", "is_required": True, "description": "最大值 (如 5.0)"},
            {"field_name": "step", "field_type": "float", "is_required": False, "default_value": 1.0, "description": "步长"},
            {"field_name": "scale_definitions", "field_type": "object", "is_required": True, "description": "量表定义 JSON [{value, label, description, behavioral_indicators}]"},
            {"field_name": "distribution_guide", "field_type": "object", "is_required": False, "description": "分布引导 JSON (如 {S: 5, A: 15, B: 60, C: 15, D: 5})"},
            {"field_name": "is_default", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否为默认评分模型"},
        ],
        "description": "绩效 — 评分量表定义 (行为锚定/数值/百分比等)",
    },
    {
        "model_key": "Performance_Review",
        "name": "考核记录",
        "fields": [
            {"field_name": "review_title", "field_type": "string", "is_required": True, "description": "考核名称"},
            {"field_name": "employee", "field_type": "reference", "reference_model": "Employee", "is_required": True, "description": "被考核人"},
            {"field_name": "position", "field_type": "reference", "reference_model": "Job_Role", "is_required": False, "description": "关联岗位"},
            {"field_name": "template", "field_type": "reference", "reference_model": "Review_Template", "is_required": False, "description": "使用的考核表单模板"},
            {"field_name": "cycle_ref", "field_type": "reference", "reference_model": "Review_Cycle", "is_required": False, "description": "关联考核周期"},
            {"field_name": "reviewer", "field_type": "reference", "reference_model": "Employee", "is_required": False, "description": "评估人"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目"},
            {"field_name": "overall_score", "field_type": "float", "is_required": False, "description": "综合评分"},
            {"field_name": "overall_rating", "field_type": "string", "is_required": False, "description": "综合等级 (如 S/A/B/C/D)"},
            {"field_name": "section_scores", "field_type": "object", "is_required": False, "description": "各分区评分详情 JSON [{section_name, score, weight, comments}]"},
            {"field_name": "self_assessment", "field_type": "text", "is_required": False, "description": "自评内容"},
            {"field_name": "manager_comments", "field_type": "text", "is_required": False, "description": "主管评语"},
            {"field_name": "development_actions", "field_type": "array", "is_required": False, "description": "发展行动项 [{action, deadline, owner}]"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["待自评", "待主管评", "待校准", "已完成", "已申诉"], "description": "考核状态"},
            {"field_name": "calibrated_score", "field_type": "float", "is_required": False, "description": "校准后评分"},
            {"field_name": "calibration_ref", "field_type": "reference", "reference_model": "Calibration_Session", "is_required": False, "description": "关联校准会话"},
        ],
        "description": "绩效 — 考核记录 (含评分、评语、发展行动项)",
    },
    {
        "model_key": "Calibration_Session",
        "name": "校准会话",
        "fields": [
            {"field_name": "session_name", "field_type": "string", "is_required": True, "description": "校准会话名称"},
            {"field_name": "cycle_ref", "field_type": "reference", "reference_model": "Review_Cycle", "is_required": False, "description": "关联考核周期"},
            {"field_name": "org_unit", "field_type": "reference", "reference_model": "Org_Unit", "is_required": False, "description": "校准范围 (组织单元)"},
            {"field_name": "calibration_type", "field_type": "enum", "is_required": False, "enum_options": ["部门内校准", "跨部门校准", "全员校准", "高管校准"], "description": "校准类型"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目"},
            {"field_name": "distribution_before", "field_type": "object", "is_required": False, "description": "校准前分布 JSON {S: n, A: n, B: n, C: n, D: n}"},
            {"field_name": "distribution_after", "field_type": "object", "is_required": False, "description": "校准后分布 JSON"},
            {"field_name": "nine_box_data", "field_type": "object", "is_required": False, "description": "九宫格数据 JSON [{employee_id, x, y, position}]"},
            {"field_name": "adjustment_notes", "field_type": "text", "is_required": False, "description": "调整说明"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["待校准", "进行中", "已完成"], "description": "校准状态"},
        ],
        "description": "绩效 — 校准会话 (强制分布、九宫格、评级标准化)",
    },

    # ========== 薪酬 Compensation (3) ==========
    {
        "model_key": "Salary_Band",
        "name": "薪酬带",
        "fields": [
            {"field_name": "band_code", "field_type": "string", "is_required": True, "description": "薪级代号"},
            {"field_name": "min_salary", "field_type": "money", "is_required": True, "description": "最小值"},
            {"field_name": "mid_salary", "field_type": "money", "is_required": True, "description": "中位值"},
            {"field_name": "max_salary", "field_type": "money", "is_required": True, "description": "最大值"},
            {"field_name": "currency", "field_type": "string", "is_required": False, "default_value": "CNY", "description": "货币单位"},
            {"field_name": "effective_date", "field_type": "datetime", "is_required": False, "description": "生效日期"},
        ],
        "description": "薪酬 — 薪酬带/薪级",
    },
    {
        "model_key": "Pay_Component",
        "name": "薪酬科目",
        "fields": [
            {"field_name": "component_name", "field_type": "string", "is_required": True, "description": "科目名称"},
            {"field_name": "fixed_variable_ratio", "field_type": "string", "is_required": False, "description": "固浮比"},
            {"field_name": "pay_frequency", "field_type": "enum", "is_required": False, "enum_options": ["月度", "季度", "年度", "一次性"], "description": "发放频率"},
            {"field_name": "is_taxable", "field_type": "boolean", "is_required": False, "default_value": True, "description": "是否应税"},
            {"field_name": "description", "field_type": "string", "is_required": False, "description": "描述说明"},
        ],
        "description": "薪酬 — 薪酬科目",
    },
    {
        "model_key": "Market_Benchmark",
        "name": "市场薪酬基准",
        "fields": [
            {"field_name": "benchmark_name", "field_type": "string", "is_required": True, "description": "基准名称"},
            {"field_name": "industry", "field_type": "string", "is_required": False, "description": "行业"},
            {"field_name": "region", "field_type": "string", "is_required": False, "description": "地区"},
            {"field_name": "percentile_25", "field_type": "money", "is_required": False, "description": "25 分位值"},
            {"field_name": "percentile_50", "field_type": "money", "is_required": False, "description": "50 分位值 (中位)"},
            {"field_name": "percentile_75", "field_type": "money", "is_required": False, "description": "75 分位值"},
            {"field_name": "data_year", "field_type": "integer", "is_required": False, "description": "数据年份"},
            {"field_name": "source", "field_type": "string", "is_required": False, "description": "数据来源"},
        ],
        "description": "薪酬 — 外部市场薪酬基准",
    },

    # ========== 人才 Talent (3) ==========
    {
        "model_key": "Employee",
        "name": "员工",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "姓名"},
            {"field_name": "employee_id", "field_type": "string", "is_required": True, "description": "工号"},
            {"field_name": "education", "field_type": "enum", "is_required": False, "enum_options": ["博士", "硕士", "本科", "大专", "其他"], "description": "学历"},
            {"field_name": "experience_years", "field_type": "integer", "is_required": False, "description": "工作年限"},
            {"field_name": "join_date", "field_type": "datetime", "is_required": False, "description": "入职时间"},
            {"field_name": "performance_grade", "field_type": "enum", "is_required": False, "enum_options": ["S", "A", "B", "C", "D"], "description": "绩效等级"},
            {"field_name": "nine_box_position", "field_type": "string", "is_required": False, "description": "九宫格落位"},
            {"field_name": "job_role_id", "field_type": "reference", "reference_model": "Job_Role", "is_required": False, "description": "担任岗位"},
        ],
        "description": "人才 — 员工/人才档案",
    },
    {
        "model_key": "Talent_Pipeline",
        "name": "人才梯队",
        "fields": [
            {"field_name": "pipeline_name", "field_type": "string", "is_required": True, "description": "梯队名称"},
            {"field_name": "employee", "field_type": "reference", "reference_model": "Employee", "is_required": False, "description": "关联员工"},
            {"field_name": "target_role", "field_type": "reference", "reference_model": "Job_Role", "is_required": False, "description": "目标岗位"},
            {"field_name": "readiness", "field_type": "enum", "is_required": False, "enum_options": ["即位", "1年内", "2-3年", "需培养"], "description": "就绪度"},
            {"field_name": "development_plan", "field_type": "text", "is_required": False, "description": "发展计划"},
            {"field_name": "risk_of_loss", "field_type": "enum", "is_required": False, "enum_options": ["高", "中", "低"], "description": "流失风险"},
        ],
        "description": "人才 — 继任计划/人才梯队",
    },
    {
        "model_key": "Learning_Development",
        "name": "学习发展",
        "fields": [
            {"field_name": "program_name", "field_type": "string", "is_required": True, "description": "项目名称"},
            {"field_name": "employee", "field_type": "reference", "reference_model": "Employee", "is_required": False, "description": "关联员工"},
            {"field_name": "training_type", "field_type": "enum", "is_required": False, "enum_options": ["内部培训", "外部培训", "导师制", "轮岗", "项目历练"], "description": "培训类型"},
            {"field_name": "competency_target", "field_type": "reference", "reference_model": "Competency", "is_required": False, "description": "目标胜任力"},
            {"field_name": "start_date", "field_type": "datetime", "is_required": False, "description": "开始日期"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["计划中", "进行中", "已完成", "已取消"], "description": "状态"},
        ],
        "description": "人才 — 学习发展/培训记录",
    },

    # ========== 跨领域 Cross-Domain (1) ==========
    {
        "model_key": "Consulting_Engagement",
        "name": "咨询项目",
        "fields": [
            {"field_name": "engagement_name", "field_type": "string", "is_required": True, "description": "项目名称"},
            {"field_name": "client_name", "field_type": "string", "is_required": True, "description": "客户名称"},
            {"field_name": "engagement_type", "field_type": "enum", "is_required": False, "enum_options": ["组织诊断", "战略咨询", "薪酬改革", "绩效体系", "人才发展", "综合咨询"], "description": "咨询类型"},
            {"field_name": "selected_modules", "field_type": "array", "is_required": False, "description": "选中的维度模块 (战略/组织/绩效/薪酬/人才)"},
            {"field_name": "start_date", "field_type": "datetime", "is_required": False, "description": "开始日期"},
            {"field_name": "end_date", "field_type": "datetime", "is_required": False, "description": "结束日期"},
            {"field_name": "consultant_count", "field_type": "integer", "is_required": False, "description": "顾问人数"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["requirement", "diagnosing", "delivering", "completed"], "default_value": "requirement", "description": "项目生命周期状态"},
        ],
        "description": "跨领域 — 咨询项目管理",
    },

    # ========== 项目管理 Project Management (2) ==========
    {
        "model_key": "Project_Plan",
        "name": "项目计划",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "phase_name", "field_type": "string", "is_required": True, "description": "阶段名称"},
            {"field_name": "phase_order", "field_type": "integer", "is_required": True, "description": "阶段顺序"},
            {"field_name": "goals", "field_type": "text", "is_required": True, "description": "阶段目标"},
            {"field_name": "deliverables", "field_type": "array", "is_required": False, "description": "成果要求列表"},
            {"field_name": "start_date", "field_type": "datetime", "is_required": False, "description": "计划开始日期"},
            {"field_name": "end_date", "field_type": "datetime", "is_required": False, "description": "计划结束日期"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["planned", "in_progress", "completed"], "default_value": "planned", "description": "阶段状态"},
        ],
        "description": "项目管理 — 里程碑和阶段计划",
    },
    {
        "model_key": "Deliverable",
        "name": "交付成果",
        "fields": [
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "成果标题"},
            {"field_name": "phase_id", "field_type": "string", "is_required": False, "description": "关联阶段 ID"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目 ID"},
            {"field_name": "deliverable_type", "field_type": "enum", "is_required": False, "enum_options": ["analysis", "report", "comparison", "plan", "document", "competency_model", "diagnosis_report", "workshop_output", "meeting_record", "presentation"], "description": "成果类型"},
            {"field_name": "source_module", "field_type": "enum", "is_required": False, "enum_options": ["workflow_w1", "workflow_w2", "workflow_w3", "competency_workshop", "diagnosis", "manual"], "description": "来源模块"},
            {"field_name": "content", "field_type": "text", "is_required": False, "description": "成果内容摘要"},
            {"field_name": "file_path", "field_type": "string", "is_required": False, "description": "文件路径"},
            {"field_name": "created_by", "field_type": "string", "is_required": False, "description": "创建人"},
            {"field_name": "created_at", "field_type": "datetime", "is_required": False, "description": "创建时间"},
        ],
        "description": "项目管理 — 交付成果记录 (跨模块汇聚)",
    },

    # ========== 交付管理 Delivery Management (4) ==========
    {
        "model_key": "Contract",
        "name": "合同",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "contract_number", "field_type": "string", "is_required": True, "description": "合同编号"},
            {"field_name": "total_amount", "field_type": "money", "is_required": True, "description": "合同总金额"},
            {"field_name": "currency", "field_type": "enum", "is_required": False, "enum_options": ["CNY", "USD", "EUR"], "default_value": "CNY", "description": "币种"},
            {"field_name": "payment_schedule", "field_type": "array", "is_required": False, "description": "付款节点 [{percentage, trigger_event, expected_date}]"},
            {"field_name": "signed_date", "field_type": "datetime", "is_required": False, "description": "签约日期"},
            {"field_name": "client_signatory", "field_type": "string", "is_required": False, "description": "客户签约人"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "合同备注"},
        ],
        "description": "交付管理 — 项目合同",
    },
    {
        "model_key": "Team_Member",
        "name": "团队成员",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "成员姓名"},
            {"field_name": "role", "field_type": "enum", "is_required": False, "enum_options": ["lead", "member", "advisor"], "default_value": "member", "description": "角色"},
            {"field_name": "specialization", "field_type": "string", "is_required": False, "description": "专业方向"},
            {"field_name": "is_external", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否外部顾问"},
        ],
        "description": "交付管理 — 项目团队成员",
    },
    {
        "model_key": "Task",
        "name": "任务",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "phase_id", "field_type": "string", "is_required": True, "description": "关联阶段 ID"},
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "任务名称"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "任务描述"},
            {"field_name": "assignee_id", "field_type": "string", "is_required": False, "description": "负责人 ID"},
            {"field_name": "due_date", "field_type": "datetime", "is_required": False, "description": "截止日期"},
            {"field_name": "status", "field_type": "enum", "is_required": False, "enum_options": ["pending", "in_progress", "completed"], "default_value": "pending", "description": "任务状态"},
            {"field_name": "priority", "field_type": "enum", "is_required": False, "enum_options": ["high", "medium", "low"], "default_value": "medium", "description": "优先级"},
        ],
        "description": "交付管理 — 阶段任务",
    },
    {
        "model_key": "Meeting_Note",
        "name": "会议纪要",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联咨询项目 ID"},
            {"field_name": "phase_id", "field_type": "string", "is_required": True, "description": "关联阶段 ID"},
            {"field_name": "meeting_date", "field_type": "datetime", "is_required": True, "description": "会议日期"},
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "会议标题"},
            {"field_name": "attendees", "field_type": "array", "is_required": False, "description": "参会人员列表"},
            {"field_name": "decisions", "field_type": "array", "is_required": False, "description": "决策项列表"},
            {"field_name": "action_items", "field_type": "array", "is_required": False, "description": "行动项 [{description, assignee, due_date}]"},
            {"field_name": "notes", "field_type": "text", "is_required": False, "description": "会议纪要正文"},
        ],
        "description": "交付管理 — 客户会议纪要",
    },

    # ========== 智能共创套件 Workshop Suite (5) ==========
    {
        "model_key": "Workshop_Session",
        "name": "工作坊会话",
        "fields": [
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "工作坊标题"},
            {"field_name": "industry_context", "field_type": "text", "is_required": True, "description": "行业上下文背景"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目 ID"},
        ],
        "description": "共创套件 — 工作坊会话基座",
    },
    {
        "model_key": "Canvas_Node",
        "name": "画布节点",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "节点名称"},
            {"field_name": "node_type", "field_type": "string", "is_required": True, "description": "节点类型 (预设: scene/painpoint/idea/task，支持自定义)"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "节点描述"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 画布思维导图节点",
    },
    {
        "model_key": "Evaluation_Item",
        "name": "评价项",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "评价项名称"},
            {"field_name": "dim_x", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 X 分数 (1-5)"},
            {"field_name": "dim_y", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 Y 分数 (1-5)"},
            {"field_name": "dim_z", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 Z 分数 (1-5)"},
            {"field_name": "dim_w", "field_type": "float", "is_required": False, "default_value": 3.0, "description": "维度 W 分数 (1-5)"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 四维评价项",
    },
    {
        "model_key": "Tag_Category",
        "name": "标签大类",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "大类名称 (场景维/痛点维/技能维/格式维)"},
            {"field_name": "color", "field_type": "string", "is_required": False, "default_value": "#3b82f6", "description": "显示颜色"},
            {"field_name": "display_order", "field_type": "integer", "is_required": False, "default_value": 0, "description": "排序顺序"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 标签分类",
    },
    {
        "model_key": "Smart_Tag",
        "name": "智能标签",
        "fields": [
            {"field_name": "name", "field_type": "string", "is_required": True, "description": "标签名称"},
            {"field_name": "color", "field_type": "string", "is_required": False, "default_value": "#6b7280", "description": "标签颜色"},
            {"field_name": "category_id", "field_type": "string", "is_required": False, "description": "所属标签大类 ID"},
            {"field_name": "workshop_id", "field_type": "string", "is_required": True, "description": "所属工作坊 ID"},
        ],
        "description": "共创套件 — 具体标签",
    },

    # ========== AI 顾问 Agent (4) ==========
    {
        "model_key": "Logic_Node",
        "name": "逻辑节点",
        "fields": [
            {"field_name": "node_type", "field_type": "string", "is_required": True, "description": "节点类型标识 (SWOT/GAP/五力/PEST等)"},
            {"field_name": "display_name", "field_type": "string", "is_required": True, "description": "展示名称"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "节点用途说明"},
            {"field_name": "required_data_schema", "field_type": "object", "is_required": True, "description": "JSON Schema: 该节点必须收集的数据字段定义"},
            {"field_name": "layout_template_id", "field_type": "string", "is_required": False, "description": "对应的 PPT 模板坑位 ID"},
            {"field_name": "dependencies", "field_type": "array", "is_required": False, "description": "前置依赖的 node_type 列表"},
            {"field_name": "industry_tags", "field_type": "array", "is_required": False, "description": "适用行业标签"},
            {"field_name": "output_schema", "field_type": "object", "is_required": False, "description": "该节点产出的数据结构定义"},
            {"field_name": "display_order", "field_type": "integer", "is_required": False, "default_value": 0, "description": "展示排序"},
        ],
        "description": "AI 顾问 — 标杆报告的逻辑分析单元",
    },
    {
        "model_key": "Benchmark",
        "name": "标杆报告模板",
        "fields": [
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "标杆报告标题"},
            {"field_name": "industry", "field_type": "string", "is_required": True, "description": "适用行业"},
            {"field_name": "consulting_type", "field_type": "enum", "is_required": True, "enum_options": ["组织诊断", "战略规划", "数字化转型", "人才管理", "人才培训", "绩效改进", "流程优化"], "description": "咨询类型"},
            {"field_name": "description", "field_type": "text", "is_required": False, "description": "模板描述"},
            {"field_name": "node_order", "field_type": "array", "is_required": False, "description": "节点展示顺序 (Logic_Node _id 列表)"},
        ],
        "description": "AI 顾问 — 咨询标杆报告的逻辑骨架模板",
    },
    {
        "model_key": "Agent_Session",
        "name": "AI 顾问会话",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联的项目 ID (sys_objects/_key)"},
            {"field_name": "benchmark_id", "field_type": "string", "is_required": True, "description": "使用的标杆报告模板 ID"},
            {"field_name": "project_goal", "field_type": "text", "is_required": True, "description": "用户初始目标描述"},
            {"field_name": "status", "field_type": "enum", "is_required": True, "enum_options": ["plan", "interact", "execute", "distill", "completed", "failed"], "default_value": "plan", "description": "会话状态"},
            {"field_name": "progress", "field_type": "float", "is_required": False, "default_value": 0.0, "description": "整体进度 (0-1)"},
            {"field_name": "interaction_count", "field_type": "integer", "is_required": False, "default_value": 0, "description": "交互轮次计数"},
            {"field_name": "pptx_path", "field_type": "string", "is_required": False, "description": "生成的 PPTX 文件路径"},
        ],
        "description": "AI 顾问 — Agent 工作流会话记录",
    },
    {
        "model_key": "Project_Spec",
        "name": "项目规格书",
        "fields": [
            {"field_name": "session_id", "field_type": "string", "is_required": True, "description": "关联的 Agent 会话 ID"},
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "项目标题"},
            {"field_name": "industry", "field_type": "string", "is_required": False, "description": "行业"},
            {"field_name": "spec_data", "field_type": "object", "is_required": True, "description": "蒸馏后的结构化数据 (按逻辑节点索引)"},
            {"field_name": "distilled_at", "field_type": "datetime", "is_required": False, "description": "蒸馏时间"},
        ],
        "description": "AI 顾问 — Agent 蒸馏后的结构化项目数据",
    },
    {
        "model_key": "Collected_Data",
        "name": "收集数据",
        "fields": [
            {"field_name": "session_id", "field_type": "string", "is_required": True, "description": "关联的 Agent 会话 ID"},
            {"field_name": "node_types", "field_type": "array", "is_required": False, "description": "已完成的逻辑节点类型列表"},
            {"field_name": "data", "field_type": "object", "is_required": True, "description": "按 node_type 索引的收集数据"},
            {"field_name": "collected_at", "field_type": "datetime", "is_required": False, "description": "收集完成时间"},
        ],
        "description": "AI 顾问 — Agent 收集的原始数据",
    },

    # ========== 智能基础设施 Smart Infrastructure (4) ==========
    {
        "model_key": "Knowledge_Entry",
        "name": "知识条目",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目 ID"},
            {"field_name": "session_id", "field_type": "string", "is_required": False, "description": "来源会话 ID"},
            {"field_name": "memory_type", "field_type": "enum", "is_required": True, "enum_options": ["client", "methodology", "project", "reference"], "description": "记忆类型"},
            {"field_name": "title", "field_type": "string", "is_required": True, "description": "简短标题"},
            {"field_name": "content", "field_type": "text", "is_required": True, "description": "知识内容 (Markdown)"},
            {"field_name": "tags", "field_type": "array", "is_required": False, "description": "标签列表"},
            {"field_name": "source_type", "field_type": "enum", "is_required": False, "enum_options": ["manual", "agent", "dream"], "default_value": "manual", "description": "来源方式"},
            {"field_name": "confidence", "field_type": "float", "is_required": False, "default_value": 1.0, "description": "置信度 (0-1)"},
            {"field_name": "expires_at", "field_type": "datetime", "is_required": False, "description": "过期时间 (可选)"},
            {"field_name": "created_at", "field_type": "datetime", "is_required": False, "description": "创建时间"},
        ],
        "description": "基础设施 — 结构化知识条目 (四类记忆体系)",
    },
    {
        "model_key": "Consolidation_State",
        "name": "巩固状态",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联项目 ID"},
            {"field_name": "locked", "field_type": "boolean", "is_required": False, "default_value": False, "description": "是否锁定中"},
            {"field_name": "locked_at", "field_type": "datetime", "is_required": False, "description": "锁定时间"},
            {"field_name": "last_consolidated_at", "field_type": "datetime", "is_required": False, "description": "上次巩固时间"},
        ],
        "description": "基础设施 — AutoDream 记忆巩固锁和时间戳",
    },
    {
        "model_key": "Project_Settings",
        "name": "项目设置",
        "fields": [
            {"field_name": "project_id", "field_type": "string", "is_required": True, "description": "关联项目 ID"},
            {"field_name": "flags", "field_type": "object", "is_required": False, "description": "功能开关配置 (JSON: {flag_name: bool})"},
            {"field_name": "updated_at", "field_type": "datetime", "is_required": False, "description": "更新时间"},
        ],
        "description": "基础设施 — 项目级功能开关配置",
    },
    {
        "model_key": "Background_Task",
        "name": "后台任务",
        "fields": [
            {"field_name": "task_type", "field_type": "enum", "is_required": True, "enum_options": ["report_generation", "data_export", "dream_consolidation"], "description": "任务类型"},
            {"field_name": "project_id", "field_type": "string", "is_required": False, "description": "关联项目 ID"},
            {"field_name": "session_id", "field_type": "string", "is_required": False, "description": "来源会话 ID"},
            {"field_name": "status", "field_type": "enum", "is_required": True, "enum_options": ["pending", "running", "completed", "failed", "cancelled"], "default_value": "pending", "description": "任务状态"},
            {"field_name": "progress", "field_type": "float", "is_required": False, "default_value": 0.0, "description": "进度 (0-1)"},
            {"field_name": "result", "field_type": "object", "is_required": False, "description": "任务结果 (JSON)"},
            {"field_name": "error", "field_type": "text", "is_required": False, "description": "错误信息"},
            {"field_name": "created_at", "field_type": "datetime", "is_required": False, "description": "创建时间"},
            {"field_name": "started_at", "field_type": "datetime", "is_required": False, "description": "开始时间"},
            {"field_name": "completed_at", "field_type": "datetime", "is_required": False, "description": "完成时间"},
        ],
        "description": "基础设施 — 后台任务记录",
    },
]


def seed_all_meta_models(verbose: bool = False):
    """Seed all meta-models into the kernel database.

    Can be called from main.py startup (demo mode) or as a script.
    When verbose=False, suppresses print output.
    """
    db = get_db()
    service = MetaModelService(db)

    success_count = 0
    for meta_data in META_MODELS:
        try:
            from app.models.kernel.meta_model import MetaModelCreate, FieldDefinition, FieldTypeEnum

            fields = []
            for f in meta_data["fields"]:
                field_kwargs = {
                    "field_name": f["field_name"],
                    "field_type": FieldTypeEnum(f["field_type"]),
                    "is_required": f.get("is_required", False),
                    "description": f.get("description"),
                }
                if "default_value" in f and f["default_value"] is not None:
                    field_kwargs["default_value"] = f["default_value"]
                if "enum_options" in f:
                    field_kwargs["enum_options"] = f["enum_options"]
                if "reference_model" in f:
                    field_kwargs["reference_model"] = f["reference_model"]
                fields.append(FieldDefinition(**field_kwargs))

            create_data = MetaModelCreate(
                model_key=meta_data["model_key"],
                name=meta_data["name"],
                fields=fields,
                description=meta_data.get("description"),
            )
            service.create_meta_model(create_data)
            success_count += 1
        except Exception:
            pass  # Already exists or other error — silently skip

    if verbose:
        print(f"Seeded {success_count}/{len(META_MODELS)} meta-models")
    return success_count


def _build_field_definitions(fields_spec: list[dict]) -> list:
    """将 raw field spec 列表转为 FieldDefinition 对象列表"""
    from app.models.kernel.meta_model import FieldDefinition, FieldTypeEnum

    result = []
    for f in fields_spec:
        kwargs = {
            "field_name": f["field_name"],
            "field_type": FieldTypeEnum(f["field_type"]),
            "is_required": f.get("is_required", False),
            "description": f.get("description"),
        }
        if "default_value" in f and f["default_value"] is not None:
            kwargs["default_value"] = f["default_value"]
        if "enum_options" in f:
            kwargs["enum_options"] = f["enum_options"]
        if "reference_model" in f:
            kwargs["reference_model"] = f["reference_model"]
        result.append(FieldDefinition(**kwargs))
    return result


def upgrade_meta_models(verbose: bool = False):
    """增量升级已有元模型：合并新字段，不删除旧字段。

    遍历 META_MODELS 定义，对于已存在的模型，将新字段追加到 fields 列表中。
    如果字段名已存在则跳过（保留数据库中的当前定义）。

    Can be called from main.py startup or as a standalone script.
    """
    db = get_db()
    service = MetaModelService(db)

    upgraded = 0
    skipped = 0

    for meta_data in META_MODELS:
        model_key = meta_data["model_key"]
        existing = service.get_meta_model_by_key(model_key)

        if existing is None:
            skipped += 1
            continue

        # Build set of existing field names
        existing_fields = existing.get("fields", [])
        existing_names = {f["field_name"] for f in existing_fields}

        # Find new fields not yet in the model
        new_field_specs = [
            f for f in meta_data["fields"]
            if f["field_name"] not in existing_names
        ]

        if not new_field_specs:
            skipped += 1
            continue

        # Merge: existing + new
        new_defs = _build_field_definitions(new_field_specs)
        merged_fields = existing_fields + [fd.model_dump() for fd in new_defs]

        from app.models.kernel.meta_model import MetaModelUpdate
        update_data = MetaModelUpdate(fields=merged_fields)
        service.update_meta_model(existing["_key"], update_data)
        upgraded += 1

        if verbose:
            new_names = [f["field_name"] for f in new_field_specs]
            print(f"  Upgraded {model_key}: +{new_names}")

    if verbose:
        print(f"Upgrade complete: {upgraded} upgraded, {skipped} skipped (not found or no new fields)")

    return upgraded


def main():
    print("=" * 60)
    print("Seeding 31 Consulting Meta Models...")
    print("=" * 60)

    init_kernel_db()
    db = get_db()
    service = MetaModelService(db)

    success_count = 0
    failed_models = []

    for i, meta_data in enumerate(META_MODELS, 1):
        model_key = meta_data["model_key"]
        name = meta_data["name"]

        print(f"\n[{i}/{len(META_MODELS)}] Creating: {model_key} ({name})...")

        try:
            from app.models.kernel.meta_model import MetaModelCreate, FieldDefinition, FieldTypeEnum

            # Convert raw dict to Pydantic models
            fields = []
            for f in meta_data["fields"]:
                field_kwargs = {
                    "field_name": f["field_name"],
                    "field_type": FieldTypeEnum(f["field_type"]),
                    "is_required": f.get("is_required", False),
                    "description": f.get("description"),
                }
                if "default_value" in f and f["default_value"] is not None:
                    field_kwargs["default_value"] = f["default_value"]
                if "enum_options" in f:
                    field_kwargs["enum_options"] = f["enum_options"]
                if "reference_model" in f:
                    field_kwargs["reference_model"] = f["reference_model"]
                fields.append(FieldDefinition(**field_kwargs))

            create_data = MetaModelCreate(
                model_key=meta_data["model_key"],
                name=meta_data["name"],
                fields=fields,
                description=meta_data.get("description"),
            )

            result = service.create_meta_model(create_data)
            print(f"       OK Created (_key: {result['_key']})")
            success_count += 1

        except Exception as e:
            print(f"       FAIL {e}")
            failed_models.append(model_key)

    # Summary
    print("\n" + "=" * 60)
    print(f"Success: {success_count}/{len(META_MODELS)}")
    print(f"Failed:  {len(failed_models)}/{len(META_MODELS)}")
    if failed_models:
        print(f"Failed models: {failed_models}")
    else:
        print(f"All {len(META_MODELS)} meta models seeded successfully!")

    # Verify
    all_meta = service.list_meta_models(limit=100)
    print(f"\nVerification: {len(all_meta)} models in database")
    for m in all_meta:
        field_count = len(m.get("fields", []))
        print(f"  {m.get('model_key'):25s} {m.get('name'):12s} ({field_count} fields)")


if __name__ == "__main__":
    main()
