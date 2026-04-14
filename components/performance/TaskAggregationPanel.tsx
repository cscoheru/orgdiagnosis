'use client';

/**
 * 三力三平台任务汇总面板
 *
 * 纵轴：6 个维度（三力 + 三平台）
 * 每个维度下按客户群分组展示原始任务内容
 * 支持编辑汇总后的内容
 *
 * 放置在战略目标 tab 中。
 */

import { useState, useMemo } from 'react';
import type { PerformancePlan } from '@/types/performance';
import {
  TrendingUp,
  Target,
  BarChart,
  Users,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronRight,
  Edit3,
  Save,
  X,
  Layers,
} from 'lucide-react';

interface Props {
  plan: PerformancePlan;
}

interface ActionRow {
  seqNumber: number;
  customerGroup: string;
  product: string;
  revenueTarget: number;
  salesForce: string;
  productForce: string;
  deliveryForce: string;
  hr: string;
  financeAssets: string;
  digitalProcess: string;
}

/* ── 6 个维度定义 ── */

interface DimensionDef {
  key: keyof ActionRow;
  label: string;
  icon: React.ElementType;
  color: string;
  accentColor: string;
  headerBg: string;
  itemBg: string;
  summaryHint: string;
}

const DIMENSIONS: DimensionDef[] = [
  {
    key: 'salesForce',
    label: '销售力',
    icon: TrendingUp,
    color: 'text-blue-700',
    accentColor: 'border-blue-300',
    headerBg: 'bg-blue-50',
    itemBg: 'bg-blue-25',
    summaryHint: '按客户/渠道/区域归类销售策略与打法',
  },
  {
    key: 'productForce',
    label: '产品力',
    icon: Target,
    color: 'text-amber-700',
    accentColor: 'border-amber-300',
    headerBg: 'bg-amber-50',
    itemBg: 'bg-amber-25',
    summaryHint: '按项目、品类、新老产品、技术方向整合',
  },
  {
    key: 'deliveryForce',
    label: '交付力',
    icon: BarChart,
    color: 'text-emerald-700',
    accentColor: 'border-emerald-300',
    headerBg: 'bg-emerald-50',
    itemBg: 'bg-emerald-25',
    summaryHint: '从供应链→生产→前端交付的任务汇总',
  },
  {
    key: 'hr',
    label: '人力资源（人才平台）',
    icon: Users,
    color: 'text-purple-700',
    accentColor: 'border-purple-300',
    headerBg: 'bg-purple-50',
    itemBg: 'bg-purple-25',
    summaryHint: '三力产生的人才需求：招聘、培养、晋升、淘汰',
  },
  {
    key: 'financeAssets',
    label: '财务&资产（财务平台）',
    icon: DollarSign,
    color: 'text-rose-700',
    accentColor: 'border-rose-300',
    headerBg: 'bg-rose-50',
    itemBg: 'bg-rose-25',
    summaryHint: '三力及人资的财务开支：四费（销售、管理、研发、财务费用）',
  },
  {
    key: 'digitalProcess',
    label: '数字化&流程（数字化平台）',
    icon: Settings,
    color: 'text-cyan-700',
    accentColor: 'border-cyan-300',
    headerBg: 'bg-cyan-50',
    itemBg: 'bg-cyan-25',
    summaryHint: '流程优化带来的数字化系统新建、升级、运维项目',
  },
];

/* ── 组件 ── */

