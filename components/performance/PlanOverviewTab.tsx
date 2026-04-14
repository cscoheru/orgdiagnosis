'use client';

/**
 * Tab 1: 方案概览 + 战略目标配置
 *
 * 创建/查看绩效方案列表，并在选中方案下方管理战略目标。
 * 战略目标通过 Kernel API 创建/查询 (Strategic_Goal model)。
 */

import { useState, useEffect, useCallback } from 'react';
import {
  createPlan,
  updatePlan,
  type PerformancePlan,
  type PerformancePlanCreate,
} from '@/lib/api/performance-api';
import { getObjectsByModel, updateObject, deleteObject, type KernelObject } from '@/lib/api/kernel-client';
import type { Methodology, CycleType, PlanStatus } from '@/types/performance';
import { METHODOLOGY_LABELS, CYCLE_TYPE_LABELS, PLAN_STATUS_LABELS, PLAN_STATUS_COLORS } from '@/types/performance';
import { Plus, Settings2, Target, Trash2, Edit3 } from 'lucide-react';
import ContextEnrichmentPanel from './ContextEnrichmentPanel';
import InlineCreateModal from './InlineCreateModal';

interface Props {
  projectId: string;
  plans: PerformancePlan[];
  activePlan: PerformancePlan | null;
  onSelectPlan: (plan: PerformancePlan) => void;
  onRefresh: () => Promise<void>;
}

const PRIORITY_COLORS: Record<string, string> = {
  P0: 'bg-red-100 text-red-700',
  P1: 'bg-amber-100 text-amber-700',
  P2: 'bg-blue-100 text-blue-700',
  P3: 'bg-gray-100 text-gray-600',
};

export default function PlanOverviewTab({ projectId, plans, activePlan, onSelectPlan, onRefresh }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Strategic goals state
  const [goals, setGoals] = useState<KernelObject[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<KernelObject | null>(null);
  const [deletingKey, setDeletingKey] = useState<string | null>(null);

  const [form, setForm] = useState({
    plan_name: '',
    client_name: '',
    industry: '',
    employee_count: '',
    methodology: 'KPI' as Methodology,
    cycle_type: '年度' as CycleType,
    description: '',
  });

  // Fetch strategic goals
  const fetchGoals = useCallback(async () => {
    setLoadingGoals(true);
    try {
      const res = await getObjectsByModel('Strategic_Goal', 100);
      if (res.success && res.data) {
        setGoals(res.data);
      }
    } finally {
      setLoadingGoals(false);
    }
  }, []);

  // Load goals when a plan becomes active
  useEffect(() => {
    if (activePlan) {
      fetchGoals();
    } else {
      setGoals([]);
    }
  }, [activePlan, fetchGoals]);

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

  const handleGoalCreated = (obj: KernelObject) => {
    if (editingGoal) {
      // Replace in-place
      setGoals(prev => prev.map(g => g._key === obj._key ? obj : g));
      setEditingGoal(null);
    } else {
      setGoals(prev => [obj, ...prev]);
    }
  };

  const handleDeleteGoal = async (key: string) => {
    setDeletingKey(key);
    try {
      const res = await deleteObject(key);
      if (res.success) {
        setGoals(prev => prev.filter(g => g._key !== key));
      }
    } finally {
      setDeletingKey(null);
    }
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

      {/* ── Context Enrichment Panel (Phase 2) ── */}
      {activePlan && (
        <>
          <ContextEnrichmentPanel plan={activePlan} onUpdated={onRefresh} />
        </>
      )}

      {/* ── Strategic Goals Section ── */}
      {activePlan && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Target size={16} className="text-indigo-500" />
              <h3 className="text-sm font-medium text-gray-700">战略目标</h3>
              <span className="text-xs text-gray-400">({goals.length}个)</span>
            </div>
            <button
              onClick={() => { setEditingGoal(null); setShowGoalModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Plus size={12} />
              添加目标
            </button>
          </div>

          {loadingGoals ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : goals.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <Target size={32} className="mx-auto mb-2 opacity-40" />
              <p className="text-sm">暂无战略目标</p>
              <p className="text-xs mt-1">添加战略目标后，AI 生成组织绩效时将自动引用</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {goals.map((goal) => {
                const g = goal.properties;
                const isDeleting = deletingKey === goal._key;
                return (
                  <div key={goal._key} className="px-5 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors group">
                    <div className="flex items-center gap-3 min-w-0 cursor-pointer" onClick={() => { setEditingGoal(goal); setShowGoalModal(true); }}>
                      {g.priority ? (
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium flex-shrink-0 ${PRIORITY_COLORS[String(g.priority)] || 'bg-gray-100 text-gray-600'}`}>
                          {String(g.priority)}
                        </span>
                      ) : null}
                      <div className="min-w-0">
                        <p className="text-sm text-gray-900 truncate">{String(g.goal_name || '')}</p>
                        <p className="text-xs text-gray-400">
                          {g.period ? String(g.period) : null}
                          {g.owner ? ` · ${String(g.owner)}` : null}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => { setEditingGoal(goal); setShowGoalModal(true); }}
                        className="p-1 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                        title="编辑"
                      >
                        <Edit3 size={13} />
                      </button>
                      <button
                        onClick={() => handleDeleteGoal(goal._key)}
                        disabled={isDeleting}
                        className="p-1 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors disabled:opacity-50"
                        title="删除"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Inline Create / Edit Modal for Strategic Goal */}
      <InlineCreateModal
        modelKey="Strategic_Goal"
        title={editingGoal ? '编辑战略目标' : '添加战略目标'}
        open={showGoalModal}
        onClose={() => { setShowGoalModal(false); setEditingGoal(null); }}
        onCreated={handleGoalCreated}
        prefills={editingGoal ? editingGoal.properties : undefined}
        editKey={editingGoal?._key}
      />
    </div>
  );
}
