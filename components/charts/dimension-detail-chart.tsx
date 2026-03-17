'use client';

import { useState } from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { DimensionData, L2Category } from '@/types/diagnosis';
import { getScoreColor } from '@/types/diagnosis';
import { L3BarChart } from './l3-bar-chart';

interface DimensionDetailChartProps {
  dimensionKey: string;
  data: DimensionData;
}

export function DimensionDetailChart({ dimensionKey, data }: DimensionDetailChartProps) {
  const [selectedL2, setSelectedL2] = useState<string | null>(null);

  // L2 雷达图数据
  const radarData = Object.entries(data.L2_categories).map(([key, category]) => ({
    key,
    name: category.label || key,
    score: category.score,
    fullMark: 100,
  }));

  // 选中的 L2 数据
  const selectedL2Data = selectedL2 ? data.L2_categories[selectedL2] : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      {/* 维度标题 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{data.label}</h3>
          <p className="text-sm text-gray-500">{data.description}</p>
        </div>
        <div
          className="px-4 py-2 rounded-xl text-lg font-bold"
          style={{
            backgroundColor: `${getScoreColor(data.score)}15`,
            color: getScoreColor(data.score),
          }}
        >
          {data.score} 分
        </div>
      </div>

      {/* L2 雷达图 */}
      <div className="mb-4">
        <ResponsiveContainer width="100%" height={220}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="name"
              tick={{ fill: '#374151', fontSize: 11, fontWeight: 500 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 10 }}
            />
            <Radar
              name={data.label}
              dataKey="score"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.3}
              strokeWidth={2}
              className="cursor-pointer"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${value} 分`, '评分']}
              labelFormatter={(label) => `子维度: ${label}`}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 点击提示 */}
      <p className="text-xs text-gray-400 text-center mb-4">
        点击雷达图区域查看 L3 评估详情
      </p>

      {/* L2 分数概览 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {Object.entries(data.L2_categories).map(([key, category]) => (
          <button
            key={key}
            onClick={() => setSelectedL2(key)}
            className={`flex items-center justify-between p-2 rounded-lg text-sm transition-all ${
              selectedL2 === key
                ? 'bg-indigo-100 border border-indigo-300'
                : 'bg-gray-50 hover:bg-gray-100 border border-transparent'
            }`}
          >
            <span className="text-gray-700 truncate">{category.label || key}</span>
            <span
              className="font-bold ml-2"
              style={{ color: getScoreColor(category.score) }}
            >
              {category.score}
            </span>
          </button>
        ))}
      </div>

      {/* L3 柱状图 */}
      {selectedL2Data && (
        <div className="border-t border-gray-100 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            {selectedL2Data.label} - L3 评估项
          </h4>
          <L3BarChart data={selectedL2Data} />
        </div>
      )}
    </div>
  );
}
