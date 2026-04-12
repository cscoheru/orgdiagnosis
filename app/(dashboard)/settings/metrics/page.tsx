'use client';

/**
 * 系统设置 — 指标库管理
 *
 * 管理 Metric_Category 和 Metric_Template 的完整 CRUD。
 * 两个 Tab: 指标分类 / 指标模板
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Search, Plus, Pencil, Trash2, Check, X, Database,
  ChevronDown, Filter, Eye, EyeOff,
} from 'lucide-react';
import {
  listMetricCategories,
  listMetricTemplates,
  createMetricCategory,
  createMetricTemplate,
  updateMetricTemplate,
  deleteMetricTemplate,
} from '@/lib/api/performance-api';
import type { MetricCategory, MetricTemplate, CategoryType } from '@/types/performance';

/* ── Constants ── */

const DIMENSIONS = ['财务', '客户', '内部流程', '学习与成长', '战略', '运营', '人才发展', '胜任力'];
const LEVELS = ['组织级', '部门级', '岗位级'];
const INDUSTRIES = ['建筑工程', '消费品', '制造业', '科技互联网', '金融', '房地产', '医疗健康'];
const CATEGORY_TYPES = ['industry', 'dimension', 'level', 'custom'];

const CAT_TYPE_LABELS: Record<string, string> = {
  industry: '行业', dimension: '维度', level: '层级', custom: '自定义',
};

const DIM_COLORS: Record<string, string> = {
  '财务': 'bg-green-100 text-green-700', '客户': 'bg-blue-100 text-blue-700',
  '内部流程': 'bg-amber-100 text-amber-700', '学习与成长': 'bg-purple-100 text-purple-700',
  '战略': 'bg-red-100 text-red-700', '运营': 'bg-cyan-100 text-cyan-700',
  '人才发展': 'bg-pink-100 text-pink-700', '胜任力': 'bg-indigo-100 text-indigo-700',
};

/* ── Types ── */

type TabId = 'categories' | 'templates';

/* ── Component ── */

export default function MetricsSettingsPage() {
  const [activeTab, setActiveTab] = useState<TabId>('templates');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">指标库管理</h1>
        <p className="text-gray-500 mt-1">行业分类、维度分类、层级分类及绩效指标模板的维护和管理</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {([
          { id: 'templates' as TabId, name: '指标模板' },
          { id: 'categories' as TabId, name: '指标分类' },
        ]).map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.name}
          </button>
        ))}
      </div>

      {activeTab === 'templates' && <TemplatesSection />}
      {activeTab === 'categories' && <CategoriesSection />}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Templates Section                                            */
/* ═══════════════════════════════════════════════════════════════ */

