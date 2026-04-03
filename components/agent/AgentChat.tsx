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
