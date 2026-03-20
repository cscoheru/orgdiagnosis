"""
Report Generation Workflow Module

Human-in-the-loop consulting report generation using LangGraph.
"""

from .state import (
    ReportState,
    WorkflowStatus,
    create_initial_state,
    update_state,
    mark_error,
    get_progress_for_status,
)

from .nodes import (
    generate_outline_node,
    confirm_outline_node,
    generate_slides_node,
    confirm_slides_node,
    export_pptx_node,
)

from .workflow import (
    ReportWorkflowManager,
    get_workflow_manager,
)

__all__ = [
    # State
    "ReportState",
    "WorkflowStatus",
    "create_initial_state",
    "update_state",
    "mark_error",
    "get_progress_for_status",
    # Nodes
    "generate_outline_node",
    "confirm_outline_node",
    "generate_slides_node",
    "confirm_slides_node",
    "export_pptx_node",
    # Workflow
    "ReportWorkflowManager",
    "get_workflow_manager",
]
