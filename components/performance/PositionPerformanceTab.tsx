'use client';

/**
 * Tab 3: 岗位绩效
 *
 * 一键生成岗位四分区绩效 (业绩目标 + 能力评估 + 价值观 + 发展目标)
 * 管理岗自动设置双重评估。
 * 支持查看、编辑、批量编辑。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listOrgPerformances,
  listPositionPerformances,
  generatePositionPerformance,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance, PositionPerformance } from '@/types/performance';
import { POS_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Users, ChevronDown, ChevronRight, Edit3, Save, Crown } from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

export default function PositionPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [selectedOrgPerf, setSelectedOrgPerf] = useState<string>('');
  const [positions, setPositions] = useState<PositionPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const fetchOrgPerfs = useCallback(async () => {
    if (!activePlan) return;
    const res = await listOrgPerformances(activePlan._key);
    if (res.success && res.data) {
      const list = Array.isArray(res.data) ? res.data : [];
      setOrgPerformances(list);
    }
  }, [activePlan]);

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
    fetchPositions();
  }, [fetchPositions]);

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
    setEditingKey(null);
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
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">选择部门绩效</label>
          <select
            value={selectedOrgPerf}
            onChange={(e) => setSelectedOrgPerf(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">选择部门绩效...</option>
            {orgPerformances.map((op) => (
              <option key={op._key} value={op._key}>
                {op.properties.org_unit_ref} — {op.properties.strategic_kpis?.length || 0} 个战略KPI
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedOrgPerf || generating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          {generating ? '一键生成中...' : '一键生成岗位绩效'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Summary */}
      {positions.length > 0 && (
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span>共 {positions.length} 个岗位</span>
          <span>{positions.filter(p => p.properties.is_leader).length} 个管理岗</span>
          <span>{positions.filter(p => p.properties.auto_generated).length} 个AI生成</span>
          <span>{positions.filter(p => p.properties.is_edited).length} 个已编辑</span>
        </div>
      )}

      {/* Position List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : positions.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>{selectedOrgPerf ? '尚未生成岗位绩效，点击一键生成' : '请先选择部门绩效'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {positions.map((pos) => {
            const p = pos.properties;
            const isExpanded = expandedKey === pos._key;
            const isLeader = p.is_leader;
            const totalWeight = (p.section_weights?.performance || 0) + (p.section_weights?.competency || 0) + (p.section_weights?.values || 0) + (p.section_weights?.development || 0);

            return (
              <div key={pos._key} className={`border rounded-xl bg-white overflow-hidden ${isLeader ? 'border-amber-200' : 'border-gray-200'}`}>
                {/* Header */}
                <div
                  className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => handleToggleExpand(pos._key)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                    {isLeader && <Crown size={14} className="text-amber-500" />}
                    <span className="text-sm font-medium text-gray-900">{p.job_role_ref}</span>
                    {isLeader && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded">管理岗</span>
                    )}
                    {p.auto_generated && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded">AI生成</span>
                    )}
                    {p.is_edited && (
                      <span className="px-1.5 py-0.5 text-[10px] bg-green-50 text-green-600 rounded">已编辑</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>{POS_PERF_STATUS_LABELS[p.status] || p.status}</span>
                    <span>权重 {totalWeight}%</span>
                  </div>
                </div>

                {/* Expanded Detail */}
                {isExpanded && (
                  <div className="border-t border-gray-100 p-4 space-y-3">
                    {/* 4 Sections Grid */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Performance Goals */}
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

                      {/* Competency Items */}
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

                      {/* Values Items */}
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

                      {/* Development Goals */}
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

                    {/* Leader Dual Eval Info */}
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
      )}
    </div>
  );
}
