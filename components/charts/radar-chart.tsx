'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { FiveDimensionsData, DimensionKey, RadarChartData } from '@/types/diagnosis';
import { DIMENSION_LABELS } from '@/types/diagnosis';

interface DimensionRadarChartProps {
  data: FiveDimensionsData;
}

export function DimensionRadarChart({ data }: DimensionRadarChartProps) {
  const chartData: RadarChartData[] = Object.keys(DIMENSION_LABELS).map((key) => ({
    dimension: DIMENSION_LABELS[key as DimensionKey],
    score: data[key as DimensionKey]?.score || 0,
    fullMark: 100,
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        五维健康度雷达图
      </h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: '#374151', fontSize: 13, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 11 }}
            />
            <Radar
              name="健康度"
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${value} 分`, '健康度']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 flex items-center justify-center gap-6 text-sm text-gray-600">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          优秀 (80+)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          良好 (60-80)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded-full bg-red-500"></span>
          需改进 (&lt;60)
        </span>
      </div>
    </div>
  );
}
