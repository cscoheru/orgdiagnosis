'use client';

/**
 * Template Selection Step — PowerPoint-style editor
 *
 * Layout: Left thumbnail panel (with content, read-only) + Right full-size preview (editable)
 * Top: Theme selection bar
 * Bottom: Confirm → Generate PPTX
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DetailedOutlineData, ThemeInfo, LayoutCategory, OutlineSlide, TemplateSelectionData } from '@/lib/workflow/w1-types';
import { createDefaultTemplateSelection } from '@/lib/workflow/w1-types';
import { getThemes, getLayouts, recommendLayout } from '@/lib/api/workflow-client';
import SlideContentRenderer from '@/components/workflow/SlideContentRenderer';

interface TemplateSelectionStepProps {
  outlineData: DetailedOutlineData | null;
  templateData: TemplateSelectionData | null;
  onConfirm: (data: TemplateSelectionData) => void;
  onOutlineChange?: (data: DetailedOutlineData) => void;
}

/** Flatten outline sections into a flat array of {slide, sectionName, activityName} */
function flattenOutline(outlineData: DetailedOutlineData) {
  const slides: Array<{
    globalIndex: number;
    slide: OutlineSlide;
    sectionName: string;
    activityName: string;
  }> = [];
  let idx = 1;
  for (const section of outlineData.sections) {
    for (const activity of section.activities) {
      for (const slide of activity.slides) {
        slides.push({ globalIndex: idx++, slide, sectionName: section.section_name, activityName: activity.activity_name });
      }
    }
    // If section has no activities but we want a section divider
    if (section.activities.length === 0) {
      slides.push({
        globalIndex: idx++,
        slide: { slide_index: idx - 1, title: section.section_name, slide_type: 'content', storyline: '', arguments: [], evidence: [], supporting_materials: [] },
        sectionName: section.section_name,
        activityName: '',
      });
    }
  }
  return slides;
}

