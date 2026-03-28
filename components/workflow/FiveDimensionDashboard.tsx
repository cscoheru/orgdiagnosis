'use client';

import { useState } from 'react';
import type { FiveDimensionsData, DimensionKey } from '@/types/diagnosis';
import { DIMENSION_LABELS, DIMENSION_KEYS, getScoreLevel, getScoreColor } from '@/types/diagnosis';
import { DimensionRadarChart } from '@/components/charts/radar-chart';
import { DimensionDetailChart } from '@/components/charts/dimension-detail-chart';

interface FiveDimensionDashboardProps {
  analysisData: FiveDimensionsData | null;
  onGenerate: () => void;
  generating: boolean;
}

export default function FiveDimensionDashboard({
  analysisData,
  onGenerate,
  generating,
}: FiveDimensionDashboardProps) {
  const [selectedDimension, setSelectedDimension] = useState<DimensionKey | null>(null);

  if (!analysisData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-4">
        <p className="text-gray-500">确认问卷后，AI 将进行五维分析</p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
              AI 分析中...
            </span>
          ) : (
            '开始五维分析'
          )}
        </button>
      </div>
    );
  }

  const overallScore = analysisData.overall_score || 0;
  const overallLevel = getScoreLevel(overallScore);

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">五维组织诊断</h3>
            {analysisData.summary && (
              <p className="text-sm text-gray-500 mt-1">{analysisData.summary}</p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={onGenerate}
              disabled={generating}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              重新分析
            </button>
            <div
              className="px-5 py-3 rounded-xl text-center"
              style={{
                backgroundColor: `${getScoreColor(overallScore)}15`,
              }}
            >
              <div className="text-2xl font-bold" style={{ color: getScoreColor(overallScore) }}>
                {overallScore}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">综合评分</div>
            </div>
          </div>
        </div>

        {/* Five dimension score cards */}
        <div className="grid grid-cols-5 gap-3">
          {DIMENSION_KEYS.map(dim => {
            const dimData = analysisData[dim];
            if (!dimData) return null;
            const level = getScoreLevel(dimData.score);
            return (
              <button
                key={dim}
                onClick={() => setSelectedDimension(selectedDimension === dim ? null : dim)}
                className={`p-3 rounded-lg text-center transition-all border ${
                  selectedDimension === dim
                    ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                    : 'bg-gray-50 border-transparent hover:bg-gray-100'
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">{DIMENSION_LABELS[dim]}</div>
                <div
                  className="text-xl font-bold"
                  style={{ color: getScoreColor(dimData.score) }}
                >
                  {dimData.score}
                </div>
                <div className={`text-xs mt-1 ${
                  level === 'danger' ? 'text-red-500' : level === 'warning' ? 'text-amber-500' : 'text-green-500'
                }`}>
                  {level === 'danger' ? '需改进' : level === 'warning' ? '良好' : '优秀'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Radar chart */}
      <DimensionRadarChart data={analysisData} />

      {/* Selected dimension detail */}
      {selectedDimension && analysisData[selectedDimension] && (
        <DimensionDetailChart
          dimensionKey={selectedDimension}
          data={analysisData[selectedDimension]}
        />
      )}

      {/* Recommendations */}
      {analysisData.summary && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">诊断摘要</h3>
          <p className="text-sm text-gray-600 leading-relaxed">{analysisData.summary}</p>
        </div>
      )}
    </div>
  );
}
