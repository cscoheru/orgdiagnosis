'use client';

import { useState } from 'react';
import { Module, PageTitle } from '@/lib/report-api';
import SlideCard from './slide-card';

interface ModuleCardProps {
  module: Module;
  pageTitles: PageTitle[];
  slides: Array<{
    slide_id: string;
    page_id?: string;
    title: string;
    key_message: string;
    bullets: string[];
    layout?: string;
    visual_model_category?: string;
  }>;
  isExpanded: boolean;
  onToggle: () => void;
  onModuleEdit: (module: Module) => void;
  onPageEdit: (pageId: string, updates: Partial<PageTitle>) => void;
  onSlideEdit: (slideId: string, updates: Record<string, unknown>) => void;
}

export default function ModuleCard({
  module,
  pageTitles,
  slides,
  isExpanded,
  onToggle,
  onModuleEdit,
  onPageEdit,
  onSlideEdit,
}: ModuleCardProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(module.module_title);

  // Filter pages belonging to this module
  const modulePages = pageTitles.filter(p => p.module_id === module.module_id);

  // Get slides for this module
  const moduleSlides = slides.filter(s => {
    // Match by page_id or by slide_id pattern
    const slideModuleId = s.slide_id.split('_page_')[0];
    return slideModuleId === module.module_id || s.page_id?.startsWith(module.module_id);
  });

  const handleTitleSave = () => {
    onModuleEdit({ ...module, module_title: editedTitle });
    setIsEditingTitle(false);
  };

  const getDimensionBadge = (dimension?: string) => {
    if (!dimension) return null;

    const badges: Record<string, { color: string; label: string }> = {
      strategy: { color: 'bg-purple-100 text-purple-700', label: '战略' },
      structure: { color: 'bg-blue-100 text-blue-700', label: '组织' },
      performance: { color: 'bg-green-100 text-green-700', label: '绩效' },
      compensation: { color: 'bg-orange-100 text-orange-700', label: '薪酬' },
      talent: { color: 'bg-pink-100 text-pink-700', label: '人才' },
    };

    const badge = badges[dimension];
    if (!badge) return null;

    return (
      <span className={`px-2 py-0.5 text-xs rounded-full ${badge.color}`}>
        {badge.label}诊断
      </span>
    );
  };

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
      {/* Module Header */}
      <div
        className="px-5 py-4 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:from-blue-50 hover:to-gray-50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center text-sm font-bold">
              {module.priority}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">{module.module_name}</h3>
                {getDimensionBadge(module.diagnosis_dimension)}
              </div>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={(e) => e.key === 'Enter' && handleTitleSave()}
                  className="mt-1 text-sm text-gray-500 w-full px-2 py-1 border border-blue-300 rounded"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <p
                  className="text-sm text-gray-500 cursor-pointer hover:text-blue-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditingTitle(true);
                  }}
                >
                  {module.module_title}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-gray-400">预计 {module.estimated_pages} 页</div>
              <div className="text-xs text-gray-400">{modulePages.length} 页已生成</div>
            </div>
            <svg
              className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content - Pages */}
      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          {modulePages.length > 0 ? (
            <div className="p-4 space-y-3">
              {modulePages.map((page, index) => {
                // Find the corresponding slide
                const slide = moduleSlides.find(s => s.page_id === page.page_id || s.slide_id === page.page_id);

                return (
                  <SlideCard
                    key={page.page_id}
                    page={page}
                    slide={slide}
                    index={index + 1}
                    onEdit={(updates) => onPageEdit(page.page_id, updates)}
                    onSlideEdit={(updates) => slide && onSlideEdit(slide.slide_id, updates)}
                  />
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-gray-400 text-sm">
              暂无页面，请先生成页面标题
            </div>
          )}
        </div>
      )}
    </div>
  );
}
