"""
Layout Module

Provides semantic routing and layout management for slide generation.

Created: 2026-03-21
"""

from .semantic_router import (
    SemanticRouter,
    get_semantic_router,
)

__all__ = [
    "SemanticRouter",
    "get_semantic_router",
]
