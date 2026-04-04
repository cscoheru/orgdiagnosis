'use client';

import { useState, useRef, useEffect } from 'react';
import {
  getTask,
  type ChatMessage as ChatMessageType,
  type InteractionResponse,
} from '@/lib/agent-api';
import ChatMessage from './ChatMessage';
import ProgressBar from './ProgressBar';

interface AgentChatProps {
  messages: ChatMessageType[];
  interaction: InteractionResponse | null;
  progress: number;
  mode: string;
  onFormSubmit: (data: Record<string, unknown>) => void;
  loading: boolean;
  taskId?: string | null;
}

// ──────────────────────────────────────────────
// Plan Mode View — AI 自主分析可视化
// ──────────────────────────────────────────────

/** Derive analysis steps from the interaction context and message history */
function derivePlanSteps(
  messages: ChatMessageType[],
  interaction: InteractionResponse | null,
  progress: number
): { label: string; status: 'done' | 'active' | 'pending' }[] {
  const steps: { label: string; status: 'done' | 'active' | 'pending' }[] = [];

  // Collect assistant messages as step descriptions
  const assistantMessages = messages.filter(m => m.role === 'assistant');

  // Common analysis phases based on progress
  if (progress >= 0) steps.push({ label: '读取项目工作流数据', status: 'done' });
  if (progress >= 0.1) steps.push({ label: '分析需求与目标', status: progress > 0.2 ? 'done' : 'active' });
  if (progress >= 0.2) steps.push({ label: '对标行业最佳实践', status: progress > 0.4 ? 'done' : 'active' });
  if (progress >= 0.4) steps.push({ label: '组织能力差距分析', status: progress > 0.6 ? 'done' : 'active' });
  if (progress >= 0.6) steps.push({ label: '生成建议方案', status: progress > 0.8 ? 'done' : 'active' });
  if (progress >= 0.8) steps.push({ label: '编排报告结构', status: progress > 0.95 ? 'done' : 'active' });

  // Mark all steps before the active one as done, after as pending
  let foundActive = false;
  for (const step of steps) {
    if (foundActive) {
      step.status = 'pending';
    } else if (step.status === 'active') {
      foundActive = true;
    }
  }

  // If we have recent assistant messages, use the last one as the active step description
  if (assistantMessages.length > 0 && interaction) {
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    // Update the active step label with the actual AI message
    const activeStep = steps.find(s => s.status === 'active');
    if (activeStep && lastMsg.content) {
      // Truncate long messages
      const truncated = lastMsg.content.length > 40
        ? lastMsg.content.slice(0, 40) + '...'
        : lastMsg.content;
      activeStep.label = truncated;
    }
  }

  return steps;
}

