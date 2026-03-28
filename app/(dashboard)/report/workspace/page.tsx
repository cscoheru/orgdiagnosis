'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  getTaskStatus,
  getModules,
  confirmModules,
  getPageTitles,
  confirmPageTitles,
  getSlides,
  confirmSlides,
  TaskStatus,
  Module,
  PageTitle,
  SlideDraft,
} from '@/lib/report-api';
import ModuleCard from '@/components/workspace/module-card';

type WorkspaceStep = 'modules' | 'page_titles' | 'theme' | 'slides' | 'preview';

// Theme interface
interface Theme {
  theme_id: string;
  theme_name: string;
  primary_color: string;
  secondary_color: string;
  accent_color: string;
  style: string;
  description: string;
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');
  const projectId = searchParams.get('project');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WorkspaceStep>('modules');
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [pageTitles, setPageTitles] = useState<PageTitle[]>([]);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

  // Theme selection state
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);

  // Fetch initial data
  useEffect(() => {
    if (!taskId) {
      setError('缺少任务ID');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const status = await getTaskStatus(taskId);
        setTaskStatus(status);
        console.log('[Workspace] Task status:', status.status);

        // Handle different workflow stages
        if (status.status === 'modules_ready' || status.status === 'generating_page_titles') {
          const modulesData = await getModules(taskId);
          setModules(modulesData.modules);
          setStep('modules');
          // Auto-expand first module
          if (modulesData.modules.length > 0) {
            setExpandedModules(new Set([modulesData.modules[0].module_id]));
          }
        } else if (status.status === 'page_titles_ready' || status.status === 'generating_slides') {
          // Load both modules and page titles
          const modulesData = await getModules(taskId);
          setModules(modulesData.modules);
          const pageTitlesData = await getPageTitles(taskId);
          setPageTitles(pageTitlesData.page_titles);
          setStep('page_titles');
          // Expand all modules with pages
          const modulesWithPages = new Set(pageTitlesData.page_titles.map(p => p.module_id));
          setExpandedModules(modulesWithPages);
        } else if (status.status === 'slides_ready' || status.status === 'ready_for_export') {
          // Load all data for content editing
          const modulesData = await getModules(taskId);
          setModules(modulesData.modules);
          try {
            const pageTitlesData = await getPageTitles(taskId);
            setPageTitles(pageTitlesData.page_titles);
          } catch (e) {
            console.warn('[Workspace] Could not load page titles:', e);
          }
          const slidesData = await getSlides(taskId);
          setSlides(slidesData.slides);
          setStep('slides');
          // Expand all modules
          setExpandedModules(new Set(modulesData.modules.map(m => m.module_id)));
        } else if (status.status === 'completed') {
          // Already completed, redirect to preview for download
          const previewUrl = projectId
            ? `/report/preview?task_id=${taskId}&project_id=${projectId}`
            : `/report/preview?task_id=${taskId}`;
          router.push(previewUrl);
        } else if (status.status === 'failed') {
          setError(status.error_message || '任务失败');
        } else if (status.status === 'pending' || status.status === 'generating_modules') {
          // Still generating, poll for updates
          pollUntilReady(taskId);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  // Load themes on mount
  useEffect(() => {
    const loadThemes = async () => {
      try {
        const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const response = await fetch(`${API_BASE}/api/layout/themes`);
        if (response.ok) {
          const data = await response.json();
          setThemes(data.themes || []);
          if (data.themes?.length > 0) {
            setSelectedTheme(data.themes[0]);
          }
        }
      } catch (e) {
        console.warn('[Workspace] Failed to load themes:', e);
      }
    };
    loadThemes();
  }, []);

  // Poll until modules are ready
  const pollUntilReady = async (taskId: string) => {
    const maxAttempts = 180; // 6 minutes at 2s interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const status = await getTaskStatus(taskId);
        setTaskStatus(status);

        if (status.status === 'modules_ready') {
          const modulesData = await getModules(taskId);
          setModules(modulesData.modules);
          setStep('modules');
          if (modulesData.modules.length > 0) {
            setExpandedModules(new Set([modulesData.modules[0].module_id]));
          }
          return;
        }

        if (status.status === 'failed') {
          setError(status.error_message || '任务失败');
          return;
        }
      } catch (e) {
        console.error('[Workspace] Poll error:', e);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    setError('生成超时，请重试');
  };

  // Poll for page titles
  const pollUntilPageTitlesReady = async (taskId: string) => {
    const maxAttempts = 180;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await getTaskStatus(taskId);
      setTaskStatus(status);

      if (status.status === 'page_titles_ready') {
        const pageTitlesData = await getPageTitles(taskId);
        setPageTitles(pageTitlesData.page_titles);
        setStep('page_titles');
        const modulesWithPages = new Set(pageTitlesData.page_titles.map(p => p.module_id));
        setExpandedModules(modulesWithPages);
        return true;
      }

      if (status.status === 'failed') {
        setError(status.error_message || '任务失败');
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    setError('生成页面标题超时');
    return false;
  };

  // Poll for slides
  const pollUntilSlidesReady = async (taskId: string) => {
    const maxAttempts = 180;
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await getTaskStatus(taskId);
      setTaskStatus(status);

      if (status.status === 'slides_ready' || status.status === 'ready_for_export') {
        const slidesData = await getSlides(taskId);
        setSlides(slidesData.slides);
        setStep('slides');
        return true;
      }

      if (status.status === 'failed') {
        setError(status.error_message || '任务失败');
        return false;
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    setError('生成幻灯片超时');
    return false;
  };

  // Confirm modules
  const handleConfirmModules = async () => {
    if (!taskId) return;
    setIsProcessing(true);
    try {
      await confirmModules(taskId, modules);
      await pollUntilPageTitlesReady(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认模块失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm page titles
  const handleConfirmPageTitles = async () => {
    if (!taskId) return;
    setIsProcessing(true);
    try {
      await confirmPageTitles(taskId, pageTitles);
      // Go to theme selection step instead of directly generating slides
      setStep('theme');
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认页面标题失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm theme and start generating slides
  const handleConfirmTheme = async () => {
    if (!taskId) return;
    setIsProcessing(true);
    try {
      // Store selected theme for later use in export
      if (selectedTheme) {
        localStorage.setItem(`theme_${taskId}`, JSON.stringify(selectedTheme));
      }
      // Start generating slides
      await pollUntilSlidesReady(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成内容失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm slides and go to preview
  const handleGoToPreview = async () => {
    if (!taskId) return;
    setIsProcessing(true);
    try {
      await confirmSlides(taskId, slides);
      // Navigate to preview page
      const previewUrl = projectId
        ? `/report/preview?task_id=${taskId}&project_id=${projectId}`
        : `/report/preview?task_id=${taskId}`;
      router.push(previewUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认内容失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Toggle module expansion
  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => {
      const next = new Set(prev);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
      }
      return next;
    });
  };

  // Update module
  const handleModuleEdit = useCallback((updatedModule: Module) => {
    setModules(prev => prev.map(m => m.module_id === updatedModule.module_id ? updatedModule : m));
  }, []);

  // Update page title
  const handlePageEdit = useCallback((pageId: string, updates: Partial<PageTitle>) => {
    setPageTitles(prev => prev.map(p => p.page_id === pageId ? { ...p, ...updates } : p));
  }, []);

  // Update slide
  const handleSlideEdit = useCallback((slideId: string, updates: Record<string, unknown>) => {
    setSlides(prev => prev.map(s => s.slide_id === slideId ? { ...s, ...updates } as SlideDraft : s));
  }, []);

  // Render loading state
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

  // Render error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">⚠️</span>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">出错了</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => router.push('/report')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            返回重新生成
          </button>
        </div>
      </div>
    );
  }

  // Render modules editor
  const renderModulesEditor = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900">报告核心模块</h2>
          <p className="text-sm text-gray-500 mt-1">
            审核报告的核心模块结构，确认后将生成每个模块的页面标题
          </p>
        </div>

        <div className="p-4 space-y-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.module_id}
              module={module}
              pageTitles={pageTitles}
              slides={slides}
              isExpanded={expandedModules.has(module.module_id)}
              onToggle={() => toggleModule(module.module_id)}
              onModuleEdit={handleModuleEdit}
              onPageEdit={handlePageEdit}
              onSlideEdit={handleSlideEdit}
            />
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            共 {modules.length} 个模块，预计 {modules.reduce((sum, m) => sum + m.estimated_pages, 0)} 页
          </div>
          <button
            onClick={handleConfirmModules}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            确认模块，生成页面标题
          </button>
        </div>
      </div>
    </div>
  );

  // Render page titles editor (card-based)
  const renderPageTitlesEditor = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-white">
          <h2 className="text-lg font-semibold text-gray-900">页面标题审核</h2>
          <p className="text-sm text-gray-500 mt-1">
            审核每个模块的页面标题和核心方向，确认后将生成详细内容
          </p>
        </div>

        <div className="p-4 space-y-3">
          {modules.map((module) => (
            <ModuleCard
              key={module.module_id}
              module={module}
              pageTitles={pageTitles}
              slides={slides}
              isExpanded={expandedModules.has(module.module_id)}
              onToggle={() => toggleModule(module.module_id)}
              onModuleEdit={handleModuleEdit}
              onPageEdit={handlePageEdit}
              onSlideEdit={handleSlideEdit}
            />
          ))}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            共 {pageTitles.length} 页标题待确认
          </div>
          <button
            onClick={handleConfirmPageTitles}
            disabled={isProcessing}
            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            确认标题，生成内容
          </button>
        </div>
      </div>
    </div>
  );

  // Render theme selector
  const renderThemeSelector = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-white">
        <h2 className="text-lg font-semibold text-gray-900">🎨 选择主题风格</h2>
        <p className="text-sm text-gray-500 mt-1">
          为报告选择一个全局视觉主题，包括配色、字体等
        </p>
      </div>

      <div className="p-6">
        {/* Theme grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {themes.map((theme) => (
            <button
              key={theme.theme_id}
              onClick={() => setSelectedTheme(theme)}
              className={`relative p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                selectedTheme?.theme_id === theme.theme_id
                  ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Color preview */}
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-8 h-8 rounded-full shadow-inner"
                  style={{ backgroundColor: theme.primary_color }}
                  title="主色"
                />
                <div
                  className="w-6 h-6 rounded-full shadow-inner"
                  style={{ backgroundColor: theme.secondary_color }}
                  title="辅色"
                />
                <div
                  className="w-4 h-4 rounded-full shadow-inner"
                  style={{ backgroundColor: theme.accent_color }}
                  title="强调色"
                />
              </div>

              {/* Theme name */}
              <h3 className="font-medium text-gray-900 text-left">{theme.theme_name}</h3>
              <p className="text-xs text-gray-500 text-left mt-1">{theme.description}</p>

              {/* Selected indicator */}
              {selectedTheme?.theme_id === theme.theme_id && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>

        {/* Preview area */}
        {selectedTheme && (
          <div className="mt-6 p-6 rounded-xl border border-gray-200" style={{ backgroundColor: selectedTheme.primary_color + '10' }}>
            <h4 className="font-medium mb-3" style={{ color: selectedTheme.primary_color }}>
              预览效果
            </h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="w-full h-2 rounded mb-2" style={{ backgroundColor: selectedTheme.primary_color }} />
                <div className="w-3/4 h-2 rounded bg-gray-200 mb-1" />
                <div className="w-1/2 h-2 rounded bg-gray-100" />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedTheme.secondary_color }} />
                  <div className="w-2/3 h-2 rounded bg-gray-200" />
                </div>
                <div className="w-full h-2 rounded bg-gray-100 mb-1" />
                <div className="w-5/6 h-2 rounded bg-gray-100" />
              </div>
              <div className="p-4 bg-white rounded-lg shadow-sm">
                <div className="w-full h-2 rounded mb-2" style={{ backgroundColor: selectedTheme.accent_color }} />
                <div className="w-2/3 h-2 rounded bg-gray-200 mb-1" />
                <div className="w-1/3 h-2 rounded bg-gray-100" />
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {themes.length} 个主题可用
        </div>
        <button
          onClick={handleConfirmTheme}
          disabled={isProcessing || !selectedTheme}
          className="px-6 py-2 bg-orange-600 text-white rounded-lg font-medium hover:bg-orange-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isProcessing && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          确认主题，生成内容 →
        </button>
      </div>
    </div>
  );

  // Render slides editor (card-based with full editing)
  const renderSlidesEditor = () => {
    return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-green-50 to-white">
        <h2 className="text-lg font-semibold text-gray-900">内容编辑</h2>
        <p className="text-sm text-gray-500 mt-1">
          编辑每个页面的标题、核心观点和支撑论点
        </p>
      </div>

      <div className="p-4 space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto">
        {modules.map((module) => (
          <ModuleCard
            key={module.module_id}
            module={module}
            pageTitles={pageTitles}
            slides={slides}
            isExpanded={expandedModules.has(module.module_id)}
            onToggle={() => toggleModule(module.module_id)}
            onModuleEdit={handleModuleEdit}
            onPageEdit={handlePageEdit}
            onSlideEdit={handleSlideEdit}
          />
        ))}
      </div>

      <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <div className="text-sm text-gray-500 flex items-center gap-4">
          <span>共 {slides.length} 页幻灯片</span>
          <Link
            href={projectId ? `/templates?project=${projectId}` : '/templates'}
            className="text-purple-600 hover:text-purple-700 flex items-center gap-1"
          >
            <span>🎨</span>
            选择模板
          </Link>
        </div>
        <button
          onClick={handleGoToPreview}
          disabled={isProcessing}
          className="px-6 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {isProcessing && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          预览和导出 →
        </button>
      </div>
    </div>
  );
  };

  // Get step info for indicator
  const getStepInfo = () => {
    const steps = [
      { id: 'modules', label: '模块审核', color: 'blue' },
      { id: 'page_titles', label: '页面标题', color: 'purple' },
      { id: 'theme', label: '主题选择', color: 'orange' },
      { id: 'slides', label: '内容编辑', color: 'green' },
      { id: 'preview', label: '预览导出', color: 'red' },
    ];
    const currentIndex = steps.findIndex(s => s.id === step);
    return { steps, currentIndex };
  };

  const { steps: stepList, currentIndex } = getStepInfo();

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with step indicator */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/report')}
              className="text-gray-500 hover:text-gray-700"
            >
              ← 返回
            </button>
            <h1 className="text-2xl font-bold text-gray-900">内容编辑</h1>
            {taskStatus && (
              <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                {taskStatus.progress_percentage.toFixed(0)}%
              </span>
            )}
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {stepList.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === s.id
                    ? `bg-${s.color}-600 text-white`
                    : i < currentIndex
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
                style={step === s.id ? { backgroundColor: s.color === 'blue' ? '#2563eb' : s.color === 'purple' ? '#9333ea' : s.color === 'green' ? '#16a34a' : '#ea580c' } : {}}
              >
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${
                step === s.id ? `text-${s.color}-600 font-medium` : 'text-gray-500'
              }`} style={step === s.id ? { color: s.color === 'blue' ? '#2563eb' : s.color === 'purple' ? '#9333ea' : s.color === 'green' ? '#16a34a' : '#ea580c' } : {}}>
                {s.label}
              </span>
              {i < 3 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  i < currentIndex ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {step === 'modules' && renderModulesEditor()}
      {step === 'page_titles' && renderPageTitlesEditor()}
      {step === 'theme' && renderThemeSelector()}
      {step === 'slides' && renderSlidesEditor()}
    </div>
  );
}

// Loading fallback component
function WorkspaceLoading() {
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

// Export with Suspense wrapper
export default function ReportWorkspacePage() {
  return (
    <>
      <div className="max-w-7xl mx-auto px-4 lg:px-8 pt-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-6 flex items-center justify-between">
          <span className="text-sm text-amber-700">
            报告工坊已整合至项目工作流
          </span>
          <Link href="/projects" className="text-sm text-amber-700 underline hover:text-amber-800">
            前往项目列表 →
          </Link>
        </div>
      </div>
      <Suspense fallback={<WorkspaceLoading />}>
        <WorkspaceContent />
      </Suspense>
    </>
  );
}
