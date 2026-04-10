'use client';

/**
 * Tab 2: 组织绩效
 *
 * Step 1 — 数据准备：预览战略目标 + 选择/新建部门
 * Step 2 — AI 生成部门四维度绩效 + 展开查看详情
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateOrgPerformance,
  listOrgPerformances,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance } from '@/types/performance';
import { ORG_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Building2, ChevronDown, ChevronRight, Plus, Target } from 'lucide-react';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import InlineCreateModal from './InlineCreateModal';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-gray-100 text-gray-600',
};

export default function OrgPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Data prep state
  const [orgUnits, setOrgUnits] = useState<KernelObject[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>('');
  const [goals, setGoals] = useState<KernelObject[]>([]);
  const [showDeptModal, setShowDeptModal] = useState(false);

  const fetchGoals = useCallback(async () => {
    const res = await getObjectsByModel('Strategic_Goal', 100);
    if (res.success && res.data) {
      setGoals(Array.isArray(res.data) ? res.data : []);
    }
  }, []);

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
    if (activePlan) {
      fetchGoals();
      fetchOrgUnits();
    }
  }, [activePlan, fetchGoals, fetchOrgUnits]);

  useEffect(() => {
    fetchOrgPerformances();
  }, [fetchOrgPerformances]);

  const handleDeptCreated = (obj: KernelObject) => {
    setOrgUnits(prev => [obj, ...prev]);
  };

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
    <div className="space-y-5">
      {/* ── Step 1: Data Preparation ── */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <span className="text-xs font-medium text-gray-500">STEP 1</span>
          <span className="text-xs text-gray-400 ml-2">数据准备</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Strategic Goals Preview */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Target size={14} className="text-indigo-500" />
              <span className="text-xs font-medium text-gray-700">已关联的战略目标 ({goals.length})</span>
            </div>
            {goals.length === 0 ? (
              <p className="text-xs text-gray-400 pl-6">暂无战略目标，请先在「方案概览」中添加</p>
            ) : (
              <div className="flex flex-wrap gap-2 pl-6">
                {goals.map((g) => (
                  <span key={g._key} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-indigo-50 text-xs text-indigo-700">
                    {g.properties.priority ? (
                      <span className={`px-1 py-0 text-[9px] rounded ${PRIORITY_COLORS[String(g.properties.priority)] || ''}`}>
                        {String(g.properties.priority)}
                      </span>
                    ) : null}
                    {String(g.properties.goal_name || '')}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Department Selection */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">选择部门</label>
            <div className="flex items-center gap-2">
              <select
                value={selectedOrgUnit}
                onChange={(e) => setSelectedOrgUnit(e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                <option value="">选择要生成绩效的部门...</option>
                {orgUnits.map((ou) => (
                  <option key={ou._key} value={ou._key}>
                    {(ou.properties.unit_name as string) || ou._key}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setShowDeptModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
              >
                <Plus size={12} />
                新建部门
              </button>
            </div>
          </div>

          {/* Generate Button */}
          <div className="pt-1">
            <button
              onClick={handleGenerate}
              disabled={!selectedOrgUnit || generating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Sparkles size={14} />
              {generating ? 'AI 生成中，请稍候...' : 'AI 生成部门绩效'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Step 2: Generated Results ── */}
      {generating && (
        <div className="flex flex-col items-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">AI 正在基于战略目标生成分部门绩效...</p>
        </div>
      )}

      {!generating && orgPerformances.length > 0 && (
        <div>
          <div className="px-1 py-2">
            <span className="text-xs font-medium text-gray-500">STEP 2</span>
            <span className="text-xs text-gray-400 ml-2">生成结果 ({orgPerformances.length}个部门)</span>
          </div>

          <div className="space-y-3">
            {orgPerformances.map((op) => {
              const p = op.properties;
              const isExpanded = expandedKey === op._key;
              const totalWeight = (p.dimension_weights?.strategic || 0) + (p.dimension_weights?.management || 0) + (p.dimension_weights?.team_development || 0) + (p.dimension_weights?.engagement || 0);

              return (
                <div key={op._key} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
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

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-4">
                      <div className="grid grid-cols-4 gap-3">
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
        </div>
      )}

      {!generating && !loading && orgPerformances.length === 0 && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-sm">选择部门并点击 AI 生成，即可创建部门绩效</p>
        </div>
      )}

      {/* Department Create Modal */}
      <InlineCreateModal
        modelKey="Org_Unit"
        title="新建部门"
        open={showDeptModal}
        onClose={() => setShowDeptModal(false)}
        onCreated={handleDeptCreated}
      />
    </div>
  );
}
