'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  File,
  FileText,
  FileImage,
  FileSpreadsheet,
  FileVideo,
  FileAudio2,
  FileCode,
  Download,
  Trash2,
  MoreVertical,
  Loader2,
  FileIcon,
  Presentation,
} from 'lucide-react';

// ==================== Types ====================

export interface KnowledgeFile {
  id: string;
  folder_id: string;
  filename: string;
  file_type: string | null;
  minio_path: string;
  size: number | null;
  metadata: any;
  source_type: string | null;
  created_at: string;
}

interface FileListProps {
  folderId: string;
  onRefresh?: () => void;
}

// ==================== API Functions ====================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchFiles(folderId: string): Promise<KnowledgeFile[]> {
  const response = await fetch(`${API_BASE}/knowledge/files?folder_id=${folderId}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch files' }));
    throw new Error(error.detail || 'Failed to fetch files');
  }
  const data = await response.json();
  return data.files || [];
}

async function deleteFile(fileId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/knowledge/files/${fileId}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete file' }));
    throw new Error(error.detail || 'Failed to delete file');
  }
}

async function getDownloadUrl(fileId: string): Promise<{ download_url: string; filename: string }> {
  const response = await fetch(`${API_BASE}/knowledge/files/${fileId}/download`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to get download URL' }));
    throw new Error(error.detail || 'Failed to get download URL');
  }
  return response.json();
}

// ==================== Utility Functions ====================

function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '-';
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));

  return `${size} ${units[i]}`;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;
  if (months < 12) return `${months}mo ago`;
  return `${years}y ago`;
}

function getFileIcon(fileType: string | null): React.ReactNode {
  const type = fileType?.toLowerCase();

  switch (type) {
    case 'pdf':
      return <FileText size={20} className="text-red-500" />;
    case 'doc':
    case 'docx':
      return <FileText size={20} className="text-blue-600" />;
    case 'xls':
    case 'xlsx':
      return <FileSpreadsheet size={20} className="text-green-600" />;
    case 'ppt':
    case 'pptx':
      return <Presentation size={20} className="text-orange-500" />;
    case 'image':
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return <FileImage size={20} className="text-purple-500" />;
    case 'video':
    case 'mp4':
    case 'mov':
    case 'avi':
      return <FileVideo size={20} className="text-pink-500" />;
    case 'audio':
    case 'mp3':
    case 'wav':
      return <FileAudio2 size={20} className="text-indigo-500" />;
    case 'markdown':
    case 'md':
      return <FileText size={20} className="text-gray-600" />;
    case 'json':
      return <FileCode size={20} className="text-yellow-600" />;
    case 'text':
    case 'txt':
      return <FileText size={20} className="text-gray-500" />;
    default:
      return <FileIcon size={20} className="text-gray-400" />;
  }
}

// ==================== Delete Confirmation Modal ====================

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  filename: string;
  isDeleting: boolean;
}

function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  filename,
  isDeleting,
}: DeleteConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-96 max-w-[90vw]">
        <h3 className="text-lg font-semibold mb-2">Delete File</h3>
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <span className="font-medium text-gray-900">"{filename}"</span>?
          This action cannot be undone.
        </p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== File Item Component ====================

interface FileItemProps {
  file: KnowledgeFile;
  onDelete: (file: KnowledgeFile) => void;
  onDownload: (file: KnowledgeFile) => void;
  isDownloading: boolean;
}

function FileItem({ file, onDelete, onDownload, isDownloading }: FileItemProps) {
  return (
    <div className="flex items-center gap-3 py-3 px-4 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 group">
      {/* File Icon */}
      <div className="flex-shrink-0">
        {getFileIcon(file.file_type)}
      </div>

      {/* File Info */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate" title={file.filename}>
          {file.filename}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span>{formatFileSize(file.size)}</span>
          <span className="text-gray-300">|</span>
          <span>{formatRelativeTime(file.created_at)}</span>
          {file.file_type && (
            <>
              <span className="text-gray-300">|</span>
              <span className="uppercase">{file.file_type}</span>
            </>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={() => onDownload(file)}
          disabled={isDownloading}
          className="p-2 hover:bg-blue-100 rounded-md text-gray-500 hover:text-blue-600 disabled:opacity-50"
          title="Download"
        >
          {isDownloading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
        </button>
        <button
          onClick={() => onDelete(file)}
          className="p-2 hover:bg-red-100 rounded-md text-gray-500 hover:text-red-600"
          title="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

// ==================== Main FileList Component ====================

export default function FileList({ folderId, onRefresh }: FileListProps) {
  // State
  const [files, setFiles] = useState<KnowledgeFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Delete modal state
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    file: KnowledgeFile | null;
  }>({ isOpen: false, file: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch files
  const loadFiles = useCallback(async () => {
    if (!folderId) {
      setFiles([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await fetchFiles(folderId);
      setFiles(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load files');
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [folderId]);

  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Handle download
  const handleDownload = useCallback(async (file: KnowledgeFile) => {
    setDownloadingId(file.id);
    try {
      const { download_url, filename } = await getDownloadUrl(file.id);
      // Open download URL in new tab/window
      const link = document.createElement('a');
      link.href = download_url;
      link.download = filename;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to download file');
    } finally {
      setDownloadingId(null);
    }
  }, []);

  // Handle delete click - open modal
  const handleDeleteClick = useCallback((file: KnowledgeFile) => {
    setDeleteModal({ isOpen: true, file });
  }, []);

  // Handle delete confirm
  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteModal.file) return;

    setIsDeleting(true);
    try {
      await deleteFile(deleteModal.file.id);
      setFiles((prev) => prev.filter((f) => f.id !== deleteModal.file!.id));
      setDeleteModal({ isOpen: false, file: null });
      onRefresh?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete file');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteModal.file, onRefresh]);

  // Close delete modal
  const closeDeleteModal = useCallback(() => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, file: null });
    }
  }, [isDeleting]);

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-gray-400" />
        <span className="ml-3 text-sm text-gray-500">Loading files...</span>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-8 px-4 text-center">
        <p className="text-sm text-red-500 mb-3">{error}</p>
        <button
          onClick={loadFiles}
          className="text-sm text-blue-600 hover:text-blue-700 hover:underline"
        >
          Retry
        </button>
      </div>
    );
  }

  // Empty state
  if (files.length === 0) {
    return (
      <div className="py-12 px-4 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
          <File size={24} className="text-gray-400" />
        </div>
        <p className="text-sm text-gray-500 mb-1">No files in this folder</p>
        <p className="text-xs text-gray-400">Upload files to get started</p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {/* File count header */}
        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
          <span className="text-xs text-gray-500">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* File list */}
        <div className="divide-y divide-gray-100">
          {files.map((file) => (
            <FileItem
              key={file.id}
              file={file}
              onDelete={handleDeleteClick}
              onDownload={handleDownload}
              isDownloading={downloadingId === file.id}
            />
          ))}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={handleDeleteConfirm}
        filename={deleteModal.file?.filename || ''}
        isDeleting={isDeleting}
      />
    </>
  );
}
