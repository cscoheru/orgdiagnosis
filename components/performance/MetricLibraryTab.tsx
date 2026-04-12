'use client';

/**
 * Tab: 指标库 (Metrics Library)
 *
 * 绩效指标库浏览器：搜索/过滤/卡片列表。
 * 支持从指标库应用到绩效方案。
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  listMetricTemplates,
  applyMetricTemplates,
  aiSuggestMetrics,
  deleteMetricTemplate,
} from '@/lib/api/performance-api';
import type {
  PerformancePlan,
  MetricTemplate,
  MetricDimension,
  MetricLevel,
} from '@/types/performance';
import {
  Search, Filter, Database, Sparkles, CheckSquare, X,
  ChevronDown, BookOpen, Tag, Target, BarChart3, Lightbulb,
  Trash2, ExternalLink,
} from 'lucide-react';

interface Props {
  projectId: string;
  activePlan: PerformancePlan | null;
  onRefresh: () => Promise<void>;
}

/* ── Constants ── */

const DIMENSIONS: MetricDimension[] = ['财务', '客户', '内部流程', '学习与成长', '战略', '运营', '人才发展', '胜任力'];
const LEVELS: MetricLevel[] = ['组织级', '部门级', '岗位级'];
const INDUSTRIES = ['建筑工程', '消费品', '制造业', '科技互联网', '金融', '房地产', '医疗健康'];

const DIM_COLORS: Record<string, string> = {
  '财务': 'bg-green-100 text-green-700',
  '客户': 'bg-blue-100 text-blue-700',
  '内部流程': 'bg-amber-100 text-amber-700',
  '学习与成长': 'bg-purple-100 text-purple-700',
  '战略': 'bg-red-100 text-red-700',
  '运营': 'bg-cyan-100 text-cyan-700',
  '人才发展': 'bg-pink-100 text-pink-700',
  '胜任力': 'bg-indigo-100 text-indigo-700',
};

/* ── Component ── */

