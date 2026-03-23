"""
MinIO Storage Client

Handles file uploads/downloads to MinIO object storage
"""

import os
import io
import logging
from typing import Optional, BinaryIO
from pathlib import Path

logger = logging.getLogger(__name__)

# MinIO configuration from environment
MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "MinioPwd2026HK")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "knowledge")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

# MinIO client (lazy initialization)
_minio_client = None


def get_minio_client():
    """Get or create MinIO client"""
    global _minio_client

    if _minio_client is None:
        try:
            from minio import Minio
            _minio_client = Minio(
                MINIO_ENDPOINT,
                access_key=MINIO_ACCESS_KEY,
                secret_key=MINIO_SECRET_KEY,
                secure=MINIO_SECURE
            )
            logger.info(f"MinIO client initialized: {MINIO_ENDPOINT}")
        except ImportError:
            logger.error("minio package not installed. Run: pip install minio")
            raise

    return _minio_client


def ensure_bucket_exists():
    """Ensure the knowledge bucket exists"""
    client = get_minio_client()

    if not client.bucket_exists(MINIO_BUCKET):
        client.make_bucket(MINIO_BUCKET)
        logger.info(f"Created bucket: {MINIO_BUCKET}")


def upload_file(
    file_data: BinaryIO,
    object_name: str,
    content_type: Optional[str] = None,
    metadata: Optional[dict] = None
) -> str:
    """
    Upload a file to MinIO

    Args:
        file_data: File content (bytes or file-like object)
        object_name: Object name in bucket (e.g., "documents/uuid.pdf")
        content_type: MIME type (optional)
        metadata: Custom metadata (optional)

    Returns:
        Object name (same as input)
    """
    ensure_bucket_exists()
    client = get_minio_client()

    # Determine content type from extension if not provided
    if not content_type:
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
        content_type = content_types.get(ext, 'application/octet-stream')

    # Build metadata
    minio_metadata = {}
    if metadata:
        minio_metadata.update({f"x-amz-meta-{k}": str(v) for k, v in metadata.items()})

    # Upload
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


def upload_file_from_path(file_path: str, object_name: Optional[str] = None) -> str:
    """
    Upload a local file to MinIO

    Args:
        file_path: Path to local file
        object_name: Object name in bucket (defaults to filename)

    Returns:
        Object name in bucket
    """
    if object_name is None:
        object_name = Path(file_path).name

    with open(file_path, 'rb') as f:
        file_data = f.read()

    return upload_file(file_data, object_name)


def download_file(object_name: str) -> bytes:
    """
    Download a file from MinIO

    Args:
        object_name: Object name in bucket

    Returns:
        File content as bytes
    """
    client = get_minio_client()

    response = client.get_object(MINIO_BUCKET, object_name)

    return response.read()


def get_file_url(object_name: str, expires: int = 3600, public: bool = False) -> str:
    """
    Get a presigned URL for a file

    Args:
        object_name: Object name in bucket
        expires: URL expiration in seconds (default 1 hour)
        public: If True, return public URL (requires public bucket)

    Returns:
        Presigned URL
    """
    client = get_minio_client()

    url = client.presigned_get_object(
        MINIO_BUCKET,
        object_name,
        expires=expires
    )

    return url


def delete_file(object_name: str) -> bool:
    """
    Delete a file from MinIO

    Args:
        object_name: Object name in bucket

    Returns:
        True if deleted successfully
    """
    client = get_minio_client()

    try:
        client.remove_object(MINIO_BUCKET, object_name)
        logger.info(f"Deleted file from MinIO: {object_name}")
        return True
    except Exception as e:
        logger.error(f"Failed to delete file {object_name}: {e}")
        return False


def file_exists(object_name: str) -> bool:
    """
    Check if a file exists in MinIO

    Args:
        object_name: Object name in bucket

    Returns:
        True if file exists
    """
    client = get_minio_client()

    try:
        client.stat_object(MINIO_BUCKET, object_name)
        return True
    except Exception:
        return False
