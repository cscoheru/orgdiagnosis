'use client';

import { useState, useRef, useEffect } from 'react';
import type {
  ChatMessage as ChatMessageType,
  InteractionResponse,
  UIComponent,
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
}

/**
 * AgentChat — Agent 对话容器

 * 左上角显示进度条，主区域是消息流（类 ChatGPT）。
 * 最新的 assistant 消息中的 ui_components 由 FormCard 渲染。
 */
export default function AgentChat({
  messages,
  interaction,
  progress,
  mode,
  onFormSubmit,
  loading,
}: AgentChatProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // 自动滚动到底部
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 构建显示用的消息列表：将最新的 interaction 注入到最后一条 assistant 消息
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
      {/* 顶部进度条 */}
      {context && (
        <div className="border-b border-gray-100 px-4 py-3 bg-gray-50/50">
          <ProgressBar
            progress={progress}
            currentNode={context.current_node}
            benchmarkTitle={context.benchmark_title}
          />
        </div>
      )}

      {/* 消息区域 */}
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
              // 只在最后一条 assistant 消息上渲染表单
              idx === displayMessages.length - 1 && mode === 'interact'
                ? onFormSubmit
                : undefined
            }
            formLoading={loading}
          />
        ))}

        {/* 加载指示 */}
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
