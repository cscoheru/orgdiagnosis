'use client';

/**
 * 能力模型校准 — AI 预分析 + 对话组件
 *
 * 1. 进入 Tab 时自动调用后端 AI，生成 L2/L3 优化建议
 * 2. 用户可直接编辑建议内容，不满意可通过对话继续调整
 * 3. 对话走后端 /api/v1/competency/calibrate（DashScope/DeepSeek）
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CompetencyOutput } from '@/lib/workshop/competency-types';
import { Send, Sparkles, RotateCcw, MessageSquare, Loader2, RefreshCw, Edit3, Check, X } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SUGGESTED_PROMPTS = [
  '帮我优化交付管理的 L3 行为描述，使其更符合能力标准',
  '对 DM-06 工程化交付实施的 L2 进行补充和优化',
  '评估当前项目管理能力模型的完整性和合理性',
  '为 DM-02 技术方案解决能力 补充更多 L3 行为指标',
];

interface Props {
  data: CompetencyOutput;
}

export default function CompetencyCalibrationChat({ data }: Props) {
  const [suggestion, setSuggestion] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // 加载 AI 预分析结果
  const generateSuggestion = useCallback(async () => {
    setIsGenerating(true);
    setSuggestion('');
    try {
      const res = await fetch(`${API_BASE}/api/v1/competency/calibrate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content:
                '请对当前能力模型进行全面分析，重点优化以下方面：\n' +
                '1. 交付管理(DM)的 L3 行为描述：将任务描述改为能力描述（能"做到什么程度"而非"做什么"）\n' +
                '2. 为新增的 DM-26 质量与运行保障 补充更详细的 L3 行为指标\n' +
                '3. 检查 L2 命名是否都是能力导向而非任务导向\n' +
                '4. 评估整体模型结构是否完整，提出增删建议\n\n' +
                '请直接给出优化后的完整 L2+L3 内容，格式清晰，可直接使用。',
            },
          ],
        }),
      });
      const json = await res.json();
      if (json.success) {
        setSuggestion(json.content);
        setEditText(json.content);
      } else {
        setSuggestion(`❌ ${json.detail || 'AI 服务调用失败'}`);
      }
    } catch (err) {
      setSuggestion(`❌ 网络错误: ${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsGenerating(false);
    }
  }, []);

  // 首次加载自动生成
  useEffect(() => {
    generateSuggestion();
  }, []);

  // 发送对话消息
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);
      try {
        const history = [
          ...messages.map((m) => ({ role: m.role, content: m.content })),
          { role: 'user', content: text.trim() },
        ];
        const res = await fetch(`${API_BASE}/api/v1/competency/calibrate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history }),
        });
        const json = await res.json();
        if (json.success) {
          setMessages((prev) => [...prev, { role: 'assistant', content: json.content }]);
        } else {
          setMessages((prev) => [...prev, { role: 'system', content: `❌ ${json.detail || '调用失败'}` }]);
        }
      } catch {
        setMessages((prev) => [...prev, { role: 'system', content: '❌ 网络错误，请稍后重试' }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages]
  );

  const handleSubmit = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSaveEdit = () => {
    setSuggestion(editText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(suggestion);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] min-h-[400px]">
      {/* AI Suggestion Panel */}
      <div className="mb-4 border border-gray-200 rounded-xl bg-white shadow-sm">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-indigo-500" />
            <span className="text-sm font-medium text-gray-900">AI 分析建议</span>
            {!isGenerating && suggestion && (
              <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">已生成</span>
            )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={generateSuggestion}
              disabled={isGenerating}
              className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              title="重新生成"
            >
              <RefreshCw size={14} className={isGenerating ? 'animate-spin' : ''} />
            </button>
            {!isEditing && suggestion && (
              <button
                onClick={() => { setIsEditing(true); }}
                className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="编辑"
              >
                <Edit3 size={14} />
              </button>
            )}
            {isEditing && (
              <>
                <button
                  onClick={handleSaveEdit}
                  className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                  title="保存"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="取消"
                >
                  <X size={14} />
                </button>
              </>
            )}
          </div>
        </div>
        <div className="px-4 py-3 max-h-64 overflow-y-auto">
          {isGenerating ? (
            <div className="flex items-center gap-3 text-sm text-gray-400">
              <Loader2 size={16} className="animate-spin" />
              AI 正在分析能力模型并生成优化建议...
            </div>
          ) : isEditing ? (
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              className="w-full h-48 text-sm text-gray-800 border border-gray-200 rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
            />
          ) : (
            <div className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed font-mono">
              {suggestion || '等待 AI 生成...'}
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex items-center gap-2 mb-3">
        <MessageSquare size={14} className="text-gray-400" />
        <span className="text-sm font-medium text-gray-700">
          对话调整
        </span>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors ml-auto"
          >
            清空对话
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pb-4 pr-1 min-h-0">
        {messages.length === 0 && (
          <div className="space-y-2 mb-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                disabled={isLoading}
                className="text-left w-full px-3 py-2.5 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/50 text-xs text-gray-600 transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          return (
            <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div
                className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : isSystem
                    ? 'bg-red-50 text-red-600 text-xs rounded-bl-md'
                    : 'bg-gray-50 border border-gray-100 text-gray-800 rounded-bl-md'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-xl rounded-bl-md px-3.5 py-2.5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                思考中...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 pt-2 border-t border-gray-100">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入调整需求..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          style={{ minHeight: '42px', maxHeight: '100px' }}
        />
        <button
          onClick={handleSubmit}
          disabled={!input.trim() || isLoading}
          className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex-shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
