'use client';

import { useState, useCallback } from 'react';

export interface GanttTask {
  id: string;
  name: string;
  phase: string;
  startWeek: number;
  durationWeeks: number;
  color: string;
}

interface GanttChartEditorProps {
  tasks: GanttTask[];
  onChange: (tasks: GanttTask[]) => void;
  totalWeeks?: number;
}

const PHASE_COLORS: Record<string, string> = {
  '诊断阶段': 'bg-blue-500',
  '方案设计': 'bg-purple-500',
  '实施落地': 'bg-green-500',
  '评估优化': 'bg-orange-500',
  'default': 'bg-gray-500',
};

const ALL_PHASES = ['诊断阶段', '方案设计', '实施落地', '评估优化'];

export default function GanttChartEditor({
  tasks,
  onChange,
  totalWeeks = 12,
}: GanttChartEditorProps) {
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const updateTask = useCallback((id: string, updates: Partial<GanttTask>) => {
    onChange(tasks.map(t => t.id === id ? { ...t, ...updates } : t));
  }, [tasks, onChange]);

  const addTask = useCallback(() => {
    const newTask: GanttTask = {
      id: `task_${Date.now()}`,
      name: '新任务',
      phase: '诊断阶段',
      startWeek: 1,
      durationWeeks: 2,
      color: PHASE_COLORS['诊断阶段'],
    };
    onChange([...tasks, newTask]);
    setSelectedTask(newTask.id);
  }, [tasks, onChange]);

  const deleteTask = useCallback((id: string) => {
    onChange(tasks.filter(t => t.id !== id));
    if (selectedTask === id) setSelectedTask(null);
  }, [tasks, onChange, selectedTask]);

  const getPhaseColor = (phase: string) => {
    return PHASE_COLORS[phase] || PHASE_COLORS['default'];
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-gray-900">项目甘特图</h4>
        <button
          onClick={addTask}
          className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          + 添加任务
        </button>
      </div>

      {/* Gantt Chart */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Timeline Header */}
        <div className="flex bg-gray-50 border-b border-gray-200">
          <div className="w-48 flex-shrink-0 px-3 py-2 text-sm font-medium text-gray-700 border-r border-gray-200">
            任务名称
          </div>
          <div className="flex-1 flex">
            {Array.from({ length: totalWeeks }, (_, i) => (
              <div
                key={i}
                className="flex-1 min-w-[40px] px-1 py-2 text-xs text-center text-gray-500 border-r border-gray-100 last:border-r-0"
              >
                W{i + 1}
              </div>
            ))}
          </div>
        </div>

        {/* Task Rows */}
        <div className="divide-y divide-gray-100">
          {tasks.length === 0 ? (
            <div className="px-3 py-8 text-center text-gray-500 text-sm">
              暂无任务，点击"添加任务"开始规划
            </div>
          ) : (
            tasks.map((task) => (
              <div
                key={task.id}
                className={`flex hover:bg-gray-50 cursor-pointer ${
                  selectedTask === task.id ? 'bg-blue-50' : ''
                }`}
                onClick={() => setSelectedTask(task.id)}
              >
                {/* Task Name */}
                <div className="w-48 flex-shrink-0 px-3 py-2 border-r border-gray-200">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getPhaseColor(task.phase)}`} />
                    <span className="text-sm text-gray-900 truncate">{task.name}</span>
                  </div>
                </div>

                {/* Timeline Bar */}
                <div className="flex-1 flex items-center relative h-10">
                  {Array.from({ length: totalWeeks }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 min-w-[40px] h-full border-r border-gray-100 last:border-r-0"
                    />
                  ))}

                  {/* Task Bar */}
                  <div
                    className={`absolute h-6 rounded ${getPhaseColor(task.phase)} opacity-80 hover:opacity-100 transition-opacity`}
                    style={{
                      left: `${((task.startWeek - 1) / totalWeeks) * 100}%`,
                      width: `${(task.durationWeeks / totalWeeks) * 100}%`,
                      top: '8px',
                    }}
                  >
                    <span className="px-2 text-xs text-white font-medium truncate block leading-6">
                      {task.durationWeeks}周
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Task Editor Panel */}
      {selectedTask && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h5 className="font-medium text-gray-900">编辑任务</h5>
            <button
              onClick={() => deleteTask(selectedTask)}
              className="text-sm text-red-600 hover:text-red-700"
            >
              删除任务
            </button>
          </div>

          {(() => {
            const task = tasks.find(t => t.id === selectedTask);
            if (!task) return null;

            return (
              <div className="grid grid-cols-2 gap-4">
                {/* Task Name */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    任务名称
                  </label>
                  <input
                    type="text"
                    value={task.name}
                    onChange={(e) => updateTask(selectedTask, { name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Phase */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    所属阶段
                  </label>
                  <select
                    value={task.phase}
                    onChange={(e) => updateTask(selectedTask, {
                      phase: e.target.value,
                      color: getPhaseColor(e.target.value)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {ALL_PHASES.map(phase => (
                      <option key={phase} value={phase}>{phase}</option>
                    ))}
                  </select>
                </div>

                {/* Start Week */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    开始周
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={totalWeeks}
                    value={task.startWeek}
                    onChange={(e) => updateTask(selectedTask, {
                      startWeek: Math.max(1, Math.min(totalWeeks, parseInt(e.target.value) || 1))
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Duration */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    持续周数
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={totalWeeks - task.startWeek + 1}
                    value={task.durationWeeks}
                    onChange={(e) => updateTask(selectedTask, {
                      durationWeeks: Math.max(1, parseInt(e.target.value) || 1)
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        {ALL_PHASES.map(phase => (
          <div key={phase} className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded ${getPhaseColor(phase)}`} />
            <span className="text-gray-600">{phase}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
