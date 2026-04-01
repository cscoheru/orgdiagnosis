'use client';

import { useState, useEffect, useCallback } from 'react';
import type { PhaseData, TaskData, TaskItem, DeliverableItem, MeetingNote } from '@/lib/api/workflow-client';
import {
  fetchTasks,
  createTask,
  updateTask,
  deleteTask,
  fetchDeliverables,
  createDeliverable,
  deleteDeliverable,
  fetchMeetings,
  createMeeting,
  updateMeeting,
  deleteMeeting,
} from '@/lib/api/workflow-client';
import type { TeamMemberInfo } from '@/lib/workflow/w3-types';

interface PhaseExecutionStepProps {
  phases: PhaseData[];
  projectId: string;
  teamMembers?: TeamMemberInfo[];
  onPhaseStatusChange: (phaseId: string, status: PhaseData['status']) => void;
  onTriggerTask: (phaseId: string) => void;
  onRequestReport: (phaseId: string) => void;
  loading: boolean;
}

type DetailTab = 'tasks' | 'deliverables' | 'meetings';

// ─── Status / Priority badge helpers ───────────────────

const STATUS_LABEL: Record<string, string> = {
  pending: '待执行',
  in_progress: '执行中',
  completed: '已完成',
};

const STATUS_CLASS: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-500',
  in_progress: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
};

const PRIORITY_LABEL: Record<string, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const PRIORITY_CLASS: Record<string, string> = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-yellow-100 text-yellow-700',
  low: 'bg-gray-100 text-gray-500',
};

const DELIVERABLE_TYPE_LABEL: Record<string, string> = {
  report: '报告',
  slides: '演示',
  dataset: '数据集',
  code: '代码',
  other: '其他',
};

const NEXT_STATUS: Record<string, TaskItem['status']> = {
  pending: 'in_progress',
  in_progress: 'completed',
};

// ─── Spinner ────────────────────────────────────────────

function InlineSpinner() {
  return (
    <span className="animate-spin w-3.5 h-3.5 border-2 border-blue-600 border-t-transparent rounded-full inline-block" />
  );
}

// ─── Tab bar ────────────────────────────────────────────

const TABS: { key: DetailTab; label: string }[] = [
  { key: 'tasks', label: '任务' },
  { key: 'deliverables', label: '交付成果' },
  { key: 'meetings', label: '会议纪要' },
];

