"""
Folder Management API Endpoints

Provides REST API for folder operations within projects.
Uses UnifiedProjectStore for data persistence.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import sys
import os

# Add lib to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from lib.projects.unified_store import UnifiedProjectStore

router = APIRouter(prefix="/knowledge/folders", tags=["folders"])
store = UnifiedProjectStore()


# ============================================================
# Pydantic Models
# ============================================================

class CreateFolderRequest(BaseModel):
    project_id: str = Field(..., min_length=1)
    name: str = Field(..., min_length=1, max_length=255)
    parent_id: Optional[str] = None


class UpdateFolderRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    parent_id: Optional[str] = None


class FolderResponse(BaseModel):
    id: str
    project_id: str
    parent_id: Optional[str] = None
    name: str
    path: str
    created_at: str
    updated_at: str


class FolderTreeResponse(BaseModel):
    id: str
    project_id: str
    parent_id: Optional[str] = None
    name: str
    path: str
    children: List["FolderTreeResponse"] = []
    created_at: str
    updated_at: str


# ============================================================
# Helper Functions
# ============================================================

def build_folder_tree(folders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Build a tree structure from flat folder list."""
    # Create lookup by parent_id
    folder_map: Dict[str, List[Dict]] = {}
    for folder in folders:
        parent_id = folder.get("parent_id")
        if parent_id not in folder_map:
            folder_map[parent_id] = []
        folder_map[parent_id].append(folder)

    # Find root folders (parent_id is None)
    tree = []
    for folder in folders:
        if folder.get("parent_id") is None:
            node = dict(folder)
            node["children"] = build_folder_children(folder["id"], folder_map)
            tree.append(node)

    return tree


def build_folder_children(folder_id: str, folder_map: Dict[str, List[Dict]]) -> List[Dict[str, Any]]:
    """Recursively build children for a folder."""
    children = []
    for child in folder_map.get(folder_id, []):
        node = dict(child)
        node["children"] = build_folder_children(child["id"], folder_map)
        children.append(node)
    return children


# ============================================================
# API Endpoints
# ============================================================

@router.post("")
async def create_folder(request: CreateFolderRequest):
    """Create a new folder in a project."""
    try:
        folder = store.create_folder(
            project_id=request.project_id,
            name=request.name,
            parent_id=request.parent_id
        )
        return {"success": True, "folder": folder}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("")
async def get_folders(project_id: str = Query):
    """Get all folders for a project as tree structure."""
    try:
        folders = store.get_folders_by_project(project_id)
        tree = build_folder_tree(folders)
        return {"success": True, "tree": tree, "total": len(folders)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{folder_id}")
async def get_folder(folder_id: str):
    """Get a specific folder by ID."""
    folder = store.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"success": True, "folder": folder}
@router.put("/{folder_id}")
async def update_folder(folder_id: str, request: UpdateFolderRequest):
    """Rename or move a folder."""
    try:
        folder = store.update_folder(
            folder_id=folder_id,
            name=request.name,
            parent_id=request.parent_id
        )
        return {"success": True, "folder": folder}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
@router.delete("/{folder_id}")
async def delete_folder(folder_id: str):
    """Delete folder and all its contents (cascade delete)."""
    deleted = store.delete_folder(folder_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Folder not found")
    return {"success": True, "deleted": True}
