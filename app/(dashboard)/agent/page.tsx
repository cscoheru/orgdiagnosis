'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  createSession,
  resumeSession,
  getBenchmarks,
  type AgentSession,
  type ChatMessage,
  type InteractionResponse,
} from '@/lib/agent-api';
import AgentChat from '@/components/agent/AgentChat';

export const dynamic = 'force-dynamic';

type Phase = 'select' | 'chat' | 'error';

export default function AgentPage() {
  const [phase, setPhase] = useState<Phase>('select');
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interaction, setInteraction] = useState<InteractionResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [mode, setMode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [goal, setGoal] = useState('');

  // 选择面板
  const [benchmarks, setBenchmarks] = useState<Array<{
    _key: string;
    properties: { title: string; industry: string; consulting_type: string; description?: string };
  }>>([]);
  const [selectedBm, setSelectedBm] = useState('');

  // 加载标杆列表
  useEffect(() => {
    getBenchmarks()
      .then(setBenchmarks)
      .catch((e) => console.error('Failed to load benchmarks:', e));
  }, []);

  // 创建会话
  const handleStart = useCallback(async () => {
    if (!goal.trim() || !selectedBm) return;
    setLoading(true);
    setError('');
    try {
      const result = await createSession(goal, selectedBm);
      setSession(result.session);
      setInteraction(result.interaction);
      setMode(result.mode);
      setProgress(result.progress);
      setMessages([]);
      setPhase('chat');
    } catch (e) {
      setError(e instanceof Error ? e.message : '创建会话失败');
    } finally {
      setLoading(false);
    }
  }, [goal, selectedBm]);

  // 提交表单数据
  const handleFormSubmit = useCallback(async (data: Record<string, unknown>) => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await resumeSession(session._key, data);

      setMode(result.mode);
      setProgress(result.progress);

      if (result.interaction) {
        setInteraction(result.interaction);
      }

      // 添加用户消息
      const userMsg: ChatMessage = {
        role: 'user',
        content: `已提交: ${Object.entries(data)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}`)
          .join(', ')}`,
      };

      // 添加 AI 响应消息
      // completed 时 interaction 为空，需要从 metadata 构建内容
      let assistantContent = result.interaction?.message || '';
      if (result.mode === 'completed' && !assistantContent) {
        const parts = ['所有数据已收集完毕，分析报告已生成。'];
        if (result.distilled_spec) {
          parts.push(`项目标题：${(result.distilled_spec as Record<string, string>).project_title || ''}`);
        }
        assistantContent = parts.join('\n');
      }

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: assistantContent,
        metadata: {
          ui_components: result.interaction?.ui_components,
          context: result.interaction?.context,
          kernel_objects_created: result.kernel_objects_created,
          distilled_spec: result.distilled_spec,
          pptx_download_url: session ? `/api/v1/agent/sessions/${session._key}/download` : undefined,
        },
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
    } catch (e) {
      setError(e instanceof Error ? e.message : '提交失败');
    } finally {
      setLoading(false);
    }
  }, [session]);

  // ─── 渲染 ───

  if (phase === 'select') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">AI 顾问</h1>
        <p className="text-gray-500 mb-8">选择标杆报告模板，开始智能咨询对话</p>

        {/* 目标输入 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            您的咨询目标
          </label>
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="例如：帮我做XX公司的组织诊断，找出管理痛点并给出改进建议"
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
          />
        </div>

        {/* 标杆选择 */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            选择标杆报告模板
          </label>
          <div className="grid grid-cols-1 gap-3">
            {benchmarks.map((bm) => (
              <button
                key={bm._key}
                onClick={() => setSelectedBm(bm._key)}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  selectedBm === bm._key
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{bm.properties.title}</h3>
                    {bm.properties.description && (
                      <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                        {bm.properties.description}
                      </p>
                    )}
                  </div>
                  <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full ml-3 shrink-0">
                    {bm.properties.consulting_type}
                  </span>
                </div>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs text-gray-400">{bm.properties.industry}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!goal.trim() || !selectedBm || loading}
          className="w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? '正在启动...' : '开始咨询'}
        </button>
      </div>
    );
  }

  // Chat phase
  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      <AgentChat
        messages={messages}
        interaction={interaction}
        progress={progress}
        mode={mode}
        onFormSubmit={handleFormSubmit}
        loading={loading}
      />
    </div>
  );
}
