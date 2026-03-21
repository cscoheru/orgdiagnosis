'use client';

import { useState } from 'react';
import { PageTitle } from '@/lib/report-api';
import SlidePreview from './slide-preview';

interface SlideCardProps {
  page: PageTitle;
  slide?: {
    slide_id: string;
    page_id?: string;
    title: string;
    key_message: string;
    bullets: string[];
    layout?: string;
    visual_model_category?: string;
  };
  index: number;
  onEdit: (updates: Partial<PageTitle>) => void;
  onSlideEdit: (updates: Record<string, unknown>) => void;
  showPreview?: boolean;
  onPreviewClick?: () => void;
}

// Visual model categories matching the plan
const VISUAL_MODELS = [
  { id: 'MATRIX_2X2', label: '矩阵 2×2', icon: '⊞' },
  { id: 'MATRIX_3X3', label: '矩阵 3×3', icon: '⊞' },
  { id: 'PROCESS_HORIZONTAL', label: '横向流程', icon: '→' },
  { id: 'PROCESS_VERTICAL', label: '纵向流程', icon: '↓' },
  { id: 'PARALLEL_CARDS', label: '并列卡片', icon: '◫' },
  { id: 'TABLE_PRO_CON', label: '对比表格', icon: '⊞' },
  { id: 'MILESTONE', label: '里程碑', icon: '◈' },
  { id: 'RADAR_DATA', label: '雷达图', icon: '◎' },
  { id: 'KEY_INSIGHT', label: '核心观点', icon: '★' },
  { id: 'TIMELINE', label: '时间线', icon: '―' },
];

export default function SlideCard({
  page,
  slide,
  index,
  onEdit,
  onSlideEdit,
  showPreview = false,
  onPreviewClick,
}: SlideCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingField, setEditingField] = useState<string | null>(null);

  // Use slide data if available, otherwise fall back to page data
  const displayTitle = slide?.title || page.page_title;
  const displayDirection = slide?.key_message || page.key_direction;
  // Generate placeholder bullets if no slide content yet
  const displayBullets = (slide?.bullets && slide.bullets.length > 0)
    ? slide.bullets
    : Array.from({ length: page.estimated_elements || 3 }, (_, i) => `要素 ${i + 1}: ${page.key_direction.slice(0, 20)}...`);
  const displayLayout = slide?.visual_model_category || slide?.layout || page.suggested_layout;

  // Find matching visual model
  const currentModel = VISUAL_MODELS.find(m => m.id === displayLayout?.toUpperCase()) ||
    VISUAL_MODELS.find(m => m.id === 'PARALLEL_CARDS');

  const handleBulletEdit = (bulletIndex: number, value: string) => {
    if (!slide) return;
    const newBullets = [...displayBullets];
    newBullets[bulletIndex] = value;
    onSlideEdit({ bullets: newBullets });
  };

  const addBullet = () => {
    if (!slide) return;
    onSlideEdit({ bullets: [...displayBullets, '新论点...'] });
  };

  const removeBullet = (bulletIndex: number) => {
    if (!slide) return;
    const newBullets = displayBullets.filter((_, i) => i !== bulletIndex);
    onSlideEdit({ bullets: newBullets });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <div
        className="px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-6 h-6 rounded bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium shrink-0 mt-0.5">
              {index}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-medium text-gray-900 truncate">{displayTitle}</h4>
              <p className="text-sm text-gray-500 truncate mt-0.5">{displayDirection}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-full flex items-center gap-1">
              <span className="text-sm">{currentModel?.icon}</span>
              <span>{currentModel?.label || '布局'}</span>
            </span>
            <span className="text-xs text-gray-400">{page.estimated_elements || displayBullets.length || 3} 要素</span>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 space-y-4">
          {/* Title Edit */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">页面标题</label>
            {editingField === 'title' ? (
              <input
                type="text"
                value={displayTitle}
                onChange={(e) => onSlideEdit({ title: e.target.value })}
                onBlur={() => setEditingField(null)}
                onKeyDown={(e) => e.key === 'Enter' && setEditingField(null)}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div
                className="px-3 py-2 bg-gray-50 rounded-lg text-sm cursor-pointer hover:bg-gray-100"
                onClick={() => setEditingField('title')}
              >
                {displayTitle}
              </div>
            )}
          </div>

          {/* Key Message Edit */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">核心观点 (Action Title)</label>
            {editingField === 'keyMessage' ? (
              <textarea
                value={displayDirection}
                onChange={(e) => onSlideEdit({ key_message: e.target.value })}
                onBlur={() => setEditingField(null)}
                rows={2}
                className="w-full px-3 py-2 border border-blue-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <div
                className="px-3 py-2 bg-gray-50 rounded-lg text-sm cursor-pointer hover:bg-gray-100"
                onClick={() => setEditingField('keyMessage')}
              >
                {displayDirection}
              </div>
            )}
          </div>

          {/* Bullets / Elements */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">支撑论点</label>
            <div className="space-y-2">
              {displayBullets.map((bullet, bulletIndex) => (
                <div key={bulletIndex} className="flex items-start gap-2">
                  <span className="text-gray-400 mt-2 text-sm">•</span>
                  <input
                    type="text"
                    value={bullet}
                    onChange={(e) => handleBulletEdit(bulletIndex, e.target.value)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    onClick={() => removeBullet(bulletIndex)}
                    className="px-2 py-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    ✕
                  </button>
                </div>
              ))}
              {displayBullets.length === 0 && (
                <div className="text-gray-400 text-sm px-3 py-2 bg-gray-50 rounded-lg">
                  暂无论点，点击下方按钮添加
                </div>
              )}
              <button
                onClick={addBullet}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <span>+</span> 添加论点
              </button>
            </div>
          </div>

          {/* Visual Model Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">视觉模型</label>
            <div className="flex flex-wrap gap-2">
              {VISUAL_MODELS.slice(0, 6).map((model) => (
                <button
                  key={model.id}
                  onClick={() => onSlideEdit({ visual_model_category: model.id })}
                  className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                    currentModel?.id === model.id
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50'
                  }`}
                >
                  <span className="mr-1">{model.icon}</span>
                  {model.label}
                </button>
              ))}
            </div>
            <button className="text-xs text-gray-400 hover:text-gray-600 mt-2">
              更多布局选项 →
            </button>
          </div>

          {/* Preview Section */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">幻灯片预览</label>
            <div className="bg-gray-100 rounded-lg p-2">
              <SlidePreview
                title={displayTitle}
                keyMessage={displayDirection}
                bullets={displayBullets}
                layout={displayLayout || 'PARALLEL_CARDS'}
              />
            </div>
            {onPreviewClick && (
              <button
                onClick={onPreviewClick}
                className="w-full mt-2 py-2 text-xs text-blue-600 hover:text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                🔍 查看大图预览
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
