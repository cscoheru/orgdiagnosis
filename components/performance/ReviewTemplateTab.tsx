'use client';

/**
 * Tab 4: 考核表单模板
 *
 * 基于岗位绩效 AI 生成考核表单模板 + 评分模型。
 * 表格式展示 + 内联编辑。
 */

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  listPositionPerformances,
  listTemplates,
  generateReviewTemplate,
  updateTemplate,
} from '@/lib/api/performance-api';
import type { PerformancePlan, ReviewTemplate, PositionPerformance } from '@/types/performance';
import { Sparkles, FileText, Pencil, Save, X, Plus, Trash2, Users, CheckSquare } from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Types ── */

interface TemplateItem {
  name: string;
  weight?: number;
  description?: string;
}

interface TemplateSection {
  section_name: string;
  weight: number;
  items: TemplateItem[];
}

interface TemplateEditData {
  _key: string;
  sections: TemplateSection[];
  reviewer_config: Record<string, boolean>;
}

/* ── Constants ── */

const REVIEWER_LABELS: Record<string, string> = {
  self_review: '自评',
  manager_review: '上级评',
  peer_review: '同事评',
  subordinate_review: '下级评',
  external_review: '外部评',
};

/* ── Component ── */

export default function ReviewTemplateTab({ projectId, activePlan, onRefresh }: Props) {
  const [positions, setPositions] = useState<PositionPerformance[]>([]);
  const [selectedPos, setSelectedPos] = useState<string>('');
  const [templates, setTemplates] = useState<ReviewTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Inline editing
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editData, setEditData] = useState<TemplateEditData | null>(null);

  /* ── Fetch ── */

  const fetchPositions = useCallback(async () => {
    if (!activePlan) return;
    const res = await listPositionPerformances(undefined, activePlan._key);
    if (res.success && res.data) setPositions(Array.isArray(res.data) ? res.data : []);
  }, [activePlan]);

  const fetchTemplates = useCallback(async () => {
    if (!activePlan) return;
    setLoading(true);
    try {
      const res = await listTemplates(activePlan._key);
      if (res.success && res.data) setTemplates(Array.isArray(res.data) ? res.data : []);
    } finally { setLoading(false); }
  }, [activePlan]);

  useEffect(() => { fetchPositions(); }, [fetchPositions]);
  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  /* ── Handlers ── */

  const handleGenerate = async () => {
    if (!selectedPos) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await generateReviewTemplate({ pos_perf_id: selectedPos });
      if (res.success) { await fetchTemplates(); await onRefresh(); }
      else setError(res.error || '生成失败');
    } finally { setGenerating(false); }
  };

  const handleBatchGenerate = async () => {
    if (positions.length === 0) return;
    setGenerating(true);
    setError(null);
    let successCount = 0;
    try {
      for (const pos of positions) {
        const res = await generateReviewTemplate({ pos_perf_id: pos._key });
        if (res.success) successCount++;
      }
      if (successCount > 0) {
        await fetchTemplates();
        await onRefresh();
      }
      if (successCount < positions.length) {
        setError(`成功生成 ${successCount}/${positions.length} 个考核表单`);
      }
    } finally { setGenerating(false); }
  };

  const startEdit = (tpl: ReviewTemplate) => {
    const p = tpl.properties;
    setEditKey(tpl._key);
    setEditData({
      _key: tpl._key,
      sections: JSON.parse(JSON.stringify(p.sections || [])),
      reviewer_config: JSON.parse(JSON.stringify(p.reviewer_config || {})),
    });
  };

  const cancelEdit = () => { setEditKey(null); setEditData(null); setError(null); };

  const saveEdit = async () => {
    if (!editData) return;
    setSaving(true);
    setError(null);
    try {
      const { _key, ...fields } = editData;
      const res = await updateTemplate(_key, fields);
      if (res.success) { await fetchTemplates(); cancelEdit(); }
      else setError(res.error || '保存失败');
    } finally { setSaving(false); }
  };

  const updateSectionName = (idx: number, value: string) => {
    if (!editData) return;
    const sections = [...editData.sections];
    sections[idx] = { ...sections[idx], section_name: value };
    setEditData({ ...editData, sections });
  };

  const updateSectionWeight = (idx: number, value: number) => {
    if (!editData) return;
    const sections = [...editData.sections];
    sections[idx] = { ...sections[idx], weight: value };
    setEditData({ ...editData, sections });
  };

  const updateItem = (sectionIdx: number, itemIdx: number, field: keyof TemplateItem, value: string | number) => {
    if (!editData) return;
    const sections = [...editData.sections];
    const items = [...sections[sectionIdx].items];
    items[itemIdx] = { ...items[itemIdx], [field]: value };
    sections[sectionIdx] = { ...sections[sectionIdx], items };
    setEditData({ ...editData, sections });
  };

  const addItem = (sectionIdx: number) => {
    if (!editData) return;
    const sections = [...editData.sections];
    const items = [...sections[sectionIdx].items];
    items.push({ name: '', weight: 0 });
    sections[sectionIdx] = { ...sections[sectionIdx], items };
    setEditData({ ...editData, sections });
  };

  const removeItem = (sectionIdx: number, itemIdx: number) => {
    if (!editData) return;
    const sections = [...editData.sections];
    const items = [...sections[sectionIdx].items];
    items.splice(itemIdx, 1);
    sections[sectionIdx] = { ...sections[sectionIdx], items };
    setEditData({ ...editData, sections });
  };

  const addSection = () => {
    if (!editData) return;
    const sections = [...editData.sections, { section_name: '', weight: 0, items: [] }];
    setEditData({ ...editData, sections });
  };

  const removeSection = (idx: number) => {
    if (!editData) return;
    const sections = [...editData.sections];
    sections.splice(idx, 1);
    setEditData({ ...editData, sections });
  };

  const toggleReviewer = (key: string) => {
    if (!editData) return;
    setEditData({
      ...editData,
      reviewer_config: { ...editData.reviewer_config, [key]: !editData.reviewer_config[key] },
    });
  };

  /* ── Empty state ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-5">
      {/* Generate Controls */}
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-gray-600 mb-1">选择岗位绩效</label>
          <select
            value={selectedPos}
            onChange={(e) => setSelectedPos(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="">选择要生成考核表单的岗位...</option>
            {positions.map((pos) => (
              <option key={pos._key} value={pos._key}>
                {pos.properties.job_role_name || pos.properties.job_role_ref}
                {pos.properties.is_leader ? ' (管理岗)' : ''}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={handleGenerate}
          disabled={!selectedPos || generating}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Sparkles size={14} />
          {generating ? 'AI 生成中...' : 'AI 生成考核表单'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Templates List */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {positions.length > 0 ? (
            <>
              <p className="mb-3">已生成 {positions.length} 个岗位绩效，但尚未生成考核表单模板</p>
              <button
                onClick={handleBatchGenerate}
                disabled={generating}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Sparkles size={14} />
                {generating ? `正在生成 (0/${positions.length})...` : `一键为 ${positions.length} 个岗位生成考核表单`}
              </button>
            </>
          ) : (
            <p>尚未生成考核表单模板，请先在「岗位绩效」中生成岗位绩效</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {templates.map((tpl) => {
            const p = tpl.properties;
            const editing = editKey === tpl._key;
            const sections = editing
              ? (editData?.sections || [])
              : (p.sections || []);
            const reviewerConfig = editing
              ? (editData?.reviewer_config || {})
              : (p.reviewer_config || {});
            const totalWeight = sections.reduce((sum: number, s: { weight: number }) => sum + (s.weight || 0), 0);

            return (
              <div key={tpl._key} className="border border-gray-300 rounded-xl bg-white overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50/80 border-b border-gray-200">
                  <div className="flex items-center gap-2">
                    <FileText size={14} className="text-indigo-500" />
                    <h4 className="font-semibold text-gray-900 text-sm">{p.template_name}</h4>
                    <span className="text-xs text-gray-400">{p.template_type}</span>
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
                      <button onClick={() => startEdit(tpl)} className="flex items-center gap-1 px-2.5 py-1 text-xs text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100">
                        <Pencil size={12} /> 编辑
                      </button>
                    )}
                  </div>
                </div>

                {/* Reviewer Config */}
                <div className="px-4 py-2.5 bg-white border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Users size={12} />
                      <span>评估人：</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(REVIEWER_LABELS).map(([key, label]) => {
                        const active = !!(reviewerConfig as Record<string, boolean>)[key];
                        return (
                          <button
                            key={key}
                            onClick={() => editing && toggleReviewer(key)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded-full font-medium transition-colors ${
                              active
                                ? 'bg-indigo-100 text-indigo-700 ring-1 ring-indigo-200'
                                : 'bg-gray-100 text-gray-400'
                            } ${editing ? 'hover:bg-indigo-200 cursor-pointer' : 'cursor-default'}`}
                          >
                            {active && <CheckSquare size={10} />}
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Sections Table */}
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-[18%]">考核维度</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700 w-[18%]">考核项目</th>
                        <th className="border border-gray-300 px-3 py-2 text-left font-semibold text-gray-700">描述</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[56px]">权重</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[56px]">自评</th>
                        <th className="border border-gray-300 px-3 py-2 text-center font-semibold text-gray-700 w-[64px]">领导评价</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sections.map((section: TemplateSection, sIdx: number) => {
                        const items = section.items || [];
                        return (
                          <Fragment key={sIdx}>
                            {/* Section header */}
                            <tr className="bg-gray-50">
                              <td colSpan={6} className="border border-gray-300 px-3 py-1.5 font-semibold text-gray-700">
                                {editing ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={section.section_name}
                                      onChange={(e) => updateSectionName(sIdx, e.target.value)}
                                      className="text-xs bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                    />
                                    <input
                                      type="number"
                                      value={section.weight}
                                      onChange={(e) => updateSectionWeight(sIdx, Number(e.target.value))}
                                      className="w-10 text-xs text-center bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                      min={0}
                                      max={100}
                                    />
                                    <span className="text-gray-400">%</span>
                                    <button
                                      onClick={() => addItem(sIdx)}
                                      className="inline-flex items-center gap-0.5 text-indigo-500 hover:text-indigo-700 font-normal"
                                    >
                                      <Plus size={11} /> 添加
                                    </button>
                                    <button
                                      onClick={() => removeSection(sIdx)}
                                      className="p-0.5 text-gray-300 hover:text-red-500 transition-colors"
                                      title="删除维度"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                ) : (
                                  <>
                                    {section.section_name}
                                    <span className="ml-2 text-gray-500 font-normal">({section.weight}%)</span>
                                  </>
                                )}
                              </td>
                            </tr>

                            {/* Item rows */}
                            {items.length === 0 && (
                              <tr>
                                <td colSpan={6} className="border border-gray-300 px-3 py-3 text-center text-gray-400">
                                  暂无考核项目
                                </td>
                              </tr>
                            )}
                            {items.map((item: TemplateItem, iIdx: number) => (
                              <tr key={iIdx} className="hover:bg-blue-50/30">
                                <td className="border border-gray-300 px-3 py-2 text-gray-500">{section.section_name}</td>
                                <td className="border border-gray-300 px-3 py-2">
                                  {editing ? (
                                    <input
                                      type="text"
                                      value={item.name}
                                      onChange={(e) => updateItem(sIdx, iIdx, 'name', e.target.value)}
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
                                      value={item.description || ''}
                                      onChange={(e) => updateItem(sIdx, iIdx, 'description', e.target.value)}
                                      className="w-full text-xs bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                      placeholder="描述"
                                    />
                                  ) : (
                                    item.description || <span className="text-gray-300">—</span>
                                  )}
                                </td>
                                <td className="border border-gray-300 px-3 py-2 text-center font-medium text-gray-800">
                                  {editing ? (
                                    <input
                                      type="number"
                                      value={item.weight || 0}
                                      onChange={(e) => updateItem(sIdx, iIdx, 'weight', Number(e.target.value))}
                                      className="w-10 text-xs text-center bg-transparent border-0 border-b border-dashed border-gray-300 focus:border-indigo-500 focus:ring-0 px-0 py-0.5 outline-none"
                                      min={0}
                                      max={100}
                                    />
                                  ) : (
                                    item.weight || 0
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
                                      onClick={() => removeItem(sIdx, iIdx)}
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

                      {/* Add section button */}
                      {editing && (
                        <tr>
                          <td colSpan={6} className="border border-gray-300 px-3 py-2">
                            <button
                              onClick={addSection}
                              className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700"
                            >
                              <Plus size={12} /> 添加考核维度
                            </button>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
