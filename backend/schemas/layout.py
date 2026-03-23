"""
Layout Schemas and Default Configurations

Defines data structures and default layouts for slide generation.

Created: 2026-03-23
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class VisualModelCategory(str, Enum):
    """Visual model categories for layout classification"""
    MATRIX = "MATRIX"               # 矩阵类 (SWOT, BCG, etc.)
    PROCESS = "PROCESS"             # 流程类 (步骤, 递进)
    PARALLEL = "PARALLEL"           # 并列类 (独立要点)
    TABLE = "TABLE"                 # 表格类 (对比, 方案)
    TIMELINE = "TIMELINE"           # 时间线类 (里程碑, 甘特)
    DATA_VIZ = "DATA_VIZ"           # 数据可视化类 (图表, 图形)
    KEY_INSIGHT = "KEY_INSIGHT"     # 核心观点类 (单一强调)
    HIERARCHY = "HIERARCHY"         # 层级类 (金字塔, 树形)
    SECTION = "SECTION"             # 章节分隔类
    TITLE = "TITLE"                 # 封面标题类


@dataclass
class SlideElement:
    """
    A single element in a slide.

    Represents a bullet point, paragraph, or visual element.
    """
    element_id: str
    element_title: str
    element_content: str
    element_type: str = "text"
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "element_id": self.element_id,
            "element_title": self.element_title,
            "element_content": self.element_content,
            "element_type": self.element_type,
            "metadata": self.metadata
        }


@dataclass
class LayoutManifest:
    """
    Manifest for a single layout configuration.

    Describes the visual and semantic properties of a layout.
    """
    layout_id: str
    layout_name: str
    category: str
    description: str
    element_count_range: Tuple[int, int]
    keywords: List[str] = field(default_factory=list)
    params: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "layout_id": self.layout_id,
            "layout_name": self.layout_name,
            "category": self.category,
            "description": self.description,
            "element_count_range": list(self.element_count_range),
            "keywords": self.keywords,
            "params": self.params
        }


# Default Layout Manifests
# These are the core layouts available in the system

DEFAULT_LAYOUT_MANIFESTS: List[Dict[str, Any]] = [
    # === KEY INSIGHT LAYOUTS ===
    {
        "layout_id": "KEY_INSIGHT_01",
        "layout_name": "核心观点-大字强调",
        "category": "KEY_INSIGHT",
        "description": "大字居中展示单一核心观点，适合强调最重要的结论或建议",
        "element_count_range": (1, 1),
        "keywords": ["核心", "关键", "重要", "结论", "建议", "要点"],
        "params": {"font_size": 36, "center_align": True}
    },

    # === BULLET LAYOUTS ===
    {
        "layout_id": "BULLET_01",
        "layout_name": "要点-标准列表",
        "category": "PARALLEL",
        "description": "标准垂直列表，适合3-5个并列要点",
        "element_count_range": (2, 6),
        "keywords": ["要点", "列表", "罗列", "清单"],
        "params": {"bullet_style": "disc", "line_spacing": 1.5}
    },
    {
        "layout_id": "BULLET_02",
        "layout_name": "要点-双列列表",
        "category": "PARALLEL",
        "description": "双列布局，适合6-8个要点",
        "element_count_range": (4, 8),
        "keywords": ["要点", "列表", "双列"],
        "params": {"columns": 2, "bullet_style": "disc"}
    },
    {
        "layout_id": "BULLET_03",
        "layout_name": "要点-紧凑列表",
        "category": "PARALLEL",
        "description": "紧凑布局，适合8-10个要点",
        "element_count_range": (6, 12),
        "keywords": ["要点", "列表", "紧凑"],
        "params": {"bullet_style": "disc", "line_spacing": 1.2}
    },

    # === PARALLEL CARD LAYOUTS ===
    {
        "layout_id": "PARALLEL_02_CARDS",
        "layout_name": "并列-双卡片",
        "category": "PARALLEL",
        "description": "两个并列卡片，适合对比或双要点展示",
        "element_count_range": (2, 2),
        "keywords": ["并列", "对比", "双卡片"],
        "params": {"card_style": "rounded", "show_number": True}
    },
    {
        "layout_id": "PARALLEL_03_CARDS",
        "layout_name": "并列-三卡片",
        "category": "PARALLEL",
        "description": "三个并列卡片，适合三要点展示",
        "element_count_range": (3, 3),
        "keywords": ["并列", "三卡片", "三要素"],
        "params": {"card_style": "rounded", "show_number": True}
    },
    {
        "layout_id": "PARALLEL_04_CARDS",
        "layout_name": "并列-四卡片",
        "category": "PARALLEL",
        "description": "四个并列卡片，适合四要点展示",
        "element_count_range": (4, 4),
        "keywords": ["并列", "四卡片", "四要素"],
        "params": {"card_style": "rounded", "show_number": True, "grid": "2x2"}
    },
    {
        "layout_id": "PARALLEL_06_CARDS",
        "layout_name": "并列-六卡片",
        "category": "PARALLEL",
        "description": "六个并列卡片，2行3列布局",
        "element_count_range": (5, 6),
        "keywords": ["并列", "六卡片", "六要素"],
        "params": {"card_style": "rounded", "show_number": True, "grid": "2x3"}
    },

    # === PROCESS LAYOUTS ===
    {
        "layout_id": "PROCESS_03_H",
        "layout_name": "流程-三步骤(水平)",
        "category": "PROCESS",
        "description": "水平三步骤流程图，适合线性流程展示",
        "element_count_range": (3, 3),
        "keywords": ["流程", "步骤", "阶段", "顺序"],
        "params": {"orientation": "horizontal", "show_arrows": True}
    },
    {
        "layout_id": "PROCESS_04_H",
        "layout_name": "流程-四步骤(水平)",
        "category": "PROCESS",
        "description": "水平四步骤流程图",
        "element_count_range": (4, 4),
        "keywords": ["流程", "步骤", "阶段", "四步"],
        "params": {"orientation": "horizontal", "show_arrows": True}
    },
    {
        "layout_id": "PROCESS_05_H",
        "layout_name": "流程-五步骤(水平)",
        "category": "PROCESS",
        "description": "水平五步骤流程图",
        "element_count_range": (5, 5),
        "keywords": ["流程", "步骤", "阶段", "五步"],
        "params": {"orientation": "horizontal", "show_arrows": True}
    },
    {
        "layout_id": "PROCESS_03_V",
        "layout_name": "流程-三步骤(垂直)",
        "category": "PROCESS",
        "description": "垂直三步骤流程图",
        "element_count_range": (3, 3),
        "keywords": ["流程", "步骤", "阶段", "垂直"],
        "params": {"orientation": "vertical", "show_arrows": True}
    },
    {
        "layout_id": "PROCESS_04_V",
        "layout_name": "流程-四步骤(垂直)",
        "category": "PROCESS",
        "description": "垂直四步骤流程图",
        "element_count_range": (4, 4),
        "keywords": ["流程", "步骤", "阶段", "垂直", "四步"],
        "params": {"orientation": "vertical", "show_arrows": True}
    },

    # === MATRIX LAYOUTS ===
    {
        "layout_id": "MATRIX_2x2",
        "layout_name": "矩阵-四象限",
        "category": "MATRIX",
        "description": "2x2四象限矩阵，适合SWOT分析、BCG矩阵等",
        "element_count_range": (4, 4),
        "keywords": ["矩阵", "四象限", "SWOT", "BCG", "2x2"],
        "params": {"style": "quadrant", "show_labels": True}
    },
    {
        "layout_id": "MATRIX_3x3",
        "layout_name": "矩阵-九宫格",
        "category": "MATRIX",
        "description": "3x3九宫格矩阵，适合优先级矩阵等",
        "element_count_range": (9, 9),
        "keywords": ["矩阵", "九宫格", "3x3", "优先级"],
        "params": {"style": "grid", "show_labels": True}
    },

    # === TIMELINE LAYOUTS ===
    {
        "layout_id": "TIMELINE_03",
        "layout_name": "时间线-三节点",
        "category": "TIMELINE",
        "description": "三节点时间线，适合展示3个里程碑",
        "element_count_range": (3, 3),
        "keywords": ["时间线", "里程碑", "进度", "节点"],
        "params": {"show_dates": True, "style": "horizontal"}
    },
    {
        "layout_id": "TIMELINE_04",
        "layout_name": "时间线-四节点",
        "category": "TIMELINE",
        "description": "四节点时间线",
        "element_count_range": (4, 4),
        "keywords": ["时间线", "里程碑", "进度", "四节点"],
        "params": {"show_dates": True, "style": "horizontal"}
    },
    {
        "layout_id": "TIMELINE_05",
        "layout_name": "时间线-五节点",
        "category": "TIMELINE",
        "description": "五节点时间线",
        "element_count_range": (5, 5),
        "keywords": ["时间线", "里程碑", "进度", "五节点"],
        "params": {"show_dates": True, "style": "horizontal"}
    },
    {
        "layout_id": "TIMELINE_06",
        "layout_name": "时间线-六节点",
        "category": "TIMELINE",
        "description": "六节点时间线",
        "element_count_range": (6, 6),
        "keywords": ["时间线", "里程碑", "进度", "六节点"],
        "params": {"show_dates": True, "style": "horizontal"}
    },

    # === TABLE/COMPARISON LAYOUTS ===
    {
        "layout_id": "TABLE_COMPARE_2",
        "layout_name": "对比-双列表格",
        "category": "TABLE",
        "description": "双列对比表格，适合方案对比、优劣分析",
        "element_count_range": (2, 6),
        "keywords": ["对比", "比较", "表格", "优劣", "方案"],
        "params": {"columns": 2, "show_header": True}
    },
    {
        "layout_id": "TABLE_COMPARE_3",
        "layout_name": "对比-三列表格",
        "category": "TABLE",
        "description": "三列对比表格",
        "element_count_range": (3, 9),
        "keywords": ["对比", "比较", "表格", "三列"],
        "params": {"columns": 3, "show_header": True}
    },

    # === HIERARCHY LAYOUTS ===
    {
        "layout_id": "HIERARCHY_PYRAMID_3",
        "layout_name": "层级-金字塔(三层)",
        "category": "HIERARCHY",
        "description": "三层金字塔结构，适合分层概念展示",
        "element_count_range": (3, 3),
        "keywords": ["金字塔", "层级", "层次", "三层"],
        "params": {"style": "pyramid", "levels": 3}
    },
    {
        "layout_id": "HIERARCHY_PYRAMID_4",
        "layout_name": "层级-金字塔(四层)",
        "category": "HIERARCHY",
        "description": "四层金字塔结构",
        "element_count_range": (4, 4),
        "keywords": ["金字塔", "层级", "层次", "四层"],
        "params": {"style": "pyramid", "levels": 4}
    },
    {
        "layout_id": "HIERARCHY_PYRAMID_5",
        "layout_name": "层级-金字塔(五层)",
        "category": "HIERARCHY",
        "description": "五层金字塔结构",
        "element_count_range": (5, 5),
        "keywords": ["金字塔", "层级", "层次", "五层"],
        "params": {"style": "pyramid", "levels": 5}
    },

    # === SECTION DIVIDER ===
    {
        "layout_id": "SECTION_01",
        "layout_name": "章节分隔-标准",
        "category": "SECTION",
        "description": "章节分隔页，显示章节标题和描述",
        "element_count_range": (1, 2),
        "keywords": ["章节", "分隔", "目录"],
        "params": {"show_number": True}
    },

    # === TITLE SLIDE ===
    {
        "layout_id": "TITLE_01",
        "layout_name": "封面-标准",
        "category": "TITLE",
        "description": "标准封面页，显示标题、副标题和日期",
        "element_count_range": (1, 3),
        "keywords": ["封面", "标题", "首页"],
        "params": {"center_align": True}
    },

    # === DATA VISUALIZATION ===
    {
        "layout_id": "DATA_VIZ_BAR",
        "layout_name": "数据可视化-柱状图",
        "category": "DATA_VIZ",
        "description": "柱状图布局，适合数据对比",
        "element_count_range": (2, 8),
        "keywords": ["柱状图", "数据", "图表", "对比"],
        "params": {"chart_type": "bar"}
    },
    {
        "layout_id": "DATA_VIZ_PIE",
        "layout_name": "数据可视化-饼图",
        "category": "DATA_VIZ",
        "description": "饼图布局，适合占比展示",
        "element_count_range": (2, 6),
        "keywords": ["饼图", "数据", "图表", "占比"],
        "params": {"chart_type": "pie"}
    },
    {
        "layout_id": "DATA_VIZ_LINE",
        "layout_name": "数据可视化-折线图",
        "category": "DATA_VIZ",
        "description": "折线图布局，适合趋势展示",
        "element_count_range": (2, 12),
        "keywords": ["折线图", "数据", "图表", "趋势"],
        "params": {"chart_type": "line"}
    },
    {
        "layout_id": "DATA_VIZ_RADAR",
        "layout_name": "数据可视化-雷达图",
        "category": "DATA_VIZ",
        "description": "雷达图布局，适合多维度评估",
        "element_count_range": (3, 8),
        "keywords": ["雷达图", "数据", "图表", "维度", "评估"],
        "params": {"chart_type": "radar"}
    },
]


def get_layout_by_id(layout_id: str) -> Optional[Dict[str, Any]]:
    """Get a layout manifest by ID"""
    for layout in DEFAULT_LAYOUT_MANIFESTS:
        if layout["layout_id"] == layout_id:
            return layout
    return None


def get_layouts_by_category(category: str) -> List[Dict[str, Any]]:
    """Get all layouts for a category"""
    return [
        layout for layout in DEFAULT_LAYOUT_MANIFESTS
        if layout["category"] == category
    ]


def get_layouts_for_element_count(count: int) -> List[Dict[str, Any]]:
    """Get all layouts that support a given element count"""
    return [
        layout for layout in DEFAULT_LAYOUT_MANIFESTS
        if layout["element_count_range"][0] <= count <= layout["element_count_range"][1]
    ]
