'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { DimensionRadarChart } from '@/components/charts/radar-chart';
import { WarningCards } from '@/components/charts/warning-cards';
import { DimensionDetailChart } from '@/components/charts/dimension-detail-chart';
import { SkeletonRadar, SkeletonScoreBar } from '@/components/ui/skeleton';
import type { FiveDimensionsData, DimensionData } from '@/types/diagnosis';
import { DIMENSION_KEYS } from '@/types/diagnosis';
import { getTaskStatus, getTaskResult } from '@/lib/langgraph-client';
import dynamic from 'next/dynamic';
import { listObjects, type KernelObject } from '@/lib/api/kernel-client';

const GraphViewer = dynamic(() => import('@/components/kernel/GraphViewer'), {
  ssr: false,
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// LangGraph result dimension type
interface LangGraphDimension {
  category: string;
  total_score: number;
  summary_insight: string;
  secondary_metrics: Array<{
    name: string;
    display_name: string;
    avg_score: number;
    tertiary_metrics: Array<{
      name: string;
      display_name: string;
      score: number;
      evidence: string;
      analysis: string;
      confidence: string;
    }>;
  }>;
}

interface LangGraphResult {
  task_id: string;
  status: string;
  overall_score: number;
  dimensions: LangGraphDimension[];
  completed_at: string;
}

// Transform LangGraph result to FiveDimensionsData format
function transformLangGraphResult(result: LangGraphResult): FiveDimensionsData {
  const dimensionLabels: Record<string, string> = {
    strategy: '战略',
    structure: '组织',
    performance: '绩效',
    compensation: '薪酬',
    talent: '人才',
  };

  const dimensionDescriptions: Record<string, string> = {
    strategy: '做正确的事 - 战略方向与市场定位',
    structure: '提升系统运转效率 - 组织架构与流程',
    performance: '持续创造价值 - 绩效管理与目标达成',
    compensation: '激励与保留 - 薪酬体系与激励机制',
    talent: '人才发展 - 人才招聘、培养与发展',
  };

  const data: FiveDimensionsData = {
    overall_score: result.overall_score,
    strategy: createEmptyDimension('strategy'),
    structure: createEmptyDimension('structure'),
    performance: createEmptyDimension('performance'),
    compensation: createEmptyDimension('compensation'),
    talent: createEmptyDimension('talent'),
  };

  // Map dimensions from result
  for (const dim of result.dimensions) {
    const key = dim.category as keyof Omit<FiveDimensionsData, 'overall_score' | 'summary'>;
    if (key in data) {
      (data as any)[key] = {
        label: dimensionLabels[key] || dim.category,
        description: dimensionDescriptions[key] || dim.summary_insight,
        score: dim.total_score,
        L2_categories: transformSecondaryMetrics(dim.secondary_metrics || []),
      };
    }
  }

  return data;
}

function createEmptyDimension(key: string): DimensionData {
  return {
    label: key,
    description: '',
    score: 0,
    L2_categories: {},
  };
}

function transformSecondaryMetrics(metrics: LangGraphDimension['secondary_metrics']): Record<string, { label: string; score: number; L3_items: Record<string, { score: number; evidence: string; confidence: 'high' | 'medium' | 'low' }> }> {
  const categories: Record<string, { label: string; score: number; L3_items: Record<string, { score: number; evidence: string; confidence: 'high' | 'medium' | 'low' }> }> = {};

  for (const metric of metrics) {
    const l3Items: Record<string, { score: number; evidence: string; confidence: 'high' | 'medium' | 'low' }> = {};

    for (const tertiary of metric.tertiary_metrics || []) {
      const confidence = (tertiary.confidence === 'high' || tertiary.confidence === 'medium' || tertiary.confidence === 'low')
        ? tertiary.confidence
        : 'medium';
      l3Items[tertiary.name] = {
        score: tertiary.score,
        evidence: tertiary.evidence || '',
        confidence: confidence,
      };
    }

    categories[metric.name] = {
      label: metric.display_name || metric.name,
      score: metric.avg_score,
      L3_items: l3Items,
    };
  }

  return categories;
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('project_id');
  const [data, setData] = useState<FiveDimensionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [savedToProject, setSavedToProject] = useState(false);
  const [kernelObjects, setKernelObjects] = useState<KernelObject[]>([]);
  const [showKernelGraph, setShowKernelGraph] = useState(false);

  // 从 LangGraph API 获取数据
  useEffect(() => {
    const fetchData = async () => {
      const taskId = params.id as string;

      setIsLoading(true);
      setError(null);

      try {
        // First check task status
        const status = await getTaskStatus(taskId);

        if (status.status === 'completed' && status.result) {
          // Transform result to expected format
          const transformed = transformLangGraphResult(status.result as unknown as LangGraphResult);
          setData(transformed);
        } else if (status.status === 'completed') {
          // Fetch result separately and transform
          const result = await getTaskResult(taskId);
          const transformed = transformLangGraphResult(result as unknown as LangGraphResult);
          setData(transformed);
        } else if (status.status === 'failed') {
          setError(status.error || '诊断失败');
        } else {
          setError('诊断尚未完成');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载失败');
      }

      setIsLoading(false);
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  // 加载内核对象数据
  useEffect(() => {
    listObjects(50).then((res) => {
      if (res.success && res.data) {
        setKernelObjects(res.data);
      }
    });
  }, []);

  const handleExportPDF = async () => {
    const sessionId = params.id as string;
    setIsExporting(true);
    // Open PDF in new tab
    window.open(`${API_BASE}/api/export/pdf/${sessionId}`, '_blank');
    setTimeout(() => setIsExporting(false), 2000);
  };

  // Save diagnosis PDF to project folder
  const handleSaveToProject = async () => {
    if (!projectId) return;

    const sessionId = params.id as string;
    setIsSaving(true);

    try {
      // Get PDF blob from export API
      const response = await fetch(`${API_BASE}/api/export/pdf/${sessionId}`);
      if (!response.ok) throw new Error('Failed to generate PDF');

      const pdfBlob = await response.blob();
      const filename = `诊断报告_${new Date().toISOString().slice(0, 10)}.pdf`;

      // Upload to project folder
      const formData = new FormData();
      formData.append('file', pdfBlob, filename);
      formData.append('project_id', projectId);
      formData.append('folder_type', 'root'); // Save to project root

      const uploadResponse = await fetch(`${API_BASE}/api/knowledge/files/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error('Failed to save to project');

      setSavedToProject(true);
    } catch (err) {
      console.error('Save to project failed:', err);
      alert('保存失败，请重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <div className="h-7 w-48 rounded bg-gray-200 animate-pulse mb-2"></div>
          <div className="h-4 w-32 rounded bg-gray-200 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <SkeletonRadar />
          </div>
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SkeletonScoreBar />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <SkeletonScoreBar />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 错误状态
  if (error || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || '数据加载失败'}</p>
          <button
            onClick={() => router.push('/input')}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            返回录入页面
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Deprecation banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
        <span className="text-sm text-amber-700">
          诊断结果已整合至项目工作流
        </span>
        <Link href="/data" className="text-sm text-amber-700 underline hover:text-amber-800">
          前往数据探索 →
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">诊断结果</h1>
          <p className="text-gray-500 mt-1">
            诊断时间: {new Date().toLocaleString('zh-CN')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/input')}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            ← 新建诊断
          </button>
          {projectId && (
            <button
              onClick={handleSaveToProject}
              disabled={isSaving || savedToProject}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                savedToProject
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : isSaving
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-500 text-white hover:bg-emerald-600'
              }`}
            >
              {savedToProject ? '✓ 已保存到项目' : isSaving ? '保存中...' : '💾 保存到项目'}
            </button>
          )}
          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className={`px-6 py-2 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/25 ${
              isExporting
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-600 hover:to-purple-700'
            }`}
          >
            {isExporting ? '生成中...' : '📄 导出 PDF'}
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-blue-100 text-sm font-medium">整体健康度</p>
            <p className="text-5xl font-bold mt-1">{data.overall_score}</p>
            <p className="text-blue-100 text-sm mt-1">满分 100</p>
          </div>
          <div className="text-8xl opacity-20">◈</div>
        </div>
      </div>

      {/* L1 Radar Chart */}
      <DimensionRadarChart data={data} />

      {/* Warning Cards */}
      <WarningCards data={data} threshold={60} />

      {/* L2 & L3 Dimension Details */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-gray-900">各维度详情</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {DIMENSION_KEYS.map((key) => (
            <DimensionDetailChart
              key={key}
              dimensionKey={key}
              data={data[key]}
            />
          ))}
        </div>
      </div>

      {/* Kernel Graph Section */}
      {kernelObjects.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">内核数据图谱</h2>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-500">
                {kernelObjects.length} 个对象
              </span>
              <button
                onClick={() => setShowKernelGraph(!showKernelGraph)}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                {showKernelGraph ? '收起' : '展开图谱'}
              </button>
            </div>
          </div>

          {showKernelGraph && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Object summary */}
              <div className="border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">对象概览</h3>
                {Object.entries(
                  kernelObjects.reduce<Record<string, number>>((acc, obj) => {
                    acc[obj.model_key] = (acc[obj.model_key] || 0) + 1;
                    return acc;
                  }, {})
                ).map(([model, count]) => (
                  <div key={model} className="flex justify-between text-sm py-1">
                    <span className="text-gray-600">{model}</span>
                    <span className="font-mono text-gray-900">{count}</span>
                  </div>
                ))}
              </div>

              {/* Graph viewer */}
              <div className="lg:col-span-2">
                <GraphViewer
                  startObjId={kernelObjects[0]._id}
                  depth={2}
                  height="400px"
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