export default function TemplateSelectionStep({
  outlineData,
  templateData,
  onConfirm,
  onOutlineChange,
}: TemplateSelectionStepProps) {
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [layoutCategories, setLayoutCategories] = useState<LayoutCategory[]>([]);
  const [data, setData] = useState<TemplateSelectionData>(createDefaultTemplateSelection());
  const [loading, setLoading] = useState(true);
  const [recommendingFor, setRecommendingFor] = useState<number | null>(null);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState(1); // 0.5, 0.75, 1, 1.25, 1.5, 2
  const [isFullscreen, setIsFullscreen] = useState(false);
  const previewContainerRef = useRef<HTMLDivElement>(null);

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
      const layouts: TemplateSelectionData['slide_layouts'] = [];
      let idx = 1;
      for (const section of outlineData.sections) {
        for (const activity of section.activities) {
          for (const slide of activity.slides) {
            layouts.push({
              slide_index: idx++,
              slide_title: slide.title,
              section_name: section.section_name,
              layout_id: 'bullet_01',
            });
          }
        }
      }
      setData(prev => ({ ...prev, slide_layouts: layouts }));
    }
  }, [outlineData, data.slide_layouts.length]);

  // Flat slide list for navigation
  const flatSlides = useMemo(
    () => outlineData ? flattenOutline(outlineData) : [],
    [outlineData],
  );

  const activeTheme = useMemo(
    () => themes.find(t => t.id === data.theme_id) || themes[0] || null,
    [themes, data.theme_id],
  );

  const allLayouts = useMemo(() => {
    const flat: { id: string; category: string }[] = [];
    for (const cat of layoutCategories) {
      for (const id of cat.layouts) {
        flat.push({ id, category: cat.category_name });
      }
    }
    return flat;
  }, [layoutCategories]);

  const selectedLayout = useMemo(
    () => data.slide_layouts.find(s => s.slide_index === selectedSlideIndex + 1) || null,
    [data.slide_layouts, selectedSlideIndex],
  );

  const selectedFlatSlide = flatSlides[selectedSlideIndex] || null;

  // Update layout for a slide
  const updateLayout = useCallback((slideIndex: number, layoutId: string) => {
    setData(prev => ({
      ...prev,
      slide_layouts: prev.slide_layouts.map(s =>
        s.slide_index === slideIndex ? { ...s, layout_id: layoutId } : s
      ),
    }));
  }, []);

  // AI recommend for one slide
  const handleRecommend = useCallback(async (slideIndex: number) => {
    const slide = data.slide_layouts.find(s => s.slide_index === slideIndex);
    if (!slide) return;
    setRecommendingFor(slideIndex);
    const res = await recommendLayout(`${slide.slide_title} ${slide.section_name}`);
    if (res.success && res.data) {
      updateLayout(slideIndex, res.data.layout_id);
    }
    setRecommendingFor(null);
  }, [data.slide_layouts, updateLayout]);

  // AI recommend all
  const handleRecommendAll = useCallback(async () => {
    for (const slide of data.slide_layouts) {
      setRecommendingFor(slide.slide_index);
      const res = await recommendLayout(`${slide.slide_title} ${slide.section_name}`);
      if (res.success && res.data) {
        updateLayout(slide.slide_index, res.data.layout_id);
      }
    }
    setRecommendingFor(null);
  }, [data.slide_layouts, updateLayout]);

  // Handle slide content editing (from full-size preview)
  const handleSlideChange = useCallback((globalIndex: number, updatedSlide: OutlineSlide) => {
    if (!outlineData || !onOutlineChange) return;
    // Find the slide in the outline and update it
    let counter = 0;
    const newSections = outlineData.sections.map(section => ({
      ...section,
      activities: section.activities.map(activity => ({
        ...activity,
        slides: activity.slides.map(slide => {
          counter++;
          if (counter === globalIndex) return updatedSlide;
          return slide;
        }),
      })),
    }));
    onOutlineChange({ ...outlineData, sections: newSections });
    // Also update slide_layouts title
    setData(prev => ({
      ...prev,
      slide_layouts: prev.slide_layouts.map(s =>
        s.slide_index === globalIndex ? { ...s, slide_title: updatedSlide.title } : s
      ),
    }));
  }, [outlineData, onOutlineChange]);

  const totalSlides = flatSlides.length;
  const totalSections = outlineData?.sections.length || 0;

  // ── Zoom & Fullscreen ──
  const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

  const zoomIn = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      return idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => {
      const idx = ZOOM_STEPS.indexOf(prev);
      return idx > 0 ? ZOOM_STEPS[idx - 1] : prev;
    });
  }, []);

  const resetZoom = useCallback(() => setZoomLevel(1), []);

  const toggleFullscreen = useCallback(() => {
    if (!previewContainerRef.current) return;
    if (!document.fullscreenElement) {
      previewContainerRef.current.requestFullscreen().then(() => {
        setIsFullscreen(true);
        setZoomLevel(1.5);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
        setZoomLevel(1);
      }).catch(() => {});
    }
  }, []);

  // Listen for fullscreen exit (user presses Esc)
  useEffect(() => {
    const handler = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
        setZoomLevel(1);
      }
    };
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* ── Top: Summary + Theme Selection ── */}
      <div className="border-b border-gray-100 px-6 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <span className="font-medium text-gray-700">{totalSections} 个阶段</span>
            <span>{totalSlides} 页幻灯片</span>
          </div>
          <button
            onClick={handleRecommendAll}
            disabled={recommendingFor !== null}
            className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 font-medium px-3 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50"
          >
            {recommendingFor !== null ? 'AI 推荐中...' : '全部 AI 推荐'}
          </button>
        </div>

        {/* Theme cards */}
        <div className="flex gap-3">
          {themes.map((theme) => {
            const isSelected = data.theme_id === theme.id;
            return (
              <button
                key={theme.id}
                onClick={() => setData(prev => ({ ...prev, theme_id: theme.id }))}
                className={`relative flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                  isSelected
                    ? 'border-blue-500 bg-blue-50 shadow-sm'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* Mini color dots */}
                <div className="flex gap-1">
                  {theme.preview_colors.slice(0, 3).map((color, i) => (
                    <div
                      key={i}
                      className="w-4 h-4 rounded-full border border-gray-200"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span className="text-xs font-medium text-gray-700">{theme.name}</span>
                {isSelected && (
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-blue-500 text-white rounded-full flex items-center justify-center text-[9px]">
                    ✓
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main: Left Thumbnails + Right Preview ── */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">加载模板数据...</div>
      ) : totalSlides === 0 ? (
        <div className="text-center py-12 text-gray-400">暂无幻灯片，请先完成大纲生成</div>
      ) : (
        <div className="flex" style={{ height: 540 }}>
          {/* Left: Thumbnail panel */}
          <div
            className="border-r border-gray-100 overflow-y-auto py-3 px-3 flex-shrink-0"
            style={{ width: 210 }}
          >
            <div className="space-y-2">
              {flatSlides.map((item, i) => {
                const isSelected = i === selectedSlideIndex;
                const layout = data.slide_layouts.find(s => s.slide_index === item.globalIndex);
                return (
                  <div key={item.globalIndex}>
                    {/* Section divider label */}
                    {i === 0 || flatSlides[i - 1].sectionName !== item.sectionName ? (
                      <div className="text-[10px] text-gray-400 font-medium px-1 py-1 truncate">
                        {item.sectionName}
                      </div>
                    ) : null}
                    {/* Thumbnail */}
                    <div
                      onClick={() => setSelectedSlideIndex(i)}
                      className={`cursor-pointer transition-all rounded-lg overflow-hidden ${
                        isSelected
                          ? 'ring-2 ring-blue-500 ring-offset-1'
                          : 'hover:ring-1 hover:ring-gray-300'
                      }`}
                    >
                      <SlideContentRenderer
                        slideData={item.slide}
                        layoutId={layout?.layout_id || 'bullet_01'}
                        theme={activeTheme}
                        scale="thumbnail"
                      />
                      <div className="px-1 py-0.5 flex items-center justify-between">
                        <span className="text-[9px] text-gray-500 truncate flex-1">
                          {item.globalIndex}. {item.slide.title}
                        </span>
                        {recommendingFor === item.globalIndex && (
                          <span className="text-[8px] text-blue-400">AI...</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right: Full-size preview + controls */}
          <div
            ref={previewContainerRef}
            className="flex-1 flex flex-col bg-gray-50"
            style={isFullscreen ? { background: '#1a1a2e' } : undefined}
          >
            {/* Top toolbar: zoom controls */}
            <div className={`flex items-center justify-between px-4 py-2 border-b ${isFullscreen ? 'border-gray-700 bg-gray-900' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-2">
                {/* Zoom out */}
                <button
                  onClick={zoomOut}
                  className={`w-7 h-7 rounded flex items-center justify-center text-sm ${isFullscreen ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                  title="缩小"
                >
                  −
                </button>
                {/* Zoom level display + reset */}
                <button
                  onClick={resetZoom}
                  className={`text-xs font-medium px-2 py-1 rounded min-w-[44px] text-center ${isFullscreen ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'}`}
                  title="重置缩放"
                >
                  {Math.round(zoomLevel * 100)}%
                </button>
                {/* Zoom in */}
                <button
                  onClick={zoomIn}
                  className={`w-7 h-7 rounded flex items-center justify-center text-sm ${isFullscreen ? 'text-gray-300 hover:text-white hover:bg-gray-700' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}
                  title="放大"
                >
                  +
                </button>
                {/* Separator */}
                <span className={`mx-1 ${isFullscreen ? 'text-gray-600' : 'text-gray-300'}`}>|</span>
                {/* Slide navigation */}
                <button
                  onClick={() => setSelectedSlideIndex(Math.max(0, selectedSlideIndex - 1))}
                  disabled={selectedSlideIndex === 0}
                  className={`text-xs px-1 disabled:opacity-30 ${isFullscreen ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  ←
                </button>
                <span className={`text-xs ${isFullscreen ? 'text-gray-400' : 'text-gray-500'}`}>
                  {selectedSlideIndex + 1} / {totalSlides}
                </span>
                <button
                  onClick={() => setSelectedSlideIndex(Math.min(totalSlides - 1, selectedSlideIndex + 1))}
                  disabled={selectedSlideIndex === totalSlides - 1}
                  className={`text-xs px-1 disabled:opacity-30 ${isFullscreen ? 'text-gray-300 hover:text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  →
                </button>
              </div>
              <div className="flex items-center gap-2">
                {/* AI recommend */}
                <button
                  onClick={() => handleRecommend(selectedSlideIndex + 1)}
                  disabled={recommendingFor !== null}
                  className={`text-xs px-2 py-1 rounded border disabled:opacity-40 ${
                    isFullscreen
                      ? 'text-blue-400 border-blue-600 hover:bg-blue-900'
                      : 'text-blue-600 border-blue-200 hover:bg-blue-50'
                  }`}
                >
                  AI 推荐
                </button>
                {/* Layout selector */}
                <select
                  value={selectedLayout?.layout_id || 'bullet_01'}
                  onChange={(e) => updateLayout(selectedSlideIndex + 1, e.target.value)}
                  className={`px-2 py-1 text-xs rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isFullscreen
                      ? 'bg-gray-800 border-gray-600 text-gray-200'
                      : 'bg-white border-gray-200'
                  }`}
                >
                  {allLayouts.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.id} ({l.category})
                    </option>
                  ))}
                </select>
                {/* Fullscreen toggle */}
                <button
                  onClick={toggleFullscreen}
                  className={`text-xs px-2 py-1 rounded border ${
                    isFullscreen
                      ? 'text-yellow-400 border-yellow-600 hover:bg-yellow-900'
                      : 'text-gray-500 border-gray-200 hover:bg-gray-50'
                  }`}
                  title={isFullscreen ? '退出全屏' : '全屏演示'}
                >
                  {isFullscreen ? '✕ 退出' : '⛶ 全屏'}
                </button>
              </div>
            </div>

            {/* Preview area */}
            <div className={`flex-1 flex items-center justify-center overflow-auto ${isFullscreen ? 'p-8' : 'p-6'}`}>
              {selectedFlatSlide && (
                <div className={`rounded-lg shadow-lg overflow-hidden border ${isFullscreen ? 'border-gray-600 shadow-2xl' : 'border-gray-200'}`}>
                  <SlideContentRenderer
                    slideData={selectedFlatSlide.slide}
                    layoutId={selectedLayout?.layout_id || 'bullet_01'}
                    theme={activeTheme}
                    scale="preview"
                    customScale={zoomLevel}
                    editable={true}
                    onSlideChange={(slide) => handleSlideChange(selectedSlideIndex + 1, slide)}
                  />
                </div>
              )}
            </div>

            {/* Bottom: slide title */}
            {selectedLayout && (
              <div className={`px-4 py-2 text-center border-t ${isFullscreen ? 'border-gray-700 bg-gray-900 text-gray-400' : 'border-gray-100 bg-white text-gray-400'}`}>
                <span className="text-xs">{selectedLayout.slide_title}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottom: Confirm ── */}
      <div className="border-t border-gray-100 px-6 py-3 flex justify-end">
        <button
          onClick={() => onConfirm(data)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          确认 → 生成 PPTX
        </button>
      </div>
    </div>
  );
}
