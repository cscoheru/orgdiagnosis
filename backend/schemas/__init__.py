"""
Schemas Module

Pydantic models for the consulting report generation system.
"""

from .requirement import (
    ClientRequirement,
    ClientRequirementTemplate,
    IndustryType,
    PainSeverity,
    ProjectPhase,
    GanttTask,
    get_requirement_template,
    validate_requirement,
)

from .report import (
    SlideDraft,
    ReportSection,
    ReportOutline,
    ReportDraft,
    LayoutType,
    REPORT_STRUCTURE,
    MDS_DIMENSIONS,
    create_empty_report,
)

__all__ = [
    # Requirement models
    "ClientRequirement",
    "ClientRequirementTemplate",
    "IndustryType",
    "PainSeverity",
    "ProjectPhase",
    "GanttTask",
    "get_requirement_template",
    "validate_requirement",
    # Report models
    "SlideDraft",
    "ReportSection",
    "ReportOutline",
    "ReportDraft",
    "LayoutType",
    "REPORT_STRUCTURE",
    "MDS_DIMENSIONS",
    "create_empty_report",
]
