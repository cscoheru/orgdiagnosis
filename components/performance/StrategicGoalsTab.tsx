'use client';

/**
 * Phase 3: 战略目标管理
 *
 * 目标列表按类型分组（战略举措 / 营收目标 / 利润目标 / 运营指标 / 能力建设）。
 * 支持创建/编辑、举措展开查看里程碑+KPI、AI 分解。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  listStrategicGoals,
  createStrategicGoal,
  updateStrategicGoal,
  decomposeInitiative,
} from '@/lib/api/performance-api';
import type { PerformancePlan, GoalType } from '@/types/performance';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import {
  Sparkles, Plus, Pencil, Save, X, Trash2, ChevronDown, ChevronRight,
  Target, Lightbulb, TrendingUp, DollarSign, BarChart3, GraduationCap,
} from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Types ── */

interface GoalItem {
  _key: string;
  goal_name: string;
  goal_type: string;
  priority: string;
  status: string;
  target_value?: number;
  actual_value?: number;
  description?: string;
  milestones?: Array<{ phase: string; date: string; deliverable: string }>;
  target_metrics?: Array<{ metric_name: string; unit: string; target_value: number; actual_value?: number }>;
  linked_kpis?: Array<{ kpi_goal_id: string; weight: number }>;
}

interface InitiativeItem {
  _key: string;
  initiative_name: string;
  status: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  milestones?: Array<{ phase: string; date: string; deliverable: string }>;
}

/* ── Constants ── */

const GOAL_TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  strategic_initiative: { label: '战略举措', color: 'text-purple-700', bg: 'bg-purple-100', icon: <Lightbulb size={12} /> },
  revenue_target: { label: '营收目标', color: 'text-blue-700', bg: 'bg-blue-100', icon: <TrendingUp size={12} /> },
  profit_target: { label: '利润目标', color: 'text-green-700', bg: 'bg-green-100', icon: <DollarSign size={12} /> },
  operational_kpi: { label: '运营指标', color: 'text-amber-700', bg: 'bg-amber-100', icon: <BarChart3 size={12} /> },
  capability_building: { label: '能力建设', color: 'text-cyan-700', bg: 'bg-cyan-100', icon: <GraduationCap size={12} /> },
};

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-gray-100 text-gray-600',
};

const GOAL_TYPES: Array<{ value: string; label: string }> = [
  { value: 'strategic_initiative', label: '战略举措' },
  { value: 'revenue_target', label: '营收目标' },
  { value: 'profit_target', label: '利润目标' },
  { value: 'operational_kpi', label: '运营指标' },
  { value: 'capability_building', label: '能力建设' },
];

/* ── Component ── */

