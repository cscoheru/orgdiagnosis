"""
LangGraph Integration for Five-Dimensional Diagnosis

This module provides state machine workflow for the diagnostic system.
"""

from .state import (
    DiagnosticState,
    WorkflowStatus,
    mark_dimension_complete,
    mark_error,
    update_progress,
)

from .workflow import (
    create_diagnostic_workflow,
    run_diagnosis,
    resume_diagnosis,
    DiagnosisWorkflowManager,
    workflow_manager,
)

__all__ = [
    # State
    "DiagnosticState",
    "WorkflowStatus",
    "mark_dimension_complete",
    "mark_error",
    "update_progress",

    # Workflow
    "create_diagnostic_workflow",
    "run_diagnosis",
    "resume_diagnosis",
    "DiagnosisWorkflowManager",
    "workflow_manager",
]

__version__ = "0.1.0"
