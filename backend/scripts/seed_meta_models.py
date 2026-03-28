#!/usr/bin/env python3
"""
种子数据：创建 18 个咨询体系元模型 (5 大领域 + 项目管理)

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

    # ========== 绩效 Performance (3) ==========
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
            {"field_name": "project_id", "field_type": "reference", "reference_model": "Consulting_Engagement", "is_required": True, "description": "关联咨询项目"},
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
            {"field_name": "phase_id", "field_type": "reference", "reference_model": "Project_Plan", "is_required": False, "description": "关联阶段"},
            {"field_name": "project_id", "field_type": "reference", "reference_model": "Consulting_Engagement", "is_required": False, "description": "关联项目"},
            {"field_name": "deliverable_type", "field_type": "enum", "is_required": False, "enum_options": ["analysis", "report", "comparison", "plan", "document"], "description": "成果类型"},
            {"field_name": "content", "field_type": "text", "is_required": False, "description": "成果内容摘要"},
            {"field_name": "file_path", "field_type": "string", "is_required": False, "description": "文件路径"},
            {"field_name": "created_by", "field_type": "string", "is_required": False, "description": "创建人"},
            {"field_name": "created_at", "field_type": "datetime", "is_required": False, "description": "创建时间"},
        ],
        "description": "项目管理 — 交付成果记录",
    },
]


def main():
    print("=" * 60)
    print("Seeding 18 Consulting Meta Models...")
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
