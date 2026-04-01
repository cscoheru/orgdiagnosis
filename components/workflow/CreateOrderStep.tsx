'use client';

import { useState, useEffect } from 'react';
import type { MilestonePlanResult } from '@/lib/api/workflow-client';
import type { CreateOrderFormData, ContractInfo, TeamMemberInfo, PaymentMilestone } from '@/lib/workflow/w3-types';
import { PAYMENT_PRESETS } from '@/lib/workflow/w3-types';
import { saveProjectOrder, getProjectOrder } from '@/lib/api/workflow-client';

interface CreateOrderStepProps {
  planData: MilestonePlanResult | null;
  projectId: string;
  onConfirm: (orderData: CreateOrderFormData) => void;
  loading: boolean;
}

/** Empty form state */
function emptyForm(): CreateOrderFormData {
  return {
    contract: {
      contract_number: '',
      total_amount: 0,
      currency: 'CNY',
      payment_schedule: [
        { percentage: 30, trigger_event: '签约时' },
        { percentage: 40, trigger_event: '中期验收' },
        { percentage: 30, trigger_event: '终期验收' },
      ],
    },
    team: [{ name: '', role: 'lead' as const }],
    project_start: '',
    project_end: '',
    milestone_dates: [],
  };
}

export default function CreateOrderStep({
  planData,
  projectId,
  onConfirm,
  loading,
}: CreateOrderStepProps) {
  const [form, setForm] = useState<CreateOrderFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Load existing order data
  useEffect(() => {
    if (!projectId) return;
    getProjectOrder(projectId).then((res) => {
      if (res.success && res.data) {
        const d = res.data;
        setForm((prev) => ({
          ...prev,
          contract: d.contract ? {
            contract_number: d.contract.contract_number || '',
            total_amount: d.contract.total_amount || 0,
            currency: d.contract.currency || 'CNY',
            payment_schedule: d.contract.payment_schedule || prev.contract.payment_schedule,
            signed_date: d.contract.signed_date,
            client_signatory: d.contract.client_signatory,
            description: d.contract.description,
          } : prev.contract,
          team: d.team?.length ? d.team : prev.team,
          project_start: d.project_start || prev.project_start,
          project_end: d.project_end || prev.project_end,
        }));
      }
    });
  }, [projectId]);

  // Auto-fill milestone dates from W1 plan
  useEffect(() => {
    if (planData?.phases && form.milestone_dates.length === 0) {
      setForm((prev) => ({
        ...prev,
        milestone_dates: planData.phases.map((p) => ({
          phase_name: p.phase_name,
          planned_start: '',
          planned_end: '',
        })),
      }));
    }
  }, [planData]);

  // Auto-fill project dates from plan
  useEffect(() => {
    if (planData?.phases && !form.project_start && !form.project_end) {
      // Try to infer from W1 time_range
      const first = planData.phases[0];
      const last = planData.phases[planData.phases.length - 1];
      if (first?.time_range && !form.project_start) {
        // time_range might be "第1-2周", try to extract
        setForm((prev) => ({ ...prev, project_start: '' }));
      }
    }
  }, [planData, form.project_start, form.project_end]);

  const updateContract = (patch: Partial<ContractInfo>) => {
    setForm((prev) => ({ ...prev, contract: { ...prev.contract, ...patch } }));
  };

  const updatePayment = (index: number, patch: Partial<PaymentMilestone>) => {
    setForm((prev) => ({
      ...prev,
      contract: {
        ...prev.contract,
        payment_schedule: prev.contract.payment_schedule.map((p, i) =>
          i === index ? { ...p, ...patch } : p
        ),
      },
    }));
  };

  const addPayment = () => {
    updateContract({
      payment_schedule: [...form.contract.payment_schedule, { percentage: 0, trigger_event: '' }],
    });
  };

  const removePayment = (index: number) => {
    updateContract({
      payment_schedule: form.contract.payment_schedule.filter((_, i) => i !== index),
    });
  };

  const addTeamMember = () => {
    setForm((prev) => ({ ...prev, team: [...prev.team, { name: '', role: 'member' }] }));
  };

  const removeTeamMember = (index: number) => {
    setForm((prev) => ({ ...prev, team: prev.team.filter((_, i) => i !== index) }));
  };

  const updateTeamMember = (index: number, patch: Partial<TeamMemberInfo>) => {
    setForm((prev) => ({
      ...prev,
      team: prev.team.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }));
  };

  const updateMilestone = (index: number, field: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      milestone_dates: prev.milestone_dates.map((m, i) =>
        i === index ? { ...m, [field]: value } : m
      ),
    }));
  };

  const validate = (): string[] => {
    const errs: string[] = [];
    if (!form.contract.contract_number.trim()) errs.push('请填写合同编号');
    if (form.contract.total_amount <= 0) errs.push('请填写合同金额');
    const total = form.contract.payment_schedule.reduce((s, p) => s + p.percentage, 0);
    if (Math.abs(total - 100) > 0.1) errs.push(`付款比例总和为 ${total}%，应为 100%`);
    if (form.team.length === 0) errs.push('请至少添加一名团队成员');
    if (form.team.some((m) => !m.name.trim())) errs.push('团队成员姓名不能为空');
    if (!form.project_start) errs.push('请选择项目开始日期');
    if (!form.project_end) errs.push('请选择项目结束日期');
    return errs;
  };

  const handleSave = async () => {
    const errs = validate();
    if (errs.length > 0) { setErrors(errs); return; }
    setErrors([]);
    setSaving(true);
    try {
      const res = await saveProjectOrder(projectId, form);
      if (res.success) {
        onConfirm(form);
      } else {
        setErrors(['保存失败: ' + (res.error || '未知错误')]);
      }
    } finally {
      setSaving(false);
    }
  };

  const paymentTotal = form.contract.payment_schedule.reduce((s, p) => s + p.percentage, 0);

  if (!planData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-4">
        <p className="text-gray-500">需要先完成 W1 需求分析，生成里程碑计划</p>
        <p className="text-sm text-gray-400">请前往「需求分析」页面完成计划后重试</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section 1: Contract */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-blue-600 rounded-full" />
          合同信息
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">合同编号 *</label>
            <input
              type="text"
              value={form.contract.contract_number}
              onChange={(e) => updateContract({ contract_number: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="HT-2026-001"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">合同金额 *</label>
            <input
              type="number"
              value={form.contract.total_amount || ''}
              onChange={(e) => updateContract({ total_amount: parseFloat(e.target.value) || 0 })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="0"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">币种</label>
            <select
              value={form.contract.currency}
              onChange={(e) => updateContract({ currency: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="CNY">CNY (人民币)</option>
              <option value="USD">USD (美元)</option>
              <option value="EUR">EUR (欧元)</option>
            </select>
          </div>
        </div>

        {/* Payment schedule */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs text-gray-500">付款节点</label>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-medium ${Math.abs(paymentTotal - 100) < 0.1 ? 'text-green-600' : 'text-red-500'}`}>
                合计: {paymentTotal}%
              </span>
              {PAYMENT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  onClick={() => updateContract({ payment_schedule: preset.schedule.map(s => ({ ...s })) })}
                  className="px-2 py-0.5 text-[10px] border border-gray-200 rounded text-gray-500 hover:bg-gray-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>
          {/* Visual bar */}
          <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-2">
            {form.contract.payment_schedule.map((p, i) => (
              <div
                key={i}
                className="h-full transition-all"
                style={{
                  width: `${p.percentage}%`,
                  backgroundColor: i % 2 === 0 ? '#3b82f6' : '#60a5fa',
                }}
              />
            ))}
          </div>
          <div className="space-y-2">
            {form.contract.payment_schedule.map((p, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="number"
                  value={p.percentage || ''}
                  onChange={(e) => updatePayment(i, { percentage: parseFloat(e.target.value) || 0 })}
                  className="w-16 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400">%</span>
                <input
                  type="text"
                  value={p.trigger_event}
                  onChange={(e) => updatePayment(i, { trigger_event: e.target.value })}
                  className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="触发条件"
                />
                <input
                  type="date"
                  value={p.expected_date || ''}
                  onChange={(e) => updatePayment(i, { expected_date: e.target.value })}
                  className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={() => removePayment(i)}
                  className="text-gray-300 hover:text-red-400 text-xs"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
          <button onClick={addPayment} className="text-xs text-blue-600 hover:text-blue-800 mt-1">
            + 添加付款节点
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">签约日期</label>
            <input
              type="date"
              value={form.contract.signed_date || ''}
              onChange={(e) => updateContract({ signed_date: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">客户签约人</label>
            <input
              type="text"
              value={form.contract.client_signatory || ''}
              onChange={(e) => updateContract({ client_signatory: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="签约人姓名"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Team */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-emerald-600 rounded-full" />
          团队分配
        </h3>
        <div className="space-y-2">
          {form.team.map((member, i) => (
            <div key={i} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                member.role === 'lead' ? 'bg-emerald-500' : member.role === 'advisor' ? 'bg-purple-500' : 'bg-gray-400'
              }`}>
                {member.role === 'lead' ? 'L' : member.role === 'advisor' ? 'A' : 'M'}
              </div>
              <input
                type="text"
                value={member.name}
                onChange={(e) => updateTeamMember(i, { name: e.target.value })}
                className="flex-1 px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="成员姓名"
              />
              <select
                value={member.role}
                onChange={(e) => updateTeamMember(i, { role: e.target.value as any })}
                className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="lead">Lead (负责人)</option>
                <option value="member">Member (成员)</option>
                <option value="advisor">Advisor (顾问)</option>
              </select>
              <input
                type="text"
                value={member.specialization || ''}
                onChange={(e) => updateTeamMember(i, { specialization: e.target.value })}
                className="w-28 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="专业方向"
              />
              <label className="flex items-center gap-1 text-xs text-gray-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={member.is_external || false}
                  onChange={(e) => updateTeamMember(i, { is_external: e.target.checked })}
                  className="rounded"
                />
                外部
              </label>
              <button onClick={() => removeTeamMember(i)} className="text-gray-300 hover:text-red-400 text-sm">
                ✕
              </button>
            </div>
          ))}
        </div>
        <button onClick={addTeamMember} className="text-xs text-blue-600 hover:text-blue-800">
          + 添加成员
        </button>
      </div>

      {/* Section 3: Schedule */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
          <span className="w-1.5 h-5 bg-amber-500 rounded-full" />
          项目排期
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">项目开始日期 *</label>
            <input
              type="date"
              value={form.project_start}
              onChange={(e) => setForm((prev) => ({ ...prev, project_start: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">项目结束日期 *</label>
            <input
              type="date"
              value={form.project_end}
              onChange={(e) => setForm((prev) => ({ ...prev, project_end: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        {form.milestone_dates.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 block mb-2">里程碑日期（从 W1 阶段自动填充）</label>
            <div className="space-y-1">
              {form.milestone_dates.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="w-5 text-xs text-gray-400">{i + 1}.</span>
                  <span className="text-gray-700 w-36 truncate">{m.phase_name}</span>
                  <input
                    type="date"
                    value={m.planned_start}
                    onChange={(e) => updateMilestone(i, 'planned_start', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-400">→</span>
                  <input
                    type="date"
                    value={m.planned_end}
                    onChange={(e) => updateMilestone(i, 'planned_end', e.target.value)}
                    className="px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section 4: Inherited Plan (read-only) */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-3">
        <h3 className="text-sm font-medium text-gray-500 flex items-center gap-2">
          W1 继承计划
          <span className="text-xs text-gray-400 font-normal">（只读）</span>
        </h3>
        {planData.project_goal && (
          <p className="text-sm text-gray-700 bg-white rounded-lg p-3">{planData.project_goal}</p>
        )}
        <div className="space-y-2">
          {planData.phases.map((phase, i) => (
            <div key={i} className="bg-white rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-5 h-5 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {phase.phase_order || i + 1}
                </span>
                <span className="text-sm font-medium text-gray-800">{phase.phase_name}</span>
                {phase.time_range && <span className="text-xs text-gray-400 ml-auto">{phase.time_range}</span>}
              </div>
              {phase.goals && <p className="text-xs text-gray-500 ml-7">{phase.goals}</p>}
              {phase.deliverables && phase.deliverables.length > 0 && (
                <div className="ml-7 mt-1 flex flex-wrap gap-1">
                  {phase.deliverables.map((d, j) => (
                    <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">{d}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        {planData.success_criteria && planData.success_criteria.length > 0 && (
          <div>
            <h4 className="text-xs text-gray-500 mb-1">成功标准</h4>
            <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
              {planData.success_criteria.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>

      {/* Errors */}
      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <ul className="text-xs text-red-600 space-y-1">
            {errors.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {/* Confirm */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {saving ? '保存中...' : '确认创建，开始交付'}
        </button>
      </div>
    </div>
  );
}
