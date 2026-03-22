'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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

type WorkspaceStep = 'modules' | 'page_titles' | 'slides' | 'preview';

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WorkspaceStep>('modules');
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [pageTitles, setPageTitles] = useState<PageTitle[]>([]);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);

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
          router.push(`/report/preview?task_id=${taskId}`);
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
      await pollUntilSlidesReady(taskId);
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认页面标题失败');
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
      router.push(`/report/preview?task_id=${taskId}`);
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
        <div className="text-sm text-gray-500">
          共 {slides.length} 页幻灯片
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
      { id: 'slides', label: '内容编辑', color: 'green' },
      { id: 'preview', label: '预览导出', color: 'orange' },
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
    <Suspense fallback={<WorkspaceLoading />}>
      <WorkspaceContent />
    </Suspense>
  );
}
