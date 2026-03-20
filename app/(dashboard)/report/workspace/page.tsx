'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  getTaskStatus,
  getOutline,
  confirmOutline,
  getSlides,
  confirmSlides,
  getPptxUrl,
  TaskStatus,
  ReportOutline,
  SlideDraft,
} from '@/lib/report-api';

type WorkspaceStep = 'outline' | 'slides' | 'export';

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const taskId = searchParams.get('task_id');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<WorkspaceStep>('outline');
  const [taskStatus, setTaskStatus] = useState<TaskStatus | null>(null);
  const [outline, setOutline] = useState<ReportOutline | null>(null);
  const [slides, setSlides] = useState<SlideDraft[]>([]);
  const [selectedSlide, setSelectedSlide] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

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

        if (status.status === 'outline_ready') {
          const outlineData = await getOutline(taskId);
          setOutline(outlineData);
          setStep('outline');
        } else if (status.status === 'slides_ready') {
          const slidesData = await getSlides(taskId);
          setSlides(slidesData.slides);
          setStep('slides');
        } else if (status.status === 'completed') {
          setDownloadUrl(getPptxUrl(taskId));
          setStep('export');
        } else if (status.status === 'failed') {
          setError(status.error_message || '任务失败');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [taskId]);

  // Confirm outline and generate slides
  const handleConfirmOutline = async () => {
    if (!taskId) return;

    setIsProcessing(true);
    try {
      await confirmOutline(taskId, outline || undefined);
      // Poll for slides ready
      const status = await pollUntilSlidesReady(taskId);
      if (status.status === 'slides_ready') {
        const slidesData = await getSlides(taskId);
        setSlides(slidesData.slides);
        setStep('slides');
        setTaskStatus(status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认大纲失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll until slides are ready
  const pollUntilSlidesReady = async (taskId: string): Promise<TaskStatus> => {
    const maxAttempts = 150; // 5 minutes at 2s interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await getTaskStatus(taskId);
      if (status.status === 'slides_ready' || status.status === 'failed') {
        return status;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('生成内容超时');
  };

  // Confirm slides and export
  const handleConfirmSlides = async () => {
    if (!taskId) return;

    setIsProcessing(true);
    try {
      await confirmSlides(taskId, slides);
      // Poll for completion
      const status = await pollUntilComplete(taskId);
      if (status.status === 'completed') {
        setDownloadUrl(getPptxUrl(taskId));
        setStep('export');
        setTaskStatus(status);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '确认内容失败');
    } finally {
      setIsProcessing(false);
    }
  };

  // Poll until export is complete
  const pollUntilComplete = async (taskId: string): Promise<TaskStatus> => {
    const maxAttempts = 60; // 2 minutes at 2s interval
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await getTaskStatus(taskId);
      if (status.status === 'completed' || status.status === 'failed') {
        return status;
      }
      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('导出超时');
  };

  // Update slide content
  const updateSlide = useCallback((index: number, field: keyof SlideDraft, value: unknown) => {
    setSlides(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
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

  // Render outline editor
  const renderOutlineEditor = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <h2 className="text-lg font-medium text-gray-900">报告大纲</h2>
          <p className="text-sm text-gray-500 mt-1">
            审核并编辑报告大纲，确认后将生成详细内容
          </p>
        </div>

        <div className="p-6 space-y-6">
          {/* Part 1: 项目需求的理解 */}
          <OutlineSection
            title="第一部分：项目需求的理解"
            outline={outline?.part1_outline}
            onChange={(data) => setOutline(prev => prev ? { ...prev, part1_outline: data } : null)}
          />

          {/* Part 2: 项目方法与整体框架 */}
          <OutlineSection
            title="第二部分：项目方法与整体框架"
            outline={outline?.part2_outline}
            onChange={(data) => setOutline(prev => prev ? { ...prev, part2_outline: data } : null)}
          />

          {/* Part 3: 项目实施步骤 */}
          <OutlineSection
            title="第三部分：项目实施步骤"
            outline={outline?.part3_outline}
            onChange={(data) => setOutline(prev => prev ? { ...prev, part3_outline: data } : null)}
          />

          {/* Part 4: 项目计划、团队与报价 */}
          <OutlineSection
            title="第四部分：项目计划、团队与报价"
            outline={outline?.part4_outline}
            onChange={(data) => setOutline(prev => prev ? { ...prev, part4_outline: data } : null)}
          />
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-500">
            预计 {outline?.estimated_slides || 0} 页幻灯片
          </div>
          <button
            onClick={handleConfirmOutline}
            disabled={isProcessing}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            确认大纲，生成内容
          </button>
        </div>
      </div>
    </div>
  );

  // Render slide editor
  const renderSlideEditor = () => (
    <div className="flex gap-6 h-[calc(100vh-200px)]">
      {/* Slide list */}
      <div className="w-64 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">幻灯片列表</h3>
          <p className="text-xs text-gray-500 mt-1">共 {slides.length} 页</p>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {slides.map((slide, index) => (
            <button
              key={slide.slide_id}
              onClick={() => setSelectedSlide(index)}
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                selectedSlide === index
                  ? 'bg-blue-50 text-blue-700'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <div className="text-xs text-gray-400 mb-0.5">
                {getSectionLabel(slide.section)}
              </div>
              <div className="text-sm font-medium truncate">
                {slide.title || '无标题'}
              </div>
            </button>
          ))}
        </div>
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
          <button
            onClick={handleConfirmSlides}
            disabled={isProcessing}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isProcessing && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            确认并导出
          </button>
        </div>
      </div>

      {/* Slide editor */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {selectedSlide !== null && slides[selectedSlide] ? (
          <div className="h-full flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-medium text-gray-900">编辑幻灯片</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  页面标题
                </label>
                <input
                  type="text"
                  value={slides[selectedSlide].title}
                  onChange={(e) => updateSlide(selectedSlide, 'title', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Key message */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  核心观点 (Action Title)
                </label>
                <textarea
                  value={slides[selectedSlide].key_message}
                  onChange={(e) => updateSlide(selectedSlide, 'key_message', e.target.value)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Bullets */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  支撑论点
                </label>
                {slides[selectedSlide].bullets.map((bullet, bIndex) => (
                  <div key={bIndex} className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={bullet}
                      onChange={(e) => {
                        const newBullets = [...slides[selectedSlide].bullets];
                        newBullets[bIndex] = e.target.value;
                        updateSlide(selectedSlide, 'bullets', newBullets);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <button
                      onClick={() => {
                        const newBullets = slides[selectedSlide].bullets.filter((_, i) => i !== bIndex);
                        updateSlide(selectedSlide, 'bullets', newBullets);
                      }}
                      className="px-3 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => {
                    const newBullets = [...slides[selectedSlide].bullets, ''];
                    updateSlide(selectedSlide, 'bullets', newBullets);
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + 添加论点
                </button>
              </div>

              {/* Evidence */}
              {slides[selectedSlide].retrieved_evidence && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    检索到的素材证据
                  </label>
                  <div className="p-4 bg-blue-50 rounded-lg text-sm text-blue-800 whitespace-pre-wrap">
                    {slides[selectedSlide].retrieved_evidence}
                  </div>
                </div>
              )}

              {/* Source */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  来源引用
                </label>
                <input
                  type="text"
                  value={slides[selectedSlide].source_ref}
                  onChange={(e) => updateSlide(selectedSlide, 'source_ref', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              {/* Layout */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  版式类型
                </label>
                <select
                  value={slides[selectedSlide].layout}
                  onChange={(e) => updateSlide(selectedSlide, 'layout', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="bullet_points">要点列表</option>
                  <option value="two_columns">双列对比</option>
                  <option value="data_chart">数据图表</option>
                  <option value="swot_matrix">SWOT 矩阵</option>
                  <option value="process_flow">流程图</option>
                  <option value="gantt_chart">甘特图</option>
                </select>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <p>选择左侧幻灯片进行编辑</p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="w-80 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="font-medium text-gray-900">预览</h3>
        </div>
        <div className="p-4 aspect-[16/9] bg-gray-100 flex items-center justify-center">
          <div className="text-center text-gray-400 text-sm">
            <p>预览功能开发中</p>
          </div>
        </div>
      </div>
    </div>
  );

  // Render export page
  const renderExportPage = () => (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-4xl">✅</span>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">报告生成完成</h2>
        <p className="text-gray-600 mb-6">
          您的项目建议书已生成完成，可以下载 PPTX 文件进行编辑
        </p>
        {downloadUrl && (
          <a
            href={downloadUrl}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            下载 PPTX
          </a>
        )}
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
  );

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header with step indicator */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={() => router.push('/report')}
            className="text-gray-500 hover:text-gray-700"
          >
            ← 返回
          </button>
          <h1 className="text-2xl font-bold text-gray-900">报告工作台</h1>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2">
          {(['outline', 'slides', 'export'] as WorkspaceStep[]).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  step === s
                    ? 'bg-blue-600 text-white'
                    : i < ['outline', 'slides', 'export'].indexOf(step)
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-500'
                }`}
              >
                {i + 1}
              </div>
              <span className={`ml-2 text-sm ${
                step === s ? 'text-blue-600 font-medium' : 'text-gray-500'
              }`}>
                {s === 'outline' ? '大纲审核' : s === 'slides' ? '内容编辑' : '导出'}
              </span>
              {i < 2 && (
                <div className={`w-12 h-0.5 mx-2 ${
                  i < ['outline', 'slides', 'export'].indexOf(step) ? 'bg-green-500' : 'bg-gray-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      {step === 'outline' && renderOutlineEditor()}
      {step === 'slides' && renderSlideEditor()}
      {step === 'export' && renderExportPage()}
    </div>
  );
}

// Helper component for outline section
function OutlineSection({
  title,
  outline,
  onChange,
}: {
  title: string;
  outline?: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}) {
  const subsections = (outline?.subsections as Array<{ title: string; points: string[] }>) || [];

  const updateSubsection = (index: number, field: 'title' | 'points', value: string | string[]) => {
    const newSubsections = [...subsections];
    if (field === 'title') {
      newSubsections[index] = { ...newSubsections[index], title: value as string };
    } else {
      newSubsections[index] = { ...newSubsections[index], points: value as string[] };
    }
    onChange({ ...outline, subsections: newSubsections });
  };

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="font-medium text-gray-900">{title}</h3>
      </div>
      <div className="p-4 space-y-4">
        {subsections.map((subsection, sIndex) => (
          <div key={sIndex} className="space-y-2">
            <input
              type="text"
              value={subsection.title}
              onChange={(e) => updateSubsection(sIndex, 'title', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="pl-4 space-y-1">
              {subsection.points.map((point, pIndex) => (
                <div key={pIndex} className="flex gap-2 items-start">
                  <span className="text-gray-400 text-sm mt-1">•</span>
                  <input
                    type="text"
                    value={point}
                    onChange={(e) => {
                      const newPoints = [...subsection.points];
                      newPoints[pIndex] = e.target.value;
                      updateSubsection(sIndex, 'points', newPoints);
                    }}
                    className="flex-1 px-2 py-1 border border-gray-200 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper function to get section label
function getSectionLabel(section: string): string {
  const labels: Record<string, string> = {
    part1: 'Part 1: 需求理解',
    part2: 'Part 2: 方法框架',
    part3: 'Part 3: 实施步骤',
    part4: 'Part 4: 计划报价',
  };
  return labels[section] || section;
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
