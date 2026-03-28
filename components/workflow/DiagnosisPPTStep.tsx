'use client';

import type { FiveDimensionsData, DimensionKey, L2Category } from '@/types/diagnosis';
import { DIMENSION_LABELS, getScoreColor } from '@/types/diagnosis';

interface DiagnosisPPTStepProps {
  analysisData: FiveDimensionsData | null;
  onGenerate: () => void;
  exporting: boolean;
  filePath?: string | null;
}

export default function DiagnosisPPTStep({
  analysisData,
  onGenerate,
  exporting,
  filePath,
}: DiagnosisPPTStepProps) {
  if (!analysisData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-400">请先完成五维分析</p>
      </div>
    );
  }

  // Collect all L2 dimensions across the 5 dimensions
  const l2Slides: Array<{
    dimension: DimensionKey;
    dimensionLabel: string;
    categoryKey: string;
    category: L2Category;
  }> = [];

  const dimKeys = Object.keys(DIMENSION_LABELS) as DimensionKey[];
  for (const dim of dimKeys) {
    const dimData = analysisData[dim];
    if (!dimData?.L2_categories) continue;
    for (const [catKey, cat] of Object.entries(dimData.L2_categories)) {
      l2Slides.push({
        dimension: dim,
        dimensionLabel: DIMENSION_LABELS[dim],
        categoryKey: catKey,
        category: cat,
      });
    }
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">诊断报告 PPT</h3>
          <p className="text-sm text-gray-500 mt-0.5">按 L2 维度生成，共 {l2Slides.length} 页</p>
        </div>
        <div className="flex gap-2">
          {filePath && (
            <a
              href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${filePath}`}
              download
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm"
            >
              下载 PPTX
            </a>
          )}
          <button
            onClick={onGenerate}
            disabled={exporting}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {exporting ? '生成中...' : '生成 PPT'}
          </button>
        </div>
      </div>

      {/* L2 dimension slide list */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto">
        {l2Slides.map((slide, i) => (
          <div
            key={`${slide.dimension}-${slide.categoryKey}`}
            className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow"
          >
            <div className="flex items-center gap-3">
              <span className="w-8 h-8 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-xs font-medium">
                #{i + 1}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-600">
                    {slide.dimensionLabel}
                  </span>
                  <span className="text-sm font-medium text-gray-800 truncate">
                    {slide.category.label || slide.categoryKey}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span
                    className="text-sm font-bold"
                    style={{ color: getScoreColor(slide.category.score) }}
                  >
                    {slide.category.score} 分
                  </span>
                  <span className="text-xs text-gray-400">
                    {Object.keys(slide.category.L3_items || {}).length} 个评估项
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Export status */}
      {exporting && (
        <div className="flex items-center justify-center py-4">
          <span className="animate-spin w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full mr-2" />
          <span className="text-sm text-gray-500">正在生成诊断报告 PPT...</span>
        </div>
      )}

      {filePath && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
          <p className="text-sm text-green-700">PPT 文件已生成</p>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}${filePath}`}
            download
            className="text-sm text-green-600 hover:underline"
          >
            点击下载
          </a>
        </div>
      )}
    </div>
  );
}
