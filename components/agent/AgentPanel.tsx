'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  createSessionFromProject,
  resumeSession,
  type AgentSession,
  type ChatMessage,
  type InteractionResponse,
} from '@/lib/agent-api';
import AgentChat from './AgentChat';

interface AgentPanelProps {
  projectId: string;
  mode: 'proposal' | 'consulting_report';
  benchmarkId: string;
  projectGoal: string;
  open: boolean;
  onClose: () => void;
  onComplete?: (result: { pptxUrl: string; sessionId: string }) => void;
  workflowData?: Record<string, unknown>;
  /** When true, renders as an inline sidebar (no overlay/modal). Used in project workspace. */
  embedded?: boolean;
}

/**
 * AgentPanel — 可复用的 AI 顾问面板。
 *
 * 两种模式:
 * - embedded=false (默认): 全屏 Modal 覆盖层
 * - embedded=true: 内嵌侧栏，由父组件控制尺寸
 *
 * 行为：
 * 1. open=true 时，调用 createSessionFromProject() 创建带种子数据的会话
 * 2. 先展示 Plan Mode 分析动画（让用户感知 AI 正在分析已有数据）
 * 3. 动画结束后显示实际交互 UI（interact 表单或 execute 进度）
 * 4. 完成后 emit onComplete 回调
 * 5. 可随时关闭（会话持久化）
 */
