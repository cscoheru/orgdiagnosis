"""
Project Management API Endpoints

Provides REST API for project-based report generation workflow.
Uses SQLite storage for reliability.
"""

from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
import uuid
import json
from lib.projects.store import project_store

router = APIRouter(prefix="/projects", tags=["projects"])


# ============================================================
# Pydantic Models
# ============================================================

class CreateProjectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_industry: Optional[str] = None
    client_id: Optional[str] = None


class UpdateProjectRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    client_name: Optional[str] = None
    client_industry: Optional[str] = None
    status: Optional[str] = None
    current_step: Optional[str] = None


class RequirementFormRequest(BaseModel):
    project_id: str
    form_step: int = Field(..., ge=1, le=4)

    # Step 1: Basic Info
    client_name: Optional[str] = None
    industry: Optional[str] = None
    company_stage: Optional[str] = None
    employee_count: Optional[int] = None

    # Step 2: Diagnosis Context
    diagnosis_session_id: Optional[str] = None
    pain_points: Optional[List[str]] = None
    goals: Optional[List[str]] = None
    timeline: Optional[str] = None

    # Step 3: Deliverables
    report_type: Optional[str] = None
    slide_count: Optional[int] = None
    focus_areas: Optional[List[str]] = None
    reference_materials: Optional[List[str]] = None

    # Step 4: Style Preferences
    tone: Optional[str] = None
    language: Optional[str] = None
    template_style: Optional[str] = None
    special_requirements: Optional[str] = None


class OutlineSection(BaseModel):
    id: str
    title: str
    key_message: Optional[str] = None
    subsections: Optional[List["OutlineSection"]] = None
    key_points: Optional[List[str]] = None
    slides: Optional[List[Dict[str, Any]]] = None


class SaveOutlineRequest(BaseModel):
    project_id: str
    sections: List[OutlineSection]
    generation_model: Optional[str] = None
    generation_tokens: Optional[int] = None
    rag_sources: Optional[List[Dict[str, Any]]] = None


class ConfirmOutlineRequest(BaseModel):
    project_id: str
    outline_id: str


class SlideData(BaseModel):
    slide_index: int
    section_id: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    key_message: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    layout_type: Optional[str] = None
    model_id: Optional[str] = None
    model_params: Optional[Dict[str, Any]] = None


class SaveSlidesRequest(BaseModel):
    project_id: str
    slides: List[SlideData]


class TriggerExportRequest(BaseModel):
    project_id: str


# ============================================================
# Helper Functions
# ============================================================

async def get_current_user_id() -> str:
    """Get current user ID from auth context."""
    # For now, return anonymous user
    return "anonymous-user"


# ============================================================
# Project CRUD Endpoints
# ============================================================

@router.post("/")
async def create_project(request: CreateProjectRequest):
    """Create a new project."""
    try:
        user_id = await get_current_user_id()

        project = project_store.create_project({
            "name": request.name,
            "description": request.description,
            "client_name": request.client_name,
            "client_industry": request.client_industry,
            "client_id": request.client_id,
            "created_by": user_id,
        })

        return {"success": True, "project": project}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/")
async def list_projects(
    status: Optional[str] = None,
    limit: int = 20,
    offset: int = 0
):
    """List projects for current user."""
    try:
        user_id = await get_current_user_id()
        projects, total = project_store.list_projects(
            user_id=user_id,
            status=status,
            limit=limit,
            offset=offset
        )

        return {
            "projects": projects,
            "total": total,
            "limit": limit,
            "offset": offset
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{project_id}")
async def get_project(project_id: str):
    """Get project with all related data."""
    try:
        project = project_store.get_project(project_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"success": True, "project": project}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{project_id}")
async def update_project(project_id: str, request: UpdateProjectRequest):
    """Update project metadata."""
    try:
        update_data = {k: v for k, v in request.dict().items() if v is not None}

        if not update_data:
            return {"success": True, "message": "No changes"}

        project = project_store.update_project(project_id, update_data)

        return {"success": True, "project": project}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project (cascades to all related data)."""
    try:
        success = project_store.delete_project(project_id)

        if not success:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"success": True, "message": "Project deleted"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Requirement Auto-Save Endpoints
# ============================================================

@router.post("/requirements/save")
async def save_requirement(request: RequirementFormRequest):
    """Auto-save requirement form data."""
    try:
        # Prepare update data
        update_data = {
            "form_step": request.form_step,
            "form_completed": request.form_step >= 4,
        }

        # Add optional fields
        optional_fields = [
            "client_name", "industry", "company_stage", "employee_count",
            "diagnosis_session_id", "pain_points", "goals", "timeline",
            "report_type", "slide_count", "focus_areas", "reference_materials",
            "tone", "language", "template_style", "special_requirements"
        ]

        for field in optional_fields:
            value = getattr(request, field, None)
            if value is not None:
                # Convert lists to JSON strings
                if isinstance(value, list):
                    update_data[field] = json.dumps(value)
                else:
                    update_data[field] = value

        requirement = project_store.save_requirement(request.project_id, update_data)

        # Update project status if form completed
        if request.form_step >= 4:
            project_store.update_project(request.project_id, {
                "status": "requirement",
                "current_step": "outline"
            })

        return {"success": True, "requirement": requirement}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/requirements/{project_id}")
async def get_requirement(project_id: str):
    """Get requirement data for a project."""
    try:
        requirement = project_store.get_requirement(project_id)

        return {"success": True, "requirement": requirement}

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# Statistics Endpoints
# ============================================================

@router.get("/stats/summary")
async def get_project_stats():
    """Get project statistics for dashboard."""
    try:
        user_id = await get_current_user_id()
        stats = project_store.get_stats(user_id)

        return {
            "success": True,
            **stats
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/draft/check")
async def check_draft_projects():
    """Check if user has any draft projects to recover."""
    try:
        user_id = await get_current_user_id()
        draft = project_store.check_draft(user_id)

        return {
            "success": True,
            "has_draft": draft is not None,
            "draft": draft,
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
