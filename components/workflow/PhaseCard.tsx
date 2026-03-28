'use client';

import type { EnhancedPhase } from '@/lib/workflow/w1-types';
import DynamicListInput from './DynamicListInput';

interface PhaseCardProps {
  phase: EnhancedPhase;
  index: number;
  onChange: (updated: EnhancedPhase) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function PhaseCard({ phase, index, onChange, onRemove, canRemove }: PhaseCardProps) {
  const update = (partial: Partial<EnhancedPhase>) => {
    onChange({ ...phase, ...partial });
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-3 bg-white">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="w-7 h-7 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
            {index + 1}
          </span>
          <input
            type="text"
            value={phase.phase_name}
            onChange={(e) => update({ phase_name: e.target.value })}
            className="font-medium text-gray-900 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500 text-sm flex-1 min-w-0"
            placeholder="阶段名称"
          />
        </div>
        {canRemove && (
          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
          >
            ✕
          </button>
        )}
      </div>

      {/* Duration + Time range */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">预计周期（周）</label>
          <input
            type="number"
            min={1}
            max={52}
            value={phase.duration_weeks}
            onChange={(e) => update({ duration_weeks: parseInt(e.target.value) || 1 })}
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 mb-1">时间范围</label>
          <input
            type="text"
            value={phase.time_range}
            onChange={(e) => update({ time_range: e.target.value })}
            placeholder="如: 第1-4周"
            className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Goals */}
      <div>
        <label className="block text-xs text-gray-500 mb-1">阶段目标</label>
        <textarea
          value={phase.goals}
          onChange={(e) => update({ goals: e.target.value })}
          placeholder="本阶段要达成的目标..."
          className="w-full px-2 py-1.5 text-sm border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          rows={2}
        />
      </div>

      {/* Key activities */}
      <DynamicListInput
        items={phase.key_activities}
        onItemsChange={(key_activities) => update({ key_activities })}
        label="关键活动"
        placeholder="输入关键活动后按回车"
        addButtonLabel="添加活动"
        rows={1}
      />

      {/* Deliverables */}
      <DynamicListInput
        items={phase.deliverables}
        onItemsChange={(deliverables) => update({ deliverables })}
        label="阶段交付物"
        placeholder="输入交付成果后按回车"
        addButtonLabel="添加成果"
        rows={1}
      />
    </div>
  );
}
