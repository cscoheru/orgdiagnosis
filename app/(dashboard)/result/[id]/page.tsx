'use client';

import { useParams, useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { DimensionRadarChart } from '@/components/charts/radar-chart';
import { WarningCards } from '@/components/charts/warning-cards';
import { DimensionDetailChart } from '@/components/charts/dimension-detail-chart';
import type { FiveDimensionsData } from '@/types/diagnosis';
import { DIMENSION_KEYS } from '@/types/diagnosis';
import { getDiagnosis, exportPDF } from '@/lib/api-config';

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const [data, setData] = useState<FiveDimensionsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // 从 Render 后端 API 获取数据
  useEffect(() => {
    const fetchData = async () => {
      const sessionId = params.id as string;

      setIsLoading(true);
      setError(null);

      const result = await getDiagnosis(sessionId);

      if (result.success && result.data) {
        setData(result.data);
      } else {
        setError(result.error || '加载失败');
      }

      setIsLoading(false);
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleExportPDF = async () => {
    const sessionId = params.id as string;
    setIsExporting(true);
    exportPDF(sessionId);
    // 短暂延迟后恢复按钮状态
    setTimeout(() => setIsExporting(false), 2000);
  };

  // 加载状态
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-500">加载诊断结果...</p>
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
    </div>
  );
}
