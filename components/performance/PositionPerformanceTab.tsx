'use client';

/**
 * Tab 3: 岗位绩效
 *
 * Step 1 — 岗位配置：查看选中部门的岗位列表，支持新增岗位
 * Step 2 — 表格式展示岗位四分区绩效 + 内联编辑
 */

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  listOrgPerformances,
  listPositionPerformances,
  generatePositionPerformance,
  updatePositionPerformance,
} from '@/lib/api/performance-api';
import type { PerformancePlan, OrgPerformance, PositionPerformance, MetricTemplate } from '@/types/performance';
import { POS_PERF_STATUS_LABELS } from '@/types/performance';
import { Sparkles, Users, Crown, Plus, Briefcase, Pencil, Save, X, Trash2 } from 'lucide-react';
import { getObjectsByModel, type KernelObject } from '@/lib/api/kernel-client';
import InlineCreateModal from './InlineCreateModal';
import MetricPicker from './MetricPicker';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Types ── */

interface SectionItem {
  name: string;
  weight: number;
  standard: string;
  /** Preserve all original fields from the backend (metric, unit, evaluation_criteria, etc.) */
  _raw?: Record<string, unknown>;
}

type EditDimKey = 'performance_goals' | 'competency_items' | 'values_items' | 'development_goals';

interface PosPerfEditData {
  _key: string;
  performance_goals: SectionItem[];
  competency_items: SectionItem[];
  values_items: SectionItem[];
  development_goals: SectionItem[];
}

/* ── Constants ── */

const JOB_FAMILY_COLORS: Record<string, string> = {
  '管理M': 'bg-amber-100 text-amber-700',
  '专业P': 'bg-blue-100 text-blue-700',
  '操作O': 'bg-gray-100 text-gray-600',
  '营销S': 'bg-green-100 text-green-700',
};

interface SectionConfig {
  key: string;
  label: string;
  weightKey: string;
  itemsKey: EditDimKey;
  standardKey: string;
  defaultWeight: number;
}

const SECTIONS: SectionConfig[] = [
  { key: 'performance',  label: '业绩目标',   weightKey: 'performance',  itemsKey: 'performance_goals',  standardKey: 'target',          defaultWeight: 15 },
  { key: 'competency',   label: '能力评估',   weightKey: 'competency',   itemsKey: 'competency_items',   standardKey: 'required_level',  defaultWeight: 10 },
  { key: 'values',       label: '价值观',     weightKey: 'values',       itemsKey: 'values_items',       standardKey: 'description',     defaultWeight: 5 },
  { key: 'development',  label: '发展目标',   weightKey: 'development',  itemsKey: 'development_goals',  standardKey: 'timeline',        defaultWeight: 5 },
];

/* ── Helpers ── */

function extractItems(p: Record<string, unknown>, itemsKey: string, standardKey: string): SectionItem[] {
  const raw = p[itemsKey];
  if (!Array.isArray(raw)) return [];
  return raw.map((item: Record<string, unknown>) => ({
    name: String(item.name || ''),
    weight: Number(item.weight || 0),
    standard: String(item[standardKey] || ''),
    _raw: { ...item } as Record<string, unknown>,
  }));
}

/* ── Component ── */

