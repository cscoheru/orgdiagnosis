"""
Layout Module

Provides semantic routing, layout management, and template management for slide generation.

Created: 2026-03-21
Updated: 2026-03-23 - Added TemplateManager for intelligent layout system
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
]