function TabBar({ active, onChange }: { active: DetailTab; onChange: (t: DetailTab) => void }) {
  return (
    <div className="flex border-b border-gray-200 mb-4">
      {TABS.map(tab => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={`px-4 py-2.5 text-sm font-medium transition-colors relative ${
            active === tab.key
              ? 'text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {tab.label}
          {active === tab.key && (
            <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-blue-600 rounded-full" />
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Tasks Tab ──────────────────────────────────────────

function TasksTab({
  projectId,
  phaseId,
  teamMembers,
}: {
  projectId: string;
  phaseId: string;
  teamMembers: TeamMemberInfo[];
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // New task form state
  const [newName, setNewName] = useState('');
  const [newPriority, setNewPriority] = useState<TaskItem['priority']>('medium');
  const [newAssignee, setNewAssignee] = useState('');
  const [newDueDate, setNewDueDate] = useState('');

  const loadTasks = useCallback(async () => {
    setLoading(true);
    const res = await fetchTasks(projectId, phaseId);
    if (res.success && res.data) setTasks(res.data);
    setLoading(false);
  }, [projectId, phaseId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const res = await createTask(projectId, {
      name: newName.trim(),
      status: 'pending',
      priority: newPriority,
      assignee: newAssignee || undefined,
      due_date: newDueDate || undefined,
      phase_id: phaseId,
    });
    if (res.success && res.data) {
      setTasks(prev => [...prev, res.data!]);
      setNewName('');
      setNewPriority('medium');
      setNewAssignee('');
      setNewDueDate('');
      setShowAdd(false);
    }
    setSaving(false);
  };

  const handleStatusToggle = async (task: TaskItem) => {
    const next = NEXT_STATUS[task.status];
    if (!next) return;
    const prev = [...tasks];
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: next } : t));
    await updateTask(projectId, task.id, { status: next });
  };

  const handleDelete = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId));
    await deleteTask(projectId, taskId);
  };

  const handleUpdate = async (taskId: string, updates: Partial<TaskItem>) => {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...updates } : t));
    await updateTask(projectId, taskId, updates);
  };

  return (
    <div>
      {/* Add task */}
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-3 px-3 py-1.5 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          + 添加任务
        </button>
      ) : (
        <div className="mb-4 p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">任务名称 *</label>
              <input
                type="text"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="输入任务名称"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">优先级</label>
              <select
                value={newPriority}
                onChange={e => setNewPriority(e.target.value as TaskItem['priority'])}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
            </div>
            {teamMembers.length > 0 && (
              <div>
                <label className="block text-xs text-gray-500 font-medium mb-1">负责人</label>
                <select
                  value={newAssignee}
                  onChange={e => setNewAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">未分配</option>
                  {teamMembers.map(m => (
                    <option key={m._key || m.name} value={m.name}>{m.name} ({m.role === 'lead' ? '负责人' : m.role === 'advisor' ? '顾问' : '成员'})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">截止日期</label>
              <input
                type="date"
                value={newDueDate}
                onChange={e => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAdd(false); setNewName(''); }}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newName.trim() || saving}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <InlineSpinner />}
              创建任务
            </button>
          </div>
        </div>
      )}

      {/* Task list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
          <InlineSpinner />
          <span>加载任务中...</span>
        </div>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">暂无任务，点击上方按钮添加</p>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => (
            <div
              key={task.id}
              className="group bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
            >
              {/* Task row */}
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <button
                    onClick={() => handleStatusToggle(task)}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      task.status === 'completed'
                        ? 'bg-green-500 border-green-500 text-white'
                        : task.status === 'in_progress'
                          ? 'border-blue-400 bg-blue-50'
                          : 'border-gray-300 hover:border-gray-400'
                    }`}
                    title={NEXT_STATUS[task.status] ? `标记为${STATUS_LABEL[NEXT_STATUS[task.status]]}` : '已完成'}
                  >
                    {task.status === 'completed' && (
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {task.status === 'in_progress' && (
                      <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                    )}
                  </button>
                  <div className="min-w-0">
                    <span className={`text-sm ${task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {task.name}
                    </span>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${STATUS_CLASS[task.status]}`}>
                        {STATUS_LABEL[task.status]}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${PRIORITY_CLASS[task.priority]}`}>
                        {PRIORITY_LABEL[task.priority]}
                      </span>
                      {task.assignee && (
                        <span className="text-[10px] text-gray-400">{task.assignee}</span>
                      )}
                      {task.due_date && (
                        <span className="text-[10px] text-gray-400">{task.due_date}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => setEditingId(editingId === task.id ? null : task.id)}
                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                    title="编辑"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete(task.id)}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="删除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Inline edit form */}
              {editingId === task.id && (
                <div className="px-4 pb-4 pt-1 border-t border-gray-100 bg-gray-50/50">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">任务名称</label>
                      <input
                        type="text"
                        defaultValue={task.name}
                        onBlur={e => handleUpdate(task.id, { name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">优先级</label>
                      <select
                        defaultValue={task.priority}
                        onChange={e => handleUpdate(task.id, { priority: e.target.value as TaskItem['priority'] })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="high">高</option>
                        <option value="medium">中</option>
                        <option value="low">低</option>
                      </select>
                    </div>
                    {teamMembers.length > 0 && (
                      <div>
                        <label className="block text-xs text-gray-500 font-medium mb-1">负责人</label>
                        <select
                          defaultValue={task.assignee || ''}
                          onChange={e => handleUpdate(task.id, { assignee: e.target.value || undefined })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        >
                          <option value="">未分配</option>
                          {teamMembers.map(m => (
                            <option key={m._key || m.name} value={m.name}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-gray-500 font-medium mb-1">截止日期</label>
                      <input
                        type="date"
                        defaultValue={task.due_date || ''}
                        onChange={e => handleUpdate(task.id, { due_date: e.target.value || undefined })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Deliverables Tab ───────────────────────────────────

function DeliverablesTab({
  projectId,
  phaseId,
}: {
  projectId: string;
  phaseId: string;
}) {
  const [deliverables, setDeliverables] = useState<DeliverableItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  // New deliverable form
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<DeliverableItem['type']>('report');
  const [newSource, setNewSource] = useState('');

  const loadDeliverables = useCallback(async () => {
    setLoading(true);
    const res = await fetchDeliverables(projectId, phaseId);
    if (res.success && res.data) setDeliverables(res.data);
    setLoading(false);
  }, [projectId, phaseId]);

  useEffect(() => { loadDeliverables(); }, [loadDeliverables]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    const res = await createDeliverable(projectId, {
      title: newTitle.trim(),
      type: newType,
      source_module: newSource || undefined,
      phase_id: phaseId,
    });
    if (res.success && res.data) {
      setDeliverables(prev => [...prev, res.data!]);
      setNewTitle('');
      setNewType('report');
      setNewSource('');
      setShowAdd(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeliverables(prev => prev.filter(d => d.id !== id));
    await deleteDeliverable(projectId, id);
  };

  return (
    <div>
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-3 px-3 py-1.5 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          + 添加成果
        </button>
      ) : (
        <div className="mb-4 p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">成果名称 *</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="输入成果名称"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">类型</label>
              <select
                value={newType}
                onChange={e => setNewType(e.target.value as DeliverableItem['type'])}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="report">报告</option>
                <option value="slides">演示</option>
                <option value="dataset">数据集</option>
                <option value="code">代码</option>
                <option value="other">其他</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">来源模块</label>
              <input
                type="text"
                value={newSource}
                onChange={e => setNewSource(e.target.value)}
                placeholder="如: 阶段一、诊断模块"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAdd(false); setNewTitle(''); }}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || saving}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <InlineSpinner />}
              添加成果
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
          <InlineSpinner />
          <span>加载成果中...</span>
        </div>
      ) : deliverables.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">暂无交付成果，点击上方按钮添加</p>
      ) : (
        <div className="space-y-1.5">
          {deliverables.map(d => (
            <div
              key={d.id}
              className="group flex items-center justify-between px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-sm text-gray-800 truncate">{d.title}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium flex-shrink-0">
                  {DELIVERABLE_TYPE_LABEL[d.type] || d.type}
                </span>
                {d.source_module && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 font-medium flex-shrink-0">
                    {d.source_module}
                  </span>
                )}
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="删除"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Meetings Tab ───────────────────────────────────────

function MeetingsTab({
  projectId,
  phaseId,
}: {
  projectId: string;
  phaseId: string;
}) {
  const [meetings, setMeetings] = useState<MeetingNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  // New meeting form
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newSummary, setNewSummary] = useState('');

  const loadMeetings = useCallback(async () => {
    setLoading(true);
    const res = await fetchMeetings(projectId, phaseId);
    if (res.success && res.data) setMeetings(res.data);
    setLoading(false);
  }, [projectId, phaseId]);

  useEffect(() => { loadMeetings(); }, [loadMeetings]);

  const handleCreate = async () => {
    if (!newTitle.trim() || !newDate) return;
    setSaving(true);
    const res = await createMeeting(projectId, {
      title: newTitle.trim(),
      date: newDate,
      summary: newSummary || undefined,
      phase_id: phaseId,
      decisions: [],
      action_items: [],
    });
    if (res.success && res.data) {
      setMeetings(prev => [...prev, res.data!]);
      setNewTitle('');
      setNewDate('');
      setNewSummary('');
      setShowAdd(false);
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setMeetings(prev => prev.filter(m => m.id !== id));
    if (expandedId === id) setExpandedId(null);
    await deleteMeeting(projectId, id);
  };

  return (
    <div>
      {!showAdd ? (
        <button
          onClick={() => setShowAdd(true)}
          className="mb-3 px-3 py-1.5 text-sm text-blue-600 border border-dashed border-blue-300 rounded-lg hover:bg-blue-50 transition-colors"
        >
          + 添加纪要
        </button>
      ) : (
        <div className="mb-4 p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">会议标题 *</label>
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                placeholder="输入会议标题"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">日期 *</label>
              <input
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 font-medium mb-1">摘要</label>
            <textarea
              value={newSummary}
              onChange={e => setNewSummary(e.target.value)}
              placeholder="会议摘要..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => { setShowAdd(false); setNewTitle(''); setNewDate(''); setNewSummary(''); }}
              className="px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              取消
            </button>
            <button
              onClick={handleCreate}
              disabled={!newTitle.trim() || !newDate || saving}
              className="px-4 py-1.5 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving && <InlineSpinner />}
              添加纪要
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-400 py-6 justify-center">
          <InlineSpinner />
          <span>加载会议纪要中...</span>
        </div>
      ) : meetings.length === 0 ? (
        <p className="text-sm text-gray-400 py-6 text-center">暂无会议纪要，点击上方按钮添加</p>
      ) : (
        <div className="space-y-2">
          {meetings.map(meeting => {
            const isExpanded = expandedId === meeting.id;
            return (
              <div
                key={meeting.id}
                className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:border-gray-300 transition-colors"
              >
                <button
                  onClick={() => setExpandedId(isExpanded ? null : meeting.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <svg
                      className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                    <div className="min-w-0">
                      <span className="text-sm text-gray-800 font-medium truncate block">{meeting.title}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-gray-400">{meeting.date}</span>
                        {meeting.decisions && meeting.decisions.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium">
                            {meeting.decisions.length} 项决议
                          </span>
                        )}
                        {meeting.action_items && meeting.action_items.length > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium">
                            {meeting.action_items.length} 项行动项
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(meeting.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    title="删除"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </button>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-gray-100 bg-gray-50/50 space-y-3 pt-3">
                    {meeting.participants && meeting.participants.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 font-medium">参会人: </span>
                        <span className="text-xs text-gray-600">{meeting.participants.join(', ')}</span>
                      </div>
                    )}
                    {meeting.summary && (
                      <div>
                        <span className="text-xs text-gray-500 font-medium">摘要</span>
                        <p className="text-sm text-gray-700 mt-1">{meeting.summary}</p>
                      </div>
                    )}
                    {meeting.decisions && meeting.decisions.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 font-medium">决议</span>
                        <ul className="mt-1 space-y-1">
                          {meeting.decisions.map((d, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <span className="w-1 h-1 bg-green-500 rounded-full mt-2 flex-shrink-0" />
                              {d}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {meeting.action_items && meeting.action_items.length > 0 && (
                      <div>
                        <span className="text-xs text-gray-500 font-medium">行动项</span>
                        <ul className="mt-1 space-y-1">
                          {meeting.action_items.map((a, i) => (
                            <li key={i} className="text-sm text-gray-700 flex items-start gap-1.5">
                              <span className="w-1 h-1 bg-yellow-500 rounded-full mt-2 flex-shrink-0" />
                              <span>{a.content}</span>
                              {a.assignee && (
                                <span className="text-xs text-gray-400 ml-1">({a.assignee})</span>
                              )}
                              {a.due_date && (
                                <span className="text-xs text-gray-400 ml-1">{a.due_date}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────

export default function PhaseExecutionStep({
  phases,
  projectId,
  teamMembers = [],
  onPhaseStatusChange,
  onTriggerTask,
  onRequestReport,
  loading,
}: PhaseExecutionStepProps) {
  const [expandedPhase, setExpandedPhase] = useState<string | null>(
    phases.find(p => p.status === 'in_progress')?.phase_id || null,
  );
  const [activeTab, setActiveTab] = useState<DetailTab>('tasks');

  // Reset tab when phase changes
  useEffect(() => {
    setActiveTab('tasks');
  }, [expandedPhase]);

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
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {/* Phase header */}
            <div className="p-6 pb-4">
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
                <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 mt-3">{phase.goals}</p>
              )}

              {/* Expected deliverables */}
              {phase.deliverables && phase.deliverables.length > 0 && (
                <div className="mt-3">
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
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="text-xs font-medium text-gray-500">任务进度</h5>
                    <span className="text-xs text-gray-400">{completedTasks}/{tasks.length}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${
                        phaseProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${phaseProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Tabbed detail area */}
            <div className="border-t border-gray-200 px-6 pb-6">
              <TabBar active={activeTab} onChange={setActiveTab} />

              {activeTab === 'tasks' && (
                <TasksTab
                  projectId={projectId}
                  phaseId={phase.phase_id}
                  teamMembers={teamMembers}
                />
              )}

              {activeTab === 'deliverables' && (
                <DeliverablesTab
                  projectId={projectId}
                  phaseId={phase.phase_id}
                />
              )}

              {activeTab === 'meetings' && (
                <MeetingsTab
                  projectId={projectId}
                  phaseId={phase.phase_id}
                />
              )}

              {/* Trigger task button */}
              {phase.status === 'in_progress' && (
                <div className="flex justify-end pt-4 mt-4 border-t border-gray-100">
                  <button
                    onClick={() => onTriggerTask(phase.phase_id)}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <InlineSpinner />
                        AI 分析中...
                      </>
                    ) : (
                      '触发任务'
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
