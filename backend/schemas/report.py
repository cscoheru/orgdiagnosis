"""
Report Schemas

Pydantic models for structured consulting report output.
Reports follow a fixed four-part structure for project proposals.
"""

from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any, Literal
from enum import Enum
from datetime import datetime


# === Layout Types for PPTX ===
LayoutType = Literal[
    "title_slide",            # 封面
    "section_divider",        # 章节分隔页
    "bullet_points",          # 要点列表
    "two_columns",            # 双列对比
    "swot_matrix",            # SWOT 矩阵
    "process_flow",           # 流程图
    "five_dimensions_radar",  # 五维雷达图
    "gantt_chart",            # 甘特图
    "team_table",             # 团队表格
    "pricing_table",          # 报价表格
    "case_study",             # 案例展示
    "key_insight",            # 核心观点
]


class SlideDraft(BaseModel):
    """单页 PPT 内容草稿"""

    slide_id: str = Field(..., description="页面唯一ID")
    section: Literal["part1", "part2", "part3", "part4"] = Field(
        ...,
        description="所属部分"
    )
    subsection: str = Field(..., description="子章节名称，如 '1.1 需求背景'")

    # === 布局信息 ===
    layout: LayoutType = Field(..., description="AI推荐的PPT版式")
    visual_strategy: str = Field(
        ...,
        description="视觉策略: matrix/radar/process/text/table"
    )

    # === 内容信息 ===
    title: str = Field(..., description="页面主标题")
    key_message: str = Field(
        ...,
        description="核心观点 (Action Title)，放在页面顶部"
    )
    bullets: List[str] = Field(
        ...,
        max_length=5,
        description="支撑论点，不超过5条"
    )

    # === 素材来源 ===
    retrieved_evidence: Optional[str] = Field(
        None,
        description="从 LlamaIndex 检索到的历史素材"
    )
    source_ref: str = Field(
        ...,
        description="素材来源出处"
    )

    # === 图表数据 ===
    chart_data: Optional[Dict[str, Any]] = Field(
        None,
        description="图表数据 (雷达图/甘特图等)"
    )

    # === 配图信息 ===
    image_prompt: Optional[str] = Field(
        None,
        description="配图提示词"
    )
    image_url: Optional[str] = Field(
        None,
        description="配图URL或本地路径"
    )

    class Config:
        json_schema_extra = {
            "example": {
                "slide_id": "slide_1_1",
                "section": "part1",
                "subsection": "1.1 需求背景",
                "layout": "bullet_points",
                "visual_strategy": "text",
                "title": "行业背景分析",
                "key_message": "科技行业正处于AI驱动的转型期，人才竞争日趋激烈",
                "bullets": [
                    "2025年AI市场规模预计突破5000亿元",
                    "人才缺口达到200万人",
                    "企业数字化转型加速推进"
                ],
                "retrieved_evidence": "根据历史项目经验...",
                "source_ref": "行业研究报告2025",
                "chart_data": None,
                "image_prompt": "科技行业趋势图"
            }
        }


class ReportSection(BaseModel):
    """报告章节"""

    section_id: str = Field(..., description="章节ID")
    section_title: str = Field(..., description="章节标题")
    total_slides: int = Field(default=0, description="总页数")
    slides: List[SlideDraft] = Field(default_factory=list, description="页面列表")


class ReportOutline(BaseModel):
    """报告大纲 - 用于人工审核阶段"""

    report_id: str = Field(..., description="报告ID")
    client_name: str = Field(..., description="客户名称")

    # 四部分大纲
    part1_outline: Dict[str, Any] = Field(
        ...,
        description="第一部分大纲: {subsections, key_points}"
    )
    part2_outline: Dict[str, Any] = Field(
        ...,
        description="第二部分大纲"
    )
    part3_outline: Dict[str, Any] = Field(
        ...,
        description="第三部分大纲"
    )
    part4_outline: Dict[str, Any] = Field(
        ...,
        description="第四部分大纲"
    )

    estimated_slides: int = Field(..., description="预估总页数")
    created_at: datetime = Field(default_factory=datetime.now)