export default function MetricLibraryTab({ projectId, activePlan, onRefresh }: Props) {
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [keyword, setKeyword] = useState('');
  const [dimension, setDimension] = useState('');
  const [level, setLevel] = useState('');
  const [industry, setIndustry] = useState('');

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Apply
  const [applying, setApplying] = useState(false);
  const [applyResult, setApplyResult] = useState<string | null>(null);

  // AI suggest
  const [suggesting, setSuggesting] = useState(false);
  const [suggestions, setSuggestions] = useState<unknown[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Detail view
  const [detailKey, setDetailKey] = useState<string | null>(null);

  /* ── Fetch ── */

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMetricTemplates({
        keyword: keyword || undefined,
        dimension: dimension || undefined,
        level: level || undefined,
        industry: industry || undefined,
        limit: 100,
      });
      if (res.success && res.data) {
        setTemplates(res.data.data);
        setTotal(res.data.total);
      } else {
        setError(res.error || '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [keyword, dimension, level, industry]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const detail = useMemo(
    () => detailKey ? templates.find(t => t._key === detailKey) : null,
    [detailKey, templates],
  );

  /* ── Handlers ── */

  const toggleSelect = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearSelection = () => {
    setSelected(new Set());
    setApplyResult(null);
  };

  const handleApply = async () => {
    if (!activePlan || selected.size === 0) return;
    // TODO: 需要选择目标部门; 当前使用方案关联的第一个部门
    setApplying(true);
    setError(null);
    try {
      const res = await applyMetricTemplates(activePlan._key, '', Array.from(selected), 'org');
      if (res.success) {
        setApplyResult(res.data?.org_perf_key ? `已创建组织绩效 ${res.data.org_perf_key}` : '已应用');
        setSelected(new Set());
        await onRefresh();
      } else {
        setError(res.error || '应用失败');
      }
    } finally {
      setApplying(false);
    }
  };

  const handleAiSuggest = async () => {
    if (!activePlan) return;
    setSuggesting(true);
    setError(null);
    try {
      const res = await aiSuggestMetrics(activePlan._key, '', '');
      if (res.success && res.data) {
        setSuggestions(res.data.suggestions);
        setShowSuggestions(true);
      } else {
        setError(res.error || 'AI 建议失败');
      }
    } finally {
      setSuggesting(false);
    }
  };

  const handleDelete = async (key: string) => {
    const tpl = templates.find(t => t._key === key);
    if (!tpl || tpl.source !== 'user_created') return;
    if (!confirm(`确定删除指标「${tpl.metric_name}」？仅用户创建的指标可删除。`)) return;
    try {
      const res = await deleteMetricTemplate(key);
      if (res.success) await fetchTemplates();
      else setError(res.error || '删除失败');
    } catch {
      setError('删除失败');
    }
  };

  const addSuggestionToSelection = (_sug: Record<string, unknown>) => {
    // AI 建议暂不加入选中，仅展示
  };

  /* ── Empty state ── */

  if (!activePlan) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Database size={40} className="mx-auto mb-3 opacity-50" />
        <p>请先在「方案概览」中创建并选择一个绩效方案</p>
      </div>
    );
  }

  /* ── Render ── */

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            placeholder="搜索指标名称..."
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={dimension}
          onChange={e => setDimension(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全部维度</option>
          {DIMENSIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
        <select
          value={level}
          onChange={e => setLevel(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全部层级</option>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
        <select
          value={industry}
          onChange={e => setIndustry(e.target.value)}
          className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">全部行业</option>
          {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Database size={14} />
          <span>{total} 个指标</span>
          {selected.size > 0 && (
            <span className="text-indigo-600 font-medium">
              &middot; 已选 {selected.size} 个
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <button
                onClick={clearSelection}
                className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                <X size={12} /> 清除选择
              </button>
              <button
                onClick={handleApply}
                disabled={applying}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
              >
                <Target size={12} />
                {applying ? '应用中...' : `应用到方案 (${selected.size})`}
              </button>
            </>
          )}
          <button
            onClick={handleAiSuggest}
            disabled={suggesting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 disabled:opacity-50"
          >
            <Sparkles size={12} />
            {suggesting ? 'AI 建议中...' : 'AI 建议指标'}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {applyResult && (
        <p className="text-sm text-green-600">{applyResult}</p>
      )}

      {/* AI Suggestions Panel */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="border border-indigo-200 rounded-xl bg-indigo-50/50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-semibold text-indigo-700 flex items-center gap-1.5">
              <Sparkles size={14} /> AI 建议指标 ({suggestions.length})
            </h4>
            <button onClick={() => setShowSuggestions(false)} className="text-gray-400 hover:text-gray-600">
              <X size={14} />
            </button>
          </div>
          <div className="space-y-2">
            {(suggestions as Record<string, string>[]).map((s, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm bg-white rounded-lg p-2.5 border border-indigo-100">
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{s.metric_name || ''}</span>
                  <div className="flex gap-1.5 mt-1">
                    {s.dimension && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${DIM_COLORS[s.dimension] || 'bg-gray-100 text-gray-600'}`}>
                        {s.dimension}
                      </span>
                    )}
                    {s.applicable_level && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {s.applicable_level}
                      </span>
                    )}
                  </div>
                  {s.reason && (
                    <p className="text-xs text-gray-500 mt-1">{s.reason}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-indigo-400 mt-2">建议仅供参考，确认后可保存到指标库复用</p>
        </div>
      )}

      {/* Template Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Database size={40} className="mx-auto mb-3 opacity-50" />
          <p>未找到匹配的指标模板</p>
          <p className="text-xs mt-1">尝试调整搜索条件或使用 AI 建议</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {templates.map(tpl => {
            const isSelected = selected.has(tpl._key);
            const isDetail = detailKey === tpl._key;
            const dimColor = DIM_COLORS[tpl.dimension] || 'bg-gray-100 text-gray-600';

            return (
              <div
                key={tpl._key}
                className={`border rounded-xl p-3 transition-all cursor-pointer hover:shadow-sm ${
                  isSelected
                    ? 'border-indigo-300 bg-indigo-50/50 ring-1 ring-indigo-200'
                    : 'border-gray-200 bg-white'
                }`}
                onClick={() => setDetailKey(isDetail ? null : tpl._key)}
              >
                <div className="flex items-start gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); toggleSelect(tpl._key); }}
                    className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                      isSelected ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'
                    }`}
                  >
                    {isSelected && <CheckSquare size={10} className="text-white" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-sm text-gray-900 truncate">
                        {tpl.metric_name}
                      </span>
                      {tpl.is_verified && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-green-100 text-green-700">已审核</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${dimColor}`}>
                        {tpl.dimension}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {tpl.applicable_level}
                      </span>
                      {tpl.industries.length > 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                          {tpl.industries.slice(0, 2).join(', ')}
                          {tpl.industries.length > 2 && ` +${tpl.industries.length - 2}`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Detail (expanded) */}
                {isDetail && (
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2 text-xs">
                    {tpl.evaluation_criteria && (
                      <div>
                        <span className="font-medium text-gray-600">评估标准：</span>
                        <span className="text-gray-700 ml-1">{tpl.evaluation_criteria}</span>
                      </div>
                    )}
                    {tpl.metric_formula && (
                      <div>
                        <span className="font-medium text-gray-600">计算公式：</span>
                        <span className="text-gray-700 ml-1">{tpl.metric_formula}</span>
                      </div>
                    )}
                    <div className="flex gap-4 text-gray-500">
                      {tpl.default_weight && (
                        <span className="flex items-center gap-0.5">
                          <BarChart3 size={10} /> 权重 {tpl.default_weight}%
                        </span>
                      )}
                      {tpl.unit && (
                        <span className="flex items-center gap-0.5">
                          <Target size={10} /> {tpl.unit}
                        </span>
                      )}
                      {tpl.target_template && (
                        <span className="flex items-center gap-0.5">
                          <Target size={10} /> {tpl.target_template}
                        </span>
                      )}
                    </div>
                    {tpl.org_dimension_mapping && (
                      <div className="text-gray-400">
                        → 映射到 Org_Performance.{tpl.org_dimension_mapping}
                      </div>
                    )}
                    {tpl.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {tpl.tags.map(tag => (
                          <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-500">
                            <Tag size={8} className="inline mr-0.5" />{tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-gray-400">
                        来源: {tpl.source === 'best_practice' ? '最佳实践' : tpl.source === 'ai_generated' ? 'AI生成' : '用户创建'}
                        {tpl.usage_count ? ` · 引用 ${tpl.usage_count} 次` : ''}
                      </span>
                      {tpl.source === 'user_created' && (
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(tpl._key); }}
                          className="text-gray-300 hover:text-red-500 transition-colors"
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
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
