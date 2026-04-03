/**
 * 诊断聊天组件
 * 用于 5 问法深度挖掘根因
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { ChatMessage } from '@/types/strategy';
import { continueDiagnosticChat, extractRootCause } from '@/lib/zhipu-api';
import { useStore } from '@/lib/store';

interface DiagnosticChatProps {
  dimensionId: string;
  dimensionName: string;
  initialMessage: string;
  messages: ChatMessage[];
  onMessagesChange: (messages: ChatMessage[]) => void;
  onRootCauseExtracted: (rootCause: string) => void;
  onClose: () => void;
}

export function DiagnosticChat({
  dimensionId,
  dimensionName,
  initialMessage,
  messages,
  onMessagesChange,
  onRootCauseExtracted,
  onClose
}: DiagnosticChatProps) {
  const { modelConfig } = useStore();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, userMessage];
    onMessagesChange(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const aiResponse = await continueDiagnosticChat(
        modelConfig.apiKey,
        messages.map(m => ({ role: m.role, content: m.content })),
        inputValue
      );

      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: aiResponse,
        timestamp: Date.now()
      };

      onMessagesChange([...updatedMessages, aiMessage]);
    } catch (error: any) {
      alert(`追问失败: ${error.message || '请检查 API 配置'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExtractRootCause = async () => {
    if (messages.length < 3) {
      alert('请至少进行 2 轮对话后再提取根因');
      return;
    }

    setIsExtracting(true);
    try {
      const rootCause = await extractRootCause(
        modelConfig.apiKey,
        dimensionName,
        messages.map(m => ({ role: m.role, content: m.content }))
      );
      onRootCauseExtracted(rootCause);
    } catch (error: any) {
      alert(`提取根因失败: ${error.message || '请检查 API 配置'}`);
    } finally {
      setIsExtracting(false);
    }
  };

  const canExtractRootCause = messages.length >= 3;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              深度诊断：{dimensionName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
              使用 5 问法挖掘根本原因
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-medium mb-1">引导师正在思考...</p>
                <p className="opacity-80">{initialMessage}</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-gray-100'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                <p className="text-xs mt-2 opacity-70">
                  {new Date(message.timestamp).toLocaleTimeString('zh-CN', {
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-slate-700 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100" />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 space-y-3">
          {canExtractRootCause && (
            <button
              onClick={handleExtractRootCause}
              disabled={isExtracting}
              className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed
                         text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              {isExtracting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  提取中...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-5 h-5" />
                  提取根因并完成诊断
                </>
              )}
            </button>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="回答引导师的问题..."
              disabled={isLoading || isExtracting}
              className="flex-1 px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-700 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500
                         disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isLoading || isExtracting}
              className="px-4 py-3 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400 disabled:cursor-not-allowed
                         text-white rounded-lg transition-colors"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
