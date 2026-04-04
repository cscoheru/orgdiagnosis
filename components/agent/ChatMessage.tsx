'use client';

import type { ChatMessage as ChatMessageType, UIComponent } from '@/lib/agent-api';
import FormCard from './FormCard';

interface ChatMessageProps {
  message: ChatMessageType;
  onFormSubmit?: (data: Record<string, unknown>) => void;
  formLoading?: boolean;
  /** When true, only show the form card (hide long AI text). Used in interact mode. */
  compact?: boolean;
}

/**
 * ChatMessage — 单条对话消息

 * - assistant 消息：显示 AI 引导话术，如果附带 ui_components 则渲染 FormCard
 * - user 消息：显示用户提交的数据摘要
 * - system 消息：显示系统通知（灰色，左对齐）
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

export default function ChatMessage({ message, onFormSubmit, formLoading, compact }: ChatMessageProps) {
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
  const hasForm = uiComponents && uiComponents.length > 0 && onFormSubmit;

  return (
    <div className="flex justify-start mb-4">
      <div className="max-w-[80%] space-y-3">
        {/* AI text message — hide in compact mode when form is present */}
        {!compact && (
          <div className="bg-white border border-gray-200 px-4 py-3 rounded-2xl rounded-bl-md text-sm text-gray-800 leading-relaxed">
            {content}
          </div>
        )}

        {/* Compact mode: show short label + form directly */}
        {compact && hasForm && (
          <div className="bg-blue-50 border border-blue-100 px-3 py-2 rounded-lg">
            <p className="text-xs font-medium text-blue-700 mb-1">需要您的决策</p>
            {content && content.length < 80 && (
              <p className="text-xs text-blue-600/80">{content}</p>
            )}
          </div>
        )}

        {/* Dynamic form */}
        {hasForm && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
            <FormCard
              components={uiComponents!}
              onSubmit={onFormSubmit}
              loading={formLoading}
            />
          </div>
        )}

        {/* Completion notification + download */}
        {metadata?.kernel_objects_created && (
          <div className="bg-green-50 border border-green-200 px-4 py-3 rounded-xl text-sm text-green-700 space-y-2">
            <p>数据已存入知识图谱 ({metadata.kernel_objects_created.length} 条记录)，报告已生成。</p>
            {metadata.pptx_download_url && (
              <a
                href={`${API_BASE}${metadata.pptx_download_url}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                download
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                下载咨询报告 (PPTX)
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
