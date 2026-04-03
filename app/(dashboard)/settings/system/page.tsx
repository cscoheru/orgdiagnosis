'use client';

import { useState, useEffect } from 'react';
import {
  getFeatureFlags,
  type FeatureFlags,
} from '@/lib/agent-api';
import {
  listMemory,
  type KnowledgeEntry,
} from '@/lib/agent-api';
import {
  listTasks,
  type BackgroundTask,
} from '@/lib/agent-api';

// ============================================================
// Feature Flags Section
// ============================================================

function FeatureFlagsSection() {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [defaults, setDefaults] = useState<FeatureFlags>({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getFeatureFlags();
      setFlags(data.flags);
      setDefaults(data.defaults);
    } catch (e) {
      console.error('Failed to load feature flags:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const FLAG_LABELS: Record<string, string> = {
    agent_session: 'Agent 会话系统',
    blueprint_management: 'Blueprint 管理',
    pptx_generation: 'PPTX 报告生成',
    five_dimensions: '五维诊断',
    workshop_tools: '工作坊工具',
    knowledge_base: '知识库',
    tool_registry: '工具注册表',
    hook_system: 'Hook 拦截系统',
    memory_system: '记忆体系',
    dream_consolidation: 'AutoDream 巩固',
    background_tasks: '后台任务',
  };

  const NEW_FLAGS = new Set(['tool_registry', 'hook_system', 'memory_system', 'dream_consolidation', 'background_tasks']);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
        <span>🔧</span>
        功能开关
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        控制系统功能的启用/禁用。优先级：环境变量 &gt; 默认值。项目级覆盖需通过 API 设置。
      </p>
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-gray-400 text-sm">加载中...</div>
      ) : (
        <div className="space-y-1">
          {Object.entries(defaults).map(([key, defaultVal]) => (
            <div key={key} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-block w-2.5 h-2.5 rounded-full transition-colors ${
                    flags[key] ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                />
                <span className="text-sm text-gray-700">{FLAG_LABELS[key] || key}</span>
                {NEW_FLAGS.has(key) && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">新</span>
                )}
              </div>
              <span
                className={`text-xs font-mono px-2 py-1 rounded ${
                  flags[key]
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {flags[key] ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      )}
      <button
        onClick={load}
        className="mt-4 text-sm text-blue-600 hover:text-blue-800"
      >
        ↻ 刷新
      </button>
    </div>
  );
}

// ============================================================
// Tool Registry & Hooks Section
// ============================================================

function ToolsAndHooksSection() {
  const [tools, setTools] = useState<Array<{ name: string; description: string; category: string }>>([]);
  const [hooks, setHooks] = useState<Array<{ name: string; hook_point: string; priority: number }>>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [toolsRes, hooksRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agent/tools`).then((r) => r.json()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL || ''}/api/v1/agent/hooks`).then((r) => r.json()),
      ]);
      setTools(toolsRes || []);
      setHooks(hooksRes || []);
    } catch (e) {
      console.error('Failed to load:', e);
      setTools([]);
      setHooks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      {/* Tool Registry */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
          <span>🧩</span>
          工具注册表
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          已注册的咨询工具，Agent 节点通过 ToolRegistry 调用。
        </p>
        {loading ? (
          <div className="text-gray-400 text-sm py-4">加载中...</div>
        ) : tools.length === 0 ? (
          <div className="text-gray-400 text-sm py-4">
            暂无已注册工具（功能开关 tool_registry = OFF 时工具不会被加载）
          </div>
        ) : (
          <div className="space-y-1">
            {tools.map((t) => (
              <div key={t.name} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-mono">
                    {t.category}
                  </span>
                  <span className="text-sm text-gray-700">{t.description}</span>
                </div>
                <code className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">{t.name}</code>
              </div>
            ))}
          </div>
        )}
        <button onClick={load} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          ↻ 刷新
        </button>
      </div>

      {/* Hook System */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
          <span>🪝️</span>
          Hook 拦截器
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          工作流拦截器，按优先级执行。可在工具调用前后插入自定义逻辑。
        </p>
        {loading ? (
          <div className="text-gray-400 text-sm py-4">加载中...</div>
        ) : hooks.length === 0 ? (
          <div className="text-gray-400 text-sm py-4">
            暂无已注册 Hook（功能开关 hook_system = OFF）
          </div>
        ) : (
          <div className="space-y-1">
            {hooks.map((h) => (
              <div key={h.name} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50">
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-mono">
                    {h.hook_point}
                  </span>
                  <span className="text-sm text-gray-700">{h.name}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono bg-gray-50 px-2 py-1 rounded">
                  P{h.priority}
                </span>
              </div>
            ))}
          </div>
        )}
        <button onClick={load} className="mt-3 text-sm text-blue-600 hover:text-blue-800">
          ↻ 刷新
        </button>
      </div>
    </div>
  );
}

// ============================================================
// AutoDream Section
// ============================================================

function AutoDreamSection() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
        <span>💭</span>
        AutoDream 记忆巩固
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        后台自动从近期咨询会话中提炼知识，写入项目知识库。三级门控（时间 &ge; 24h + 会话数 &ge; 3）。
      </p>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <div className="flex items-start gap-2">
          <span className="text-blue-600 mt-0.5">💡</span>
          <div className="text-sm text-blue-800">
            <p className="font-medium">工作原理</p>
            <ol className="mt-1 list-decimal list-inside text-blue-700 space-y-1 text-xs">
              <li>咨询会话完成后自动触发检查</li>
              <li>满足条件时启动四阶段巩固（定向→收集→整合→修剪）</li>
              <li>知识按 client / methodology / project / reference 四类存储</li>
              <li>通过环境变量 <code className="bg-blue-100 px-1 rounded">FEATURE_DREAM_CONSOLIDATION=true</code> 启用</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-gray-500 text-xs">门控参数</span>
          <p className="text-gray-900 font-mono text-xs mt-1">min_hours=24</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-gray-500 text-xs">会话阈值</span>
          <p className="text-gray-900 font-mono text-xs mt-1">min_sessions=3</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <span className="text-gray-500 text-xs">状态</span>
          <p className="text-gray-900 font-mono text-xs mt-1">
            {typeof window !== 'undefined' && process.env.NEXT_PUBLIC_API_URL ? '已连接' : '未知'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Background Tasks Section
// ============================================================

function BackgroundTasksSection() {
  const [tasks, setTasks] = useState<BackgroundTask[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await listTasks();
      setTasks(result.items || []);
    } catch (e) {
      console.error('Failed to load tasks:', e);
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    pending: { label: '等待中', color: 'text-gray-600', bg: 'bg-gray-100' },
    running: { label: '执行中', color: 'text-blue-600', bg: 'bg-blue-50' },
    completed: { label: '已完成', color: 'text-green-600', bg: 'bg-green-50' },
    failed: { label: '失败', color: 'text-red-600', bg: 'bg-red-50' },
    cancelled: { label: '已取消', color: 'text-gray-400', bg: 'bg-gray-50' },
  };

  const typeLabels: Record<string, string> = {
    report_generation: '报告生成',
    data_export: '数据导出',
    dream_consolidation: '记忆巩固',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h2 className="text-lg font-medium mb-1 flex items-center gap-2">
        <span>📋</span>
        后台任务
      </h2>
      <p className="text-sm text-gray-500 mb-4">
        后台异步任务（报告生成、数据导出、知识巩固）的执行状态。
      </p>
      <button onClick={load} className="mb-4 text-sm text-blue-600 hover:text-blue-800">
        ↻ 刷新
      </button>
      {loading ? (
        <div className="text-gray-400 text-sm py-4">加载中...</div>
      ) : tasks.length === 0 ? (
        <div className="text-gray-400 text-sm py-4">暂无后台任务记录（仅保留当前进程生命周期内的任务）</div>
      ) : (
        <div className="space-y-2">
          {tasks.map((t) => {
            const sc = statusConfig[t.status] || statusConfig.pending;
            return (
              <div key={t.task_id} className="flex items-center justify-between py-2 px-3 border border-gray-100 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded ${sc.bg} ${sc.color}`}>{sc.label}</span>
                    <span className="text-sm text-gray-700 truncate">{typeLabels[t.task_type] || t.task_type}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {t.task_id} · {t.created_at}
                  </div>
                </div>
                {t.error && (
                  <span className="text-xs text-red-500 ml-2 truncate max-w-[200px]" title={t.error}>
                    {t.error}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

export default function SystemAdminPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">系统管理</h1>
        <p className="text-gray-500 mt-1">
          功能开关、工具注册表、Hook 拦截器、记忆巩固、后台任务
        </p>
      </div>

      <div className="space-y-6">
        <FeatureFlagsSection />
        <ToolsAndHooksSection />
        <AutoDreamSection />
        <BackgroundTasksSection />
      </div>
    </div>
  );
}