class ReportDraft(BaseModel):
    """
    完整报告草稿 - 四部分固定结构

    这是要导出为 PPTX 的最终数据结构
    """

    report_id: str = Field(..., description="报告ID")
    client_name: str = Field(..., description="客户名称")
    proposal_type: str = Field(
        default="project_proposal",
        description="建议书类型"
    )

    # === 四部分固定结构 ===
    part1_understanding: ReportSection = Field(
        ...,
        description="第一部分：项目需求的理解"
    )
    part2_methodology: ReportSection = Field(
        ...,
        description="第二部分：项目方法与整体框架"
    )
    part3_implementation: ReportSection = Field(
        ...,
        description="第三部分：项目实施步骤"
    )
    part4_plan_team_pricing: ReportSection = Field(
        ...,
        description="第四部分：项目计划、团队与报价"
    )

    # === 汇总信息 ===
    total_slides: int = Field(..., description="总页数")
    overall_score: Optional[float] = Field(None, description="五维诊断总分(如有)")

    # === 元数据 ===
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    def get_all_slides(self) -> List[SlideDraft]:
        """获取所有页面"""
        return (
            self.part1_understanding.slides +
            self.part2_methodology.slides +
            self.part3_implementation.slides +
            self.part4_plan_team_pricing.slides
        )

    def get_slides_by_section(self, section: str) -> List[SlideDraft]:
        """按部分获取页面"""
        section_map = {
            "part1": self.part1_understanding,
            "part2": self.part2_methodology,
            "part3": self.part3_implementation,
            "part4": self.part4_plan_team_pricing,
        }
        return section_map.get(section, ReportSection(section_id="", section_title="")).slides


# === 报告模板常量 ===
REPORT_STRUCTURE = {
    "part1_understanding": {
        "title": "项目需求的理解",
        "description": "Part 1: Understanding Client Requirements",
        "subsections": [
            {"id": "1.1", "title": "需求背景", "required": True, "suggested_slides": 2},
            {"id": "1.2", "title": "关键需求", "required": True, "suggested_slides": 2},
            {"id": "1.3", "title": "客户目标", "required": True, "suggested_slides": 1},
        ]
    },
    "part2_methodology": {
        "title": "项目方法与整体框架",
        "description": "Part 2: Methodology & Framework",
        "subsections": [
            {"id": "2.1", "title": "方法论", "required": True, "suggested_slides": 2},
            {"id": "2.2", "title": "MDS模型", "required": True, "suggested_slides": 2},
            {"id": "2.3", "title": "解决方案框架", "required": True, "suggested_slides": 1},
        ]
    },
    "part3_implementation": {
        "title": "项目实施步骤",
        "description": "Part 3: Implementation Plan",
        "subsections": [
            {"id": "3.1", "title": "阶段一：诊断与洞察", "required": True, "suggested_slides": 2},
            {"id": "3.2", "title": "阶段二：方案设计", "required": True, "suggested_slides": 2},
            {"id": "3.3", "title": "阶段三：落地实施", "required": True, "suggested_slides": 2},
            {"id": "3.4", "title": "阶段四：固化复盘", "required": False, "suggested_slides": 1},
        ]
    },
    "part4_plan_team_pricing": {
        "title": "项目计划、团队与报价",
        "description": "Part 4: Project Plan, Team & Pricing",
        "subsections": [
            {"id": "4.1", "title": "项目计划", "required": True, "suggested_slides": 1},
            {"id": "4.2", "title": "团队配置", "required": True, "suggested_slides": 1},
            {"id": "4.3", "title": "项目报价", "required": True, "suggested_slides": 1},
        ]
    }
}

# MDS 五维模型
MDS_DIMENSIONS = {
    "strategy": {
        "name": "战略",
        "description": "做正确的事",
        "keywords": ["战略", "市场洞察", "业务设计", "竞争分析"]
    },
    "structure": {
        "name": "组织",
        "description": "搭好班子",
        "keywords": ["组织架构", "权责体系", "协同机制"]
    },
    "performance": {
        "name": "绩效",
        "description": "明确指挥棒",
        "keywords": ["绩效考核", "KPI", "OKR", "目标管理"]
    },
    "compensation": {
        "name": "薪酬",
        "description": "提供核心动力",
        "keywords": ["薪酬体系", "激励机制", "固浮比"]
    },
    "talent": {
        "name": "人才",
        "description": "打造人才供应链",
        "keywords": ["人才盘点", "招聘配置", "培养发展"]
    }
}


def create_empty_report(report_id: str, client_name: str) -> ReportDraft:
    """创建空的报告模板"""
    return ReportDraft(
        report_id=report_id,
        client_name=client_name,
        part1_understanding=ReportSection(
            section_id="part1",
            section_title="项目需求的理解",
            slides=[]
        ),
        part2_methodology=ReportSection(
            section_id="part2",
            section_title="项目方法与整体框架",
            slides=[]
        ),
        part3_implementation=ReportSection(
            section_id="part3",
            section_title="项目实施步骤",
            slides=[]
        ),
        part4_plan_team_pricing=ReportSection(
            section_id="part4",
            section_title="项目计划、团队与报价",
            slides=[]
        ),
        total_slides=0
    )
