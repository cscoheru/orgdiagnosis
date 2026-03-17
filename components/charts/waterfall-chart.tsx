'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DimensionData, BarChartData } from '@/types/diagnosis';
import { getScoreColor } from '@/types/diagnosis';

interface DimensionBarChartProps {
  dimensionKey: string;
  data: DimensionData;
}

export function DimensionBarChart({ dimensionKey, data }: DimensionBarChartProps) {
  const chartData: BarChartData[] = Object.entries(data.L2_categories).map(
    ([key, category]) => ({
      name: category.label || key,
      score: category.score,
      category: key,
    })
  );

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {data.label} - L2 维度分解
        </h3>
        <span
          className="px-3 py-1 rounded-full text-sm font-medium"
          style={{
            backgroundColor: `${getScoreColor(data.score)}20`,
            color: getScoreColor(data.score),
          }}
        >
          {data.score} 分
        </span>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
            <XAxis
              type="number"
              domain={[0, 100]}
              tick={{ fill: '#6b7280', fontSize: 12 }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={100}
              tick={{ fill: '#374151', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: 'none',
                borderRadius: '8px',
                color: '#fff',
              }}
              formatter={(value) => [`${value} 分`, '评分']}
            />
            <Bar dataKey="score" radius={[0, 4, 4, 0]} barSize={24}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getScoreColor(entry.score)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
