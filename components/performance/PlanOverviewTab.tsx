'use client';

/**
 * Tab 1: 方案概览
 *
 * 创建/查看绩效方案列表，支持创建新方案和切换活跃方案。
 */

import { useState } from 'react';
import {
  createPlan,
  updatePlan,
  type PerformancePlan,
  type PerformancePlanCreate,
} from '@/lib/api/performance-api';
import type { Methodology, CycleType, PlanStatus } from '@/types/performance';
import { METHODOLOGY_LABELS, CYCLE_TYPE_LABELS, PLAN_STATUS_LABELS, PLAN_STATUS_COLORS } from '@/types/performance';
import { Plus, Settings2 } from 'lucide-react';

interface Props {
  projectId: string;
  plans: PerformancePlan[];
  activePlan: PerformancePlan | null;
  onSelectPlan: (plan: PerformancePlan) => void;
  onRefresh: () => Promise<void>;
}

export default function PlanOverviewTab({ projectId, plans, activePlan, onSelectPlan, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    plan_name: '',
    client_name: '',
    industry: '',
    employee_count: '',
    methodology: 'KPI' as Methodology,
    cycle_type: '年度' as CycleType,
    description: '',
  });

  const handleCreate = async () => {
    if (!form.plan_name.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const data: PerformancePlanCreate = {
        plan_name: form.plan_name,
        project_id: projectId,
        client_name: form.client_name || undefined,
        industry: form.industry || undefined,
        employee_count: form.employee_count ? parseInt(form.employee_count) : undefined,
        methodology: form.methodology,
        cycle_type: form.cycle_type,
        description: form.description || undefined,
        status: '草拟中',
      };
      const res = await createPlan(data);
      if (res.success && res.data) {
        setShowCreate(false);
        setForm({ plan_name: '', client_name: '', industry: '', employee_count: '', methodology: 'KPI', cycle_type: '年度', description: '' });
        await onRefresh();
      } else {
        setError(res.error || '创建失败');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleStatusChange = async (plan: PerformancePlan, newStatus: PlanStatus) => {
    const res = await updatePlan(plan._key, { status: newStatus });
    if (res.success) await onRefresh();
  };

  return (
    <div className="space-y-4">
      {/* Plan List */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">绩效方案</h3>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
        >
          <Plus size={14} />
          新建方案
        </button>
      </div>

      {plans.length === 0 && !showCreate && (
        <div className="text-center py-12 text-gray-400">
          <Settings2 size={40} className="mx-auto mb-3 opacity-50" />
          <p>暂无绩效方案，点击上方按钮创建</p>
        </div>
      )}

      {plans.length > 0 && (
        <div className="grid gap-3">
          {plans.map((plan) => {
            const p = plan.properties;
            const isActive = activePlan?._key === plan._key;
            return (
              <div
                key={plan._key}
                onClick={() => onSelectPlan(plan)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  isActive
                    ? 'border-indigo-300 bg-indigo-50/50 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="min-w-0">
                    <h4 className="font-medium text-gray-900 truncate">{p.plan_name}</h4>
                    <p className="text-xs text-gray-500 mt-1">
                      {METHODOLOGY_LABELS[p.methodology as Methodology]} · {CYCLE_TYPE_LABELS[p.cycle_type as CycleType]}
                      {p.client_name && ` · ${p.client_name}`}
                    </p>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ml-3 ${PLAN_STATUS_COLORS[p.status] || ''}`}>
                    {PLAN_STATUS_LABELS[p.status] || p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">{p.description}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <div className="border border-gray-200 rounded-xl p-5 space-y-4 bg-white">
          <h4 className="font-medium text-gray-900">新建绩效方案</h4>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">方案名称 *</label>
              <input
                type="text"
                value={form.plan_name}
                onChange={(e) => setForm(prev => ({ ...prev, plan_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="例：XX公司 2026年度绩效方案"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">客户名称</label>
              <input
                type="text"
                value={form.client_name}
                onChange={(e) => setForm(prev => ({ ...prev, client_name: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">所属行业</label>
              <input
                type="text"
                value={form.industry}
                onChange={(e) => setForm(prev => ({ ...prev, industry: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">评估方法 *</label>
              <select
                value={form.methodology}
                onChange={(e) => setForm(prev => ({ ...prev, methodology: e.target.value as Methodology }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.entries(METHODOLOGY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">考核周期 *</label>
              <select
                value={form.cycle_type}
                onChange={(e) => setForm(prev => ({ ...prev, cycle_type: e.target.value as CycleType }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.entries(CYCLE_TYPE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">涉及员工数</label>
              <input
                type="number"
                value={form.employee_count}
                onChange={(e) => setForm(prev => ({ ...prev, employee_count: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1">方案概述</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm(prev => ({ ...prev, description: e.target.value }))}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                placeholder="简要描述绩效方案的目标和范围..."
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!form.plan_name.trim() || creating}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {creating ? '创建中...' : '创建方案'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
