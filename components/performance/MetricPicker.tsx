'use client';

/**
 * MetricPicker — 弹出式指标选择器
 *
 * 嵌入到组织绩效/岗位绩效的编辑流程中。
 * 按上下文自动过滤指标库，用户点击选中后自动填充字段。
 * 搜索无匹配时显示"新建指标"内联表单。
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Pencil, X, Database, Plus, Check, Save } from 'lucide-react';
import { listMetricTemplates, createMetricTemplate } from '@/lib/api/performance-api';
import type {
  MetricTemplate,
  MetricDimension,
  MetricLevel,
  OrgDimensionMapping,
  PosSectionMapping,
} from '@/types/performance';

/* ── Types ── */

export type PickerContext =
  | { type: 'org'; dimension: OrgDimensionMapping }
  | { type: 'pos'; section: PosSectionMapping }
  | { type: 'company'; bscDimension: MetricDimension };

interface MetricPickerProps {
  context: PickerContext;
  onSelect: (template: MetricTemplate) => void;
  onManualAdd: () => void;
  children: React.ReactNode;
}

/* ── Helpers ── */

const DIMENSION_OPTIONS: MetricDimension[] = ['财务', '客户', '内部流程', '学习与成长', '战略', '运营', '人才发展', '胜任力'];

function inferDimension(ctx: PickerContext): MetricDimension {
  if (ctx.type === 'company') return ctx.bscDimension;
  if (ctx.type === 'org') {
    const map: Record<string, MetricDimension> = {
      strategic_kpis: '财务',
      management_indicators: '客户',
      team_development: '学习与成长',
      engagement_compliance: '内部流程',
    };
    return map[ctx.dimension] || '财务';
  }
  // pos — infer from section
  const map: Record<string, MetricDimension> = {
    performance_goals: '财务',
    competency_items: '胜任力',
    values_items: '运营',
    development_goals: '人才发展',
  };
  return map[ctx.section] || '财务';
}

function inferLevel(ctx: PickerContext): MetricLevel {
  if (ctx.type === 'company') return '组织级';
  if (ctx.type === 'org') return '部门级';
  return '岗位级';
}

/* ── Component ── */

