"""
File Management API Endpoints
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from typing import Optional, List
from pathlib import Path

from lib.projects.unified_store import UnifiedProjectStore
from lib.storage.minio_client import upload_file, get_file_url, delete_file

router = APIRouter(prefix="/knowledge/files", tags=["files"])
store = UnifiedProjectStore()


@router.post("/upload")
async def upload_files(
    files: List[UploadFile] = File(...),
    project_id: str = Form(...),
    folder_id: Optional[str] = Form(default=None)
):
    """
    Upload files to a folder.
    Supports folder upload via webkitdirectory (folder_path preserved in filename).
    """
    if not files:
        raise HTTPException(status_code=400, detail="No files provided")

    # Get or create folder
    if folder_id:
        folder = store.get_folder(folder_id)
        if not folder:
            raise HTTPException(status_code=404, detail=f"Folder {folder_id} not found")
    else:
        # Get or create root folder for project
        folder = store.get_or_create_root_folder(project_id)

    uploaded = []
    errors = []

    for file in files:
        try:
            # Read file content
            content = await file.read()

            # Determine file type from extension
            ext = Path(file.filename).suffix.lower()
            file_types = {
                '.pdf': 'pdf',
                '.docx': 'docx',
                '.doc': 'doc',
                '.pptx': 'pptx',
                '.xlsx': 'xlsx',
                '.xls': 'xls',
                '.png': 'image',
                '.jpg': 'image',
                '.jpeg': 'image',
                '.gif': 'image',
                '.md': 'markdown',
                '.txt': 'text',
                '.json': 'json',
            }
            file_type = file_types.get(ext, 'other')

            # Generate MinIO path
            minio_path = f"projects/{project_id}/{file.filename}"

            # Upload to MinIO
            upload_file(content, minio_path)

            # Create file record
            file_record = store.create_file(
                folder_id=folder['id'],
                filename=file.filename,
                minio_path=minio_path,
                file_type=file_type,
                size=len(content),
                source_type='upload'
            )

            uploaded.append({
                "id": file_record['id'],
                "filename": file_record['filename'],
                "file_type": file_type,
                "size": len(content),
                "minio_path": minio_path
            })

        except Exception as e:
            errors.append({
                "filename": file.filename,
                "error": str(e)
            })

    return {
        "uploaded": len(uploaded),
        "files": uploaded,
        "errors": errors if errors else None
    }


@router.get("")
async def get_files(folder_id: str):
    """Get all files in a folder"""
    folder = store.get_folder(folder_id)
    if not folder:
        raise HTTPException(status_code=404, detail=f"Folder {folder_id} not found")

    files = store.get_files_by_folder(folder_id)
    return {"files": files, "count": len(files)}


@router.get("/{file_id}")
async def get_file(file_id: str):
    """Get a specific file"""
    file = store.get_file(file_id)
    if not file:
        raise HTTPException(status_code=404, detail=f"File {file_id} not found")
    return file


@router.get("/{file_id}/download")
async def download_file(file_id: str):
    """Get presigned download URL"""
    file = store.get_file(file_id)
    if not file:
        raise HTTPException(status_code=404, detail=f"File {file_id} not found")

    try:
        download_url = get_file_url(file['minio_path'])
        return {
            "download_url": download_url,
            "filename": file['filename'],
            "file_type": file.get('file_type'),
            "size": file.get('size')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate download URL: {e}")


@router.delete("/{file_id}")
async def delete_file_endpoint(file_id: str):
    """Delete file (both DB record and MinIO object)"""
    file = store.get_file(file_id)
    if not file:
        raise HTTPException(status_code=404, detail=f"File {file_id} not found")

    try:
        # Delete from MinIO first
        delete_file(file['minio_path'])
    except Exception as e:
        # Log but continue - DB record is more important
        print(f"Warning: Failed to delete from MinIO: {e}")

    # Delete from database
    success = store.delete_file(file_id)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to delete file record")

    return {"success": True, "message": f"File {file_id} deleted"}


@router.get("/search")
async def search_files(
    query: str,
    project_id: Optional[str] = None,
    limit: int = 50
):
    """Search files using FTS5 with LIKE fallback for Chinese"""
    if not query:
        raise HTTPException(status_code=400, detail="Query parameter required")

    results = store.search_files(query, project_id=project_id, limit=limit)
    return {
        "query": query,
        "results": results,
        "count": len(results)
    }