export default function PositionPerformanceTab({ projectId, activePlan, onRefresh }: Props) {
  const [orgPerformances, setOrgPerformances] = useState<OrgPerformance[]>([]);
  const [selectedOrgPerf, setSelectedOrgPerf] = useState<string>('');
  const [positions, setPositions] = useState<PositionPerformance[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<PosPerfEditData | null>(null);

  // Data prep
  const [jobRoles, setJobRoles] = useState<KernelObject[]>([]);
  const [loadingRoles, setLoadingRoles] = useState(false);
  const [showRoleModal, setShowRoleModal] = useState(false);

  const selectedOrgPerfData = orgPerformances.find(op => op._key === selectedOrgPerf);
  const orgUnitRef = selectedOrgPerfData?.properties.org_unit_ref as string | undefined;

  /* ── Fetch ── */

  const fetchOrgPerfs = useCallback(async () => {
    if (!activePlan) return;
    const res = await listOrgPerformances(activePlan._key);
    if (res.success && res.data) setOrgPerformances(Array.isArray(res.data) ? res.data : []);
  }, [activePlan]);

  const fetchJobRoles = useCallback(async () => {
    if (!orgUnitRef) { setJobRoles([]); return; }
    setLoadingRoles(true);
    try {
      const res = await getObjectsByModel('Job_Role', 200);
      if (res.success && res.data) {
        const all = Array.isArray(res.data) ? res.data : [];
        const filtered = all.filter(jr => {
          const ouId = jr.properties.org_unit_id as string | undefined;
          return ouId === orgUnitRef || ouId === selectedOrgPerfData?._key;
        });
        setJobRoles(filtered);
      }
    } finally { setLoadingRoles(false); }
  }, [orgUnitRef, selectedOrgPerfData?._key]);

  const fetchPositions = useCallback(async () => {
    if (!selectedOrgPerf) return;
    setLoading(true);
    try {
      const res = await listPositionPerformances(selectedOrgPerf);
      if (res.success && res.data) setPositions(Array.isArray(res.data) ? res.data : []);
    } finally { setLoading(false); }
  }, [selectedOrgPerf]);

  useEffect(() => { fetchOrgPerfs(); }, [fetchOrgPerfs]);
  useEffect(() => { fetchJobRoles(); }, [fetchJobRoles]);
  useEffect(() => { fetchPositions(); }, [fetchPositions]);

  /* ── Handlers ── */

  const handleRoleCreated = (obj: KernelObject) => setJobRoles(prev => [obj, ...prev]);

  const handleGenerate = async () => {
    if (!selectedOrgPerf) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generatePositionPerformance({ org_perf_id: selectedOrgPerf });
      if (res.success) { await fetchPositions(); await onRefresh(); }
      else setError(res.error || '生成失败');
    } finally { setGenerating(false); }
  };

  const startEdit = (pos: PositionPerformance) => {
    const p = pos.properties;
    setEditKey(pos._key);
    setEditData({
      _key: pos._key,
      performance_goals: extractItems(p as Record<string, unknown>, 'performance_goals', 'target'),
      competency_items: extractItems(p as Record<string, unknown>, 'competency_items', 'required_level'),
      values_items: extractItems(p as Record<string, unknown>, 'values_items', 'description'),
      development_goals: extractItems(p as Record<string, unknown>, 'development_goals', 'timeline'),
    });
  };

  const cancelEdit = () => { setEditKey(null); setEditData(null); setError(null); };

  const saveEdit = async () => {
    if (!editData) return;
    setSaving(true);
    setError(null);
    try {
      const { _key, ...fields } = editData;

      // Reconstruct full items: merge edited fields back into original raw data
      const reconstructed: Record<string, unknown> = {};
      for (const dimKey of ['performance_goals', 'competency_items', 'values_items', 'development_goals'] as const) {
        const items = fields[dimKey];
        const standardKeyMap: Record<string, string> = {
          performance_goals: 'target',
          competency_items: 'required_level',
          values_items: 'description',
          development_goals: 'timeline',
        };
        const stdKey = standardKeyMap[dimKey];
        reconstructed[dimKey] = items.map(item => {
          if (item._raw) {
            // Merge edited fields into original data
            const merged: Record<string, unknown> = { ...item._raw, name: item.name, weight: item.weight };
            merged[stdKey] = item.standard;
            return merged;
          }
          // New item added by user — no raw data
          const result: Record<string, unknown> = { name: item.name, weight: item.weight };
          result[stdKey] = item.standard;
          return result;
        });
      }

      const res = await updatePositionPerformance(_key, reconstructed);
      if (res.success) { await fetchPositions(); cancelEdit(); }
      else setError(res.error || '保存失败');
    } finally { setSaving(false); }
  };

  const updateItem = (dimKey: EditDimKey, idx: number, field: keyof SectionItem, value: string | number) => {
    if (!editData) return;
    const items = [...editData[dimKey]];
    items[idx] = { ...items[idx], [field]: value };
    setEditData({ ...editData, [dimKey]: items });
  };

  const addItem = (dimKey: EditDimKey, defaultWeight: number) => {
    if (!editData) return;
    const items = [...editData[dimKey]];
    items.push({ name: '', weight: defaultWeight, standard: '' }); // no _raw — new item
    setEditData({ ...editData, [dimKey]: items });
  };

  const addFromTemplate = (dimKey: EditDimKey, template: MetricTemplate, defaultWeight: number) => {
    if (!editData) return;
    const items = [...editData[dimKey]];
    items.push({
      name: template.metric_name,
      weight: template.default_weight || defaultWeight,
      standard: template.evaluation_criteria || '',
      _raw: {
        evaluation_criteria: template.evaluation_criteria,
        target: template.target_template,
        metric: template.metric_formula,
        unit: template.unit,
      },
    });
    setEditData({ ...editData, [dimKey]: items });
  };

  const removeItem = (dimKey: EditDimKey, idx: number) => {
    if (!editData) return;
    const items = [...editData[dimKey]];
    items.splice(idx, 1);
    setEditData({ ...editData, [dimKey]: items });
  };

  /* ── Empty state ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Users size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">
      {/* Org Performance Selector + Add Role */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
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
        <button
          onClick={() => setShowRoleModal(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors whitespace-nowrap"
        >
          <Plus size={12} /> 添加岗位
        </button>
      </div>

      {/* ═══ Step 1: Job Role Configuration ═══ */}
      {selectedOrgPerf && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50">
            <span className="text-xs font-medium text-gray-500">STEP 1</span>
            <span className="text-xs text-gray-400 ml-2">岗位配置</span>
            <span className="text-xs text-gray-400 ml-2">— 部门: {orgUnitRef || '未知'}</span>
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
              <div className="flex flex-wrap gap-2">
                {jobRoles.map((jr) => {
                  const r = jr.properties;
                  const family = String(r.job_family || '');
                  return (
                    <div key={jr._key} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-50 border border-gray-100">
                      <Briefcase size={13} className="text-gray-400" />
                      <span className="text-xs text-gray-900 font-medium">{String(r.role_name || '')}</span>
                      {family && (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${JOB_FAMILY_COLORS[family] || 'bg-gray-100 text-gray-600'}`}>
                          {family}
                        </span>
                      )}
                      {r.is_key_position ? (
                        <span className="px-1.5 py-0.5 text-[10px] bg-red-50 text-red-600 rounded">关键岗位</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

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

      {/* Error */}
      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* ═══ Step 2: Performance Tables ═══ */}
      {generating && (
        <div className="flex flex-col items-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">AI 正在为 {jobRoles.length} 个岗位生成绩效方案...</p>
        </div>
      )}

      {!generating && loading && (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!generating && !loading && positions.length > 0 && (
        <div>
          <div className="px-1 py-2 mb-3">
            <span className="text-xs font-medium text-gray-500">STEP 2</span>
            <span className="text-xs text-gray-400 ml-2">生成结果 ({positions.length}个岗位)</span>
          </div>

          <div className="space-y-6">
            {positions.map((pos) => {
              const p = pos.properties;
              const editing = editKey === pos._key;
              const isLeader = p.is_leader;
              const sw = p.section_weights || {};
              const totalWeight = (sw.performance || 0) + (sw.competency || 0) + (sw.values || 0) + (sw.development || 0);

              return (
                <div key={pos._key} className="border border-gray-300 rounded-xl bg-white overflow-hidden">
                  {/* Table Header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-200">
                    <div className="flex items-center gap-2">
                      {isLeader && <Crown size={14} className="text-amber-500" />}
                      <h4 className="font-semibold text-gray-900 text-sm">
                        {p.job_role_name || p.job_role_ref} 绩效考核表
                      </h4>
                      {isLeader && <span className="px-1.5 py-0.5 text-[10px] bg-amber-100 text-amber-700 rounded font-medium">管理岗</span>}
                      {p.auto_generated && <span className="px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-600 rounded font-medium">AI生成</span>}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                        (p.status as string) === 'draft' ? 'bg-gray-100 text-gray-500' :
                        (p.status as string) === 'active' ? 'bg-green-100 text-green-700' :
                        'bg-gray-100 text-gray-500'
                      }`}>
                        {POS_PERF_STATUS_LABELS[p.status] || p.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-400">权重合计 {totalWeight}%</span>
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
                        <button onClick={() => startEdit(pos)} className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100">
                          <Pencil size={12} /> 编辑
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Leader dual assessment */}
                  {isLeader && p.leader_config && (
                    <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-2 text-xs text-amber-700">
                      <Crown size={13} />
                      双重评估：个人绩效 {p.leader_config.personal_weight}% + 团队绩效 {p.leader_config.team_weight}%
                    </div>
                  )}

                  {/* ── Performance Evaluation Table ── */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-[14%]">指标类别</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-[14%]">考评指标</th>
                          <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">考评标准</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[56px]">分值</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[56px]">自评</th>
                          <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[64px]">领导评价</th>
                        </tr>
                      </thead>
                      <tbody>
                        {SECTIONS.map((section) => {
                          const items = editing
                            ? (editData?.[section.itemsKey] || [])
                            : extractItems(p as Record<string, unknown>, section.itemsKey, section.standardKey);
                          const weight = sw[section.weightKey as keyof typeof sw] as number || 0;

                          return (
                            <Fragment key={section.key}>
                              {/* Category row */}
                              <tr className="bg-gray-50">
                                <td colSpan={6} className="border border-gray-300 px-3 py-1.5 font-semibold text-gray-700">
                                  {section.label}
                                  <span className="ml-2 text-gray-500 font-normal">({weight}%)</span>
                                  {editing && (
                                    <MetricPicker
                                      context={{ type: 'pos', section: section.itemsKey as 'performance_goals' | 'competency_items' | 'values_items' | 'development_goals' }}
                                      onSelect={(tpl) => addFromTemplate(section.itemsKey, tpl, section.defaultWeight)}
                                      onManualAdd={() => addItem(section.itemsKey, section.defaultWeight)}
                                    >
                                      <button
                                        className="ml-3 inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 font-normal"
                                      >
                                        <Plus size={11} /> 添加指标
                                      </button>
                                    </MetricPicker>
                                  )}
                                </td>
                              </tr>

                              {/* Item rows */}
                              {items.length === 0 && (
                                <tr>
                                  <td colSpan={6} className="border border-gray-300 px-3 py-3 text-center text-gray-400">
                                    暂无指标
                                  </td>
                                </tr>
                              )}
                              {items.map((item, idx) => (
                                <tr key={idx} className="hover:bg-blue-50/30">
                                  <td className="border border-gray-300 px-3 py-2 text-gray-500">{section.label}</td>
                                  <td className="border border-gray-300 px-3 py-2">
                                    {editing ? (
                                      <input
                                        type="text"
                                        value={item.name}
                                        onChange={(e) => updateItem(section.itemsKey, idx, 'name', e.target.value)}
                                        className="w-full text-xs bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                      />
                                    ) : (
                                      <span className="font-medium text-gray-800">{item.name}</span>
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-gray-600">
                                    {editing ? (
                                      <input
                                        type="text"
                                        value={item.standard}
                                        onChange={(e) => updateItem(section.itemsKey, idx, 'standard', e.target.value)}
                                        className="w-full text-xs bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                        placeholder="考评标准"
                                      />
                                    ) : (
                                      item.standard || <span className="text-gray-300">—</span>
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-800">
                                    {editing ? (
                                      <input
                                        type="number"
                                        value={item.weight}
                                        onChange={(e) => updateItem(section.itemsKey, idx, 'weight', Number(e.target.value))}
                                        className="w-10 text-xs text-center bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                        min={0}
                                        max={100}
                                      />
                                    ) : (
                                      item.weight
                                    )}
                                  </td>
                                  <td className="border border-gray-300 px-2 py-1.5 text-center">
                                    <input
                                      type="number"
                                      className="w-full text-xs text-center bg-transparent border-0 focus:ring-0 focus:outline-none"
                                      placeholder="—"
                                    />
                                  </td>
                                  <td className="border border-gray-300 px-1 py-1.5 text-center relative">
                                    <input
                                      type="number"
                                      className="w-full text-xs text-center bg-transparent border-0 focus:ring-0 focus:outline-none pr-4"
                                      placeholder="—"
                                    />
                                    {editing && (
                                      <button
                                        onClick={() => removeItem(section.itemsKey, idx)}
                                        className="absolute top-1 right-0.5 p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                        title="删除"
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </Fragment>
                          );
                        })}

                        {/* Total row */}
                        <tr className="bg-gray-50 font-semibold">
                          <td colSpan={3} className="border border-gray-300 px-3 py-2 text-right text-gray-700">合计</td>
                          <td className="border border-gray-300 px-3 py-2 text-center text-gray-800">{totalWeight}</td>
                          <td colSpan={2} className="border border-gray-300 px-3 py-2" />
                        </tr>
                      </tbody>
                    </table>
                  </div>
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
