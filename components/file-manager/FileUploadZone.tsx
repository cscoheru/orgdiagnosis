'use client';

import { useState, useCallback, useRef } from 'react';
import { Upload, FolderUp, X, File, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// ==================== Types ====================

interface FileUploadZoneProps {
  projectId: string;
  folderId: string;
  onUploadComplete?: () => void;
}

interface FileWithPreview {
  file: File;
  id: string;
}

interface UploadResult {
  success: boolean;
  filename: string;
  error?: string;
}

// ==================== Utility Functions ====================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  const size = parseFloat((bytes / Math.pow(k, i)).toFixed(1));
  return `${size} ${units[i]}`;
}

function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts.pop()?.toLowerCase() || '' : '';
}

function generateId(): string {
  return Math.random().toString(36).substring(2, 11);
}

// ==================== API Function ====================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function uploadFiles(
  files: File[],
  projectId: string,
  folderId: string,
  onProgress?: (current: number, total: number) => void
): Promise<UploadResult[]> {
  const formData = new FormData();
  formData.append('project_id', projectId);
  formData.append('folder_id', folderId);

  files.forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${API_BASE}/api/knowledge/files/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Upload failed');
  }

  const data = await response.json();
  onProgress?.(files.length, files.length);

  // Map response to UploadResult[]
  if (data.files && Array.isArray(data.files)) {
    return data.files.map((f: any) => ({
      success: true,
      filename: f.filename,
    }));
  }

  return files.map((f) => ({
    success: true,
    filename: f.name,
  }));
}

// ==================== File Preview Component ====================

interface FilePreviewItemProps {
  file: File;
  onRemove: () => void;
  disabled: boolean;
}

function FilePreviewItem({ file, onRemove, disabled }: FilePreviewItemProps) {
  const ext = getFileExtension(file.name);

  return (
    <div className="flex items-center gap-3 py-2 px-3 bg-gray-50 rounded-md group">
      <File size={18} className="text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-gray-700 truncate" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-gray-500">
          {formatFileSize(file.size)}
          {ext && <span className="ml-2 uppercase text-gray-400">.{ext}</span>}
        </p>
      </div>
      <button
        onClick={onRemove}
        disabled={disabled}
        className="p-1 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
        title="Remove file"
      >
        <X size={16} className="text-gray-500" />
      </button>
    </div>
  );
}

// ==================== Main FileUploadZone Component ====================

export default function FileUploadZone({
  projectId,
  folderId,
  onUploadComplete,
}: FileUploadZoneProps) {
  // State
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [uploadResults, setUploadResults] = useState<UploadResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);

  // Handle drag events
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!uploading) {
      setIsDragging(true);
    }
  }, [uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Add files to state
  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const filesWithPreview: FileWithPreview[] = fileArray.map((file) => ({
      file,
      id: generateId(),
    }));

    setFiles((prev) => [...prev, ...filesWithPreview]);
    setUploadResults(null);
    setError(null);
  }, []);

  // Handle drop
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (uploading) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      addFiles(droppedFiles);
    }
  }, [uploading, addFiles]);

  // Handle file input change
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles);
    }
    // Reset input so selecting the same file again triggers change
    e.target.value = '';
  }, [addFiles]);

  // Remove file from list
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  // Clear all files
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadResults(null);
    setError(null);
  }, []);

  // Cancel upload (reset state)
  const cancelUpload = useCallback(() => {
    setUploading(false);
    setUploadProgress(null);
    setError('Upload cancelled');
  }, []);

  // Handle upload
  const handleUpload = useCallback(async () => {
    if (files.length === 0 || uploading) return;

    setUploading(true);
    setUploadProgress({ current: 0, total: files.length });
    setError(null);
    setUploadResults(null);

    try {
      const fileList = files.map((f) => f.file);
      const results = await uploadFiles(fileList, projectId, folderId, (current, total) => {
        setUploadProgress({ current, total });
      });

      setUploadResults(results);

      // Check if all uploads were successful
      const allSuccess = results.every((r) => r.success);
      if (allSuccess) {
        // Clear files on success
        setFiles([]);
        onUploadComplete?.();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }, [files, uploading, projectId, folderId, onUploadComplete]);

  // Open file picker
  const openFilePicker = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  // Open folder picker
  const openFolderPicker = useCallback(() => {
    folderInputRef.current?.click();
  }, []);

  // Calculate summary
  const totalSize = files.reduce((acc, f) => acc + f.file.size, 0);
  const successCount = uploadResults?.filter((r) => r.success).length || 0;
  const failCount = uploadResults?.filter((r) => !r.success).length || 0;

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={!uploading ? openFilePicker : undefined}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all
          ${isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-60 cursor-not-allowed' : ''}
        `}
      >
        {/* Drag overlay */}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-100/80 rounded-lg flex items-center justify-center z-10">
            <div className="text-blue-600">
              <Upload size={32} className="mx-auto mb-2" />
              <p className="font-medium">Drop files here</p>
            </div>
          </div>
        )}

        <Upload size={40} className="mx-auto text-gray-400 mb-3" />
        <p className="text-sm text-gray-600 mb-1">
          <span className="font-medium text-blue-600 hover:text-blue-700">Click to upload</span>
          {' '}or drag and drop
        </p>
        <p className="text-xs text-gray-400">
          Supports all file types
        </p>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          // @ts-expect-error webkitdirectory is not in the type definition
          webkitdirectory=""
          onChange={handleFileInputChange}
          className="hidden"
          disabled={uploading}
        />
      </div>

      {/* Folder upload button */}
      <div className="flex justify-center">
        <button
          onClick={openFolderPicker}
          disabled={uploading}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FolderUp size={16} />
          <span>Upload folder</span>
        </button>
      </div>

      {/* File Preview List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {files.length} file{files.length !== 1 ? 's' : ''} selected ({formatFileSize(totalSize)})
            </span>
            <button
              onClick={clearFiles}
              disabled={uploading}
              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              Clear all
            </button>
          </div>

          <div className="max-h-48 overflow-y-auto space-y-2">
            {files.map((fileWithPreview) => (
              <FilePreviewItem
                key={fileWithPreview.id}
                file={fileWithPreview.file}
                onRemove={() => removeFile(fileWithPreview.id)}
                disabled={uploading}
              />
            ))}
          </div>

          {/* Upload Actions */}
          <div className="flex items-center justify-between pt-2">
            {uploading && uploadProgress && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 size={16} className="animate-spin" />
                <span>
                  Uploading {uploadProgress.current} of {uploadProgress.total}...
                </span>
              </div>
            )}

            {!uploading && (
              <span className="text-sm text-gray-500">
                Ready to upload
              </span>
            )}

            <div className="flex gap-2">
              {uploading && (
                <button
                  onClick={cancelUpload}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md"
                >
                  Cancel
                </button>
              )}
              <button
                onClick={handleUpload}
                disabled={uploading || files.length === 0}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload {files.length} file{files.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Results */}
      {uploadResults && uploadResults.length > 0 && (
        <div className="space-y-2">
          {successCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 px-3 py-2 rounded-md">
              <CheckCircle size={16} />
              <span>{successCount} file{successCount !== 1 ? 's' : ''} uploaded successfully</span>
            </div>
          )}
          {failCount > 0 && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
              <AlertCircle size={16} />
              <span>{failCount} file{failCount !== 1 ? 's' : ''} failed to upload</span>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
