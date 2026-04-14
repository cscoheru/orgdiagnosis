'use client';

/**
 * 三力三平台任务汇总面板
 *
 * 6 个维度（三力 + 三平台），每个维度展示原始任务列表
 * 支持 AI 整合：将 18 个客户/产品任务精简为每维度 3-5 个关键任务
 *
 * 放置在战略目标 tab 中。
 */

import { useState, useMemo } from 'react';
import type { PerformancePlan } from '@/types/performance';
import { consolidateTasks } from '@/lib/api/performance-api';
import {
  TrendingUp,
  Target,
  BarChart,
  Users,
  DollarSign,
  Settings,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  RotateCcw,
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
  labelCN: string;
  icon: React.ElementType;
  color: string;
  accentColor: string;
  headerBg: string;
}

const DIMENSIONS: DimensionDef[] = [
  { key: 'salesForce', label: '销售力', labelCN: '销售力', icon: TrendingUp, color: 'text-blue-700', accentColor: 'border-blue-300', headerBg: 'bg-blue-50' },
  { key: 'productForce', label: '产品力', labelCN: '产品力', icon: Target, color: 'text-amber-700', accentColor: 'border-amber-300', headerBg: 'bg-amber-50' },
  { key: 'deliveryForce', label: '交付力', labelCN: '交付力', icon: BarChart, color: 'text-emerald-700', accentColor: 'border-emerald-300', headerBg: 'bg-emerald-50' },
  { key: 'hr', label: '人力资源', labelCN: '人力资源', icon: Users, color: 'text-purple-700', accentColor: 'border-purple-300', headerBg: 'bg-purple-50' },
  { key: 'financeAssets', label: '财务&资产', labelCN: '财务&资产', icon: DollarSign, color: 'text-rose-700', accentColor: 'border-rose-300', headerBg: 'bg-rose-50' },
  { key: 'digitalProcess', label: '数字化&流程', labelCN: '数字化&流程', icon: Settings, color: 'text-cyan-700', accentColor: 'border-cyan-300', headerBg: 'bg-cyan-50' },
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

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [consolidating, setConsolidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI 整合结果: { "销售力": ["task1", "task2"], ... }
  const [consolidated, setConsolidated] = useState<Record<string, string[]> | null>(null);

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

  const handleConsolidate = async () => {
    if (!plan._key) return;
    setConsolidating(true);
    setError(null);
    try {
      const res = await consolidateTasks(plan._key);
      if (res.success && res.data?.consolidated) {
        setConsolidated(res.data.consolidated);
        // 展开所有维度
        setExpanded(new Set(DIMENSIONS.map(d => d.key)));
      } else {
        setError(res.error || 'AI 整合失败');
      }
    } catch {
      setError('AI 整合请求失败');
    } finally {
      setConsolidating(false);
    }
  };

  const resetConsolidated = () => {
    setConsolidated(null);
    setError(null);
  };

  if (rows.length === 0) return null;

  const totalTasks = DIMENSIONS.reduce((sum, dim) => {
    return sum + rows.filter(r => String(r[dim.key] || '').trim()).length;
  }, 0);

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">三力三平台任务汇总</span>
          <span className="text-xs text-gray-400">{rows.length} 个业务单元 · {totalTasks} 条原始任务</span>
        </div>
        <div className="flex items-center gap-2">
          {consolidated && (
            <button
              onClick={resetConsolidated}
              className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <RotateCcw size={11} /> 恢复原始
            </button>
          )}
          <button
            onClick={handleConsolidate}
            disabled={consolidating}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <Sparkles size={12} />
            {consolidating ? 'AI 整合中...' : 'AI 整合任务'}
          </button>
        </div>
      </div>

      {error && <p className="px-5 py-2 text-xs text-red-600 bg-red-50">{error}</p>}

      {/* AI Consolidated Result Banner */}
      {consolidated && (
        <div className="px-5 py-3 bg-indigo-50/50 border-b border-indigo-100">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles size={13} className="text-indigo-500" />
            <span className="text-xs font-semibold text-indigo-700">AI 整合结果</span>
            <span className="text-[10px] text-indigo-400">每维度提炼 3-5 个关键任务</span>
          </div>
        </div>
      )}

      {/* Dimensions */}
      <div className="divide-y divide-gray-100">
        {DIMENSIONS.map((dim) => {
          const isExpanded = expanded.has(dim.key);

          // 按客户群分组收集该维度的原始内容
          const groupedItems = rows
            .map(r => ({
              group: r.customerGroup,
              product: r.product,
              revenue: r.revenueTarget,
              content: String(r[dim.key] || '').trim(),
            }))
            .filter(item => item.content);

          const hasContent = groupedItems.length > 0;

          // AI 整合后的关键任务
          const keyTasks = consolidated?.[dim.labelCN];

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
                    {groupedItems.length} 条
                  </span>
                ) : (
                  <span className="text-[10px] text-gray-400 italic">暂无</span>
                )}
                {keyTasks && (
                  <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                    已整合为 {keyTasks.length} 个关键任务
                  </span>
                )}
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div className={`px-5 pb-4 border-l-4 ${dim.accentColor} ml-7`}>
                  {/* AI Consolidated Tasks (priority display) */}
                  {keyTasks && keyTasks.length > 0 && (
                    <div className="mb-3 space-y-1.5">
                      <span className="text-[10px] font-semibold text-indigo-600 uppercase tracking-wide">关键任务</span>
                      {keyTasks.map((task, i) => (
                        <div key={i} className="flex items-start gap-2 bg-white/90 rounded-lg border border-indigo-100 px-3 py-2">
                          <span className="flex-shrink-0 w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                            {i + 1}
                          </span>
                          <p className="text-xs text-gray-800 leading-relaxed">{task}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Original tasks grouped by customer */}
                  <div className="space-y-2">
                    <span className="text-[10px] text-gray-400">
                      {consolidated ? '原始任务（点击展开）' : '按客户群/产品分组'}
                    </span>
                    {groupedItems.map((item, i) => (
                      <div key={i} className="bg-white/80 rounded-lg border border-gray-100 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                            {item.group}
                          </span>
                          <span className="text-[10px] text-gray-500">{item.product}</span>
                          <span className="text-[10px] text-gray-400 ml-auto">{item.revenue}万</span>
                        </div>
                        <p className="text-[11px] text-gray-600 leading-relaxed">{item.content}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
