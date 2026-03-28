'use client';

import { useState, useEffect, useMemo } from 'react';
import type { DetailedOutlineData, ThemeInfo, LayoutCategory, SlideLayoutAssignment, TemplateSelectionData } from '@/lib/workflow/w1-types';
import { createDefaultTemplateSelection } from '@/lib/workflow/w1-types';
import { getThemes, getLayouts, recommendLayout } from '@/lib/api/workflow-client';

interface TemplateSelectionStepProps {
  outlineData: DetailedOutlineData | null;
  templateData: TemplateSelectionData | null;
  onConfirm: (data: TemplateSelectionData) => void;
}

export default function TemplateSelectionStep({
  outlineData,
  templateData,
  onConfirm,
}: TemplateSelectionStepProps) {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [layoutCategories, setLayoutCategories] = useState<LayoutCategory[]>([]);
  const [data, setData] = useState<TemplateSelectionData>(createDefaultTemplateSelection());
  const [loading, setLoading] = useState(true);
  const [recommendingFor, setRecommendingFor] = useState<string | null>(null);

  // Load themes and layouts on mount
  useEffect(() => {
    async function load() {
      const [themeRes, layoutRes] = await Promise.all([getThemes(), getLayouts()]);
      if (themeRes.success && themeRes.data) setThemes(themeRes.data);
      if (layoutRes.success && layoutRes.data) setLayoutCategories(layoutRes.data.categories);
      setLoading(false);
    }
    load();
  }, []);

  // Sync templateData prop
  useEffect(() => {
    if (templateData) setData(templateData);
  }, [templateData]);

  // Initialize slide_layouts from outlineData
  useEffect(() => {
    if (outlineData && data.slide_layouts.length === 0) {
      const layouts: SlideLayoutAssignment[] = [];
      let idx = 1;
      for (const section of outlineData.sections) {
        for (const activity of section.activities) {
          for (const slide of activity.slides) {
          layouts.push({
            slide_index: idx++,
            slide_title: slide.title,
            section_name: section.section_name,
            layout_id: 'centered_insight',
          });
        }
        }
      }
      setData(prev => ({ ...prev, slide_layouts: layouts }));
    }
  }, [outlineData, data.slide_layouts.length]);

  const allLayouts = useMemo(() => {
    const flat: { id: string; category: string }[] = [];
    for (const cat of layoutCategories) {
      for (const id of cat.layouts) {
        flat.push({ id, category: cat.category_name });
      }
    }
    return flat;
  }, [layoutCategories]);

  const updateLayout = (slideIndex: number, layoutId: string) => {
    setData(prev => ({
      ...prev,
      slide_layouts: prev.slide_layouts.map(s =>
        s.slide_index === slideIndex ? { ...s, layout_id: layoutId } : s
      ),
    }));
  };

  const handleRecommend = async (slideIndex: number) => {
    const slide = data.slide_layouts.find(s => s.slide_index === slideIndex);
    if (!slide) return;
    setRecommendingFor(`${slideIndex}`);
    const res = await recommendLayout(`${slide.slide_title} ${slide.section_name}`);
    if (res.success && res.data) {
      updateLayout(slideIndex, res.data.layout_id);
    }
    setRecommendingFor(null);
  };

  const handleRecommendAll = async () => {
    for (const slide of data.slide_layouts) {
      setRecommendingFor(`${slide.slide_index}`);
      const res = await recommendLayout(`${slide.slide_title} ${slide.section_name}`);
      if (res.success && res.data) {
        updateLayout(slide.slide_index, res.data.layout_id);
      }
    }
    setRecommendingFor(null);
  };

  const totalSlides = outlineData?.sections.reduce((sum, s) => sum + s.activities.reduce((a, act) => a + act.slides.length, 0), 0) || 0;
  const totalSections = outlineData?.sections.length || 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Outline summary */}
      {outlineData && (
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>共 {totalSections} 个阶段</span>
            <span>{totalSlides} 页 slides</span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-gray-400">加载模板数据...</div>
      ) : (
        <>
          {/* Theme selection */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">选择演示主题</h3>
            <div className="grid grid-cols-5 gap-3">
              {themes.map((theme) => {
                const isSelected = data.theme_id === theme.id;
                return (
                  <button
                    key={theme.id}
                    onClick={() => setData(prev => ({ ...prev, theme_id: theme.id }))}
                    className={`relative p-3 rounded-xl border-2 transition-all text-center ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {/* Color preview */}
                    <div className="flex gap-1 justify-center mb-2">
                      {theme.preview_colors.slice(0, 3).map((color, i) => (
                        <div
                          key={i}
                          className="w-5 h-5 rounded-full border border-gray-200"
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                    <p className="text-xs font-medium text-gray-900">{theme.name}</p>
                    <p className="text-[10px] text-gray-500 mt-0.5">{theme.description}</p>
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Per-slide layout assignment */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-gray-700">逐页布局分配</h3>
              <button
                onClick={handleRecommendAll}
                disabled={recommendingFor !== null}
                className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                全部 AI 推荐
              </button>
            </div>
            <div className="space-y-2">
              {data.slide_layouts.map((slide) => {
                const isRecommending = recommendingFor === `${slide.slide_index}`;
                return (
                  <div key={slide.slide_index} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 bg-gray-200 text-gray-600 rounded-full flex items-center justify-center text-xs font-medium flex-shrink-0">
                      {slide.slide_index}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 truncate">{slide.slide_title}</p>
                      <p className="text-xs text-gray-400">{slide.section_name}</p>
                    </div>
                    <select
                      value={slide.layout_id}
                      onChange={(e) => updateLayout(slide.slide_index, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
                    >
                      {allLayouts.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.id} ({l.category})
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => handleRecommend(slide.slide_index)}
                      disabled={isRecommending}
                      className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 flex-shrink-0 px-1"
                    >
                      {isRecommending ? '...' : 'AI'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Confirm */}
          <div className="flex justify-end">
            <button
              onClick={() => onConfirm(data)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              确认 → 生成 PPTX
            </button>
          </div>
        </>
      )}
    </div>
  );
}
