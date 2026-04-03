'use client';

import { useState, useEffect } from 'react';
import { getFeatureFlags, type FeatureFlags } from '@/lib/agent-api';

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

export default function FeatureFlagsPanel() {
  const [flags, setFlags] = useState<FeatureFlags>({});
  const [defaults, setDefaults] = useState<FeatureFlags>({});
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeatureFlags()
      .then((data) => {
        setFlags(data.flags);
        setDefaults(data.defaults);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;

  const newFlagsCount = Object.entries(flags).filter(
    ([key]) => NEW_FLAGS.has(key) && flags[key]
  ).length;

  return (
    <div className="border border-gray-200 rounded-xl bg-white">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900">功能开关</span>
          {newFlagsCount > 0 && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
              {newFlagsCount} 新功能已启用
            </span>
          )}
        </div>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className={`w-4 h-4 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-2">
          <p className="text-xs text-gray-400 mb-3">
            优先级：项目级设置 &gt; 环境变量 &gt; 默认值
          </p>
          {Object.entries(defaults).map(([key, defaultVal]) => (
            <div key={key} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${flags[key] ? 'bg-green-500' : 'bg-gray-300'}`} />
                <span className="text-sm text-gray-700">{FLAG_LABELS[key] || key}</span>
                {NEW_FLAGS.has(key) && (
                  <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">新</span>
                )}
              </div>
              <span className={`text-xs font-mono ${flags[key] ? 'text-green-600' : 'text-gray-400'}`}>
                {flags[key] ? 'ON' : 'OFF'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
