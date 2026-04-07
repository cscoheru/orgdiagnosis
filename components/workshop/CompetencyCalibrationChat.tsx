'use client';

/**
 * 能力模型校准 — AI 对话组件
 *
 * 用户可以通过 AI 会话来优化能力模型的 L2/L3 细则。
 * System prompt 内嵌当前能力模型概要作为上下文。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { callZhipuAPI, type ZhipuMessage } from '@/lib/zhipu-api';
import type { CompetencyOutput } from '@/lib/workshop/competency-types';
import { Send, Sparkles, RotateCcw, MessageSquare } from 'lucide-react';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

const SUGGESTED_PROMPTS = [
  '帮我优化交付管理的 L3 行为描述，使其更符合能力标准而非任务描述',
  '对 DM-06 工程化交付实施的 L2 进行补充和优化',
  '评估当前项目管理能力模型的完整性和合理性',
  '为 DM-02 技术方案解决能力 补充更多 L3 行为指标',
];

function buildModelSummary(data: CompetencyOutput): string {
  const lines: string[] = [];
  const models = [
    { key: 'delivery_management', label: '交付管理' },
    { key: 'business_management', label: '项目管理' },
  ];
  for (const m of models) {
    const items = data.competencies.filter((c) => c.model === m.key);
    lines.push(`## ${m.label}（${items.length} 项 L1）`);
    for (const c of items) {
      const l2names = c.secondary_terms.map((s) => `${s.code} ${s.term}`).join('、');
      lines.push(`- ${c.code} ${c.term}：${l2names}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

const SYSTEM_PROMPT = `你是一位资深的数字化人才能力模型专家，正在协助泸州老窖数字化发展中心优化技术岗位的能力模型。

**当前能力模型概要：**

{MODEL_SUMMARY}

**你的职责：**
1. 基于用户需求，对能力模型的 L2/L3 层级提出具体的优化建议
2. L3 行为描述必须是"能力描述"而非"任务描述"（能力 = 能做到什么程度，任务 = 做什么）
3. L3 编写公式：行为动词 + 具体场景 + 可衡量结果 + 复杂度标识
4. 交付管理(DM)只有中级和高级两个层级，没有初级
5. 项目管理(BM)有初级、中级、高级三个层级

**层级定义：**
- 初级（仅BM）：在他人指导下完成标准化工作。关键词：辅助、参与、遵循
- 中级：独立完成既定范围内的标准工作。关键词：独立、完成、遵循规范
- 高级：处理非标问题、设计框架、指导他人。关键词：主导、设计、优化、指导

**输出要求：**
- 具体可操作，给出可直接使用的文本
- 标注修改的是哪个 L1/L2 的哪条 L3
- 如有删除或合并建议，说明理由`;

interface Props {
  data: CompetencyOutput;
}

export default function CompetencyCalibrationChat({ data }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const modelSummary = buildModelSummary(data);
  const systemPrompt = SYSTEM_PROMPT.replace('{MODEL_SUMMARY}', modelSummary);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = { role: 'user', content: text.trim() };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setIsLoading(true);

      try {
        const history: ZhipuMessage[] = [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({
            role: m.role as 'system' | 'user' | 'assistant',
            content: m.content,
          })),
          { role: 'user', content: text.trim() },
        ];

        const reply = await callZhipuAPI('', history);
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'AI 服务暂时不可用，请稍后重试';
        setMessages((prev) => [...prev, { role: 'system', content: `❌ ${errMsg}` }]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, messages, systemPrompt]
  );

  const handleSubmit = () => sendMessage(input);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleReset = () => {
    setMessages([]);
  };

  // Welcome state
  if (messages.length === 0) {
    return (
      <div className="max-w-2xl mx-auto py-12 text-center space-y-8">
        <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto">
          <Sparkles size={28} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">能力模型校准助手</h3>
          <p className="text-sm text-gray-500">
            基于 AI 对话优化能力模型的 L2/L3 细则，支持多轮交互
          </p>
        </div>
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
            试试这些问题
          </p>
          <div className="grid gap-2">
            {SUGGESTED_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                onClick={() => sendMessage(prompt)}
                className="text-left px-4 py-3 rounded-xl border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-sm text-gray-700 transition-colors"
              >
                <MessageSquare size={14} className="inline mr-2 text-indigo-400" />
                {prompt}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-16rem)] min-h-[400px]">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-4 pr-1">
        {messages.map((msg, i) => {
          const isUser = msg.role === 'user';
          const isSystem = msg.role === 'system';
          return (
            <div
              key={i}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? 'bg-indigo-600 text-white rounded-br-md'
                    : isSystem
                    ? 'bg-red-50 text-red-700 border border-red-200 rounded-bl-md'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-md shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="w-4 h-4 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                思考中...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex items-end gap-2 pt-3 border-t border-gray-100">
        <button
          onClick={handleReset}
          title="清空对话"
          className="p-2.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors flex-shrink-0"
        >
          <RotateCcw size={16} />
        </button>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入优化需求，如：帮我优化 DM-02 的 L3 描述..."
          rows={1}
          className="flex-1 resize-none rounded-xl border border-gray-200 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          style={{ minHeight: '42px', maxHeight: '120px' }}
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
