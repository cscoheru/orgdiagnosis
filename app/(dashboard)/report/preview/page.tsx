'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getTaskStatus,
  getModules,
  getPageTitles,
  getSlides,
  exportPptx,
  TaskStatus,
  Module,
  PageTitle,
  SlideDraft,
} from '@/lib/report-api';
import { SYSTEM_LAYOUTS } from '@/lib/layout-api';
import { LayoutCategory, LAYOUT_CATEGORY_LABELS, LAYOUT_CATEGORY_ICONS, LayoutDefinition } from '@/lib/layout-types';

interface Template {
  id: string;
  name: string;
  style: {
    primaryColor: string;
    secondaryColor: string;
    backgroundColor: string;
    textColor: string;
  };
}

// System templates
const SYSTEM_TEMPLATES: Template[] = [
  {
    id: 'template-blue-professional',
    name: '蓝色商务',
    style: {
      primaryColor: '#2563eb',
      secondaryColor: '#3b82f6',
      backgroundColor: '#ffffff',
      textColor: '#1e293b',
    },
  },
  {
    id: 'template-green-nature',
    name: '绿色自然',
    style: {
      primaryColor: '#16a34a',
      secondaryColor: '#22c55e',
      backgroundColor: '#f0fdf4',
      textColor: '#14532d',
    },
  },
  {
    id: 'template-purple-creative',
    name: '紫色创意',
    style: {
      primaryColor: '#9333ea',
      secondaryColor: '#a855f7',
      backgroundColor: '#faf5ff',
      textColor: '#3b0764',
    },
  },
  {
    id: 'template-orange-energy',
    name: '橙色活力',
    style: {
      primaryColor: '#ea580c',
      secondaryColor: '#f97316',
      backgroundColor: '#fff7ed',
      textColor: '#431407',
    },
  },
];

interface SlideLayout {
  slide_id: string;
  layout_id: string;
}

function PreviewContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Data
  const [modules, setModules] = useState<Module[]>([]);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Style state
  const [selectedTemplate, setSelectedTemplate] = useState<Template>(SYSTEM_TEMPLATES[0]);
  const [availableTemplates, setAvailableTemplates] = useState<Template[]>(SYSTEM_TEMPLATES);
  const [slideLayouts, setSlideLayouts] = useState<SlideLayout[]>([]);
  const [availableLayouts, setAvailableLayouts] = useState<LayoutDefinition[]>(SYSTEM_LAYOUTS);

  // Load custom layouts and templates from localStorage (same as /layouts and /templates pages)
  useEffect(() => {
    try {
      // Load custom layouts
      const customLayouts = JSON.parse(localStorage.getItem('customLayouts') || '[]');
      setAvailableLayouts([...SYSTEM_LAYOUTS, ...customLayouts]);

      // Load custom templates
      const customTemplates = JSON.parse(localStorage.getItem('customTemplates') || '[]');
      const allTemplates = [...SYSTEM_TEMPLATES, ...customTemplates];
      setAvailableTemplates(allTemplates);

      // Set default template to first one
      if (allTemplates.length > 0) {
        setSelectedTemplate(allTemplates[0]);
      }
    } catch (e) {
      console.warn('[Preview] Failed to load custom data:', e);
    }
  }, []);

  // Load data
  useEffect(() => {
    if (!taskId) {
      setError('缺少任务ID');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const status = await getTaskStatus(taskId);
        console.log('[Preview] Task status:', status.status);

        // Allow more statuses for demo/testing
        const validStatuses = ['slides_ready', 'ready_for_export', 'completed', 'generating_slides'];
        if (!validStatuses.includes(status.status)) {
          setError(`任务状态不正确 (当前: ${status.status})，请先完成内容编辑`);
          setLoading(false);
          return;
        }

        const modulesData = await getModules(taskId);
        setModules(modulesData.modules);

        const slidesData = await getSlides(taskId);
        if (!slidesData.slides || slidesData.slides.length === 0) {
          setError('没有找到幻灯片数据');
          setLoading(false);
          return;
        }
        setSlides(slidesData.slides);

        // Initialize slide layouts with auto-recommended layouts
        const initialLayouts: SlideLayout[] = slidesData.slides.map(slide => ({
          slide_id: slide.slide_id,
          layout_id: recommendLayout(slide),
        }));
        setSlideLayouts(initialLayouts);

        if (status.status === 'completed') {
          setDownloadUrl(`/api/report/${taskId}/download`);
        }
      } catch (err) {
        console.error('[Preview] Error:', err);
        setError(err instanceof Error ? err.message : '加载失败，请检查后端服务是否运行');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  // Auto-recommend layout based on slide content
  const recommendLayout = (slide: SlideDraft): string => {
    const bulletCount = slide.bullets?.length || 0;

    if (bulletCount === 4) return 'swot-matrix';
    if (bulletCount === 3) return 'process-3-step';
    if (bulletCount === 2) return 'comparison-before-after';
    if (bulletCount >= 5) return 'pyramid-3-level';

    return 'swot-matrix'; // Default
  };

  // Get current slide
  const currentSlide = slides[currentSlideIndex];
  const currentLayoutId = slideLayouts.find(l => l.slide_id === currentSlide?.slide_id)?.layout_id;
  const currentLayout = availableLayouts.find(l => l.id === currentLayoutId);

  // Get similar layouts for recommendation
  const getSimilarLayouts = (): LayoutDefinition[] => {
    if (!currentLayout) return [];
    return availableLayouts.filter(l =>
      l.category === currentLayout.category && l.id !== currentLayout.id
    ).slice(0, 3);
  };

  // Handle layout change
  const handleLayoutChange = (slideId: string, layoutId: string) => {
    setSlideLayouts(prev =>
      prev.map(l => l.slide_id === slideId ? { ...l, layout_id: layoutId } : l)
    );
  };

  // Handle export
  const handleExport = async () => {
    if (!taskId) return;
    setExporting(true);
    try {
      const result = await exportPptx(taskId, {
        template_id: selectedTemplate.id,
        slide_layouts: slideLayouts,
      });
      setDownloadUrl(result.download_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : '导出失败');
    } finally {
      setExporting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">出错了</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            {taskId && (
              <p className="text-xs text-gray-400 mb-4">任务ID: {taskId}</p>
            )}
            <div className="flex gap-3 justify-center">
              {taskId && (
                <button
                  onClick={() => router.push(`/report/workspace?task_id=${taskId}`)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  返回内容编辑
                </button>
              )}
              <button
                onClick={() => router.push('/report')}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                重新生成
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Download ready state
  if (downloadUrl) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center max-w-md">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <span className="text-4xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">报告生成完成</h2>
            <p className="text-gray-600 mb-6">
              您的项目建议书已生成完成，可以下载 PPTX 文件进行编辑
            </p>
            <a
              href={downloadUrl}
              className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              下载 PPTX
            </a>
            <div className="mt-6">
              <button
                onClick={() => router.push('/report')}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                生成新报告
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/report/workspace?task_id=${taskId}`)}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 返回编辑
            </button>
            <h1 className="text-2xl font-bold text-gray-900">预览和导出</h1>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {exporting && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            导出 PPTX
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="grid grid-cols-3 gap-6">
        {/* Left: Slide preview */}
        <div className="col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Preview area */}
            <div className="aspect-video relative p-8"
              style={{
                background: `linear-gradient(135deg, ${selectedTemplate.style.backgroundColor} 0%, ${selectedTemplate.style.primaryColor}15 100%)`,
              }}
            >
              {currentSlide && (
                <SlidePreview
                  slide={currentSlide}
                  layout={currentLayout}
                  template={selectedTemplate}
                />
              )}
            </div>

            {/* Navigation */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex items-center justify-between">
              <button
                onClick={() => setCurrentSlideIndex(Math.max(0, currentSlideIndex - 1))}
                disabled={currentSlideIndex === 0}
                className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm text-gray-600">
                {currentSlideIndex + 1} / {slides.length}
              </span>
              <button
                onClick={() => setCurrentSlideIndex(Math.min(slides.length - 1, currentSlideIndex + 1))}
                disabled={currentSlideIndex === slides.length - 1}
                className="p-2 text-gray-500 hover:text-gray-700 disabled:opacity-30"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>

          {/* Thumbnail strip */}
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {slides.map((slide, index) => (
              <button
                key={slide.slide_id}
                onClick={() => setCurrentSlideIndex(index)}
                className={`flex-shrink-0 w-24 h-16 rounded-lg border-2 transition-all ${
                  index === currentSlideIndex
                    ? 'border-blue-600 shadow-md'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                style={{
                  background: `linear-gradient(135deg, ${selectedTemplate.style.backgroundColor} 0%, ${selectedTemplate.style.primaryColor}10 100%)`,
                }}
              >
                <span className="text-xs text-gray-500">{index + 1}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Controls */}
        <div className="space-y-4">
          {/* Template selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">母版选择</h3>
              <span className="text-xs text-gray-400">{availableTemplates.length} 个模板</span>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto">
              {availableTemplates.map(template => (
                <button
                  key={template.id}
                  onClick={() => setSelectedTemplate(template)}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    selectedTemplate.id === template.id
                      ? 'border-blue-600 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div
                    className="w-full h-8 rounded mb-2"
                    style={{
                      background: `linear-gradient(135deg, ${template.style.backgroundColor} 0%, ${template.style.primaryColor} 100%)`,
                    }}
                  />
                  <span className="text-sm text-gray-700">{template.name}</span>
                </button>
              ))}
            </div>
            {availableTemplates.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                暂无模板，请先在
                <Link href="/templates" className="text-blue-600 hover:underline">模板管理</Link>
                页面上传
              </p>
            )}
          </div>

          {/* Layout selection */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Layout 选择</h3>

            {/* Current layout */}
            {currentLayout && (
              <div className="mb-4">
                <span className="text-xs text-gray-500">当前 Layout</span>
                <div className="mt-1 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <span className="font-medium text-blue-700">{currentLayout.name}</span>
                  <p className="text-xs text-blue-600 mt-1">{currentLayout.description}</p>
                </div>
              </div>
            )}

            {/* Similar layouts */}
            {getSimilarLayouts().length > 0 && (
              <div>
                <span className="text-xs text-gray-500">同类推荐</span>
                <div className="mt-2 space-y-2">
                  {getSimilarLayouts().map(layout => (
                    <button
                      key={layout.id}
                      onClick={() => currentSlide && handleLayoutChange(currentSlide.slide_id, layout.id)}
                      className="w-full p-2 text-left bg-gray-50 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors"
                    >
                      <span className="text-sm text-gray-700">{layout.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* All layouts by category */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <span className="text-xs text-gray-500">全部 Layout</span>
              <div className="mt-2 space-y-2">
                {Object.entries(LAYOUT_CATEGORY_LABELS).map(([cat, label]) => {
                  const layoutsInCategory = availableLayouts.filter(l => l.category === cat);
                  if (layoutsInCategory.length === 0) return null;
                  return (
                    <div key={cat}>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        {LAYOUT_CATEGORY_ICONS[cat as LayoutCategory]} {label}
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {layoutsInCategory.map(layout => (
                          <button
                            key={layout.id}
                            onClick={() => currentSlide && handleLayoutChange(currentSlide.slide_id, layout.id)}
                            className={`px-2 py-1 text-xs rounded border transition-colors ${
                              currentLayoutId === layout.id
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300'
                            }`}
                          >
                            {layout.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Slide Preview Component
function SlidePreview({
  slide,
  layout,
  template,
}: {
  slide: SlideDraft;
  layout?: LayoutDefinition;
  template: Template;
}) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center">
      {/* Title */}
      <h2
        className="text-2xl font-bold mb-6 text-center"
        style={{ color: template.style.textColor }}
      >
        {slide.title}
      </h2>

      {/* Key message */}
      {slide.key_message && (
        <p
          className="text-lg mb-8 text-center max-w-2xl"
          style={{ color: template.style.primaryColor }}
        >
          {slide.key_message}
        </p>
      )}

      {/* Content based on layout */}
      <div className="w-full max-w-4xl">
        {layout?.category === 'MATRIX' && (
          <MatrixView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'PROCESS' && (
          <ProcessView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'PYRAMID' && (
          <PyramidView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'COMPARISON' && (
          <ComparisonView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'TIMELINE' && (
          <ProcessView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'RADAR' && (
          <MatrixView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'ORG_CHART' && (
          <PyramidView bullets={slide.bullets || []} template={template} />
        )}
        {layout?.category === 'CUSTOM' && (
          <ParallelView bullets={slide.bullets || []} template={template} />
        )}
        {!layout && (
          <ParallelView bullets={slide.bullets || []} template={template} />
        )}
      </div>
    </div>
  );
}

// Matrix View (SWOT, 2x2)
function MatrixView({ bullets, template }: { bullets: string[]; template: Template }) {
  const quadrants = ['左上', '右上', '左下', '右下'];
  return (
    <div className="grid grid-cols-2 gap-4">
      {bullets.slice(0, 4).map((bullet, i) => (
        <div
          key={i}
          className="p-4 rounded-lg border"
          style={{
            backgroundColor: i % 2 === 0 ? `${template.style.primaryColor}10` : `${template.style.secondaryColor}10`,
            borderColor: template.style.primaryColor,
          }}
        >
          <span className="text-xs text-gray-500">{quadrants[i]}</span>
          <p className="mt-1 text-sm" style={{ color: template.style.textColor }}>{bullet}</p>
        </div>
      ))}
    </div>
  );
}

// Process View
function ProcessView({ bullets, template }: { bullets: string[]; template: Template }) {
  return (
    <div className="flex items-center justify-center gap-4">
      {bullets.map((bullet, i) => (
        <div key={i} className="flex items-center">
          <div
            className="p-4 rounded-lg border text-center min-w-[120px]"
            style={{
              backgroundColor: `${template.style.primaryColor}10`,
              borderColor: template.style.primaryColor,
            }}
          >
            <span className="text-2xl font-bold" style={{ color: template.style.primaryColor }}>
              {i + 1}
            </span>
            <p className="mt-1 text-sm" style={{ color: template.style.textColor }}>{bullet}</p>
          </div>
          {i < bullets.length - 1 && (
            <svg className="w-8 h-8 mx-2" style={{ color: template.style.primaryColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          )}
        </div>
      ))}
    </div>
  );
}

// Pyramid View
function PyramidView({ bullets, template }: { bullets: string[]; template: Template }) {
  return (
    <div className="flex flex-col items-center gap-2">
      {bullets.slice(0, 5).map((bullet, i) => (
        <div
          key={i}
          className="p-2 rounded-lg text-center"
          style={{
            backgroundColor: `${template.style.primaryColor}${20 + i * 15}`,
            width: `${100 - i * 15}%`,
            color: template.style.textColor,
          }}
        >
          <span className="text-sm">{bullet}</span>
        </div>
      ))}
    </div>
  );
}

// Comparison View
function ComparisonView({ bullets, template }: { bullets: string[]; template: Template }) {
  const left = bullets.slice(0, Math.ceil(bullets.length / 2));
  const right = bullets.slice(Math.ceil(bullets.length / 2));
  return (
    <div className="grid grid-cols-2 gap-8">
      <div className="p-4 rounded-lg" style={{ backgroundColor: `${template.style.primaryColor}10` }}>
        {left.map((b, i) => (
          <p key={i} className="text-sm mb-2" style={{ color: template.style.textColor }}>• {b}</p>
        ))}
      </div>
      <div className="p-4 rounded-lg" style={{ backgroundColor: `${template.style.secondaryColor}10` }}>
        {right.map((b, i) => (
          <p key={i} className="text-sm mb-2" style={{ color: template.style.textColor }}>• {b}</p>
        ))}
      </div>
    </div>
  );
}

// Parallel View (default)
function ParallelView({ bullets, template }: { bullets: string[]; template: Template }) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {bullets.map((bullet, i) => (
        <div
          key={i}
          className="p-3 rounded-lg border"
          style={{ borderColor: template.style.primaryColor }}
        >
          <p className="text-sm" style={{ color: template.style.textColor }}>• {bullet}</p>
        </div>
      ))}
    </div>
  );
}

// Loading fallback
function PreviewLoading() {
  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    </div>
  );
}

export default function ReportPreviewPage() {
  return (
    <Suspense fallback={<PreviewLoading />}>
      <PreviewContent />
    </Suspense>
  );
}
