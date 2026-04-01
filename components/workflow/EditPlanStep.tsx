'use client';

/**
 * EditPlanStep — 结构化阶段编辑器 (Step 2)
 *
 * 每个阶段卡片包含：
 *   - 可编辑阶段名称
 *   - 时间范围（日期选择器，从 Step1 里程碑继承）
 *   - 阶段目标（textarea）
 *   - 关键活动（DynamicListInput，从 W1 继承）
 *   - 成果要求（DynamicListInput）
 *   - 负责人（从团队成员多选）
 *   - 阶段备注
 *   - 删除阶段按钮
 *
 * 底部：+ 添加新阶段
 */

import { useState } from 'react';
import DynamicListInput from './DynamicListInput';
import type { PhaseData } from '@/lib/api/workflow-client';
import type { TeamMemberInfo } from '@/lib/workflow/w3-types';

interface EditPlanStepProps {
  phases: PhaseData[];
  onPhasesChange: (phases: PhaseData[]) => void;
  teamMembers?: TeamMemberInfo[];
  onConfirm: () => void;
  loading: boolean;
}

export default function EditPlanStep({
  phases,
  onPhasesChange,
  teamMembers = [],
  onConfirm,
  loading,
}: EditPlanStepProps) {
  const [confirming, setConfirming] = useState(false);

  const updatePhase = (index: number, patch: Partial<PhaseData>) => {
    const updated = [...phases];
    updated[index] = { ...updated[index], ...patch };
    onPhasesChange(updated);
  };

  const deletePhase = (index: number) => {
    if (phases.length <= 1) return;
    const updated = phases
      .filter((_, i) => i !== index)
      .map((p, i) => ({ ...p, phase_order: i + 1 }));
    onPhasesChange(updated);
  };

  const addPhase = () => {
    const newPhase: PhaseData = {
      phase_id: `phase-${phases.length}`,
      phase_name: '',
      phase_order: phases.length + 1,
      time_range: '',
      goals: '',
      key_activities: [],
      deliverables: [],
      assignee_ids: [],
      notes: '',
      status: 'planned',
      tasks: [],
    };
    onPhasesChange([...phases, newPhase]);
  };

  const toggleAssignee = (phaseIndex: number, memberId: string) => {
    const current = phases[phaseIndex].assignee_ids || [];
    const updated = current.includes(memberId)
      ? current.filter(id => id !== memberId)
      : [...current, memberId];
    updatePhase(phaseIndex, { assignee_ids: updated });
  };

  const handleConfirm = () => {
    setConfirming(true);
    onConfirm();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">编辑项目计划</h3>
          <p className="text-sm text-gray-500 mt-1">
            编辑各阶段的目标、活动和成果要求，分配负责人后即可开始交付执行
          </p>
        </div>
        <button
          onClick={addPhase}
          className="px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
        >
          + 添加阶段
        </button>
      </div>

      {/* Phase cards */}
      <div className="space-y-4">
        {phases.map((phase, i) => (
          <div
            key={phase.phase_id}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            {/* Phase header */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-50 border-b border-gray-100">
              <span className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                {phase.phase_order}
              </span>
              <input
                type="text"
                value={phase.phase_name || ''}
                onChange={(e) => updatePhase(i, { phase_name: e.target.value })}
                className="flex-1 text-sm font-medium text-gray-900 bg-transparent border-none focus:outline-none placeholder:text-gray-400"
                placeholder="阶段名称"
              />
              {phase.status && (
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  phase.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : phase.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}>
                  {phase.status === 'completed' ? '已完成' : phase.status === 'in_progress' ? '进行中' : '计划中'}
                </span>
              )}
              <button
                onClick={() => deletePhase(i)}
                disabled={phases.length <= 1}
                className="text-gray-300 hover:text-red-500 disabled:opacity-30 text-sm ml-1"
                title="删除阶段"
              >
                ✕
              </button>
            </div>

            {/* Phase body */}
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Left column */}
              <div className="space-y-4">
                {/* Time range */}
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1.5">时间范围</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={phase.time_range?.split('~')[0]?.trim() || ''}
                      onChange={(e) => {
                        const end = phase.time_range?.split('~')[1]?.trim() || '';
                        updatePhase(i, { time_range: `${e.target.value}~${end}` });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-xs text-gray-400">→</span>
                    <input
                      type="date"
                      value={phase.time_range?.split('~')[1]?.trim() || ''}
                      onChange={(e) => {
                        const start = phase.time_range?.split('~')[0]?.trim() || '';
                        updatePhase(i, { time_range: `${start}~${e.target.value}` });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                {/* Goals */}
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1.5">阶段目标</label>
                  <textarea
                    value={phase.goals || ''}
                    onChange={(e) => updatePhase(i, { goals: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={3}
                    placeholder="描述本阶段要达成的目标..."
                  />
                </div>

                {/* Assignee */}
                {teamMembers.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 font-medium mb-1.5">负责人</label>
                    <div className="flex flex-wrap gap-1.5">
                      {teamMembers.map((member) => {
                        const memberId = member._key || member.name;
                        const isSelected = (phase.assignee_ids || []).includes(memberId);
                        return (
                          <button
                            key={memberId}
                            onClick={() => toggleAssignee(i, memberId)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                              isSelected
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            {member.name}
                            {member.role === 'lead' && (
                              <span className="ml-1 text-[10px] opacity-70">L</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Right column */}
              <div className="space-y-4">
                {/* Key activities */}
                <DynamicListInput
                  items={phase.key_activities || []}
                  onItemsChange={(items) => updatePhase(i, { key_activities: items })}
                  label="关键活动"
                  placeholder="输入关键活动后按回车添加"
                  addButtonLabel="+ 活动"
                />

                {/* Deliverables */}
                <DynamicListInput
                  items={phase.deliverables || []}
                  onItemsChange={(items) => updatePhase(i, { deliverables: items })}
                  label="成果要求"
                  placeholder="输入成果要求后按回车添加"
                  addButtonLabel="+ 成果"
                />

                {/* Notes */}
                <div>
                  <label className="block text-xs text-gray-500 font-medium mb-1.5">阶段备注</label>
                  <textarea
                    value={phase.notes || ''}
                    onChange={(e) => updatePhase(i, { notes: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
                    rows={2}
                    placeholder="可选的补充说明..."
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm */}
      <div className="flex justify-end">
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {confirming ? '保存中...' : '确认计划，开始交付'}
        </button>
      </div>
    </div>
  );
}
