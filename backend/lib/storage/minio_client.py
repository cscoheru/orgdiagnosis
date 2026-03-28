"""
MinIO Storage Client (with local filesystem fallback)

Handles file uploads/downloads to MinIO object storage.
When MinIO is unavailable (no package or server down), falls back to local filesystem.
"""

import os
import io
import logging
from typing import Optional, BinaryIO
from pathlib import Path

logger = logging.getLogger(__name__)

# MinIO configuration from environment
# Supports both SDK standard names (MINIO_ACCESS_KEY) and short names (MINIO_USER)
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY") or os.getenv("MINIO_USER", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY") or os.getenv("MINIO_PASSWORD", "")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "knowledge")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# Local storage path (fallback)
LOCAL_STORAGE_PATH = Path(os.getenv("LOCAL_STORAGE_PATH", "data/file_storage"))

# Storage mode: "minio" or "local"
_storage_mode: Optional[str] = None

# MinIO client (lazy initialization)
_minio_client = None


def _detect_storage_mode() -> str:
    """Detect available storage: try MinIO first, fallback to local filesystem."""
    try:
        from minio import Minio
        client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE,
        )
        # Quick connectivity check
        client.list_buckets()
        logger.info(f"MinIO available: {MINIO_ENDPOINT}")
        return "minio"
    except Exception as e:
        logger.warning(f"MinIO unavailable ({e}), falling back to local filesystem at {LOCAL_STORAGE_PATH}")
        return "local"


def get_storage_mode() -> str:
    """Get current storage mode (cached after first detection)."""
    global _storage_mode
    if _storage_mode is None:
        _storage_mode = _detect_storage_mode()
    return _storage_mode


def get_minio_client():
    """Get or create MinIO client (only call when storage_mode == 'minio')"""
    global _minio_client

    if _minio_client is None:
        from minio import Minio
        _minio_client = Minio(
            MINIO_ENDPOINT,
            access_key=MINIO_ACCESS_KEY,
            secret_key=MINIO_SECRET_KEY,
            secure=MINIO_SECURE
        )
        logger.info(f"MinIO client initialized: {MINIO_ENDPOINT}")

    return _minio_client


def ensure_bucket_exists():
    """Ensure the knowledge bucket exists (MinIO only)"""
    if get_storage_mode() != "minio":
        return
    client = get_minio_client()

    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)
        logger.info(f"Created bucket: {MINIO_BUCKET}")


def _local_path(object_name: str) -> Path:
    """Convert object_name to local filesystem path."""
    return LOCAL_STORAGE_PATH / object_name


def upload_file(
    file_data: BinaryIO,
    object_name: str,
    content_type: Optional[str] = None,
    metadata: Optional[dict] = None
) -> str:
    """Upload a file (MinIO or local filesystem)"""
    if get_storage_mode() == "minio":
        return _upload_to_minio(file_data, object_name, content_type, metadata)
    else:
        return _upload_to_local(file_data, object_name)


def _upload_to_minio(
    file_data: BinaryIO,
    object_name: str,
    content_type: Optional[str] = None,
    metadata: Optional[dict] = None
) -> str:
    """Upload to MinIO"""
    ensure_bucket_exists()
    client = get_minio_client()

    if not content_type:
        content_type = _guess_content_type(object_name)

    minio_metadata = {}
    if metadata:
        minio_metadata.update({f"x-amz-meta-{k}": str(v) for k, v in metadata.items()})

    client.put_object(
        MINIO_BUCKET,
        object_name,
        data=file_data,
        length=len(file_data) if isinstance(file_data, bytes) else None,
        content_type=content_type,
        metadata=minio_metadata
    )
    logger.info(f"Uploaded file to MinIO: {object_name}")
    return object_name


def _upload_to_local(file_data: BinaryIO, object_name: str) -> str:
    """Upload to local filesystem"""
    local = _local_path(object_name)
    local.parent.mkdir(parents=True, exist_ok=True)

    data = file_data if isinstance(file_data, bytes) else file_data.read()
    local.write_bytes(data)
    logger.info(f"Uploaded file to local storage: {local}")
    return object_name


def upload_file_from_path(file_path: str, object_name: Optional[str] = None) -> str:
    """Upload a local file"""
    if object_name is None:
        object_name = Path(file_path).name

    with open(file_path, 'rb') as f:
        file_data = f.read()

    return upload_file(file_data, object_name)


def download_file(object_name: str) -> bytes:
    """Download a file (MinIO or local filesystem)"""
    if get_storage_mode() == "minio":
        return _download_from_minio(object_name)
    else:
        return _download_from_local(object_name)


def _download_from_minio(object_name: str) -> bytes:
    """Download from MinIO"""
    client = get_minio_client()
    response = client.get_object(MINIO_BUCKET, object_name)
    return response.read()


def _download_from_local(object_name: str) -> bytes:
    """Download from local filesystem"""
    local = _local_path(object_name)
    if not local.exists():
        raise FileNotFoundError(f"File not found: {local}")
    return local.read_bytes()


def get_file_url(object_name: str, expires: int = 3600, public: bool = False) -> str:
    """Get a presigned URL for a file (MinIO) or local file URL"""
    if get_storage_mode() == "minio":
        client = get_minio_client()
        return client.presigned_get_object(
            MINIO_BUCKET, object_name, expires=expires
        )
    else:
        # Local mode: no presigned URL, return a placeholder
        # In production, this would be served by a static file endpoint
        return f"/api/knowledge/files/local/{object_name}"


def delete_file(object_name: str) -> bool:
    """Delete a file (MinIO or local filesystem)"""
    if get_storage_mode() == "minio":
        return _delete_from_minio(object_name)
    else:
        return _delete_from_local(object_name)


def _delete_from_minio(object_name: str) -> bool:
    """Delete from MinIO"""
    client = get_minio_client()
    try:
        client.remove_object(MINIO_BUCKET, object_name)
        logger.info(f"Deleted file from MinIO: {object_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete file {object_name}: {e}")
        return False


def _delete_from_local(object_name: str) -> bool:
    """Delete from local filesystem"""
    local = _local_path(object_name)
    try:
        local.unlink()
        logger.info(f"Deleted file from local storage: {local}")
        return True
    except FileNotFoundError:
        return False
    except Exception as e:
        logger.error(f"Failed to delete file {object_name}: {e}")
        return False


def file_exists(object_name: str) -> bool:
    """Check if a file exists (MinIO or local filesystem)"""
    if get_storage_mode() == "minio":
        return _exists_in_minio(object_name)
    else:
        return _exists_in_local(object_name)


def _exists_in_minio(object_name: str) -> bool:
    """Check in MinIO"""
    client = get_minio_client()
    try:
        client.stat_object(MINIO_BUCKET, object_name)
        return True
    except Exception:
        return False


def _exists_in_local(object_name: str) -> bool:
    """Check in local filesystem"""
    return _local_path(object_name).exists()


def _guess_content_type(object_name: str) -> str:
    """Guess MIME type from file extension."""
    ext = Path(object_name).suffix.lower()
    content_types = {
        '.pdf': 'application/pdf',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.xls': 'application/vnd.ms-excel',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.md': 'text/markdown',
        '.json': 'application/json',
        '.txt': 'text/plain',
    }
    return content_types.get(ext, 'application/octet-stream')
