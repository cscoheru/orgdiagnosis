'use client';

import type { ChatMessage as ChatMessageType, UIComponent } from '@/lib/agent-api';
import FormCard from './FormCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onFormSubmit?: (data: Record<string, unknown>) => void;
  formLoading?: boolean;
}

/**
 * ChatMessage — 单条对话消息

 * - assistant 消息：显示 AI 引导话术，如果附带 ui_components 则渲染 FormCard
 * - user 消息：显示用户提交的数据摘要
 * - system 消息：显示系统通知（灰色，左对齐）
 */
export default function ChatMessage({ message, onFormSubmit, formLoading }: ChatMessageProps) {
  const { role, content, metadata } = message;

  if (role === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-xs text-gray-400 bg-gray-50 px-3 py-1 rounded-full">
          {content}
        </span>
      </div>
    );
  }

  if (role === 'user') {
    return (
      <div className="flex justify-end mb-4">
        <div className="max-w-[70%] bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-br-md text-sm">
          {content}
        </div>
      </div>
    );
  }

  // assistant
  const uiComponents = metadata?.ui_components as UIComponent[] | undefined;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] space-y-3">
        {/* AI 文本消息 */}
        <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md text-sm text-gray-800 leading-relaxed">
          {content}
        </div>

        {/* 动态表单 */}
        {uiComponents && uiComponents.length > 0 && onFormSubmit && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <FormCard
              components={uiComponents}
              onSubmit={onFormSubmit}
              loading={formLoading}
            />
          </div>
        )}

        {/* 完成通知 */}
        {metadata?.kernel_objects_created && (
          <div className="bg-green-50 border border-green-200 px-4 py-2.5 rounded-xl text-sm text-green-700">
            数据已存入知识图谱 ({metadata.kernel_objects_created.length} 条记录)
          </div>
        )}
      </div>
    </div>
  );
}
