'use client';

/**
 * MetricPicker — 弹出式指标选择器
 *
 * 嵌入到组织绩效/岗位绩效的编辑流程中。
 * 按上下文自动过滤指标库，用户点击选中后自动填充字段。
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Pencil, X, Database } from 'lucide-react';
import { listMetricTemplates } from '@/lib/api/performance-api';
import type {
  MetricTemplate,
  OrgDimensionMapping,
  PosSectionMapping,
} from '@/types/performance';

/* ── Types ── */

type PickerContext =
  | { type: 'org'; dimension: OrgDimensionMapping }
  | { type: 'pos'; section: PosSectionMapping };

interface MetricPickerProps {
  context: PickerContext;
  onSelect: (template: MetricTemplate) => void;
  onManualAdd: () => void;
  children: React.ReactNode;
}

/* ── Component ── */

export default function MetricPicker({ context, onSelect, onManualAdd, children }: MetricPickerProps) {
  const [open, setOpen] = useState(false);
  const [templates, setTemplates] = useState<MetricTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  /* ── Fetch on open ── */

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);

    const params: Record<string, string | number> = { limit: 100 };

    if (context.type === 'org') {
      params.org_dim = context.dimension;
      params.level = '部门级';
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
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  /* ── Client-side search ── */

  const filtered = useMemo(() => {
    if (!search.trim()) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      t =>
        t.metric_name.toLowerCase().includes(q) ||
        (t.evaluation_criteria && t.evaluation_criteria.toLowerCase().includes(q)) ||
        (t.dimension && t.dimension.includes(q)),
    );
  }, [templates, search]);

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
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <Database size={20} className="mx-auto mb-1.5 opacity-40" />
                <p>{search ? '无匹配指标' : '暂无可用指标'}</p>
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
