'use client';

/**
 * Tab 5: 数据分析
 *
 * 评分分布统计、偏差分析、项目绩效全景概览。
 * 展示图表和分析结果。
 */

import { useState, useEffect } from 'react';
import {
  getDistributionAnalytics,
  getBiasAnalysis,
  getPerformanceOverview,
} from '@/lib/api/performance-api';
import type {
  DistributionAnalytics,
  BiasAnalysis,
  PerformanceOverview,
} from '@/types/performance';
import { BarChart3, AlertTriangle, Activity } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function AnalyticsTab({ projectId }: Props) {
  const [activeView, setActiveView] = useState<'overview' | 'distribution' | 'bias'>('overview');
  const [overview, setOverview] = useState<PerformanceOverview | null>(null);
  const [distribution, setDistribution] = useState<DistributionAnalytics | null>(null);
  const [bias, setBias] = useState<BiasAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async (view: 'overview' | 'distribution' | 'bias') => {
    setLoading(true);
    setError(null);
    try {
      if (view === 'overview') {
        const res = await getPerformanceOverview(projectId);
        if (res.success) setOverview(res.data || null);
        else setError(res.error || null);
      } else if (view === 'distribution') {
        const res = await getDistributionAnalytics(projectId);
        if (res.success) setDistribution(res.data || null);
        else setError(res.error || null);
      } else {
        const res = await getBiasAnalysis(projectId);
        if (res.success) setBias(res.data || null);
        else setError(res.error || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData('overview');
  }, [projectId]);

  const handleViewChange = (view: 'overview' | 'distribution' | 'bias') => {
    setActiveView(view);
    fetchData(view);
  };

  return (
    <div className="space-y-4">
      {/* View Toggle */}
      <div className="flex gap-2">
        {[
          { id: 'overview' as const, name: '全景概览', icon: Activity },
          { id: 'distribution' as const, name: '评分分布', icon: BarChart3 },
          { id: 'bias' as const, name: '偏差分析', icon: AlertTriangle },
        ].map(({ id, name, icon: Icon }) => (
          <button
            key={id}
            onClick={() => handleViewChange(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors ${
              activeView === id
                ? 'bg-indigo-100 text-indigo-700 font-medium'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
            }`}
          >
            <Icon size={14} />
            {name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : error ? (
        <div className="text-center py-8 text-red-500 text-sm">{error}</div>
      ) : activeView === 'overview' && overview ? (
        <div className="grid grid-cols-3 gap-4">
          <MetricCard label="绩效方案" value={overview.plans} />
          <MetricCard label="部门绩效" value={overview.org_performances} />
          <MetricCard label="岗位绩效" value={overview.position_performances} />
          <MetricCard label="管理岗" value={overview.leaders} />
          <MetricCard label="专业岗" value={overview.professionals} />
          <MetricCard label="考核表单" value={overview.templates} />
          <MetricCard label="考核记录" value={overview.reviews} />
          <MetricCard label="AI 自动生成" value={overview.auto_generated} />
          <MetricCard label="已编辑" value={overview.edited} />
        </div>
      ) : activeView === 'distribution' && distribution ? (
        <div className="space-y-4">
          {/* Score Statistics */}
          <div className="grid grid-cols-4 gap-4">
            <StatCard label="均值" value={distribution.score_statistics?.mean?.toFixed(2) || '-'} />
            <StatCard label="中位数" value={distribution.score_statistics?.median?.toFixed(2) || '-'} />
            <StatCard label="标准差" value={distribution.score_statistics?.std_dev?.toFixed(2) || '-'} />
            <StatCard label="考核总数" value={String(distribution.total_reviews || 0)} />
          </div>

          {/* Rating Distribution */}
          <div className="border border-gray-200 rounded-xl p-4 bg-white">
            <h4 className="text-sm font-medium text-gray-700 mb-3">等级分布</h4>
            {distribution.rating_distribution && Object.keys(distribution.rating_distribution).length > 0 ? (
              <div className="flex items-end gap-4 h-32">
                {Object.entries(distribution.rating_distribution).map(([rating, count]) => {
                  const countNum = count as number;
                  const maxCount = Math.max(...Object.values(distribution.rating_distribution) as number[]);
                  const height = maxCount > 0 ? ((countNum / maxCount) * 100) : 0;
                  return (
                    <div key={rating} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-xs text-gray-500">{countNum}</span>
                      <div
                        className="w-full bg-indigo-500 rounded-t"
                        style={{ height: `${height}%`, minHeight: countNum > 0 ? '4px' : '0' }}
                      />
                      <span className="text-xs font-medium text-gray-700">{rating}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">暂无考核数据</p>
            )}
          </div>
        </div>
      ) : activeView === 'bias' && bias ? (
        <div className="space-y-4">
          {bias.bias_detected && bias.bias_detected.length > 0 ? (
            bias.bias_detected.map((b: { type: string; severity: string; description: string }, i: number) => (
              <div
                key={i}
                className={`border rounded-xl p-4 ${
                  b.severity === 'high' ? 'border-red-200 bg-red-50/50' :
                  b.severity === 'medium' ? 'border-amber-200 bg-amber-50/50' :
                  'border-gray-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle size={14} className={b.severity === 'high' ? 'text-red-500' : b.severity === 'medium' ? 'text-amber-500' : 'text-gray-400'} />
                  <span className="text-sm font-medium text-gray-900">{b.type}</span>
                  <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                    b.severity === 'high' ? 'bg-red-100 text-red-700' :
                    b.severity === 'medium' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {b.severity === 'high' ? '高' : b.severity === 'medium' ? '中' : '低'}
                  </span>
                </div>
                <p className="text-xs text-gray-600">{b.description}</p>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <p>未检测到显著偏差，或暂无足够数据进行分析</p>
            </div>
          )}

          {/* Recommendations */}
          {bias.recommendations && bias.recommendations.length > 0 && (
            <div className="border border-gray-200 rounded-xl p-4 bg-white">
              <h4 className="text-sm font-medium text-gray-700 mb-2">改进建议</h4>
              <ul className="space-y-1">
                {bias.recommendations.map((rec: string, i: number) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-indigo-500 mt-0.5">•</span>
                    {rec}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <p>暂无分析数据</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-white text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-xs text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-gray-200 rounded-xl p-3 bg-white">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-gray-900 mt-1">{value}</div>
    </div>
  );
}