export default function AgentPanel({
  projectId,
  mode,
  benchmarkId,
  projectGoal,
  open,
  onClose,
  onComplete,
  workflowData,
  embedded = false,
}: AgentPanelProps) {
  const [session, setSession] = useState<AgentSession | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [interaction, setInteraction] = useState<InteractionResponse | null>(null);
  const [progress, setProgress] = useState(0);
  const [agentMode, setAgentMode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);

  // Plan Mode transition: show analysis animation before actual mode
  const [showPlanIntro, setShowPlanIntro] = useState(false);
  const [planIntroSeeds, setPlanIntroSeeds] = useState<string[]>([]);
  const planIntroTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (planIntroTimer.current) clearTimeout(planIntroTimer.current);
    };
  }, []);

  // 打开面板时自动启动（每次打开都重新创建 session，确保使用最新 workflowData）
  useEffect(() => {
    if (!open) return;
    setStarted(true);
    setLoading(true);
    setError('');
    setSession(null);
    setMessages([]);
    setInteraction(null);
    setShowPlanIntro(false);
    if (planIntroTimer.current) clearTimeout(planIntroTimer.current);

    createSessionFromProject(projectId, benchmarkId, projectGoal, mode, workflowData)
      .then((result) => {
        setSession(result.session);
        setAgentMode(result.mode);
        setProgress(result.progress);

        const sessionKey = result.session?._key;
        const downloadUrl = sessionKey
          ? `/api/v1/agent/sessions/${sessionKey}/download`
          : undefined;

        // ── mode=completed: report generated immediately ──
        if (result.mode === 'completed') {
          setShowPlanIntro(false);
          setMessages([
            {
              role: 'assistant',
              content: result.interaction?.message || '报告已生成完毕。',
              metadata: {
                context: result.interaction?.context,
                kernel_objects_created: ['knowledge_graph', 'project_spec'],
                pptx_download_url: downloadUrl,
              },
            },
          ]);
          if (onComplete && downloadUrl) {
            onComplete({ pptxUrl: downloadUrl, sessionId: sessionKey });
          }
          return;
        }

        // ── mode=plan/interact/execute: normal flow ──
        const hasSeeds = result.seeded_nodes && result.seeded_nodes.length > 0;
        if (hasSeeds) {
          setPlanIntroSeeds(result.seeded_nodes);
          setShowPlanIntro(true);
          planIntroTimer.current = setTimeout(() => {
            setShowPlanIntro(false);
            if (result.interaction) {
              setInteraction(result.interaction);
            }
            setMessages([
              {
                role: 'assistant',
                content: result.interaction?.message || '数据已分析完毕，请确认以下信息。',
                metadata: {
                  ui_components: result.interaction?.ui_components,
                  context: result.interaction?.context,
                },
              },
            ]);
          }, 2000);
        } else {
          if (result.interaction) {
            setInteraction(result.interaction);
          }
          setMessages(
            result.interaction
              ? [
                  {
                    role: 'assistant',
                    content: result.interaction.message,
                    metadata: {
                      ui_components: result.interaction.ui_components,
                      context: result.interaction.context,
                    },
                  },
                ]
              : [],
          );
        }
      })
      .catch((e) => {
        setError(e instanceof Error ? e.message : '启动 AI 顾问失败');
      })
      .finally(() => setLoading(false));
  }, [open, projectId, benchmarkId, projectGoal, mode, workflowData]);

  // 提交表单
  const handleFormSubmit = useCallback(
    async (data: Record<string, unknown>) => {
      if (!session) return;
      setLoading(true);
      try {
        const result = await resumeSession(session._key, data);
        setAgentMode(result.mode);
        setProgress(result.progress);

        if (result.interaction) {
          setInteraction(result.interaction);
        }

        // 用户消息
        const userMsg: ChatMessage = {
          role: 'user',
          content: `已提交: ${Object.entries(data)
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ')}`,
        };

        // AI 响应
        let assistantContent = result.interaction?.message || '';
        if (result.mode === 'completed' && !assistantContent) {
          const parts = ['数据已收集完毕，报告已生成。'];
          if (result.distilled_spec) {
            parts.push(
              `项目标题：${(result.distilled_spec as Record<string, string>).project_title || ''}`,
            );
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
            pptx_download_url: session
              ? `/api/v1/agent/sessions/${session._key}/download`
              : undefined,
          },
        };

        setMessages((prev) => [...prev, userMsg, assistantMsg]);

        // 完成回调
        if (result.mode === 'completed' && onComplete) {
          onComplete({
            pptxUrl: `/api/v1/agent/sessions/${session._key}/download`,
            sessionId: session._key,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '提交失败');
      } finally {
        setLoading(false);
      }
    },
    [session, onComplete],
  );

  if (!open) return null;

  // Shared inner content
  const panelContent = (
    <>
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            AI {mode === 'proposal' ? '建议书生成' : '咨询报告生成'}
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {started && !error
              ? session
                ? showPlanIntro
                  ? `正在分析项目数据...`
                  : `会话 ${session._key.slice(0, 8)}...`
                : '正在初始化...'
              : ''}
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 内容区 */}
      <div className="flex-1 min-h-0">
        {error ? (
          <div className="flex flex-col items-center justify-center h-full px-8">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-sm text-red-600 text-center">{error}</p>
            <button
              onClick={() => {
                setStarted(false);
                setError('');
              }}
              className="mt-4 px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              重试
            </button>
          </div>
        ) : showPlanIntro ? (
          /* Plan Mode Intro — AI analyzing inherited data */
          <div className="flex flex-col items-center justify-center h-full px-6 py-8">
            <div className="mb-6">
              <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            </div>

            <h3 className="text-sm font-medium text-gray-900 mb-1">AI 正在分析项目数据</h3>
            <p className="text-xs text-gray-500 text-center max-w-[280px] mb-6">
              已读取 {planIntroSeeds.length} 个模块的工作流数据，正在生成分析...
            </p>

            {/* Seeded data indicators */}
            <div className="w-full max-w-[300px] space-y-2 mb-6">
              {planIntroSeeds.map((seed, idx) => (
                <div key={idx} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <span className="text-xs text-gray-600">{seed}</span>
                </div>
              ))}
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                </div>
                <span className="text-xs text-gray-900 font-medium">智能分析中...</span>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full max-w-[300px]">
              <div className="w-full bg-gray-100 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-[2000ms] ease-out"
                  style={{ width: '0%', animation: 'fill-progress 2s ease-out forwards' }}
                />
              </div>
              <span className="text-[10px] text-gray-400 mt-1.5 block text-center">读取工作流数据并生成分析</span>
            </div>
          </div>
        ) : started && !loading ? (
          <AgentChat
            messages={messages}
            interaction={interaction}
            progress={progress}
            mode={agentMode}
            onFormSubmit={handleFormSubmit}
            loading={loading}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">正在加载 AI 顾问...</p>
            </div>
          </div>
        )}
      </div>
    </>
  );

  // Embedded mode: inline sidebar (no overlay)
  if (embedded) {
    return (
      <div className="h-full flex flex-col bg-white">
        {panelContent}
      </div>
    );
  }

  // Default: full modal overlay
  return (
    <div className="fixed inset-0 z-50 flex">
      {/* 遮罩 */}
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />

      {/* 面板 */}
      <div className="relative ml-auto w-full max-w-2xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        {panelContent}
      </div>

      <style jsx>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
        @keyframes fill-progress {
          from { width: 0%; }
          to { width: 85%; }
        }
      `}</style>
    </div>
  );
}
