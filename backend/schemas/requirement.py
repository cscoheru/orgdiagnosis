"""
Client Requirement Schemas

Pydantic models for structured client requirement input.
This is the primary input for the consulting report generation system.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import date
from enum import Enum


class IndustryType(str, Enum):
    """行业类型"""
    MANUFACTURING = "制造业"
    RETAIL = "零售"
    FINANCE = "金融"
    TECH = "科技"
    HEALTHCARE = "医疗"
    EDUCATION = "教育"
    REAL_ESTATE = "房地产"
    ENERGY = "能源"
    LOGISTICS = "物流"
    CONSULTING = "咨询"
    OTHER = "其他"


class PainSeverity(str, Enum):
    """痛点严重程度"""
    CRITICAL = "critical"  # 非常严重，影响生存
    HIGH = "high"          # 严重，影响发展
    MEDIUM = "medium"      # 中等，影响效率
    LOW = "low"            # 轻微，可容忍


class ProjectPhase(BaseModel):
    """项目阶段"""
    phase_id: str = Field(..., description="阶段ID，如 'phase_1'")
    phase_name: str = Field(..., description="阶段名称，如'诊断阶段'")
    duration_weeks: int = Field(..., ge=1, description="预计周数")
    key_activities: List[str] = Field(..., description="主要活动列表")
    deliverables: List[str] = Field(..., description="交付物列表")

    class Config:
        json_schema_extra = {
            "example": {
                "phase_id": "phase_1",
                "phase_name": "诊断与洞察",
                "duration_weeks": 4,
                "key_activities": [
                    "高管访谈",
                    "问卷调研",
                    "数据分析",
                    "标杆研究"
                ],
                "deliverables": [
                    "诊断报告",
                    "痛点清单",
                    "改进机会地图"
                ]
            }
        }


class GanttTask(BaseModel):
    """甘特图任务"""
    task_id: str = Field(..., description="任务ID")
    task_name: str = Field(..., description="任务名称")
    start_date: Optional[date] = Field(None, description="开始日期")
    end_date: Optional[date] = Field(None, description="结束日期")
    owner: Optional[str] = Field(None, description="负责人")
    dependencies: List[str] = Field(default_factory=list, description="依赖任务ID列表")

    class Config:
        json_schema_extra = {
            "example": {
                "task_id": "task_1",
                "task_name": "高管访谈",
                "start_date": "2026-04-01",
                "end_date": "2026-04-15",
                "owner": "项目经理",
                "dependencies": []
            }
        }


class ClientRequirement(BaseModel):
    """
    客户需求结构化输入 - 项目建议书核心数据

    这是系统的主要输入源，包含客户背景、痛点、目标等信息。
    """

    # === 基本信息 ===
    client_name: str = Field(
        ...,
        min_length=2,
        max_length=100,
        description="客户名称"
    )
    industry: IndustryType = Field(
        ...,
        description="行业类型"
    )
    industry_background: str = Field(
        ...,
        min_length=50,
        max_length=5000,
        description="客户行业背景描述，包括行业趋势、竞争格局等"
    )

    # === 公司介绍 ===
    company_intro: str = Field(
        ...,
        min_length=50,
        max_length=5000,
        description="公司简介，包括基本情况、主营业务、发展历程"
    )
    company_scale: Optional[str] = Field(
        None,
        description="公司规模，如'500-1000人'"
    )
    annual_revenue: Optional[str] = Field(
        None,
        description="年营收规模，如'1-5亿'"
    )

    # === 核心痛点 ===
    core_pain_points: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="核心痛点列表，每个痛点建议20-200字"
    )
    pain_severity: Optional[PainSeverity] = Field(
        None,
        description="痛点严重程度"
    )

    # === 项目目标 ===
    project_goals: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="项目目标列表"
    )
    success_criteria: Optional[List[str]] = Field(
        None,
        description="成功标准/验收标准"
    )

    # === 阶段规划 ===
    phase_planning: List[ProjectPhase] = Field(
        ...,
        min_length=1,
        description="项目阶段规划"
    )
    total_duration_weeks: Optional[int] = Field(
        None,
        ge=1,
        description="总周期(周)"
    )

    # === 主要工作任务 ===
    main_tasks: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="主要工作任务清单"
    )

    # === 阶段交付成果 ===
    deliverables: List[str] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="各阶段交付物清单"
    )

    # === 项目计划甘特图 ===
    gantt_chart_data: Optional[List[GanttTask]] = Field(
        None,
        description="甘特图数据"
    )

    # === 可选：五维诊断数据 ===
    five_d_diagnosis: Optional[Dict[str, Any]] = Field(
        None,
        description="五维诊断结果JSON (可选)"
    )

    # === 元数据 ===
    proposal_type: str = Field(
        default="project_proposal",
        description="建议书类型: project_proposal/diagnosis_report/implementation_plan"
    )
    created_by: Optional[str] = Field(None, description="创建人")

    class Config:
        json_schema_extra = {
            "example": {
                "client_name": "示例科技有限公司",
                "industry": "科技",
                "industry_background": "科技行业正处于快速变革期，人工智能、云计算等技术正在重塑行业格局...",
                "company_intro": "示例科技成立于2015年，是一家专注于企业软件开发的高科技公司...",
                "company_scale": "200-500人",
                "core_pain_points": [
                    "绩效考核体系不完善，员工缺乏明确的奋斗目标",
                    "薪酬结构单一，难以吸引和留住优秀人才"
                ],
                "pain_severity": "high",
                "project_goals": [
                    "建立科学的绩效管理体系",
                    "优化薪酬激励机制"
                ],
                "phase_planning": [
                    {
                        "phase_id": "phase_1",
                        "phase_name": "诊断阶段",
                        "duration_weeks": 3,
                        "key_activities": ["高管访谈", "员工调研"],
                        "deliverables": ["诊断报告"]
                    }
                ],
                "main_tasks": [
                    "现状调研与诊断",
                    "方案设计",
                    "试点实施"
                ],
                "deliverables": [
                    "诊断报告",
                    "方案设计文档",
                    "实施手册"
                ]
            }
        }


class ClientRequirementTemplate(BaseModel):
    """客户需求录入模板 - 前端表单使用"""

    template_id: str = "client_requirement_v1"
    template_name: str = "项目建议书需求模板"
    template_version: str = "1.0"

    fields: Dict[str, Dict[str, Any]] = {
        "client_name": {
            "label": "客户名称",
            "type": "text",
            "required": True,
            "placeholder": "请输入客户公司名称"
        },
        "industry": {
            "label": "行业类型",
            "type": "select",
            "required": True,
            "options": [e.value for e in IndustryType]
        },
        "industry_background": {
            "label": "行业背景",
            "type": "textarea",
            "required": True,
            "placeholder": "描述客户所在行业的发展趋势、竞争格局、主要挑战等...",
            "minLength": 50
        },
        "company_intro": {
            "label": "公司介绍",
            "type": "textarea",
            "required": True,
            "placeholder": "客户公司的基本情况、主营业务、发展历程、组织规模等...",
            "minLength": 50
        },
        "core_pain_points": {
            "label": "核心痛点",
            "type": "list",
            "required": True,
            "maxItems": 10,
            "itemPlaceholder": "输入一个痛点描述..."
        },
        "project_goals": {
            "label": "项目目标",
            "type": "list",
            "required": True,
            "maxItems": 10
        },
        "phase_planning": {
            "label": "阶段规划",
            "type": "phases",
            "required": True
        },
        "main_tasks": {
            "label": "主要工作任务",
            "type": "list",
            "required": True
        },
        "deliverables": {
            "label": "阶段交付成果",
            "type": "list",
            "required": True
        }
    }


# 便捷函数
def get_requirement_template() -> ClientRequirementTemplate:
    """获取需求录入模板"""
    return ClientRequirementTemplate()


def validate_requirement(data: Dict[str, Any]) -> ClientRequirement:
    """验证并创建 ClientRequirement 实例"""
    return ClientRequirement(**data)