export default function StrategicGoalsTab({ projectId, activePlan, onRefresh }: Props) {
  const [goals, setGoals] = useState<GoalItem[]>([]);
  const [initiatives, setInitiatives] = useState<InitiativeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [decomposing, setDecomposing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    goal_name: '',
    goal_type: 'operational_kpi' as string,
    priority: 'P2',
    target_value: '',
    description: '',
  });
  const [creating, setCreating] = useState(false);

  // Expanded initiatives
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  /* ── Fetch ── */

  const fetchData = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const [goalsRes, initRes] = await Promise.all([
        listStrategicGoals(projectId),
        getObjectsByModel('Strategic_Initiative', 50),
      ]);
      if (goalsRes.success && goalsRes.data) {
        setGoals((goalsRes.data as Array<Record<string, unknown>>).map(g => {
          const props = (g.properties || {}) as Record<string, unknown>;
          return {
            _key: g._key as string,
            goal_name: (props.goal_name as string) || '',
            goal_type: (props.goal_type as string) || 'operational_kpi',
            priority: (props.priority as string) || 'P2',
            status: (props.status as string) || '',
            target_value: props.target_value as number | undefined,
            actual_value: props.actual_value as number | undefined,
            description: props.description as string | undefined,
            milestones: props.milestones as GoalItem['milestones'],
            target_metrics: props.target_metrics as GoalItem['target_metrics'],
            linked_kpis: props.linked_kpis as GoalItem['linked_kpis'],
          };
        }));
      }
      if (initRes.success && initRes.data) {
        setInitiatives((initRes.data as KernelObject[]).map(obj => ({
          _key: obj._key,
          ...(obj.properties as unknown as Record<string, unknown>),
        })) as InitiativeItem[]);
      }
    } finally { setLoading(false); }
  }, [activePlan, projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ── Handlers ── */

  const handleCreate = async () => {
    if (!createForm.goal_name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const res = await createStrategicGoal({
        goal_name: createForm.goal_name,
        goal_type: createForm.goal_type,
        priority: createForm.priority,
        target_value: createForm.target_value ? Number(createForm.target_value) : undefined,
        description: createForm.description || undefined,
        status: '进行中',
      });
      if (res.success) {
        setShowCreate(false);
        setCreateForm({ goal_name: '', goal_type: 'operational_kpi', priority: 'P2', target_value: '', description: '' });
        await fetchData();
        await onRefresh();
      } else {
        setError(res.error || '创建失败');
      }
    } finally { setCreating(false); }
  };

  const handleDecompose = async (iniKey: string) => {
    setDecomposing(iniKey);
    setError(null);
    try {
      const res = await decomposeInitiative(iniKey, activePlan?._key || '');
      if (res.success) {
        await fetchData();
        await onRefresh();
      } else {
        setError(res.error || '分解失败');
      }
    } finally { setDecomposing(null); }
  };

  const toggleExpand = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  /* ── Empty state ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Target size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Group goals by type ── */

  const goalsByType = new Map<string, GoalItem[]>();
  for (const g of goals) {
    const type = g.goal_type || 'operational_kpi';
    if (!goalsByType.has(type)) goalsByType.set(type, []);
    goalsByType.get(type)!.push(g);
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">
      {/* Create Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">目标类型</label>
          <div className="flex items-center gap-2">
            <select
              value={createForm.goal_type}
              onChange={(e) => setCreateForm({ ...createForm, goal_type: e.target.value })}
              className="w-40 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {GOAL_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={createForm.goal_name}
              onChange={(e) => setCreateForm({ ...createForm, goal_name: e.target.value })}
              placeholder="输入目标名称..."
              className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="number"
              value={createForm.target_value}
              onChange={(e) => setCreateForm({ ...createForm, target_value: e.target.value })}
              placeholder="目标值"
              className="w-24 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <select
              value={createForm.priority}
              onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
              className="w-20 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {['P0', 'P1', 'P2', 'P3'].map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={!createForm.goal_name.trim() || creating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Plus size={14} />
          {creating ? '创建中...' : '添加目标'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Goals by Type */}
      {!loading && (
        <div className="space-y-4">
          {GOAL_TYPES.map(typeConfig => {
            const items = goalsByType.get(typeConfig.value) || [];
            if (items.length === 0) return null;

            const config = GOAL_TYPE_CONFIG[typeConfig.value] || GOAL_TYPE_CONFIG.operational_kpi;

            return (
              <div key={typeConfig.value} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50/80 border-b border-gray-100">
                  <span className={`${config.bg} ${config.color} p-1 rounded`}>{config.icon}</span>
                  <h4 className="text-xs font-semibold text-gray-700">{config.label}</h4>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(g => (
                    <div key={g._key} className="px-4 py-2.5 flex items-center gap-3 hover:bg-gray-50/50">
                      <span className={`px-1.5 py-0.5 text-[9px] rounded font-medium ${PRIORITY_COLORS[g.priority] || PRIORITY_COLORS.P3}`}>
                        {g.priority}
                      </span>
                      <span className="flex-1 text-xs font-medium text-gray-800 truncate">{g.goal_name}</span>
                      {g.target_value != null && (
                        <span className="text-xs text-gray-500">目标: {g.target_value}</span>
                      )}
                      <span className="text-[10px] text-gray-400">{g.status}</span>
                      {g.milestones && g.milestones.length > 0 && (
                        <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">
                          {g.milestones.length} 里程碑
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {/* Strategic Initiatives Section */}
          {initiatives.length > 0 && (
            <div className="border border-purple-200 rounded-xl bg-white overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 bg-purple-50/80 border-b border-purple-100">
                <Lightbulb size={13} className="text-purple-600" />
                <h4 className="text-xs font-semibold text-purple-800">战略举措</h4>
                <span className="text-xs text-purple-400">({initiatives.length})</span>
              </div>
              <div className="divide-y divide-gray-50">
                {initiatives.map(ini => {
                  const expanded = expandedKeys.has(ini._key);
                  const milestones = ini.milestones as Array<{ phase: string; date: string; deliverable: string }> | undefined;

                  return (
                    <div key={ini._key}>
                      <div
                        className="px-4 py-2.5 flex items-center gap-3 hover:bg-purple-50/30 cursor-pointer"
                        onClick={() => toggleExpand(ini._key)}
                      >
                        {expanded ? <ChevronDown size={12} className="text-gray-400" /> : <ChevronRight size={12} className="text-gray-400" />}
                        <span className="flex-1 text-xs font-medium text-gray-800 truncate">{ini.initiative_name}</span>
                        <span className="text-[10px] text-gray-400">{ini.status}</span>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDecompose(ini._key); }}
                          disabled={decomposing === ini._key}
                          className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-indigo-600 bg-indigo-50 rounded hover:bg-indigo-100 disabled:opacity-50"
                        >
                          <Sparkles size={10} />
                          {decomposing === ini._key ? '分解中...' : 'AI 分解'}
                        </button>
                      </div>
                      {expanded && (
                        <div className="px-6 py-3 bg-gray-50/50 border-t border-gray-100">
                          {ini.description && (
                            <p className="text-xs text-gray-600 mb-3">{ini.description}</p>
                          )}
                          {milestones && milestones.length > 0 ? (
                            <div className="space-y-2">
                              <span className="text-[10px] font-semibold text-gray-500 uppercase">里程碑</span>
                              {milestones.map((m, i) => (
                                <div key={i} className="flex items-center gap-2 text-xs">
                                  <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-[9px] font-bold">{i + 1}</span>
                                  <span className="font-medium text-gray-800">{m.phase}</span>
                                  <span className="text-gray-400">{m.date}</span>
                                  <span className="text-gray-500 truncate">{m.deliverable}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-gray-400 italic">尚未分解 — 点击「AI 分解」生成里程碑和关联KPI</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Empty state */}
          {goals.length === 0 && initiatives.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Target size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无战略目标，请添加或从战略解码导入</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