function TemplatesSection() {
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MetricTemplate | null>(null);
  const [creating, setCreating] = useState(false);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [dimension, setDimension] = useState('');
  const [level, setLevel] = useState('');
  const [industry, setIndustry] = useState('');
  const [status, setStatus] = useState('all');

  // Fetch — 自动分页加载全部数据
  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const PAGE_SIZE = 200;
      let allData: MetricTemplate[] = [];
      let offset = 0;
      let firstTotal = 0;

      while (true) {
        const res = await listMetricTemplates({
          keyword: keyword || undefined,
          dimension: dimension || undefined,
          level: level || undefined,
          industry: industry || undefined,
          status: status || undefined,
          limit: PAGE_SIZE,
          offset,
        });
        if (!res.success || !res.data) break;
        const batch = res.data.data || [];
        allData = [...allData, ...batch];
        if (offset === 0) firstTotal = res.data.total || 0;
        if (batch.length < PAGE_SIZE) break;
        offset += PAGE_SIZE;
      }

      setTemplates(allData);
      setTotal(firstTotal);
    } finally {
      setLoading(false);
    }
  }, [keyword, dimension, level, industry, status]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  // Handlers
  const handleDelete = async (tpl: MetricTemplate) => {
    if (tpl.source !== 'user_created') return;
    if (!confirm(`确定删除指标「${tpl.metric_name}」？`)) return;
    const res = await deleteMetricTemplate(tpl._key);
    if (res.success) fetchTemplates();
  };

  const handleToggleStatus = async (tpl: MetricTemplate) => {
    const newStatus = tpl.status === 'draft' ? 'published' : 'draft';
    const res = await updateMetricTemplate(tpl._key, { status: newStatus } as Partial<MetricTemplate>);
    if (res.success) fetchTemplates();
  };

  const handleSave = async (data: Partial<MetricTemplate>) => {
    if (editing) {
      const res = await updateMetricTemplate(editing._key, data);
      if (res.success) { setEditing(null); fetchTemplates(); }
    } else if (creating) {
      const res = await createMetricTemplate({ ...data, source: 'user_created', status: 'draft' });
      if (res.success) { setCreating(false); fetchTemplates(); }
    }
  };

  const openCreate = () => {
    setEditing(null);
    setCreating(true);
  };

  const openEdit = (tpl: MetricTemplate) => {
    setEditing(tpl);
    setCreating(false);
  };

  const closeModal = () => {
    setEditing(null);
    setCreating(false);
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索指标名称..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <select value={dimension} onChange={e => setDimension(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="">全部维度</option>
          {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={level} onChange={e => setLevel(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="">全部层级</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select value={industry} onChange={e => setIndustry(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="">全部行业</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="px-3 py-2 text-sm border border-gray-200 rounded-lg">
          <option value="all">全部状态</option>
          <option value="published">已发布</option>
          <option value="draft">草稿</option>
        </select>
      </div>

      {/* Stats & Actions */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <Database size={14} className="inline mr-1" />
          {total} 个指标
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus size={14} /> 新建指标
        </button>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Database size={40} className="mx-auto mb-3 opacity-40" />
          <p>未找到匹配的指标</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map(tpl => (
            <div key={tpl._key} className={`border rounded-xl p-3 bg-white hover:shadow-sm transition-shadow ${tpl.status === 'draft' ? 'border-dashed border-gray-300 opacity-75' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-sm text-gray-900 truncate">{tpl.metric_name}</span>
                    {tpl.status === 'draft' && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">草稿</span>
                    )}
                    {tpl.is_verified && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700">已审核</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${DIM_COLORS[tpl.dimension] || 'bg-gray-100 text-gray-600'}`}>
                      {tpl.dimension}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                      {tpl.applicable_level}
                    </span>
                    {tpl.industries.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                        {tpl.industries.slice(0, 2).join(', ')}{tpl.industries.length > 2 && ` +${tpl.industries.length - 2}`}
                      </span>
                    )}
                  </div>
                  {tpl.evaluation_criteria && (
                    <p className="text-xs text-gray-400 mt-1.5 line-clamp-2">{tpl.evaluation_criteria}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  <button onClick={() => openEdit(tpl)} className="p-1 text-gray-400 hover:text-indigo-600" title="编辑">
                    <Pencil size={12} />
                  </button>
                  {tpl.source === 'user_created' && (
                    <button onClick={() => handleDelete(tpl)} className="p-1 text-gray-300 hover:text-red-500" title="删除">
                      <Trash2 size={12} />
                    </button>
                  )}
                  {tpl.source === 'user_created' && (
                    <button
                      onClick={() => handleToggleStatus(tpl)}
                      className="p-1 text-gray-400 hover:text-indigo-600"
                      title={tpl.status === 'draft' ? '发布' : '取消发布'}
                    >
                      {tpl.status === 'draft' ? <Eye size={12} /> : <EyeOff size={12} />}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {(editing || creating) && (
        <MetricTemplateModal
          template={editing}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Metric Template Modal                                        */
/* ═══════════════════════════════════════════════════════════════ */

function MetricTemplateModal({
  template,
  onSave,
  onClose,
}: {
  template: MetricTemplate | null;
  onSave: (data: Partial<MetricTemplate>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!template;
  const [form, setForm] = useState<Partial<MetricTemplate>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (template) {
      setForm({ ...template });
    } else {
      setForm({
        metric_name: '',
        dimension: '财务',
        applicable_level: '部门级',
        industries: [],
        default_weight: 10,
        unit: '',
        target_template: '',
        evaluation_criteria: '',
        description: '',
        metric_formula: '',
        tags: [],
        org_dimension_mapping: undefined,
        pos_section_mapping: undefined,
      });
    }
  }, [template]);

  const update = (field: keyof MetricTemplate, value: unknown) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    if (!form.metric_name?.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const toggleIndustry = (ind: string) => {
    const industries = [...(form.industries || [])];
    const idx = industries.indexOf(ind);
    if (idx >= 0) industries.splice(idx, 1);
    else industries.push(ind);
    update('industries', industries);
  };

  const toggleTag = (tag: string) => {
    const tags = [...(form.tags || [])];
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    update('tags', tags);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? '编辑指标' : '新建指标'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* 指标名称 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">指标名称 *</label>
            <input
              type="text"
              value={form.metric_name || ''}
              onChange={e => update('metric_name', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="如：营业收入达成率"
            />
          </div>

          {/* 维度 + 层级 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">维度 *</label>
              <select value={form.dimension} onChange={e => update('dimension', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">适用层级 *</label>
              <select value={form.applicable_level} onChange={e => update('applicable_level', e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg">
                {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* 权重 + 单位 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">建议权重 (%)</label>
              <input
                type="number"
                value={form.default_weight || 0}
                onChange={e => update('default_weight', Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                min={0} max={100}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">计量单位</label>
              <input
                type="text"
                value={form.unit || ''}
                onChange={e => update('unit', e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                placeholder="如: %, 万元, 分"
              />
            </div>
          </div>

          {/* 目标值模板 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">目标值模板</label>
            <input
              type="text"
              value={form.target_template || ''}
              onChange={e => update('target_template', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="如: >=90%, >=年度目标"
            />
          </div>

          {/* 评估标准 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">评估标准</label>
            <textarea
              value={form.evaluation_criteria || ''}
              onChange={e => update('evaluation_criteria', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
              placeholder="如: 实际值/目标值 * 100%"
            />
          </div>

          {/* 计算公式 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">计算公式</label>
            <input
              type="text"
              value={form.metric_formula || ''}
              onChange={e => update('metric_formula', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="可选"
            />
          </div>

          {/* 描述 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
            <textarea
              value={form.description || ''}
              onChange={e => update('description', e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
              placeholder="可选"
            />
          </div>

          {/* 适用行业 */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">适用行业</label>
            <div className="flex flex-wrap gap-1.5">
              {INDUSTRIES.map(ind => (
                <button
                  key={ind}
                  onClick={() => toggleIndustry(ind)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    (form.industries || []).includes(ind)
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {ind}
                </button>
              ))}
            </div>
          </div>

          {/* 维度映射 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">组织维度映射</label>
              <select
                value={form.org_dimension_mapping || ''}
                onChange={e => update('org_dimension_mapping', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">无</option>
                <option value="strategic_kpis">strategic_kpis</option>
                <option value="management_indicators">management_indicators</option>
                <option value="team_development">team_development</option>
                <option value="engagement_compliance">engagement_compliance</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">岗位分区映射</label>
              <select
                value={form.pos_section_mapping || ''}
                onChange={e => update('pos_section_mapping', e.target.value || undefined)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              >
                <option value="">无</option>
                <option value="performance_goals">performance_goals</option>
                <option value="competency_items">competency_items</option>
                <option value="values_items">values_items</option>
                <option value="development_goals">development_goals</option>
              </select>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">标签</label>
            <div className="flex flex-wrap gap-1.5">
              {['核心指标', '量化指标', '定性指标', '过程指标', '结果指标'].map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
                    (form.tags || []).includes(tag)
                      ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.metric_name?.trim()}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : isEdit ? '保存修改' : '创建指标'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════ */
/*  Categories Section                                         */
/* ═══════════════════════════════════════════════════════════════ */

function CategoriesSection() {
  const [categories, setCategories] = useState<MetricCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MetricCategory | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listMetricCategories();
      if (res.success && Array.isArray(res.data)) {
        setCategories(res.data);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCategories(); }, [fetchCategories]);

  const handleDelete = async (cat: MetricCategory) => {
    if (!confirm(`确定删除分类「${cat.category_name}」？`)) return;
    // Use kernel API to delete since no dedicated delete endpoint
    const { API_BASE_URL } = await import('@/lib/api-config');
    const res = await fetch(`${API_BASE_URL}/api/v1/kernel/objects/${cat._key}`, { method: 'DELETE' });
    if (res.ok) fetchCategories();
  };

  const handleSave = async (data: Partial<MetricCategory>) => {
    if (editing) {
      const { API_BASE_URL } = await import('@/lib/api-config');
      const res = await fetch(`${API_BASE_URL}/api/v1/kernel/objects/${editing._key}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ properties: data }),
      });
      if (res.ok) { setEditing(null); fetchCategories(); }
    } else if (creating) {
      const res = await createMetricCategory(data);
      if (res.success) { setCreating(false); fetchCategories(); }
    }
  };

  const openCreate = () => { setEditing(null); setCreating(true); };
  const openEdit = (cat: MetricCategory) => { setEditing(cat); setCreating(false); };
  const closeModal = () => { setEditing(null); setCreating(false); };

  // Group by type
  const grouped = categories.reduce<Record<string, MetricCategory[]>>((acc, cat) => {
    const type = cat.category_type || 'custom';
    (acc[type] = acc[type] || []).push(cat);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <Database size={14} className="inline mr-1" />
          {categories.length} 个分类
        </div>
        <button onClick={openCreate} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700">
          <Plus size={14} /> 新建分类
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, cats]) => (
            <div key={type}>
              <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                {CAT_TYPE_LABELS[type] || type} ({cats.length})
              </h3>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-left text-xs text-gray-500">
                      <th className="px-4 py-2 font-medium">名称</th>
                      <th className="px-4 py-2 font-medium w-24">类型</th>
                      <th className="px-4 py-2 font-medium w-20">排序</th>
                      <th className="px-4 py-2 font-medium w-20">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cats.map(cat => (
                      <tr key={cat._key} className="border-t border-gray-100 hover:bg-gray-50">
                        <td className="px-4 py-2.5 text-gray-900">{cat.category_name}</td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{cat.category_type}</span>
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{cat.display_order ?? '-'}</td>
                        <td className="px-4 py-2.5">
                          <button onClick={() => openEdit(cat)} className="text-indigo-500 hover:text-indigo-700 text-xs">编辑</button>
                          <button onClick={() => handleDelete(cat)} className="text-red-400 hover:text-red-600 text-xs ml-2">删除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Modal */}
      {(editing || creating) && (
        <CategoryModal
          category={editing}
          onSave={handleSave}
          onClose={closeModal}
        />
      )}
    </div>
  );
}

function CategoryModal({
  category,
  onSave,
  onClose,
}: {
  category: MetricCategory | null;
  onSave: (data: Partial<MetricCategory>) => Promise<void>;
  onClose: () => void;
}) {
  const isEdit = !!category;
  const [form, setForm] = useState({
    category_name: '',
    category_type: 'custom' as CategoryType,
    description: '',
    display_order: 0,
    icon: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (category) {
      setForm({
        category_name: category.category_name,
        category_type: category.category_type || 'custom',
        description: category.description || '',
        display_order: category.display_order || 0,
        icon: category.icon || '',
      });
    }
  }, [category]);

  const handleSubmit = async () => {
    if (!form.category_name.trim()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-900">{isEdit ? '编辑分类' : '新建分类'}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-6 space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">分类名称 *</label>
            <input
              type="text"
              value={form.category_name}
              onChange={e => setForm(prev => ({ ...prev, category_name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">分类类型 *</label>
            <select
              value={form.category_type}
              onChange={e => setForm(prev => ({ ...prev, category_type: e.target.value as CategoryType }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
            >
              {CATEGORY_TYPES.map(t => <option key={t} value={t}>{CAT_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">描述</label>
            <input
              type="text"
              value={form.description}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              placeholder="可选"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">排序</label>
            <input
              type="number"
              value={form.display_order}
              onChange={e => setForm(prev => ({ ...prev, display_order: Number(e.target.value) }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
              min={0}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600">取消</button>
          <button
            onClick={handleSubmit}
            disabled={saving || !form.category_name.trim()}
            className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? '保存中...' : isEdit ? '保存修改' : '创建分类'}
          </button>
        </div>
      </div>
    </div>
  );
}
