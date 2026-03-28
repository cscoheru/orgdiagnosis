'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Theme {
  theme_id: string;
  theme_name: string;
  style: string;
  color: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  description: string;
  preview_url?: string;
}

// Backend theme to display template converter
function themeToDisplay(theme: Theme) {
  return {
    id: theme.theme_id,
    name: theme.theme_name,
    description: theme.description,
    style: {
      primaryColor: theme.primary_color,
      secondaryColor: theme.secondary_color,
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
    },
    isSystem: true,
    source: 'backend',
  };
}

export default function TemplatesPage() {
  const [themes, setThemes] = useState<Theme[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load themes from backend API
  useEffect(() => {
    const loadThemes = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/layout/themes`);
        if (!response.ok) throw new Error('Failed to load themes');

        const data = await response.json();
        console.log('[Templates] Loaded themes from API:', data.total);
        setThemes(data.themes || []);
      } catch (err) {
        console.error('[Templates] Failed to load themes:', err);
        setError('加载主题失败，请检查后端服务');
      } finally {
        setLoading(false);
      }
    };

    loadThemes();
  }, []);

  // Upload template to backend
  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pptx')) {
      alert('只支持 PPTX 格式的母版文件');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('use_ai_description', 'true');

      const response = await fetch(`${API_BASE}/api/layout/template/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Upload failed');
      }

      const result = await response.json();
      console.log('[Templates] Upload result:', result);

      if (result.success) {
        alert(`母版上传成功！解析了 ${result.layouts_count} 个布局`);
        // Reload themes after successful upload
        const themesResponse = await fetch(`${API_BASE}/api/layout/themes`);
        if (themesResponse.ok) {
          const data = await themesResponse.json();
          setThemes(data.themes || []);
        }
      } else {
        alert(result.message || '上传失败，请重试');
      }
    } catch (err) {
      console.error('[Templates] Upload error:', err);
      setError(err instanceof Error ? err.message : '上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, []);

  // Delete template from backend
  const handleDelete = useCallback(async (templateId: string) => {
    if (!confirm('确定要删除这个母版吗？')) return;

    try {
      const response = await fetch(`${API_BASE}/api/layout/template/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      // Remove from local state
      setThemes(prev => prev.filter(t => t.theme_id !== templateId));
      alert('母版已删除');
    } catch (err) {
      console.error('[Templates] Delete error:', err);
      alert('删除失败，请重试');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleUpload(e.dataTransfer.files[0]);
    }
  }, [handleUpload]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600">加载主题...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Deprecation banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center justify-between">
        <span className="text-sm text-amber-700">
          模板管理已迁移至设置
        </span>
        <Link href="/settings/export" className="text-sm text-amber-700 underline hover:text-amber-800">
          前往设置 →
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">母版管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理 PPT 整体视觉风格（配色、字体、布局）
            </p>
          </div>
          <Link
            href="/layouts"
            className="text-blue-600 hover:text-blue-700 text-sm"
          >
            管理 Layout →
          </Link>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={() => setError(null)} className="text-red-600 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Upload Area */}
      <div
        className="bg-white rounded-xl shadow-sm border-2 border-dashed border-gray-300 p-8 mb-6 text-center hover:border-blue-400 transition-colors cursor-pointer"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = '.pptx';
          input.onchange = (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (file) handleUpload(file);
          };
          input.click();
        }}
      >
        {uploading ? (
          <div className="flex items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-gray-600">正在上传并解析...</span>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">点击或拖拽上传 PPTX 母版</p>
            <p className="text-sm text-gray-400 mt-1">支持 .pptx 格式，AI 将自动解析布局和样式</p>
          </>
        )}
      </div>

      {/* Themes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {themes.map((theme) => {
          const display = themeToDisplay(theme);
          return (
            <div
              key={theme.theme_id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
            >
              {/* Preview */}
              <div
                className="aspect-video relative"
                style={{
                  background: `linear-gradient(135deg, ${display.style.backgroundColor} 0%, ${display.style.primaryColor}15 100%)`,
                }}
              >
                {/* Title slide preview */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div
                      className="w-16 h-1 mx-auto mb-3 rounded"
                      style={{ backgroundColor: display.style.primaryColor }}
                    />
                    <div
                      className="text-lg font-semibold"
                      style={{ color: display.style.textColor }}
                    >
                      {theme.theme_name}
                    </div>
                    <div
                      className="w-16 h-1 mx-auto mt-3 rounded"
                      style={{ backgroundColor: display.style.secondaryColor }}
                    />
                  </div>
                </div>

                {/* Color palette */}
                <div className="absolute bottom-2 right-2 flex gap-1">
                  <div
                    className="w-4 h-4 rounded-full border border-white shadow"
                    style={{ backgroundColor: theme.primary_color }}
                    title="主色"
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-white shadow"
                    style={{ backgroundColor: theme.secondary_color }}
                    title="辅色"
                  />
                  <div
                    className="w-4 h-4 rounded-full border border-gray-200 shadow"
                    style={{ backgroundColor: theme.accent_color }}
                    title="强调色"
                  />
                </div>

                {/* Style badge */}
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/80 backdrop-blur text-xs text-gray-600 rounded-full">
                  {theme.style}
                </div>

                {/* Actions overlay */}
                {!display.isSystem && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(theme.theme_id);
                      }}
                      className="px-3 py-1.5 bg-red-500 text-white rounded-lg text-sm hover:bg-red-600"
                    >
                      删除
                    </button>
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="font-medium text-gray-900">{theme.theme_name}</h3>
                <p className="text-sm text-gray-500 mt-1">{theme.description}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                  <span className="capitalize">{theme.color} · {theme.style}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {themes.length === 0 && !loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">📭</div>
          <p className="text-gray-500">暂无主题，上传一个 PPTX 文件开始</p>
        </div>
      )}
    </div>
  );
}
