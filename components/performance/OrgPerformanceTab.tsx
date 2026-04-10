'use client';

/**
 * Tab 2: 组织绩效
 *
 * Step 1 — 数据准备：预览战略目标 + 选择/新建部门
 * Step 2 — AI 生成部门四维度绩效 + 表格展示 + 内联编辑
 */

import { useState, useEffect, useCallback } from 'react';
import {
  generateOrgPerformance,
  listOrgPerformances,
  updateOrgPerformance,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance } from '@/types/performance';
import { ORG_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Plus, Target, Pencil, Save, X, Trash2 } from 'lucide-react';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import InlineCreateModal from './InlineCreateModal';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Types ── */

interface KPIItem {
  name: string;
  weight: number;
  target?: string;
  [key: string]: unknown;
}

interface OrgPerfEditData {
  _key: string;
  strategic_kpis: KPIItem[];
  management_indicators: KPIItem[];
  team_development: KPIItem[];
  engagement_compliance: KPIItem[];
}

/* ── Constants ── */

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-gray-100 text-gray-600',
};

interface DimensionConfig {
  key: keyof OrgPerfEditData;
  label: string;
  headerBg: string;
  itemBg: string;
  defaultWeight: number;
}

const DIMENSIONS: DimensionConfig[] = [
  { key: 'strategic_kpis',          label: '战略KPI',     headerBg: 'bg-blue-600',   itemBg: 'bg-blue-50/60',   defaultWeight: 25 },
  { key: 'management_indicators',   label: '部门管理',     headerBg: 'bg-green-600',  itemBg: 'bg-green-50/60',  defaultWeight: 12 },
  { key: 'team_development',        label: '团队发展',     headerBg: 'bg-amber-600',  itemBg: 'bg-amber-50/60',  defaultWeight: 7 },
  { key: 'engagement_compliance',   label: '敬业度/合规',  headerBg: 'bg-purple-600', itemBg: 'bg-purple-50/60', defaultWeight: 5 },
];

/* ── Component ── */

