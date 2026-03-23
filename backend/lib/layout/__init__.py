"""
Layout Module

Provides semantic routing, layout management, and template management for slide generation.

Created: 2026-03-21
Updated: 2026-03-23 - Added TemplateManager, ContentAnalyzer, IntelligentLayoutSelector
"""

from .semantic_router import (
    SemanticRouter,
    get_semantic_router,
)

from .template_manager import (
    TemplateManager,
    ThemeConfig,
    LayoutConfig,
    ThemeStyle,
    ThemeColor,
    get_template_manager,
)

from .content_analyzer import (
    ContentAnalyzer,
    ContentAnalysisResult,
    ContentRelationship,
    TextDensity,
    get_content_analyzer,
)

from .intelligent_selector import (
    IntelligentLayoutSelector,
    LayoutRecommendation,
    LayoutSelectionResult,
    get_layout_selector,
)

from .visual_elements import (
    ShapeFactory,
    ChartBuilder,
    LayoutRenderer,
    ColorScheme,
    Position,
    get_layout_renderer,
)

__all__ = [
    # Semantic Router
    "SemanticRouter",
    "get_semantic_router",
    # Template Manager
    "TemplateManager",
    "ThemeConfig",
    "LayoutConfig",
    "ThemeStyle",
    "ThemeColor",
    "get_template_manager",
    # Content Analyzer
    "ContentAnalyzer",
    "ContentAnalysisResult",
    "ContentRelationship",
    "TextDensity",
    "get_content_analyzer",
    # Intelligent Selector
    "IntelligentLayoutSelector",
    "LayoutRecommendation",
    "LayoutSelectionResult",
    "get_layout_selector",
    # Visual Elements
    "ShapeFactory",
    "ChartBuilder",
    "LayoutRenderer",
    "ColorScheme",
    "Position",
    "get_layout_renderer",
]
