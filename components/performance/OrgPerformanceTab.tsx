'use client';

/**
 * Tab 2: 组织绩效
 *
 * AI 生成部门四维度绩效 (战略KPI + 部门管理 + 团队发展 + 敬业度/合规)
 * 展示生成的部门绩效列表，支持查看详情和编辑。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateOrgPerformance,
  listOrgPerformances,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance } from '@/types/performance';
import { ORG_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Building2, ChevronDown, ChevronRight } from 'lucide-react';
import { getObjectsByModel } from '@/lib/api/kernel-client';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

export default function OrgPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [orgUnits, setOrgUnits] = useState<Array<{ _key: string; properties: Record<string, unknown> }>>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>('');

  const fetchOrgUnits = useCallback(async () => {
    const res = await getObjectsByModel('Org_Unit', 100);
    if (res.success && res.data) {
      setOrgUnits(Array.isArray(res.data) ? res.data : []);
    }
  }, []);

  const fetchOrgPerformances = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const res = await listOrgPerformances(activePlan._key);
      if (res.success && res.data) {
        setOrgPerformances(Array.isArray(res.data) ? res.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  useEffect(() => {
    fetchOrgUnits();
  }, [fetchOrgUnits]);

  useEffect(() => {
    fetchOrgPerformances();
  }, [fetchOrgPerformances]);

  const handleGenerate = async () => {
    if (!activePlan || !selectedOrgUnit) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateOrgPerformance({
        plan_id: activePlan._key,
        org_unit_id: selectedOrgUnit,
      });
      if (res.success) {
        await fetchOrgPerformances();
        await onRefresh();
      } else {
        setError(res.error || '生成失败');
      }
    } finally {
      setGenerating(false);
    }
  };

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Building2 size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generate Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">选择部门</label>
          <select
            value={selectedOrgUnit}
            onChange={(e) => setSelectedOrgUnit(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">选择要生成绩效的部门...</option>
            {orgUnits.map((ou) => (
              <option key={ou._key} value={ou._key}>
                {(ou.properties.unit_name as string) || ou._key}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedOrgUnit || generating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          {generating ? 'AI 生成中...' : 'AI 生成部门绩效'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Org Performance List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : orgPerformances.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>尚未生成部门绩效，选择部门后点击 AI 生成</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orgPerformances.map((op) => {
            const p = op.properties;
            const isExpanded = expandedKey === op._key;
            const totalWeight = (p.dimension_weights?.strategic || 0) + (p.dimension_weights?.management || 0) + (p.dimension_weights?.team_development || 0) + (p.dimension_weights?.engagement || 0);

            return (
              <div key={op._key} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                {/* Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpandedKey(isExpanded ? null : op._key)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
                    <div>
                      <h4 className="font-medium text-gray-900 text-sm">部门绩效 — {p.org_unit_ref}</h4>
                      <p className="text-xs text-gray-500">
                        {p.strategic_kpis?.length || 0} 个战略KPI · 权重合计 {totalWeight}%
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-400">{ORG_PERF_STATUS_LABELS[p.status] || p.status}</span>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-4">
                    {/* 4 Dimensions */}
                    <div className="grid grid-cols-4 gap-3">
                      {/* Strategic KPIs */}
                      <div className="bg-blue-50/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-blue-700 mb-1">
                          战略KPI ({p.dimension_weights?.strategic || 50}%)
                        </div>
                        {p.strategic_kpis?.map((kpi, i) => (
                          <div key={i} className="text-xs text-gray-600 mt-1">
                            <span className="font-medium">{kpi.name}</span>
                            <span className="text-gray-400 ml-1">{kpi.weight}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Management Indicators */}
                      <div className="bg-green-50/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-green-700 mb-1">
                          部门管理 ({p.dimension_weights?.management || 25}%)
                        </div>
                        {p.management_indicators?.map((ind, i) => (
                          <div key={i} className="text-xs text-gray-600 mt-1">
                            <span className="font-medium">{ind.name}</span>
                            <span className="text-gray-400 ml-1">{ind.weight}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Team Development */}
                      <div className="bg-amber-50/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-amber-700 mb-1">
                          团队发展 ({p.dimension_weights?.team_development || 15}%)
                        </div>
                        {p.team_development?.map((ind, i) => (
                          <div key={i} className="text-xs text-gray-600 mt-1">
                            <span className="font-medium">{ind.name}</span>
                            <span className="text-gray-400 ml-1">{ind.weight}%</span>
                          </div>
                        ))}
                      </div>

                      {/* Engagement/Compliance */}
                      <div className="bg-purple-50/50 rounded-lg p-3">
                        <div className="text-xs font-medium text-purple-700 mb-1">
                          敬业度/合规 ({p.dimension_weights?.engagement || 10}%)
                        </div>
                        {p.engagement_compliance?.map((ind, i) => (
                          <div key={i} className="text-xs text-gray-600 mt-1">
                            <span className="font-medium">{ind.name}</span>
                            <span className="text-gray-400 ml-1">{ind.weight}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