export default function TaskAggregationPanel({ plan }: Props) {
  const rows = useMemo<ActionRow[]>(() => {
    const ctx = (plan.properties.business_context as Record<string, string>) || {};
    const raw = ctx.action_plans;
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [plan.properties.business_context]);

  // 按维度展开状态
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // 编辑中的维度
  const [editingDim, setEditingDim] = useState<string | null>(null);
  // 编辑内容
  const [editContent, setEditContent] = useState('');
  // 已保存的汇总覆盖内容
  const [savedSummaries, setSavedSummaries] = useState<Record<string, string>>({});

  // 自动展开有内容的维度
  useMemo(() => {
    if (expanded.size === 0 && rows.length > 0) {
      const withContent = DIMENSIONS
        .filter(dim => rows.some(r => String(r[dim.key] || '').trim()))
        .map(dim => dim.key);
      if (withContent.length > 0) {
        setExpanded(new Set(withContent));
      }
    }
  }, [rows]);

  const toggleExpand = (dimKey: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(dimKey)) next.delete(dimKey);
      else next.add(dimKey);
      return next;
    });
  };

  const startEdit = (dimKey: string) => {
    // 合并所有客户群的该维度内容作为初始编辑值
    const allItems = rows
      .map(r => ({ group: r.customerGroup, product: r.product, content: String(r[dimKey as keyof ActionRow] || '').trim() }))
      .filter(item => item.content);
    const text = allItems
      .map(item => `[${item.group} / ${item.product}]\n${item.content}`)
      .join('\n\n');
    setEditContent(savedSummaries[dimKey] || text);
    setEditingDim(dimKey);
  };

  const saveEdit = (dimKey: string) => {
    setSavedSummaries(prev => ({ ...prev, [dimKey]: editContent }));
    setEditingDim(null);
    setEditContent('');
  };

  const cancelEdit = () => {
    setEditingDim(null);
    setEditContent('');
  };

  if (rows.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <Layers size={14} className="text-indigo-500" />
        <span className="text-sm font-semibold text-gray-900">三力三平台任务汇总</span>
        <span className="text-xs text-gray-400">{rows.length} 个业务单元</span>
      </div>

      {/* Dimensions */}
      <div className="divide-y divide-gray-100">
        {DIMENSIONS.map((dim) => {
          const isExpanded = expanded.has(dim.key);
          const isEditing = editingDim === dim.key;

          // 按客户群分组收集该维度的内容
          const groupedItems = rows
            .map(r => ({
              group: r.customerGroup,
              product: r.product,
              revenue: r.revenueTarget,
              content: String(r[dim.key] || '').trim(),
            }))
            .filter(item => item.content);

          const hasContent = groupedItems.length > 0;

          // 如果有保存的汇总，显示保存内容
          const savedSummary = savedSummaries[dim.key];

          return (
            <div key={dim.key} className={isExpanded ? dim.headerBg : ''}>
              {/* Dimension Header Row */}
              <div
                className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-gray-50/50 transition-colors"
                onClick={() => toggleExpand(dim.key)}
              >
                {isExpanded ? (
                  <ChevronDown size={14} className="text-gray-400 flex-shrink-0" />
                ) : (
                  <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                )}
                <dim.icon size={15} className={dim.color} />
                <span className={`text-xs font-semibold ${dim.color}`}>{dim.label}</span>
                {hasContent ? (
                  <span className="text-[10px] text-gray-500 bg-white/80 px-1.5 py-0.5 rounded">
                    {groupedItems.length} 条任务
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">暂无任务</span>
                )}
                {!isExpanded && savedSummary && (
                  <span className="text-[10px] text-green-600 bg-green-50 px-1.5 py-0.5 rounded">已汇总</span>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className={`px-5 pb-4 border-l-4 ${dim.accentColor} ml-7`}>
                  {/* Summary hint */}
                  <p className="text-[10px] text-gray-400 mb-3">{dim.summaryHint}</p>

                  {isEditing ? (
                    /* Edit Mode */
                    <div className="space-y-2">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        rows={8}
                        className="w-full px-3 py-2 text-xs leading-relaxed bg-white border border-gray-200 rounded-lg resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        placeholder={`在此汇总${dim.label}的关键任务...`}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={cancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-gray-500 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
                        >
                          <X size={10} /> 取消
                        </button>
                        <button
                          onClick={() => saveEdit(dim.key)}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
                        >
                          <Save size={10} /> 保存汇总
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Display Mode */
                    <div className="space-y-3">
                      {savedSummary ? (
                        /* Show saved summary */
                        <div className="bg-white/80 rounded-lg border border-gray-200 p-3">
                          <p className="text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">{savedSummary}</p>
                        </div>
                      ) : (
                        /* Show per-group items */
                        <div className="space-y-2">
                          {groupedItems.map((item, i) => (
                            <div key={i} className="bg-white/80 rounded-lg border border-gray-100 px-3 py-2">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                  {item.group}
                                </span>
                                <span className="text-[10px] text-gray-500">{item.product}</span>
                                <span className="text-[10px] text-gray-400 ml-auto">{item.revenue}万</span>
                              </div>
                              <p className="text-[11px] text-gray-700 leading-relaxed">{item.content}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Edit button */}
                      <div className="flex justify-end">
                        <button
                          onClick={() => startEdit(dim.key)}
                          className="flex items-center gap-1 px-3 py-1.5 text-[10px] text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          <Edit3 size={10} />
                          {savedSummary ? '编辑汇总' : '汇总编辑'}
                        </button>
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
  );
}