export default function OrgPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<OrgPerfEditData | null>(null);

  // Data prep
  const [orgUnits, setOrgUnits] = useState<KernelObject[]>([]);
  const [selectedOrgUnit, setSelectedOrgUnit] = useState<string>('');
  const [goals, setGoals] = useState<KernelObject[]>([]);
  const [showDeptModal, setShowDeptModal] = useState(false);

  /* ── Fetch ── */

  const fetchGoals = useCallback(async () => {
    const res = await getObjectsByModel('Strategic_Goal', 100);
    if (res.success && res.data) setGoals(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchOrgUnits = useCallback(async () => {
    const res = await getObjectsByModel('Org_Unit', 100);
    if (res.success && res.data) setOrgUnits(Array.isArray(res.data) ? res.data : []);
  }, []);

  const fetchOrgPerformances = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const res = await listOrgPerformances(activePlan._key);
      if (res.success && res.data) setOrgPerformances(Array.isArray(res.data) ? res.data : []);
    } finally {
      setLoading(false);
    }
  }, [activePlan]);

  useEffect(() => {
    if (activePlan) { fetchGoals(); fetchOrgUnits(); }
  }, [activePlan, fetchGoals, fetchOrgUnits]);

  useEffect(() => { fetchOrgPerformances(); }, [fetchOrgPerformances]);

  /* ── Handlers ── */

  const handleDeptCreated = (obj: KernelObject) => setOrgUnits(prev => [obj, ...prev]);

  const handleGenerate = async () => {
    if (!activePlan || !selectedOrgUnit) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateOrgPerformance({ plan_id: activePlan._key, org_unit_id: selectedOrgUnit });
      if (res.success) { await fetchOrgPerformances(); await onRefresh(); }
      else setError(res.error || '生成失败');
    } finally { setGenerating(false); }
  };

  const startEdit = (op: OrgPerformance) => {
    const p = op.properties;
    setEditKey(op._key);
    setEditData({
      _key: op._key,
      strategic_kpis: JSON.parse(JSON.stringify(p.strategic_kpis || [])),
      management_indicators: JSON.parse(JSON.stringify(p.management_indicators || [])),
      team_development: JSON.parse(JSON.stringify(p.team_development || [])),
      engagement_compliance: JSON.parse(JSON.stringify(p.engagement_compliance || [])),
    });
  };

  const cancelEdit = () => { setEditKey(null); setEditData(null); setError(null); };

  const saveEdit = async () => {
    if (!editData) return;
    setSaving(true);
    setError(null);
    try {
      const { _key: _, ...fields } = editData;
      const res = await updateOrgPerformance(editData._key, fields);
      if (res.success) { await fetchOrgPerformances(); cancelEdit(); }
      else setError(res.error || '保存失败');
    } finally { setSaving(false); }
  };

  const updateItem = (dimKey: keyof OrgPerfEditData, idx: number, field: string, value: string | number) => {
    if (!editData) return;
    const items = [...editData[dimKey]] as KPIItem[];
    items[idx] = { ...items[idx], [field]: value };
    setEditData({ ...editData, [dimKey]: items });
  };

  const addItem = (dimKey: keyof OrgPerfEditData, defaultWeight: number) => {
    if (!editData) return;
    const items = [...editData[dimKey]] as KPIItem[];
    items.push({ name: '', weight: defaultWeight, target: '' });
    setEditData({ ...editData, [dimKey]: items });
  };

  const removeItem = (dimKey: keyof OrgPerfEditData, idx: number) => {
    if (!editData) return;
    const items = [...editData[dimKey]] as KPIItem[];
    items.splice(idx, 1);
    setEditData({ ...editData, [dimKey]: items });
  };

  const isEditing = (key: string) => editKey === key;

  /* ── Render: no plan ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Target size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Render: Step 1 + Step 2 ── */

  return (
    <div className="space-y-5">
      {/* ═══ Step 1: Data Preparation ═══ */}
      <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
          <span className="text-xs font-medium text-gray-500">STEP 1</span>
          <span className="text-xs text-gray-400 ml-2">数据准备</span>
        </div>

        <div className="p-5 space-y-4">
          {/* Strategic Goals */}
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

          {/* Department Selection + Generate */}
          <div className="flex items-end gap-3">
            <div className="flex-1">
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
                  <Plus size={12} /> 新建部门
                </button>
              </div>
            </div>
            <button
              onClick={handleGenerate}
              disabled={!selectedOrgUnit || generating}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
            >
              <Sparkles size={14} />
              {generating ? 'AI 生成中...' : 'AI 生成部门绩效'}
            </button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ═══ Step 2: Table Grid ═══ */}
      {generating && (
        <div className="flex flex-col items-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">AI 正在基于战略目标生成分部门绩效...</p>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!generating && !loading && orgPerformances.length > 0 && (
        <div>
          <div className="px-1 py-2 mb-3">
            <span className="text-xs font-medium text-gray-500">STEP 2</span>
            <span className="text-xs text-gray-400 ml-2">生成结果 ({orgPerformances.length}个部门)</span>
          </div>

          <div className="space-y-4">
            {orgPerformances.map((op) => {
              const p = op.properties;
              const editing = isEditing(op._key);
              const dw = p.dimension_weights || {};
              const totalWeight = (dw.strategic || 0) + (dw.management || 0) + (dw.team_development || 0) + (dw.engagement || 0);

              return (
                <div key={op._key} className="border border-gray-200 rounded-xl bg-white overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      <h4 className="font-medium text-gray-900 text-sm">{p.org_unit_name || p.org_unit_ref}</h4>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        (p.status as string) === 'draft' ? 'bg-gray-100 text-gray-500' :
                        (p.status as string) === 'active' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {ORG_PERF_STATUS_LABELS[p.status] || p.status}
                      </span>
                      <span className="text-xs text-gray-400">权重合计 {totalWeight}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {editing ? (
                        <>
                          <button onClick={cancelEdit} disabled={saving} className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50">
                            <X size={12} /> 取消
                          </button>
                          <button onClick={saveEdit} disabled={saving} className="flex items-center gap-1 px-2.5 py-1 text-xs text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50">
                            <Save size={12} /> {saving ? '保存中...' : '保存'}
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEdit(op)} className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100">
                          <Pencil size={12} /> 编辑
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 4-Column Grid Table */}
                  <div className="flex">
                    {DIMENSIONS.map((dim) => {
                      const items = editing
                        ? (editData?.[dim.key] as KPIItem[] || [])
                        : (((p as unknown as Record<string, unknown>)[dim.key] as KPIItem[]) || []);
                      const weight = dw[dim.key === 'strategic_kpis' ? 'strategic' : dim.key === 'management_indicators' ? 'management' : dim.key === 'team_development' ? 'team_development' : 'engagement'] || 0;

                      return (
                        <div key={dim.key} className="flex-1 min-w-0 border-r border-gray-100 last:border-r-0">
                          {/* Dimension header */}
                          <div className={`${dim.headerBg} text-white px-3 py-2 text-center`}>
                            <div className="text-xs font-semibold">{dim.label}</div>
                            <div className="text-[10px] opacity-80">{weight}%</div>
                          </div>

                          {/* Items */}
                          <div className="divide-y divide-gray-50">
                            {items.length === 0 && (
                              <div className="px-3 py-4 text-center text-xs text-gray-400">暂无指标</div>
                            )}
                            {items.map((item, idx) => (
                              <div key={idx} className={`${dim.itemBg} px-3 py-2 group`}>
                                {editing ? (
                                  <div className="space-y-1.5">
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateItem(dim.key, idx, 'name', e.target.value)}
                                        placeholder="指标名称"
                                        className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                      />
                                      <button onClick={() => removeItem(dim.key, idx)} className="p-0.5 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100">
                                        <Trash2 size={11} />
                                      </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="number"
                                        value={item.weight}
                                        onChange={(e) => updateItem(dim.key, idx, 'weight', Number(e.target.value))}
                                        className="w-14 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white text-center"
                                        min={0}
                                        max={100}
                                      />
                                      <span className="text-[10px] text-gray-400">%</span>
                                      <input
                                        type="text"
                                        value={item.target || ''}
                                        onChange={(e) => updateItem(dim.key, idx, 'target', e.target.value)}
                                        placeholder="目标值"
                                        className="flex-1 text-xs px-2 py-1 border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-400 bg-white"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="text-xs font-medium text-gray-800 truncate">{item.name}</div>
                                    <div className="text-[10px] text-gray-500 mt-0.5">
                                      <span className="font-medium">{item.weight}%</span>
                                      {item.target && <span className="ml-1.5">{item.target}</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}

                            {/* Add item button (edit mode) */}
                            {editing && (
                              <div className="px-3 py-1.5">
                                <button
                                  onClick={() => addItem(dim.key, dim.defaultWeight)}
                                  className="flex items-center gap-1 text-[10px] text-indigo-500 hover:text-indigo-700"
                                >
                                  <Plus size={10} /> 添加指标
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