function PlanModeView({
  messages,
  interaction,
  progress,
}: {
  messages: ChatMessageType[];
  interaction: InteractionResponse | null;
  progress: number;
}) {
  const steps = derivePlanSteps(messages, interaction, progress);
  const currentNode = interaction?.context?.current_node || '';
  const currentMessage = interaction?.message || '';

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8">
      {/* AI thinking animation */}
      <div className="mb-6">
        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>

      <h3 className="text-sm font-medium text-gray-900 mb-1">AI 正在分析项目数据</h3>
      {currentMessage && (
        <p className="text-xs text-gray-500 text-center max-w-[280px] mb-6 line-clamp-2">
          {currentMessage}
        </p>
      )}

      {/* Analysis steps */}
      <div className="w-full max-w-[300px] space-y-2 mb-6">
        {steps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-2.5">
            {step.status === 'done' && (
              <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            )}
            {step.status === 'active' && (
              <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              </div>
            )}
            {step.status === 'pending' && (
              <div className="w-5 h-5 rounded-full bg-gray-100 flex-shrink-0" />
            )}
            <span className={`text-xs ${
              step.status === 'done' ? 'text-gray-400' :
              step.status === 'active' ? 'text-gray-900 font-medium' :
              'text-gray-300'
            }`}>
              {step.label}
            </span>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-[300px]">
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-blue-500 h-1.5 rounded-full transition-all duration-700 ease-out"
            style={{ width: `${Math.max(5, progress * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-gray-400">{currentNode}</span>
          <span className="text-[10px] text-gray-400">{Math.round(progress * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────
// Main AgentChat Component
// ──────────────────────────────────────────────

export default function AgentChat({
  messages,
  interaction,
  progress,
  mode,
  onFormSubmit,
  loading,
  taskId,
}: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [taskStatus, setTaskStatus] = useState<string | null>(null);
  const [taskProgress, setTaskProgress] = useState(0);

  // Poll background task progress
  useEffect(() => {
    if (!taskId) return;
    let interval: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const task = await getTask(taskId);
        setTaskStatus(task.status);
        setTaskProgress(task.progress);
        if (['completed', 'failed', 'cancelled'].includes(task.status)) {
          clearInterval(interval);
        }
      } catch {
        // ignore polling errors
      }
    };

    poll();
    interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [taskId]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, taskStatus]);

  // Build display messages: inject latest interaction into last assistant message
  const displayMessages = [...messages];
  if (interaction && mode === 'interact') {
    const lastAssistantIdx = [...displayMessages].reverse().findIndex(
      (m) => m.role === 'assistant'
    );
    if (lastAssistantIdx >= 0) {
      const actualIdx = displayMessages.length - 1 - lastAssistantIdx;
      const existing = displayMessages[actualIdx];
      displayMessages[actualIdx] = {
        ...existing,
        metadata: {
          ...existing.metadata,
          ui_components: interaction.ui_components,
          context: interaction.context,
        },
      };
    } else {
      displayMessages.push({
        role: 'assistant',
        content: interaction.message,
        metadata: {
          ui_components: interaction.ui_components,
          context: interaction.context,
        },
      });
    }
  }

  const context = interaction?.context;

  // ── Plan Mode: show autonomous analysis view ──
  if (mode === 'plan') {
    return (
      <div className="flex flex-col h-full">
        {/* Progress bar */}
        {context && (
          <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/50">
            <ProgressBar
              progress={progress}
              currentNode={context.current_node}
              benchmarkTitle={context.benchmark_title}
            />
          </div>
        )}

        {/* Plan mode analysis view */}
        <div className="flex-1 min-h-0">
          <PlanModeView
            messages={messages}
            interaction={interaction}
            progress={progress}
          />
        </div>
      </div>
    );
  }

  // ── Interact / Execute / Completed mode: chat view ──
  return (
    <div className="flex flex-col h-full">
      {/* Progress bar */}
      {context && (
        <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/50">
          <ProgressBar
            progress={progress}
            currentNode={context.current_node}
            benchmarkTitle={context.benchmark_title}
          />
        </div>
      )}

      {/* Background task progress */}
      {taskStatus && (
        <div className="border-b border-blue-100 px-4 py-2 bg-blue-50/50">
          <div className="flex items-center gap-3">
            {taskStatus === 'running' && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
            {taskStatus === 'completed' && (
              <span className="text-green-600 text-sm">&#10003;</span>
            )}
            {taskStatus === 'failed' && (
              <span className="text-red-600 text-sm">&#10007;</span>
            )}
            <span className="text-sm text-gray-700">
              {taskStatus === 'running' ? `报告生成中... ${Math.round(taskProgress * 100)}%`
                : taskStatus === 'completed' ? '报告生成完成'
                : taskStatus === 'failed' ? '报告生成失败'
                : taskStatus}
            </span>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
        {displayMessages.length === 0 && !loading && (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            等待 Agent 响应...
          </div>
        )}
        {displayMessages.map((msg, idx) => (
          <ChatMessage
            key={idx}
            message={msg}
            onFormSubmit={
              idx === displayMessages.length - 1 && mode === 'interact'
                ? onFormSubmit
                : undefined
            }
            formLoading={loading}
            compact={mode === 'interact' && idx === displayMessages.length - 1}
          />
        ))}

        {/* Loading indicator */}
        {loading && (
          <div className="flex justify-start mb-4">
            <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md">
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
