'use client';

/**
 * Tab 3: 岗位绩效
 *
 * Step 1 — 岗位配置：查看选中部门的岗位列表，支持新增岗位
 * Step 2 — AI 生成岗位四分区绩效 + 展开查看详情
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listOrgPerformances,
  listPositionPerformances,
  generatePositionPerformance,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance, PositionPerformance } from '@/types/performance';
import { POS_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Users, ChevronDown, ChevronRight, Crown, Plus, Briefcase } from 'lucide-react';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import InlineCreateModal from './InlineCreateModal';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

const JOB_FAMILY_COLORS: Record<string, string> = {
  '管理M': 'bg-amber-100 text-amber-700',
  '专业P': 'bg-blue-100 text-blue-700',
  '操作O': 'bg-gray-100 text-gray-600',
  '营销S': 'bg-green-100 text-green-700',
};

export default function PositionPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [selectedOrgPerf, setSelectedOrgPerf] = useState<string>('');
  const [positions, setPositions] = useState<PositionPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  // Data prep state
  const [jobRoles, setJobRoles] = useState<KernelObject[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  // Find the org_unit_ref from the selected org performance
  const selectedOrgPerfData = orgPerformances.find(op => op._key === selectedOrgPerf);
  const orgUnitRef = selectedOrgPerfData?.properties.org_unit_ref as string | undefined;

  const fetchOrgPerfs = useCallback(async () => {
    if (!activePlan) return;
    const res = await listOrgPerformances(activePlan._key);
    if (res.success && res.data) {
      setOrgPerformances(Array.isArray(res.data) ? res.data : []);
    }
  }, [activePlan]);

  const fetchJobRoles = useCallback(async () => {
    if (!orgUnitRef) {
      setJobRoles([]);
      return;
    }
    setLoadingRoles(true);
    try {
      const res = await getObjectsByModel('Job_Role', 200);
      if (res.success && res.data) {
        // Filter job roles by org_unit_id matching the org_unit_ref
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter(jr => {
          const ouId = jr.properties.org_unit_id as string | undefined;
          // Match by _key or by name
          return ouId === orgUnitRef || ouId === selectedOrgPerfData?._key;
        });
        setJobRoles(filtered);
      }
    } finally {
      setLoadingRoles(false);
    }
  }, [orgUnitRef, selectedOrgPerfData?._key]);

  const fetchPositions = useCallback(async () => {
    if (!selectedOrgPerf) return;
    setLoading(true);
    try {
      const res = await listPositionPerformances(selectedOrgPerf);
      if (res.success && res.data) {
        setPositions(Array.isArray(res.data) ? res.data : []);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedOrgPerf]);

  useEffect(() => {
    fetchOrgPerfs();
  }, [fetchOrgPerfs]);

  useEffect(() => {
    fetchJobRoles();
  }, [fetchJobRoles]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleRoleCreated = (obj: KernelObject) => {
    setJobRoles(prev => [obj, ...prev]);
  };

  const handleGenerate = async () => {
    if (!selectedOrgPerf) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generatePositionPerformance({ org_perf_id: selectedOrgPerf });
      if (res.success) {
        await fetchPositions();
        await onRefresh();
      } else {
        setError(res.error || '生成失败');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleExpand = (key: string) => {
    setExpandedKey(expandedKey === key ? null : key);
  };

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Org Performance Selector */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1.5">选择部门绩效</label>
        <select
          value={selectedOrgPerf}
          onChange={(e) => { setSelectedOrgPerf(e.target.value); setPositions([]); }}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
        >
          <option value="">选择部门绩效...</option>
          {orgPerformances.map((op) => (
            <option key={op._key} value={op._key}>
              {op.properties.org_unit_name || op.properties.org_unit_ref} — {op.properties.strategic_kpis?.length || 0} 个战略KPI
            </option>
          ))}
        </select>
      </div>

      {/* ── Step 1: Job Role Configuration ── */}
      {selectedOrgPerf && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500">STEP 1</span>
              <span className="text-xs text-gray-400 ml-2">岗位配置</span>
              <span className="text-xs text-gray-400 ml-2">— 部门: {orgUnitRef || '未知'}</span>
            </div>
            <button
              onClick={() => setShowRoleModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Plus size={12} />
              添加岗位
            </button>
          </div>

          <div className="p-5">
            {loadingRoles ? (
              <div className="flex items-center justify-center py-4">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : jobRoles.length === 0 ? (
              <div className="text-center py-6 text-gray-400">
                <Briefcase size={28} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">该部门暂无岗位</p>
                <p className="text-xs mt-1">点击「添加岗位」创建岗位后，AI 将为每个岗位生成专属绩效方案</p>
              </div>
            ) : (
              <div className="space-y-2">
                {jobRoles.map((jr) => {
                  const r = jr.properties;
                  const family = String(r.job_family || '');
                  return (
                    <div key={jr._key} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors">
                      <Briefcase size={14} className="text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-900 font-medium">{String(r.role_name || '')}</span>
                      {family && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${JOB_FAMILY_COLORS[family] || 'bg-gray-100 text-gray-600'}`}>
                          {family}
                        </span>
                      )}
                      {r.is_key_position ? (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded">关键岗位</span>
                      ) : null}
                      {r.level_range ? (
                        <span className="text-xs text-gray-400">{String(r.level_range)}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Generate Button */}
            {jobRoles.length > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100">
                <button
                  onClick={handleGenerate}
                  disabled={generating}
                  className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Sparkles size={14} />
                  {generating ? 'AI 生成中，请稍候...' : `一键生成 ${jobRoles.length} 个岗位绩效`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ── Step 2: Generated Results ── */}
      {generating && (
        <div className="flex flex-col items-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">AI 正在为 {jobRoles.length} 个岗位生成绩效方案...</p>
        </div>
      )}

      {!generating && positions.length > 0 && (
        <div>
          <div className="px-1 py-2 flex items-center justify-between">
            <div>
              <span className="text-xs font-medium text-gray-500">STEP 2</span>
              <span className="text-xs text-gray-400 ml-2">生成结果 ({positions.length}个岗位)</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span>{positions.filter(p => p.properties.is_leader).length} 个管理岗</span>
              <span>{positions.filter(p => p.properties.auto_generated).length} 个AI生成</span>
            </div>
          </div>

          <div className="space-y-2">
            {positions.map((pos) => {
              const p = pos.properties;
              const isExpanded = expandedKey === pos._key;
              const isLeader = p.is_leader;
              const totalWeight = (p.section_weights?.performance || 0) + (p.section_weights?.competency || 0) + (p.section_weights?.values || 0) + (p.section_weights?.development || 0);

              return (
                <div key={pos._key} className={`border rounded-xl bg-white overflow-hidden ${isLeader ? 'border-amber-200' : 'border-gray-200'}`}>
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleToggleExpand(pos._key)}
                  >
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                      {isLeader && <Crown size={14} className="text-amber-500" />}
                      <span className="text-sm font-medium text-gray-900">{p.job_role_name || p.job_role_ref}</span>
                      {isLeader && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">管理岗</span>
                      )}
                      {p.auto_generated && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded">AI生成</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{POS_PERF_STATUS_LABELS[p.status] || p.status}</span>
                      <span>权重 {totalWeight}%</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-blue-50/50 rounded-lg p-3">
                          <div className="text-xs font-medium text-blue-700 mb-1">
                            业绩目标 ({p.section_weights?.performance || 55}%)
                          </div>
                          {p.performance_goals?.map((g, i) => (
                            <div key={i} className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">{g.name}</span>
                              <span className="text-gray-400 ml-1">{g.weight}% · {g.target}</span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-green-50/50 rounded-lg p-3">
                          <div className="text-xs font-medium text-green-700 mb-1">
                            能力评估 ({p.section_weights?.competency || 25}%)
                          </div>
                          {p.competency_items?.map((c, i) => (
                            <div key={i} className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">{c.name}</span>
                              <span className="text-gray-400 ml-1">{c.required_level} · {c.weight}%</span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-purple-50/50 rounded-lg p-3">
                          <div className="text-xs font-medium text-purple-700 mb-1">
                            价值观 ({p.section_weights?.values || 10}%)
                          </div>
                          {p.values_items?.map((v, i) => (
                            <div key={i} className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">{v.name}</span>
                              <span className="text-gray-400 ml-1">{v.weight}%</span>
                            </div>
                          ))}
                        </div>

                        <div className="bg-amber-50/50 rounded-lg p-3">
                          <div className="text-xs font-medium text-amber-700 mb-1">
                            发展目标 ({p.section_weights?.development || 10}%)
                          </div>
                          {p.development_goals?.map((d, i) => (
                            <div key={i} className="text-xs text-gray-600 mt-1">
                              <span className="font-medium">{d.name}</span>
                              <span className="text-gray-400 ml-1">{d.timeline}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {isLeader && p.leader_config && (
                        <div className="bg-amber-50 rounded-lg p-3 flex items-center gap-2">
                          <Crown size={14} className="text-amber-600" />
                          <div className="text-xs text-amber-800">
                            双重评估：个人 {p.leader_config.personal_weight}% + 团队 {p.leader_config.team_weight}%
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Job Role Create Modal */}
      <InlineCreateModal
        modelKey="Job_Role"
        title="添加岗位"
        open={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        onCreated={handleRoleCreated}
        prefills={orgUnitRef ? { org_unit_id: orgUnitRef } : undefined}
      />
    </div>
  );
}
