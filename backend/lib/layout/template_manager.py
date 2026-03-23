"""
PPTX Template Manager

Manages presentation templates, themes, and layout registry.
Provides a unified interface for template selection and layout matching.

Created: 2026-03-23
"""

import os
import json
from typing import List, Dict, Any, Optional
from pathlib import Path
from dataclasses import dataclass, asdict
from loguru import logger
from enum import Enum

# Try to import python-pptx
try:
    from pptx import Presentation
    PPTX_AVAILABLE = True
except ImportError:
    PPTX_AVAILABLE = False
    logger.warning("python-pptx not installed")


class ThemeStyle(str, Enum):
    """Available theme styles"""
    PROFESSIONAL = "professional"  # 商务专业
    TECH = "tech"                  # 科技感
    MINIMAL = "minimal"            # 简约
    CREATIVE = "creative"          # 创意
    CORPORATE = "corporate"        # 企业正式


class ThemeColor(str, Enum):
    """Available theme colors"""
    BLUE = "blue"        # 经典蓝
    GREEN = "green"      # 自然绿
    PURPLE = "purple"    # 优雅紫
    ORANGE = "orange"    # 活力橙
    RED = "red"          # 激情红
    GRAY = "gray"        # 商务灰


@dataclass
class ThemeConfig:
    """Theme configuration"""
    theme_id: str
    theme_name: str
    style: ThemeStyle
    color: ThemeColor
    primary_color: str      # Hex color
    secondary_color: str    # Hex color
    accent_color: str       # Hex color
    text_color: str         # Hex color
    background_color: str   # Hex color
    font_family: str
    description: str = ""
    preview_url: str = ""


@dataclass
class LayoutConfig:
    """Layout configuration"""
    layout_id: str
    layout_name: str
    category: str           # MATRIX, PROCESS, PARALLEL, etc.
    element_count_range: tuple
    keywords: List[str]
    description: str
    thumbnail_url: str = ""

    # Layout-specific parameters
    params: Dict[str, Any] = None

    def __post_init__(self):
        if self.params is None:
            self.params = {}


