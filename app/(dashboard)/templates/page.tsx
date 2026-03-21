'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';

interface Template {
  id: string;
  name: string;
  description: string;
  thumbnail?: string;
  style: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
    fontFamily: string;
    headingFont?: string;
  };
  slides: {
    title: string;
    subtitle?: string;
    layout: 'title' | 'section' | 'content' | 'two-column' | 'image-left' | 'image-right';
  }[];
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
}

// System preset templates
const SYSTEM_TEMPLATES: Template[] = [
  {
    id: 'template-blue-professional',
    name: '蓝色商务',
    description: '专业商务风格，适合咨询报告',
    style: {
      primaryColor: '#2563eb',
      secondaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
      fontFamily: 'Microsoft YaHei, sans-serif',
      headingFont: 'Microsoft YaHei, sans-serif',
    },
    slides: [
      { title: '封面页', layout: 'title' },
      { title: '目录页', layout: 'content' },
      { title: '章节页', layout: 'section' },
      { title: '内容页', layout: 'content' },
      { title: '双栏页', layout: 'two-column' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  {
    id: 'template-green-nature',
    name: '绿色自然',
    description: '清新自然风格，适合环保、健康主题',
    style: {
      primaryColor: '#16a34a',
      secondaryColor: '#22c55e',
      backgroundColor: '#f0fdf4',
      textColor: '#14532d',
      fontFamily: 'Microsoft YaHei, sans-serif',
    },
    slides: [
      { title: '封面页', layout: 'title' },
      { title: '内容页', layout: 'content' },
      { title: '章节页', layout: 'section' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  {
    id: 'template-purple-creative',
    name: '紫色创意',
    description: '现代创意风格，适合设计、营销主题',
    style: {
      primaryColor: '#9333ea',
      secondaryColor: '#a855f7',
      backgroundColor: '#faf5ff',
      textColor: '#3b0764',
      fontFamily: 'Microsoft YaHei, sans-serif',
    },
    slides: [
      { title: '封面页', layout: 'title' },
      { title: '内容页', layout: 'content' },
      { title: '图片左文右', layout: 'image-left' },
      { title: '文左图片右', layout: 'image-right' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  {
    id: 'template-orange-energy',
    name: '橙色活力',
    description: '活力动感风格，适合创业、科技主题',
    style: {
      primaryColor: '#ea580c',
      secondaryColor: '#f97316',
      backgroundColor: '#fff7ed',
      textColor: '#431407',
      fontFamily: 'Microsoft YaHei, sans-serif',
    },
    slides: [
      { title: '封面页', layout: 'title' },
      { title: '内容页', layout: 'content' },
      { title: '章节页', layout: 'section' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>(SYSTEM_TEMPLATES);
  const [uploading, setUploading] = useState(false);

  // Load custom templates on mount
  useEffect(() => {
    const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    setTemplates([...SYSTEM_TEMPLATES, ...customTemplates]);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    if (!file.name.endsWith('.pptx')) {
      alert('只支持 PPTX 格式的母版文件');
      return;
    }

    setUploading(true);

    try {
      // For now, create a simple template record
      // In production, this would parse the PPTX and extract styles
      const newTemplate: Template = {
        id: `template_${Date.now()}`,
        name: file.name.replace('.pptx', ''),
        description: '用户上传的母版',
        style: {
          primaryColor: '#2563eb',
          secondaryColor: '#3b82f6',
          backgroundColor: '#ffffff',
          textColor: '#1e293b',
          fontFamily: 'Microsoft YaHei, sans-serif',
        },
        slides: [
          { title: '封面页', layout: 'title' },
          { title: '内容页', layout: 'content' },
        ],
        isSystem: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
      customTemplates.push(newTemplate);
      localStorage.setItem('customTemplates', JSON.stringify(customTemplates));

      setTemplates([...SYSTEM_TEMPLATES, ...customTemplates]);
      alert('母版上传成功！');
    } catch (error) {
      console.error('Upload error:', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  }, []);

  const handleDelete = useCallback((id: string) => {
    if (!confirm('确定要删除这个母版吗？')) return;

    const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
    const updated = customTemplates.filter((t: Template) => t.id !== id);
    localStorage.setItem('customTemplates', JSON.stringify(updated));
    setTemplates([...SYSTEM_TEMPLATES, ...updated]);
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

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">母版管理</h1>
            <p className="text-sm text-gray-500 mt-1">
              管理 PPT 整体视觉风格（配色、字体、布局）
            </p>
          </div>
        </div>
      </div>

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
            <span className="text-gray-600">正在上传...</span>
          </div>
        ) : (
          <>
            <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-gray-600 font-medium">点击或拖拽上传 PPTX 母版</p>
            <p className="text-sm text-gray-400 mt-1">支持 .pptx 格式</p>
          </>
        )}
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <div
            key={template.id}
            className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow group"
          >
            {/* Preview */}
            <div
              className="aspect-video relative"
              style={{
                background: `linear-gradient(135deg, ${template.style.backgroundColor} 0%, ${template.style.primaryColor}15 100%)`,
              }}
            >
              {/* Title slide preview */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <div
                    className="w-16 h-1 mx-auto mb-3 rounded"
                    style={{ backgroundColor: template.style.primaryColor }}
                  />
                  <div
                    className="text-lg font-semibold"
                    style={{ color: template.style.textColor }}
                  >
                    {template.name}
                  </div>
                  <div
                    className="w-16 h-1 mx-auto mt-3 rounded"
                    style={{ backgroundColor: template.style.secondaryColor }}
                  />
                </div>
              </div>

              {/* Color palette */}
              <div className="absolute bottom-2 right-2 flex gap-1">
                <div
                  className="w-4 h-4 rounded-full border border-white shadow"
                  style={{ backgroundColor: template.style.primaryColor }}
                  title="主色"
                />
                <div
                  className="w-4 h-4 rounded-full border border-white shadow"
                  style={{ backgroundColor: template.style.secondaryColor }}
                  title="辅色"
                />
                <div
                  className="w-4 h-4 rounded-full border border-gray-200 shadow"
                  style={{ backgroundColor: template.style.backgroundColor }}
                  title="背景色"
                />
              </div>

              {/* System badge */}
              {template.isSystem && (
                <div className="absolute top-2 left-2 px-2 py-0.5 bg-white/80 backdrop-blur text-xs text-gray-600 rounded-full">
                  系统
                </div>
              )}

              {/* Actions overlay */}
              {!template.isSystem && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(template.id);
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
              <h3 className="font-medium text-gray-900">{template.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{template.description}</p>
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                <span>{template.slides.length} 个页面布局</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {templates.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <div className="text-gray-400 text-4xl mb-4">📭</div>
          <p className="text-gray-500">暂无母版，上传一个 PPTX 文件开始</p>
        </div>
      )}
    </div>
  );
}
