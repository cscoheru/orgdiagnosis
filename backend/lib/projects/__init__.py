"""
Unified Project Management

All modules share the single source of truth for projects.
"""

from .unified_store import unified_store, UnifiedProjectStore
from .store import project_store, ProjectStore  # Keep for backward compatibility

__all__ = ['unified_store', 'UnifiedProjectStore', 'project_store', 'ProjectStore']
