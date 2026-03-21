'use client';

import { useState, useCallback } from 'react';

interface LayoutInfo {
  layout_id: string;
  layout_name: string;
  category: string;
  description: string;
  element_count_range: [number, number];
  keywords: string[];
}

interface UploadResult {
  success: boolean;
  template_name: string;
  layouts_count: number;
  layouts: LayoutInfo[];
  message: string;
}

interface TemplateUploaderProps {
  onUploadComplete?: (result: UploadResult) => void;
  className?: string;
}

export default function TemplateUploader({
  onUploadComplete,
  className = '',
}: TemplateUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pptx')) {
      setError('只支持 PPTX 格式的模板文件');
      return;
    }

    setIsUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${API_BASE}/api/layout/template/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || '上传失败');
      }

      const result: UploadResult = await response.json();
      setUploadResult(result);

      if (onUploadComplete) {
        onUploadComplete(result);
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败');
    } finally {
      setIsUploading(false);
    }
  }, [onUploadComplete]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  }, [handleUpload]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleUpload(e.target.files[0]);
    }
  }, [handleUpload]);

  const getCategoryBadge = (category: string) => {
    const badges: Record<string, { color: string; label: string }> = {
      MATRIX: { color: 'bg-purple-100 text-purple-700', label: '矩阵' },
      PROCESS: { color: 'bg-blue-100 text-blue-700', label: '流程' },
      PARALLEL: { color: 'bg-green-100 text-green-700', label: '并列' },
      TABLE: { color: 'bg-orange-100 text-orange-700', label: '表格' },
      TIMELINE: { color: 'bg-cyan-100 text-cyan-700', label: '时间线' },
      DATA_VIZ: { color: 'bg-pink-100 text-pink-700', label: '数据' },
      KEY_INSIGHT: { color: 'bg-yellow-100 text-yellow-700', label: '核心' },
    };

    const badge = badges[category] || badges.PARALLEL;
    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
        {badge.label}
      </span>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          accept=".pptx"
          onChange={handleFileChange}
          className="hidden"
          id="template-upload"
          disabled={isUploading}
        />

        <div className="space-y-3">
          <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>

          <div>
            <label
              htmlFor="template-upload"
              className={`cursor-pointer text-blue-600 hover:text-blue-700 font-medium ${
                isUploading ? 'pointer-events-none opacity-50' : ''
              }`}
            >
              点击上传模板
            </label>
            <p className="text-gray-500 text-sm mt-1">或拖拽 PPTX 文件到此处</p>
          </div>

          <p className="text-xs text-gray-400">
            支持 .pptx 格式，文件大小不超过 50MB
          </p>
        </div>
      </div>

      {/* Loading State */}
      {isUploading && (
        <div className="flex items-center justify-center py-4">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3" />
          <span className="text-gray-600">正在解析模板，请稍候...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Success Result */}
      {uploadResult && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-green-700">
              <span>✅</span>
              <span className="font-medium">{uploadResult.message}</span>
            </div>
            <p className="text-sm text-green-600 mt-1">
              模板: {uploadResult.template_name}
            </p>
          </div>

          {/* Extracted Layouts */}
          {uploadResult.layouts.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900">提取的布局 ({uploadResult.layouts.length})</h4>
              <div className="grid gap-2 max-h-80 overflow-y-auto">
                {uploadResult.layouts.map((layout) => (
                  <div
                    key={layout.layout_id}
                    className="bg-white border border-gray-200 rounded-lg p-3 hover:border-blue-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-400 font-mono">{layout.layout_id}</span>
                          {getCategoryBadge(layout.category)}
                        </div>
                        <h5 className="font-medium text-gray-900 text-sm truncate">
                          {layout.layout_name}
                        </h5>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                          {layout.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-gray-400">
                            {layout.element_count_range[0]}-{layout.element_count_range[1]} 要素
                          </span>
                          {layout.keywords.length > 0 && (
                            <div className="flex gap-1">
                              {layout.keywords.slice(0, 3).map((kw, i) => (
                                <span key={i} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[10px] rounded">
                                  {kw}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