class TemplateManager:
    """
    Template Manager for PPTX generation.

    Manages:
    - Theme configurations
    - Layout registry
    - Template file paths
    - Layout matching logic

    Usage:
        manager = TemplateManager()
        theme = manager.get_theme("blue_professional")
        layout = manager.match_layout(elements=4, relationship="matrix")
    """

    # Default themes
    DEFAULT_THEMES: List[Dict[str, Any]] = [
        {
            "theme_id": "blue_professional",
            "theme_name": "商务蓝",
            "style": ThemeStyle.PROFESSIONAL,
            "color": ThemeColor.BLUE,
            "primary_color": "#00528B",
            "secondary_color": "#336699",
            "accent_color": "#E74C3C",
            "text_color": "#333333",
            "background_color": "#F5F5F5",
            "font_family": "Microsoft YaHei",
            "description": "经典商务蓝色主题，适合企业咨询报告"
        },
        {
            "theme_id": "green_natural",
            "theme_name": "自然绿",
            "style": ThemeStyle.MINIMAL,
            "color": ThemeColor.GREEN,
            "primary_color": "#27AE60",
            "secondary_color": "#2ECC71",
            "accent_color": "#F39C12",
            "text_color": "#2C3E50",
            "background_color": "#FFFFFF",
            "font_family": "Microsoft YaHei",
            "description": "清新自然绿色主题，适合环保、健康相关报告"
        },
        {
            "theme_id": "purple_elegant",
            "theme_name": "优雅紫",
            "style": ThemeStyle.CREATIVE,
            "color": ThemeColor.PURPLE,
            "primary_color": "#8E44AD",
            "secondary_color": "#9B59B6",
            "accent_color": "#E74C3C",
            "text_color": "#2C3E50",
            "background_color": "#F8F9FA",
            "font_family": "Microsoft YaHei",
            "description": "优雅紫色主题，适合创意、设计相关报告"
        },
        {
            "theme_id": "orange_vibrant",
            "theme_name": "活力橙",
            "style": ThemeStyle.TECH,
            "color": ThemeColor.ORANGE,
            "primary_color": "#E67E22",
            "secondary_color": "#F39C12",
            "accent_color": "#3498DB",
            "text_color": "#2C3E50",
            "background_color": "#FFFFFF",
            "font_family": "Microsoft YaHei",
            "description": "活力橙色主题，适合科技、互联网相关报告"
        },
        {
            "theme_id": "gray_corporate",
            "theme_name": "商务灰",
            "style": ThemeStyle.CORPORATE,
            "color": ThemeColor.GRAY,
            "primary_color": "#34495E",
            "secondary_color": "#7F8C8D",
            "accent_color": "#E74C3C",
            "text_color": "#2C3E50",
            "background_color": "#FFFFFF",
            "font_family": "Microsoft YaHei",
            "description": "正式商务灰色主题，适合政府、国企报告"
        }
    ]

    # Extended layout registry (40+ layouts)
    DEFAULT_LAYOUTS: List[Dict[str, Any]] = [
        # === KEY_INSIGHT layouts (single message emphasis) ===
        {
            "layout_id": "KEY_INSIGHT_01",
            "layout_name": "核心观点-居中大字",
            "category": "KEY_INSIGHT",
            "element_count_range": (1, 1),
            "keywords": ["核心", "关键", "重点", "总结"],
            "description": "居中显示单个核心观点，适合开场或总结页",
            "params": {"font_size": 36, "alignment": "center"}
        },
        {
            "layout_id": "KEY_INSIGHT_02",
            "layout_name": "核心观点-左右结构",
            "category": "KEY_INSIGHT",
            "element_count_range": (1, 2),
            "keywords": ["核心", "关键", "重点"],
            "description": "左侧观点，右侧图示，适合强调单一要点",
            "params": {"layout": "left_right", "ratio": "60:40"}
        },

        # === PARALLEL layouts (side-by-side elements) ===
        {
            "layout_id": "PARALLEL_02",
            "layout_name": "并列-双列",
            "category": "PARALLEL",
            "element_count_range": (2, 2),
            "keywords": ["并列", "双列", "两点"],
            "description": "左右并列展示两个要点",
            "params": {"columns": 2}
        },
        {
            "layout_id": "PARALLEL_03",
            "layout_name": "并列-三列",
            "category": "PARALLEL",
            "element_count_range": (3, 3),
            "keywords": ["并列", "三列", "三点"],
            "description": "三列并列展示三个要点",
            "params": {"columns": 3}
        },
        {
            "layout_id": "PARALLEL_04",
            "layout_name": "并列-四列",
            "category": "PARALLEL",
            "element_count_range": (4, 4),
            "keywords": ["并列", "四列", "四点"],
            "description": "四列并列展示四个要点",
            "params": {"columns": 4}
        },
        {
            "layout_id": "PARALLEL_05",
            "layout_name": "并列-五列",
            "category": "PARALLEL",
            "element_count_range": (5, 5),
            "keywords": ["并列", "五列"],
            "description": "五列并列展示",
            "params": {"columns": 5}
        },
        {
            "layout_id": "PARALLEL_06",
            "layout_name": "并列-六列",
            "category": "PARALLEL",
            "element_count_range": (6, 6),
            "keywords": ["并列", "六列"],
            "description": "六列并列展示",
            "params": {"columns": 6}
        },

        # === BULLET layouts (bullet points) ===
        {
            "layout_id": "BULLET_01",
            "layout_name": "要点-标准列表",
            "category": "PARALLEL",
            "element_count_range": (3, 5),
            "keywords": ["要点", "列表", "论点"],
            "description": "标准要点列表，适合陈述核心观点和支撑论点",
            "params": {"bullet_style": "standard"}
        },
        {
            "layout_id": "BULLET_02",
            "layout_name": "要点-带图标",
            "category": "PARALLEL",
            "element_count_range": (3, 4),
            "keywords": ["要点", "图标", "可视化"],
            "description": "带图标的要点列表，增强视觉效果",
            "params": {"bullet_style": "icon"}
        },
        {
            "layout_id": "BULLET_03",
            "layout_name": "要点-编号",
            "category": "PARALLEL",
            "element_count_range": (3, 6),
            "keywords": ["要点", "编号", "序号"],
            "description": "带编号的要点列表，强调顺序",
            "params": {"bullet_style": "numbered"}
        },

        # === MATRIX layouts (2x2, 3x3) ===
        {
            "layout_id": "MATRIX_2x2_01",
            "layout_name": "矩阵-四象限",
            "category": "MATRIX",
            "element_count_range": (4, 4),
            "keywords": ["四象限", "矩阵", "SWOT", "BCG"],
            "description": "标准四象限矩阵，适合SWOT分析、BCG矩阵",
            "params": {"rows": 2, "cols": 2}
        },
        {
            "layout_id": "MATRIX_2x2_02",
            "layout_name": "矩阵-四象限带标题",
            "category": "MATRIX",
            "element_count_range": (4, 4),
            "keywords": ["四象限", "矩阵", "SWOT"],
            "description": "带象限标题的四象限矩阵",
            "params": {"rows": 2, "cols": 2, "show_quadrant_titles": True}
        },
        {
            "layout_id": "MATRIX_3x3_01",
            "layout_name": "矩阵-九宫格",
            "category": "MATRIX",
            "element_count_range": (9, 9),
            "keywords": ["九宫格", "矩阵", "3x3"],
            "description": "九宫格矩阵，适合多维度分析",
            "params": {"rows": 3, "cols": 3}
        },
        {
            "layout_id": "MATRIX_2x3_01",
            "layout_name": "矩阵-2x3",
            "category": "MATRIX",
            "element_count_range": (6, 6),
            "keywords": ["矩阵", "2x3", "六格"],
            "description": "2行3列矩阵布局",
            "params": {"rows": 2, "cols": 3}
        },

        # === PROCESS layouts (sequential flows) ===
        {
            "layout_id": "PROCESS_03_H",
            "layout_name": "流程-三步横向",
            "category": "PROCESS",
            "element_count_range": (3, 3),
            "keywords": ["流程", "步骤", "阶段", "横向"],
            "description": "横向三步流程，适合展示三个阶段",
            "params": {"direction": "horizontal", "steps": 3}
        },
        {
            "layout_id": "PROCESS_04_H",
            "layout_name": "流程-四步横向",
            "category": "PROCESS",
            "element_count_range": (4, 4),
            "keywords": ["流程", "步骤", "阶段", "横向"],
            "description": "横向四步流程，适合展示四个阶段",
            "params": {"direction": "horizontal", "steps": 4}
        },
        {
            "layout_id": "PROCESS_05_H",
            "layout_name": "流程-五步横向",
            "category": "PROCESS",
            "element_count_range": (5, 5),
            "keywords": ["流程", "步骤", "阶段"],
            "description": "横向五步流程",
            "params": {"direction": "horizontal", "steps": 5}
        },
        {
            "layout_id": "PROCESS_06_H",
            "layout_name": "流程-六步横向",
            "category": "PROCESS",
            "element_count_range": (6, 6),
            "keywords": ["流程", "步骤", "阶段"],
            "description": "横向六步流程",
            "params": {"direction": "horizontal", "steps": 6}
        },
        {
            "layout_id": "PROCESS_03_V",
            "layout_name": "流程-三步纵向",
            "category": "PROCESS",
            "element_count_range": (3, 3),
            "keywords": ["流程", "步骤", "纵向"],
            "description": "纵向三步流程",
            "params": {"direction": "vertical", "steps": 3}
        },
        {
            "layout_id": "PROCESS_04_V",
            "layout_name": "流程-四步纵向",
            "category": "PROCESS",
            "element_count_range": (4, 4),
            "keywords": ["流程", "步骤", "纵向"],
            "description": "纵向四步流程",
            "params": {"direction": "vertical", "steps": 4}
        },
        {
            "layout_id": "PROCESS_CIRCULAR",
            "layout_name": "流程-循环",
            "category": "PROCESS",
            "element_count_range": (4, 6),
            "keywords": ["循环", "闭环", "迭代"],
            "description": "循环流程图，适合展示闭环流程",
            "params": {"style": "circular"}
        },

        # === TIMELINE layouts ===
        {
            "layout_id": "TIMELINE_01",
            "layout_name": "时间线-横向",
            "category": "TIMELINE",
            "element_count_range": (3, 6),
            "keywords": ["时间", "进度", "里程碑", "横向"],
            "description": "横向时间线，适合展示项目进度",
            "params": {"direction": "horizontal"}
        },
        {
            "layout_id": "TIMELINE_02",
            "layout_name": "时间线-纵向",
            "category": "TIMELINE",
            "element_count_range": (3, 6),
            "keywords": ["时间", "进度", "纵向"],
            "description": "纵向时间线，适合展示历史发展",
            "params": {"direction": "vertical"}
        },
        {
            "layout_id": "TIMELINE_GANTT",
            "layout_name": "甘特图",
            "category": "TIMELINE",
            "element_count_range": (4, 12),
            "keywords": ["甘特", "计划", "进度", "项目"],
            "description": "甘特图布局，适合项目计划展示",
            "params": {"style": "gantt"}
        },

        # === TABLE layouts ===
        {
            "layout_id": "TABLE_COMPARE_01",
            "layout_name": "对比-双列",
            "category": "TABLE",
            "element_count_range": (2, 2),
            "keywords": ["对比", "比较", "优劣", "方案"],
            "description": "双列对比布局",
            "params": {"style": "comparison"}
        },
        {
            "layout_id": "TABLE_COMPARE_02",
            "layout_name": "对比-三列",
            "category": "TABLE",
            "element_count_range": (3, 3),
            "keywords": ["对比", "比较", "方案"],
            "description": "三列对比布局，适合多方案比较",
            "params": {"style": "comparison", "columns": 3}
        },
        {
            "layout_id": "TABLE_TEAM",
            "layout_name": "团队表格",
            "category": "TABLE",
            "element_count_range": (3, 8),
            "keywords": ["团队", "人员", "角色", "配置"],
            "description": "团队表格布局，适合人员配置展示",
            "params": {"style": "team"}
        },
        {
            "layout_id": "TABLE_PRICING",
            "layout_name": "报价表格",
            "category": "TABLE",
            "element_count_range": (4, 10),
            "keywords": ["报价", "费用", "价格", "明细"],
            "description": "报价表格布局，适合费用明细展示",
            "params": {"style": "pricing"}
        },

        # === DATA_VIZ layouts ===
        {
            "layout_id": "DATA_RADAR",
            "layout_name": "雷达图",
            "category": "DATA_VIZ",
            "element_count_range": (5, 8),
            "keywords": ["雷达", "维度", "评估", "能力"],
            "description": "雷达图布局，适合多维度评估",
            "params": {"chart_type": "radar"}
        },
        {
            "layout_id": "DATA_BAR",
            "layout_name": "柱状图",
            "category": "DATA_VIZ",
            "element_count_range": (3, 8),
            "keywords": ["柱状", "数据", "统计"],
            "description": "柱状图布局",
            "params": {"chart_type": "bar"}
        },
        {
            "layout_id": "DATA_PIE",
            "layout_name": "饼图",
            "category": "DATA_VIZ",
            "element_count_range": (3, 6),
            "keywords": ["饼图", "占比", "分布"],
            "description": "饼图布局，适合占比分析",
            "params": {"chart_type": "pie"}
        },
        {
            "layout_id": "DATA_LINE",
            "layout_name": "折线图",
            "category": "DATA_VIZ",
            "element_count_range": (3, 8),
            "keywords": ["折线", "趋势", "变化"],
            "description": "折线图布局，适合趋势分析",
            "params": {"chart_type": "line"}
        },

        # === PYRAMID layouts ===
        {
            "layout_id": "PYRAMID_01",
            "layout_name": "金字塔-三层",
            "category": "HIERARCHY",
            "element_count_range": (3, 3),
            "keywords": ["金字塔", "层级", "层次"],
            "description": "三层金字塔布局",
            "params": {"levels": 3}
        },
        {
            "layout_id": "PYRAMID_02",
            "layout_name": "金字塔-四层",
            "category": "HIERARCHY",
            "element_count_range": (4, 4),
            "keywords": ["金字塔", "层级"],
            "description": "四层金字塔布局",
            "params": {"levels": 4}
        },

        # === SECTION_DIVIDER layouts ===
        {
            "layout_id": "SECTION_01",
            "layout_name": "章节分隔-简约",
            "category": "SECTION",
            "element_count_range": (1, 1),
            "keywords": ["章节", "分隔", "标题"],
            "description": "简约章节分隔页",
            "params": {"style": "simple"}
        },
        {
            "layout_id": "SECTION_02",
            "layout_name": "章节分隔-带编号",
            "category": "SECTION",
            "element_count_range": (1, 1),
            "keywords": ["章节", "分隔", "编号"],
            "description": "带编号的章节分隔页",
            "params": {"style": "numbered"}
        },

        # === TITLE layouts ===
        {
            "layout_id": "TITLE_01",
            "layout_name": "封面-简约",
            "category": "TITLE",
            "element_count_range": (1, 2),
            "keywords": ["封面", "标题"],
            "description": "简约封面页",
            "params": {"style": "simple"}
        },
        {
            "layout_id": "TITLE_02",
            "layout_name": "封面-带副标题",
            "category": "TITLE",
            "element_count_range": (2, 3),
            "keywords": ["封面", "标题", "副标题"],
            "description": "带副标题的封面页",
            "params": {"style": "with_subtitle"}
        },
    ]

    def __init__(self, template_dir: str = None):
        """
        Initialize the template manager.

        Args:
            template_dir: Directory containing template files
        """
        self.template_dir = Path(template_dir or "app/templates")
        self.themes: Dict[str, ThemeConfig] = {}
        self.layouts: Dict[str, LayoutConfig] = {}

        self._load_default_themes()
        self._load_default_layouts()
        self._load_custom_configs()

        logger.info(f"TemplateManager initialized with {len(self.themes)} themes and {len(self.layouts)} layouts")

    def _load_default_themes(self):
        """Load default theme configurations"""
        for theme_data in self.DEFAULT_THEMES:
            theme = ThemeConfig(**theme_data)
            self.themes[theme.theme_id] = theme

    def _load_default_layouts(self):
        """Load default layout configurations"""
        for layout_data in self.DEFAULT_LAYOUTS:
            layout = LayoutConfig(**layout_data)
            self.layouts[layout.layout_id] = layout

    def _load_custom_configs(self):
        """Load custom theme and layout configurations from files"""
        themes_file = self.template_dir / "themes.json"
        layouts_file = self.template_dir / "layouts.json"

        if themes_file.exists():
            try:
                with open(themes_file, 'r', encoding='utf-8') as f:
                    custom_themes = json.load(f)
                    for theme_data in custom_themes.get("themes", []):
                        theme = ThemeConfig(**theme_data)
                        self.themes[theme.theme_id] = theme
                logger.info(f"Loaded custom themes from {themes_file}")
            except Exception as e:
                logger.warning(f"Failed to load custom themes: {e}")

        if layouts_file.exists():
            try:
                with open(layouts_file, 'r', encoding='utf-8') as f:
                    custom_layouts = json.load(f)
                    for layout_data in custom_layouts.get("layouts", []):
                        layout = LayoutConfig(**layout_data)
                        self.layouts[layout.layout_id] = layout
                logger.info(f"Loaded custom layouts from {layouts_file}")
            except Exception as e:
                logger.warning(f"Failed to load custom layouts: {e}")

    def get_theme(self, theme_id: str) -> Optional[ThemeConfig]:
        """Get a theme by ID"""
        return self.themes.get(theme_id)

    def get_all_themes(self) -> List[ThemeConfig]:
        """Get all available themes"""
        return list(self.themes.values())

    def get_themes_by_style(self, style: ThemeStyle) -> List[ThemeConfig]:
        """Get themes filtered by style"""
        return [t for t in self.themes.values() if t.style == style]

    def get_layout(self, layout_id: str) -> Optional[LayoutConfig]:
        """Get a layout by ID"""
        return self.layouts.get(layout_id)

    def get_all_layouts(self) -> List[LayoutConfig]:
        """Get all available layouts"""
        return list(self.layouts.values())

    def get_layouts_by_category(self, category: str) -> List[LayoutConfig]:
        """Get layouts filtered by category"""
        return [l for l in self.layouts.values() if l.category == category]

    def match_layout(
        self,
        element_count: int,
        relationship: str = "parallel",
        context: Dict[str, Any] = None
    ) -> tuple:
        """
        Match the best layout for given content.

        Args:
            element_count: Number of content elements
            relationship: Content relationship (parallel, sequential, matrix, etc.)
            context: Additional context for matching

        Returns:
            Tuple of (primary_layout_id, alternative_layout_ids)
        """
        context = context or {}
        candidates = []

        # Category mapping
        category_map = {
            "parallel": "PARALLEL",
            "sequential": "PROCESS",
            "matrix": "MATRIX",
            "temporal": "TIMELINE",
            "hierarchical": "HIERARCHY",
            "contrast": "TABLE",
        }

        preferred_category = category_map.get(relationship, "PARALLEL")

        for layout_id, layout in self.layouts.items():
            min_count, max_count = layout.element_count_range

            # Check element count range
            if not (min_count <= element_count <= max_count):
                continue

            score = 0

            # Category match
            if layout.category == preferred_category:
                score += 50

            # Keyword matching
            context_text = context.get("section", "") + " " + context.get("module", "")
            for keyword in layout.keywords:
                if keyword.lower() in context_text.lower():
                    score += 10

            # Exact element count match
            if element_count == min_count or element_count == max_count:
                score += 5

            candidates.append({
                "layout_id": layout_id,
                "score": score,
                "layout": layout
            })

        # Sort by score
        candidates.sort(key=lambda x: x["score"], reverse=True)

        if not candidates:
            # Fallback
            return "BULLET_01", ["PARALLEL_03", "PARALLEL_04"]

        primary = candidates[0]["layout_id"]
        alternatives = [c["layout_id"] for c in candidates[1:4]]

        return primary, alternatives

    def get_template_path(self, theme_id: str) -> Optional[str]:
        """
        Get the path to a template file for a theme.

        Args:
            theme_id: Theme identifier

        Returns:
            Path to the template file or None if not found
        """
        # Check for theme-specific template
        template_path = self.template_dir / "themes" / f"{theme_id}.pptx"
        if template_path.exists():
            return str(template_path)

        # Fallback to default template
        default_path = self.template_dir / "themes" / "default.pptx"
        if default_path.exists():
            return str(default_path)

        return None

    def save_configs(self):
        """Save current configurations to files"""
        self.template_dir.mkdir(parents=True, exist_ok=True)

        # Save themes
        themes_file = self.template_dir / "themes.json"
        themes_data = {
            "version": "1.0",
            "themes": [asdict(t) for t in self.themes.values()]
        }
        with open(themes_file, 'w', encoding='utf-8') as f:
            json.dump(themes_data, f, ensure_ascii=False, indent=2)

        # Save layouts
        layouts_file = self.template_dir / "layouts.json"
        layouts_data = {
            "version": "1.0",
            "layouts": [asdict(l) for l in self.layouts.values()]
        }
        with open(layouts_file, 'w', encoding='utf-8') as f:
            json.dump(layouts_data, f, ensure_ascii=False, indent=2)

        logger.info(f"Saved configurations to {self.template_dir}")


# Singleton instance
_template_manager: Optional[TemplateManager] = None


def get_template_manager() -> TemplateManager:
    """Get the global template manager instance"""
    global _template_manager
    if _template_manager is None:
        _template_manager = TemplateManager()
    return _template_manager
