'use client';

import type { FiveDimensionsData, DimensionKey } from '@/types/diagnosis';
import { DIMENSION_KEYS, DIMENSION_LABELS, getScoreColor } from '@/types/diagnosis';
import { useState } from 'react';

interface ScoreOverviewProps {
  data: FiveDimensionsData;
  viewMode?: 'cards' | 'radar' | 'gauge';
}

/**
 * 分数概览 - 多种展示方式
 */
export function ScoreOverview({ data, viewMode = 'cards' }: ScoreOverviewProps) {
  const [mode, setMode] = useState<'cards' | 'radar' | 'gauge'>(viewMode);

  return (
    <div className="space-y-4">
      {/* 切换按钮 */}
      <div className="flex justify-center gap-2">
        <button
          onClick={() => setMode('cards')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'cards'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          卡片视图
        </button>
        <button
          onClick={() => setMode('radar')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'radar'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          雷达图
        </button>
        <button
          onClick={() => setMode('gauge')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            mode === 'gauge'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          仪表盘
        </button>
      </div>

      {/* 内容区域 */}
      {mode === 'cards' && <ScoreCards data={data} />}
      {mode === 'radar' && <RadarView data={data} />}
      {mode === 'gauge' && <GaugeView data={data} />}
    </div>
  );
}

/**
 * 卡片视图 - 进度条展示
 */
function ScoreCards({ data }: { data: FiveDimensionsData }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      {DIMENSION_KEYS.map((key) => {
        const dimension = data[key];
        const color = getScoreColor(dimension.score);

        return (
          <div
            key={key}
            className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="text-center mb-3">
              <div
                className="text-3xl font-bold"
                style={{ color }}
              >
                {dimension.score}
              </div>
              <div className="text-sm text-gray-500 mt-1">{dimension.label}</div>
              <div className="text-xs text-gray-400">{dimension.description}</div>
            </div>

            {/* 进度条 */}
            <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full rounded-full transition-all duration-500"
                style={{
                  width: `${dimension.score}%`,
                  backgroundColor: color,
                }}
              />
            </div>

            {/* L2 分数 */}
            <div className="mt-3 space-y-1">
              {Object.entries(dimension.L2_categories).slice(0, 3).map(([l2Key, l2]) => (
                <div key={l2Key} className="flex justify-between text-xs">
                  <span className="text-gray-500 truncate">{l2.label || l2Key}</span>
                  <span style={{ color: getScoreColor(l2.score) }}>{l2.score}</span>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * 雷达视图 - 简化版
 */
function RadarView({ data }: { data: FiveDimensionsData }) {
  // 计算雷达图路径
  const angles = [0, 72, 144, 216, 288].map(a => (a - 90) * Math.PI / 180);
  const centerX = 150;
  const centerY = 120;
  const radius = 80;

  const points = DIMENSION_KEYS.map((key, i) => {
    const score = data[key].score;
    const r = (score / 100) * radius;
    return {
      x: centerX + r * Math.cos(angles[i]),
      y: centerY + r * Math.sin(angles[i]),
      label: data[key].label,
      score,
    };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  return (
    <div className="flex justify-center">
      <svg width="300" height="250" viewBox="0 0 300 250">
        {/* 背景网格 */}
        {[20, 40, 60, 80, 100].map((level) => {
          const r = (level / 100) * radius;
          const gridPoints = angles.map(a => ({
            x: centerX + r * Math.cos(a),
            y: centerY + r * Math.sin(a),
          }));
          const d = gridPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';
          return (
            <path key={level} d={d} fill="none" stroke="#e5e7eb" strokeWidth="1" />
          );
        })}

        {/* 轴线 */}
        {angles.map((a, i) => (
          <line
            key={i}
            x1={centerX}
            y1={centerY}
            x2={centerX + radius * Math.cos(a)}
            y2={centerY + radius * Math.sin(a)}
            stroke="#e5e7eb"
            strokeWidth="1"
          />
        ))}

        {/* 数据区域 */}
        <path
          d={pathD}
          fill="#6366f1"
          fillOpacity="0.3"
          stroke="#6366f1"
          strokeWidth="2"
        />

        {/* 数据点 */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="4" fill="#6366f1" />
        ))}

        {/* 标签 */}
        {points.map((p, i) => {
          const labelRadius = radius + 25;
          const labelX = centerX + labelRadius * Math.cos(angles[i]);
          const labelY = centerY + labelRadius * Math.sin(angles[i]);
          return (
            <g key={i}>
              <text
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
                className="text-xs fill-gray-700 font-medium"
              >
                {p.label}
              </text>
              <text
                x={labelX}
                y={labelY + 14}
                textAnchor="middle"
                className="text-xs font-bold"
                style={{ fill: getScoreColor(p.score) }}
              >
                {p.score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/**
 * 仪表盘视图
 */
function GaugeView({ data }: { data: FiveDimensionsData }) {
  return (
    <div className="flex justify-center">
      <div className="grid grid-cols-3 md:grid-cols-5 gap-4">
        {DIMENSION_KEYS.map((key) => {
          const dimension = data[key];
          const color = getScoreColor(dimension.score);

          return (
            <div key={key} className="flex flex-col items-center">
              <svg width="100" height="70" viewBox="0 0 100 70">
                {/* 背景弧 */}
                <path
                  d="M 10 60 A 40 40 0 0 1 90 60"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* 分数弧 */}
                <path
                  d="M 10 60 A 40 40 0 0 1 90 60"
                  fill="none"
                  stroke={color}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${dimension.score * 1.26} 126`}
                />
                {/* 分数文字 */}
                <text
                  x="50"
                  y="55"
                  textAnchor="middle"
                  className="text-lg font-bold"
                  style={{ fill: color }}
                >
                  {dimension.score}
                </text>
              </svg>
              <div className="text-sm font-medium text-gray-700 mt-1">{dimension.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
