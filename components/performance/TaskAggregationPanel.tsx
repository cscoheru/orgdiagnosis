'use client';

/**
 * 部门任务归集面板
 *
 * 读取 plan.business_context.action_plans（step4.actionPlanTable JSON），
 * 按 3力3平台纵向汇总，展示每个客户群/产品的任务分配。
 */

import { useMemo } from 'react';
import type { PerformancePlan } from '@/types/performance';
import { LayoutGrid, TrendingUp, Target, BarChart, Users, DollarSign, Settings } from 'lucide-react';

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

const FORCE_COLS = [
  { key: 'salesForce', label: '销售力', icon: TrendingUp, color: 'bg-blue-600' },
  { key: 'productForce', label: '产品力', icon: Target, color: 'bg-amber-600' },
  { key: 'deliveryForce', label: '交付力', icon: BarChart, color: 'bg-emerald-600' },
] as const;

const PLATFORM_COLS = [
  { key: 'hr', label: '人力', icon: Users, color: 'bg-purple-600' },
  { key: 'financeAssets', label: '财务&资产', icon: DollarSign, color: 'bg-rose-600' },
  { key: 'digitalProcess', label: '数字化&流程', icon: Settings, color: 'bg-cyan-600' },
] as const;

function aggregateColumn(rows: ActionRow[], colKey: keyof ActionRow): string {
  const items = rows
    .map((r) => r[colKey])
    .filter(Boolean)
    .map((v, i) => `${i + 1}. ${v}`);
  return items.join('\n');
}

function SummaryRow({ label, rows, cols, icon: Icon, color }: {
  label: string;
  rows: ActionRow[];
  cols: readonly { key: keyof ActionRow; label: string; color: string }[];
  icon: React.ElementType;
  color: string;
}) {
  return (
    <tr className="bg-gray-50 border-t-2 border-gray-300">
      <td className="px-3 py-2 text-xs font-semibold text-gray-700" colSpan={2}>
        <span className="flex items-center gap-1.5">
          <Icon size={12} className="text-gray-500" />
          {label}（纵向汇总）
        </span>
      </td>
      {cols.map((col) => {
        const items = rows.map((r) => r[col.key]).filter(Boolean);
        return (
          <td key={col.key} className="px-2 py-2 text-xs text-gray-700 align-top">
            {items.length === 0 ? (
              <span className="text-gray-400 italic">—</span>
            ) : (
              <ul className="space-y-0.5">
                {items.map((item, i) => (
                  <li key={i} className="leading-tight">{item}</li>
                ))}
              </ul>
            )}
          </td>
        );
      })}
    </tr>
  );
}

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

  if (rows.length === 0) return null;

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <div className="flex items-center gap-2">
          <LayoutGrid size={14} className="text-indigo-500" />
          <span className="text-sm font-semibold text-gray-900">部门任务归集</span>
          <span className="text-xs text-gray-400">{rows.length} 个业务单元</span>
        </div>
        <span className="text-[10px] text-gray-400">按三力三平台纵向汇总</span>
      </div>

      <div className="overflow-x-auto">
        {/* 3力 */}
        <div className="px-4 pt-3 pb-1">
          <h5 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
            3力（业务层）
          </h5>
          <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr>
                <th className="px-3 py-1.5 bg-gray-100 text-left text-gray-600 border border-gray-200 w-28">客户群</th>
                <th className="px-3 py-1.5 bg-gray-100 text-left text-gray-600 border border-gray-200 w-28">产品</th>
                <th className="px-3 py-1.5 bg-gray-100 text-right text-gray-600 border border-gray-200 w-20">营收目标</th>
                {FORCE_COLS.map((col) => (
                  <th key={col.key} className={`px-2 py-1.5 ${col.color} text-white text-left border border-gray-200`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.seqNumber} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800 font-medium border border-gray-100">{row.customerGroup}</td>
                  <td className="px-3 py-2 text-gray-600 border border-gray-100">{row.product}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800 border border-gray-100">{row.revenueTarget}万</td>
                  {FORCE_COLS.map((col) => (
                    <td key={col.key} className="px-2 py-2 text-gray-700 border border-gray-100 align-top whitespace-pre-line">{row[col.key] || <span className="text-gray-300">—</span>}</td>
                  ))}
                </tr>
              ))}
              <SummaryRow label="3力汇总" rows={rows} cols={FORCE_COLS} icon={TrendingUp} color="bg-blue-600" />
            </tbody>
          </table>
        </div>

        {/* 3平台 */}
        <div className="px-4 pt-3 pb-4">
          <h5 className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
            3平台（支撑层）
          </h5>
          <table className="w-full text-xs border-collapse border border-gray-200 rounded-lg overflow-hidden">
            <thead>
              <tr>
                <th className="px-3 py-1.5 bg-gray-100 text-left text-gray-600 border border-gray-200 w-28">客户群</th>
                <th className="px-3 py-1.5 bg-gray-100 text-left text-gray-600 border border-gray-200 w-28">产品</th>
                <th className="px-3 py-1.5 bg-gray-100 text-right text-gray-600 border border-gray-200 w-20">营收目标</th>
                {PLATFORM_COLS.map((col) => (
                  <th key={col.key} className={`px-2 py-1.5 ${col.color} text-white text-left border border-gray-200`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.seqNumber} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-800 font-medium border border-gray-100">{row.customerGroup}</td>
                  <td className="px-3 py-2 text-gray-600 border border-gray-100">{row.product}</td>
                  <td className="px-3 py-2 text-right font-mono text-gray-800 border border-gray-100">{row.revenueTarget}万</td>
                  {PLATFORM_COLS.map((col) => (
                    <td key={col.key} className="px-2 py-2 text-gray-700 border border-gray-100 align-top whitespace-pre-line">{row[col.key] || <span className="text-gray-300">—</span>}</td>
                  ))}
                </tr>
              ))}
              <SummaryRow label="3平台汇总" rows={rows} cols={PLATFORM_COLS} icon={Settings} color="bg-purple-600" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
