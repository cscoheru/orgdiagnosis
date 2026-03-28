'use client';

import { useState } from 'react';
import type { PhaseData, TaskData } from '@/lib/api/workflow-client';

interface PhaseExecutionStepProps {
  phases: PhaseData[];
  onPhaseStatusChange: (phaseId: string, status: PhaseData['status']) => void;
  onTriggerTask: (phaseId: string) => void;
  onRequestReport: (phaseId: string) => void;
  loading: boolean;
}

export default function PhaseExecutionStep({
  phases,
  onPhaseStatusChange,
  onTriggerTask,
  onRequestReport,
  loading,
}: PhaseExecutionStepProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(
    phases.find(p => p.status === 'in_progress')?.phase_id || null,
  );

  // Calculate overall progress
  const totalPhases = phases.length;
  const completedPhases = phases.filter(p => p.status === 'completed').length;
  const overallProgress = totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  if (phases.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
        <p className="text-gray-500">暂无阶段数据</p>
        <p className="text-sm text-gray-400 mt-1">请先完成项目计划</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overall progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-lg font-medium text-gray-900">项目交付进度</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {completedPhases} / {totalPhases} 个阶段已完成
            </p>
          </div>
          <span className="text-2xl font-bold text-blue-600">{overallProgress}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all"
            style={{ width: `${overallProgress}%` }}
          />
        </div>

        {/* Phase mini progress */}
        <div className="flex gap-1 mt-4">
          {phases.map(phase => {
            const isExpanded = expandedPhase === phase.phase_id;
            return (
              <button
                key={phase.phase_id}
                onClick={() => setExpandedPhase(isExpanded ? null : phase.phase_id)}
                className={`flex-1 h-8 rounded-lg text-xs font-medium transition-all ${
                  phase.status === 'completed'
                    ? 'bg-green-500 text-white'
                    : phase.status === 'in_progress'
                      ? 'bg-blue-500 text-white ring-2 ring-blue-200'
                      : isExpanded
                        ? 'bg-gray-200 text-gray-700'
                        : 'bg-gray-100 text-gray-400'
                }`}
                title={phase.phase_name}
              >
                {phase.phase_name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded phase detail */}
      {expandedPhase && (() => {
        const phase = phases.find(p => p.phase_id === expandedPhase);
        if (!phase) return null;

        const tasks = phase.tasks || [];
        const completedTasks = tasks.filter(t => t.status === 'completed').length;
        const phaseProgress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;

        return (
          <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
            {/* Phase header */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-gray-900">{phase.phase_name}</h4>
                <div className="flex items-center gap-3 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                    phase.status === 'completed' ? 'bg-green-100 text-green-700' :
                    phase.status === 'in_progress' ? 'bg-blue-100 text-blue-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {phase.status === 'completed' ? '已完成' : phase.status === 'in_progress' ? '进行中' : '待开始'}
                  </span>
                  {phase.time_range && <span className="text-xs text-gray-400">{phase.time_range}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                {phase.status !== 'in_progress' && (
                  <button
                    onClick={() => onPhaseStatusChange(phase.phase_id, 'in_progress')}
                    className="px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    {phase.status === 'planned' ? '开始阶段' : '重新开启'}
                  </button>
                )}
                {phase.status === 'in_progress' && (
                  <button
                    onClick={() => onPhaseStatusChange(phase.phase_id, 'completed')}
                    className="px-3 py-1.5 text-sm text-green-600 border border-green-200 rounded-lg hover:bg-green-50"
                  >
                    完成阶段
                  </button>
                )}
                <button
                  onClick={() => onRequestReport(phase.phase_id)}
                  className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  生成阶段报告
                </button>
              </div>
            </div>

            {/* Goals */}
            {phase.goals && (
              <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">{phase.goals}</p>
            )}

            {/* Expected deliverables */}
            {phase.deliverables && phase.deliverables.length > 0 && (
              <div>
                <h5 className="text-xs font-medium text-gray-500 mb-2">预期成果</h5>
                <div className="flex flex-wrap gap-1">
                  {phase.deliverables.map((d, i) => (
                    <span key={i} className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">{d}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Task progress */}
            {tasks.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h5 className="text-xs font-medium text-gray-500">任务进度</h5>
                  <span className="text-xs text-gray-400">{completedTasks}/{tasks.length}</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mb-3">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      phaseProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${phaseProgress}%` }}
                  />
                </div>

                {/* Task list */}
                <div className="space-y-1.5">
                  {tasks.map(task => (
                    <div
                      key={task.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-gray-50"
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          task.status === 'completed' ? 'bg-green-500' :
                          task.status === 'in_progress' ? 'bg-blue-500' :
                          'bg-gray-300'
                        }`} />
                        <span className={task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-700'}>
                          {task.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {task.file_paths && task.file_paths.length > 0 && (
                          <span className="text-xs text-gray-400">
                            {task.file_paths.length} 个文件
                          </span>
                        )}
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          task.status === 'completed' ? 'bg-green-100 text-green-600' :
                          task.status === 'in_progress' ? 'bg-blue-100 text-blue-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {task.status === 'completed' ? '完成' : task.status === 'in_progress' ? '执行中' : '待执行'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Trigger task button */}
            {phase.status === 'in_progress' && (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button
                  onClick={() => onTriggerTask(phase.phase_id)}
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                      AI 分析中...
                    </>
                  ) : (
                    '触发任务'
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
