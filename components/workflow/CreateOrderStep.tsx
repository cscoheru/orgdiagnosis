'use client';

import type { MilestonePlanResult } from '@/lib/api/workflow-client';

interface CreateOrderStepProps {
  planData: MilestonePlanResult | null;
  onConfirm: () => void;
  loading: boolean;
}

export default function CreateOrderStep({
  planData,
  onConfirm,
  loading,
}: CreateOrderStepProps) {
  if (!planData) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center space-y-4">
        <p className="text-gray-500">需要先完成 W1 需求分析，生成里程碑计划</p>
        <p className="text-sm text-gray-400">请前往「需求分析」页面完成计划后重试</p>
      </div>
    );
  }

  const phases = planData.phases || [];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900">创建咨询订单</h3>
        <p className="text-sm text-gray-500 mt-1">
          以下数据从 W1 需求分析自动继承，确认后项目将进入交付阶段
        </p>
      </div>

      {/* Project goal */}
      {planData.project_goal && (
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-1">项目目标</h4>
          <p className="text-sm text-gray-600">{planData.project_goal}</p>
        </div>
      )}

      {/* Phases overview */}
      <div>
        <h4 className="text-sm font-medium text-gray-700 mb-3">阶段计划（{phases.length} 个阶段）</h4>
        <div className="space-y-3">
          {phases.map((phase, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-6 h-6 bg-blue-100 text-blue-700 rounded-full flex items-center justify-center text-xs font-medium">
                  {phase.phase_order || i + 1}
                </span>
                <span className="font-medium text-gray-900 text-sm">{phase.phase_name}</span>
                {phase.time_range && (
                  <span className="text-xs text-gray-400 ml-auto">{phase.time_range}</span>
                )}
              </div>
              {phase.goals && (
                <p className="text-sm text-gray-600 ml-8">{phase.goals}</p>
              )}
              {phase.deliverables && phase.deliverables.length > 0 && (
                <div className="ml-8 mt-2 flex flex-wrap gap-1">
                  {phase.deliverables.map((d, j) => (
                    <span key={j} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                      {d}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Success criteria */}
      {planData.success_criteria && planData.success_criteria.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-700 mb-2">成功标准</h4>
          <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
            {planData.success_criteria.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-6 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
        >
          {loading ? '创建中...' : '确认创建，开始交付'}
        </button>
      </div>
    </div>
  );
}
