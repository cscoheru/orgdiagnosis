'use client';

/**
 * 战略目标汇总表
 *
 * 从 step3 的 matrixData（客户×产品矩阵）计算出 5 个关键数据：
 * 达标目标、新客户汇总、老客户汇总、新产品汇总、老产品汇总
 * 为组织绩效的公司层面绩效提供数据来源。
 */

import { useMemo } from 'react';
import type { PerformancePlan } from '@/types/performance';
import { Target, TrendingUp, Users, Package, Archive } from 'lucide-react';

interface Props {
  plan: PerformancePlan;
}

interface MatrixData {
  oldClients: string[];
  newClients: string[];
  oldProducts: string[];
  newProducts: string[];
  values: Record<string, number>; // "client_product": amount
}

function calcSum(values: Record<string, number>, includeSet: Set<string>, keyType: 'client' | 'product'): number {
  let sum = 0;
  for (const [key, amount] of Object.entries(values)) {
    const [client, product] = key.split('_');
    const checkVal = keyType === 'client' ? client : product;
    if (includeSet.has(checkVal)) {
      sum += amount || 0;
    }
  }
  return sum;
}

export default function StrategicTargetsSummary({ plan }: Props) {
  const matrix = useMemo<MatrixData | null>(() => {
    const ctx = (plan.properties.business_context as Record<string, string>) || {};
    const raw = ctx.matrix_data;
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.oldClients && parsed.values) return parsed as MatrixData;
      return null;
    } catch {
      return null;
    }
  }, [plan.properties.business_context]);

  const data = useMemo(() => {
    if (!matrix) return null;
    const oldClientsSet = new Set(matrix.oldClients || []);
    const newClientsSet = new Set(matrix.newClients || []);
    const oldProductsSet = new Set(matrix.oldProducts || []);
    const newProductsSet = new Set(matrix.newProducts || []);

    const total = Object.values(matrix.values).reduce((a, b) => a + (b || 0), 0);
    const oldClientSum = calcSum(matrix.values, oldClientsSet, 'client');
    const newClientSum = calcSum(matrix.values, newClientsSet, 'client');
    const oldProductSum = calcSum(matrix.values, oldProductsSet, 'product');
    const newProductSum = calcSum(matrix.values, newProductsSet, 'product');

    return { total, oldClientSum, newClientSum, oldProductSum, newProductSum };
  }, [matrix]);

  if (!data) return null;

  const rows = [
    {
      label: '达标目标（总）',
      value: data.total,
      icon: Target,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      sub: '全部客户 × 全部产品',
    },
    {
      label: '老客户汇总',
      value: data.oldClientSum,
      icon: Users,
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
      sub: `${matrix.oldClients?.join('、') || '—'}`,
    },
    {
      label: '新客户汇总',
      value: data.newClientSum,
      icon: TrendingUp,
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
      sub: `${matrix.newClients?.join('、') || '—'}`,
    },
    {
      label: '老产品汇总',
      value: data.oldProductSum,
      icon: Archive,
      color: 'text-purple-700',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
      sub: `${matrix.oldProducts?.join('、') || '—'}`,
    },
    {
      label: '新产品汇总',
      value: data.newProductSum,
      icon: Package,
      color: 'text-rose-700',
      bg: 'bg-rose-50',
      border: 'border-rose-200',
      sub: `${matrix.newProducts?.join('、') || '—'}`,
    },
  ];

  return (
    <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50/50">
        <Target size={14} className="text-indigo-500" />
        <span className="text-sm font-semibold text-gray-900">战略目标汇总</span>
        <span className="text-[10px] text-gray-400">基于客户×产品矩阵，为组织绩效提供数据来源</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500 w-44">指标</th>
              <th className="px-5 py-2.5 text-right text-xs font-medium text-gray-500">金额（万元）</th>
              <th className="px-5 py-2.5 text-left text-xs font-medium text-gray-500">说明</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                <td className="px-5 py-3">
                  <div className={`flex items-center gap-2 ${row.color}`}>
                    <row.icon size={14} />
                    <span className="font-medium text-xs">{row.label}</span>
                  </div>
                </td>
                <td className={`px-5 py-3 text-right font-mono font-semibold text-sm ${row.color}`}>
                  {row.value.toLocaleString()}
                </td>
                <td className="px-5 py-3 text-xs text-gray-500 leading-relaxed max-w-xs">
                  {row.sub}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50/50">
              <td className="px-5 py-2.5 text-xs font-semibold text-gray-700">合计校验</td>
              <td className="px-5 py-2.5 text-right font-mono text-xs text-gray-500">
                {data.total.toLocaleString()}
              </td>
              <td className="px-5 py-2.5 text-[10px] text-gray-400">
                老客户({data.oldClientSum.toLocaleString()}) + 新客户({data.newClientSum.toLocaleString()}) = {data.total.toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