export default function MetricPicker({ context, onSelect, onManualAdd, children }: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  // Inline create state
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    metric_name: '',
    dimension: '' as MetricDimension | '',
    weight: 10,
    target: '',
    criteria: '',
  });
  const [creating, setCreating] = useState(false);
  const [createSuccess, setCreateSuccess] = useState(false);

  /* ── Fetch on open ── */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    const params: Record<string, string | number> = { limit: 100 };

    if (context.type === 'org') {
      params.org_dim = context.dimension;
    } else if (context.type === 'company') {
      params.dimension = context.bscDimension;
      params.level = '组织级';
    } else {
      params.pos_sec = context.section;
      params.level = '岗位级';
    }

    listMetricTemplates(params as Parameters<typeof listMetricTemplates>[0])
      .then(res => {
        if (!cancelled && res.success && res.data) {
          setTemplates(res.data.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [open, context]);

  /* ── Close on outside click ── */

  useEffect(() => {
    if (!open) return;

    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
        setShowCreate(false);
        setCreateSuccess(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Client-side search — precise match only ── */

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase().trim();
    // Precise: metric_name must contain the keyword
    return templates.filter(t => t.metric_name.toLowerCase().includes(q));
  }, [templates, search]);

  const hasNoResults = !loading && filtered.length === 0 && search.trim().length > 0;

  /* ── Handlers ── */

  const handleSelect = (tpl: MetricTemplate) => {
    onSelect(tpl);
    setOpen(false);
    setSearch('');
  };

  const handleManualAdd = () => {
    onManualAdd();
    setOpen(false);
    setSearch('');
  };

  const openCreateForm = () => {
    setCreateForm({
      metric_name: search.trim(),
      dimension: inferDimension(context),
      weight: 10,
      target: '',
      criteria: '',
    });
    setShowCreate(true);
    setCreateSuccess(false);
  };

  const handleCreate = async () => {
    if (!createForm.metric_name.trim()) return;
    setCreating(true);

    const orgDim = context.type === 'org' ? context.dimension
      : context.type === 'company' ? 'strategic_kpis' : '';
    const posSec = context.type === 'pos' ? context.section : '';

    const res = await createMetricTemplate({
      metric_name: createForm.metric_name.trim(),
      dimension: createForm.dimension || inferDimension(context),
      applicable_level: inferLevel(context),
      default_weight: createForm.weight,
      target_template: createForm.target,
      evaluation_criteria: createForm.criteria,
      source: 'user_created',
      status: 'draft',
      tags: [],
      industries: [],
      ...(orgDim ? { org_dimension_mapping: orgDim as OrgDimensionMapping } : {}),
      ...(posSec ? { pos_section_mapping: posSec as PosSectionMapping } : {}),
    });

    if (res.success) {
      setCreateSuccess(true);
      setTimeout(() => {
        setShowCreate(false);
        setCreateSuccess(false);
      }, 1500);
    }
    setCreating(false);
  };

  /* ── Render ── */

  return (
    <div ref={containerRef} className="relative inline-block">
      <div onClick={() => setOpen(prev => !prev)} className="cursor-pointer">
        {children}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-80 bg-white border border-gray-200 rounded-lg shadow-lg">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索指标名称..."
                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => { setSearch(''); setShowCreate(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Content area */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : showCreate ? (
              /* Inline create form */
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-gray-700">新建指标 <span className="text-gray-400 font-normal">(草稿)</span></p>

                <input
                  type="text"
                  value={createForm.metric_name}
                  onChange={e => setCreateForm(prev => ({ ...prev, metric_name: e.target.value }))}
                  placeholder="指标名称"
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />

                <select
                  value={createForm.dimension}
                  onChange={e => setCreateForm(prev => ({ ...prev, dimension: e.target.value as MetricDimension }))}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                >
                  <option value="">选择维度</option>
                  {DIMENSION_OPTIONS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>

                <div className="flex gap-2">
                  <input
                    type="number"
                    value={createForm.weight}
                    onChange={e => setCreateForm(prev => ({ ...prev, weight: Number(e.target.value) }))}
                    placeholder="权重"
                    min={1}
                    max={100}
                    className="w-20 px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={createForm.target}
                    onChange={e => setCreateForm(prev => ({ ...prev, target: e.target.value }))}
                    placeholder="目标值 (如 >=95%)"
                    className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                <textarea
                  value={createForm.criteria}
                  onChange={e => setCreateForm(prev => ({ ...prev, criteria: e.target.value }))}
                  placeholder="评估标准 (可选)"
                  rows={2}
                  className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
                />

                {createSuccess ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 py-1">
                    <Check size={13} /> 已保存为草稿，发布后可在搜索中找到
                  </div>
                ) : (
                  <div className="flex gap-2 pt-1">
                    <button
                      onClick={handleCreate}
                      disabled={!createForm.metric_name.trim() || creating}
                      className="flex items-center gap-1 px-3 py-1.5 text-xs text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 rounded transition-colors"
                    >
                      <Save size={11} /> {creating ? '保存中...' : '保存草稿'}
                    </button>
                    <button
                      onClick={() => setShowCreate(false)}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 rounded transition-colors"
                    >
                      取消
                    </button>
                  </div>
                )}
              </div>
            ) : hasNoResults ? (
              /* No results — offer create */
              <div className="py-6 text-center">
                <Database size={20} className="mx-auto mb-2 text-gray-300" />
                <p className="text-xs text-gray-500 mb-3">未找到匹配指标</p>
                <button
                  onClick={openCreateForm}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                >
                  <Plus size={12} /> 新建指标
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <Database size={20} className="mx-auto mb-1.5 opacity-40" />
                <p>暂无可用指标</p>
              </div>
            ) : (
              filtered.map(tpl => (
                <button
                  key={tpl._key}
                  onClick={() => handleSelect(tpl)}
                  className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                >
                  <div className="text-xs font-medium text-gray-900 truncate">
                    {tpl.metric_name}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-gray-500">
                      权重 {tpl.default_weight}%
                    </span>
                    {tpl.unit && (
                      <span className="text-[10px] text-gray-400">{tpl.unit}</span>
                    )}
                    {tpl.target_template && (
                      <span className="text-[10px] text-indigo-500 truncate max-w-[140px]">
                        目标: {tpl.target_template}
                      </span>
                    )}
                  </div>
                  {tpl.evaluation_criteria && (
                    <div className="text-[10px] text-gray-400 mt-0.5 line-clamp-1">
                      {tpl.evaluation_criteria}
                    </div>
                  )}
                </button>
              ))
            )}
          </div>

          {/* Manual add footer */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={handleManualAdd}
              className="w-full flex items-center justify-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            >
              <Pencil size={11} /> 手动输入
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
