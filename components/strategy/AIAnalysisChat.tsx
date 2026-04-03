'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  Check,
  ClipboardPaste
} from 'lucide-react';
import { analyzeUploadedFile, chatAnalysisAssistant } from '@/lib/zhipu-api';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  extractedData?: string[];
  questions?: string[];
  timestamp?: number;
  _debug?: string;
}

interface AIAnalysisChatProps {
  apiKey: string;
  module: 'trends' | 'competitors' | 'customer' | 'company';
  title: string;
  placeholder?: string;
  onAnalysisComplete?: (data: string[]) => void;
  currentValue?: string;
  onValueChange?: (value: string) => void;
}

export default function AIAnalysisChat({
  apiKey,
  module,
  title,
  placeholder,
  onAnalysisComplete,
  currentValue,
  onValueChange
}: AIAnalysisChatProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pastedText, setPastedText] = useState('');
  const [isAnalyzingText, setIsAnalyzingText] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 是否为开发环境
  const isDev = process.env.NODE_ENV === 'development';

  // 模块配置
  const moduleConfig = {
    trends: {
      icon: <FileText className="w-4 h-4" />,
      color: 'blue',
      placeholder: placeholder || '例如：行业正经历数字化转型，政策支持智能制造...',
      pastePlaceholder: '请在此粘贴行业报告文本内容...',
      title: '行业趋势资料'
    },
    competitors: {
      icon: <FileText className="w-4 h-4" />,
      color: 'orange',
      placeholder: placeholder || '例如：主要竞对A公司市场份额30%，核心优势是...',
      pastePlaceholder: '请在此粘贴竞争对手资料文本内容...',
      title: '竞争对手资料'
    },
    customer: {
      icon: <FileText className="w-4 h-4" />,
      color: 'purple',
      placeholder: placeholder || '例如：核心客户是华东地区中小制造企业...',
      pastePlaceholder: '请在此粘贴客户调研资料文本内容...',
      title: '客户需求资料'
    },
    company: {
      icon: <FileText className="w-4 h-4" />,
      color: 'green',
      placeholder: placeholder || '例如：公司成立于2020年，目前团队规模50人...',
      pastePlaceholder: '请在此粘贴公司资料文本内容...',
      title: '公司情况资料'
    }
  };

  const config = moduleConfig[module];

  // 自动滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 初始化欢迎消息
  useEffect(() => {
    if (isExpanded && messages.length === 0) {
      const welcomeMessages = {
        trends: '你好！我是行业趋势分析专家。我会帮助你深入理解行业发展趋势、政策变化和技术革新。\n\n你可以直接输入信息，或者将行业报告、研究分析等文本内容粘贴到下方的文本框中，我会帮你提炼关键要点。',
        competitors: '你好！我是竞争情报分析专家。我会帮助你全面分析竞争对手的优劣势、市场地位和核心能力。\n\n请告诉我你关注哪些竞争对手，或者将竞争对手的资料文本粘贴到下方文本框中。',
        customer: '你好！我是客户洞察专家。我会帮助你深入了解目标客户的画像、需求和购买决策因素。\n\n请描述你的客户群体，或者将客户调研报告粘贴到下方文本框中。',
        company: '你好！我是企业诊断专家。我会帮助你客观分析公司的现状、优势、短板和资源。\n\n请告诉我关于公司的情况，或者将相关资料粘贴到下方文本框中。'
      };

      setMessages([{
        role: 'assistant',
        content: welcomeMessages[module],
        timestamp: Date.now()
      }]);
    }
  }, [isExpanded, module, messages.length]);

  // 分析粘贴的文本
  const handleAnalyzePastedText = async () => {
    if (!apiKey) {
      alert('请先配置 AI API Key');
      return;
    }

    if (!pastedText.trim()) {
      alert('请先粘贴文本内容');
      return;
    }

    setIsAnalyzingText(true);

    try {
      // 使用真实文本内容进行 AI 分析
      const analysis = await analyzeUploadedFile(
        apiKey,
        `${config.title}（用户粘贴）`,
        pastedText,
        module
      );

      // 显示分析结果（带调试信息）
      const textLength = pastedText.length;
      const debugInfo = isDev ? `\n\n[Debug: 成功读取文本 ${textLength} 字]` : '';

      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `📎 **资料分析结果**${debugInfo}\n\n**摘要**：${analysis.summary}\n\n**关键要点**：\n${analysis.keyPoints.map((p, i) => `${i + 1}. ${p}`).join('\n')}\n\n**建议**：\n${analysis.suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}`,
        extractedData: analysis.keyPoints,
        _debug: isDev ? `[Debug: 成功读取文本 ${textLength} 字]` : undefined,
        timestamp: Date.now()
      }]);

      // 通知父组件
      if (onAnalysisComplete) {
        onAnalysisComplete(analysis.keyPoints);
      }

      // 清空粘贴框
      setPastedText('');
    } catch (error: any) {
      console.error('文本分析错误:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `分析失败：${error.message}`,
        _debug: isDev ? `[Debug: ${error.message}]` : undefined,
        timestamp: Date.now()
      }]);
    } finally {
      setIsAnalyzingText(false);
    }
  };

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || !apiKey) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsLoading(true);

    try {
      const chatHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));

      // 如果有已粘贴的文本内容，将其附加到上下文中
      const contextWithFile = pastedText
        ? `[资料内容已读取，长度: ${pastedText.length} 字]\n${pastedText}\n\n[用户输入]\n${inputText}`
        : inputText;

      const response = await chatAnalysisAssistant(apiKey, module, chatHistory, contextWithFile);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.response,
        extractedData: response.extractedData,
        questions: response.questions,
        timestamp: Date.now()
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (response.extractedData && response.extractedData.length > 0 && onAnalysisComplete) {
        onAnalysisComplete(response.extractedData);
      }

      if (response.isComplete && onValueChange) {
        const allData = messages
          .filter(m => m.extractedData)
          .flatMap(m => m.extractedData || []);
        onValueChange(allData.join('\n'));
      }
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `分析失败：${error.message}`,
        timestamp: Date.now()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  // 使用分析结果
  const handleUseAnalysis = () => {
    const allData = messages
      .filter(m => m.extractedData)
      .flatMap(m => m.extractedData || []);

    if (onValueChange) {
      onValueChange(allData.join('\n'));
    }
    setIsExpanded(false);
  };

  return (
    <div className={`border-2 rounded-lg transition-all duration-200 ${
      isExpanded
        ? 'border-primary-500 bg-primary-50/50 dark:bg-primary-900/10'
        : 'border-gray-200 dark:border-slate-700'
    }`}>
      {/* 折叠/展开 按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-500" />
          <span className="font-medium text-gray-900 dark:text-gray-100">
            AI 助手：{title}
          </span>
          {!isExpanded && currentValue && (
            <span className="text-xs text-gray-500 dark:text-slate-400">
              (已有内容)
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-gray-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-gray-500" />
        )}
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div className="p-4 border-t border-gray-200 dark:border-slate-700">
          {/* 文本粘贴区 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <ClipboardPaste className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                粘贴{config.title}
              </span>
              <span className="text-xs text-gray-500 dark:text-slate-400">
                · 将 PDF/Word 中的文字复制后粘贴到下方
              </span>
            </div>

            {/* 大型多行文本输入框 */}
            <textarea
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
              placeholder={config.pastePlaceholder}
              className="w-full h-40 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm
                         resize-y"
              disabled={isAnalyzingText}
            />

            {/* 分析按钮 */}
            {pastedText.trim() && (
              <div className="mt-2 flex gap-2">
                <button
                  onClick={handleAnalyzePastedText}
                  disabled={isAnalyzingText}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600
                             disabled:bg-gray-400 text-white rounded-lg text-sm transition-colors"
                >
                  {isAnalyzingText ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      分析中...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      开始分析
                    </>
                  )}
                </button>
                <button
                  onClick={() => setPastedText('')}
                  className="px-4 py-2 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300
                             dark:hover:bg-slate-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition-colors"
                >
                  清空
                </button>
              </div>
            )}
          </div>

          {/* 对话消息区 */}
          <div className="mb-4 max-h-80 overflow-y-auto space-y-3">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] p-3 rounded-lg ${
                    msg.role === 'user'
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-gray-100'
                  }`}
                >
                  {/* 调试信息 - 仅开发模式 */}
                  {msg._debug && isDev && (
                    <div className="mb-2 p-2 bg-yellow-100 dark:bg-yellow-900/30
                                    border-l-2 border-yellow-500 rounded">
                      <p className="text-xs font-mono text-yellow-700 dark:text-yellow-300">
                        {msg._debug}
                      </p>
                    </div>
                  )}

                  {/* 提取的数据 */}
                  {msg.extractedData && msg.extractedData.length > 0 && (
                    <div className="mb-2 p-2 bg-blue-100 dark:bg-blue-900/30
                                    border-l-2 border-blue-500 rounded">
                      <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">
                        💡 提炼的关键信息：
                      </p>
                      <ul className="text-xs space-y-1">
                        {msg.extractedData.map((data, i) => (
                          <li key={i} className="text-blue-600 dark:text-blue-400">
                            • {data}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* 消息内容 */}
                  <p className="text-sm whitespace-pre-wrap">{msg.content}</p>

                  {/* 追问提示 */}
                  {msg.questions && msg.questions.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-300 dark:border-slate-600">
                      <p className="text-xs font-medium mb-1">
                        接下来可以聊聊：
                      </p>
                      {msg.questions.map((q, i) => (
                        <button
                          key={i}
                          onClick={() => setInputText(q)}
                          className="block w-full text-left text-xs p-2 bg-white dark:bg-slate-600
                                         hover:bg-gray-50 dark:hover:bg-slate-500 rounded mb-1
                                         text-gray-700 dark:text-gray-300 transition-colors"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="p-3 bg-gray-100 dark:bg-slate-700 rounded-lg">
                  <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 输入区 */}
          <div className="flex gap-2">
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
              placeholder={config.placeholder}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg
                         bg-white dark:bg-slate-800 text-gray-900 dark:text-gray-100
                         focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              disabled={isLoading}
            />
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputText.trim() || !apiKey}
              className="px-4 py-2 bg-primary-500 hover:bg-primary-600 disabled:bg-gray-400
                         text-white rounded-lg flex items-center gap-2 transition-colors"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* 底部操作按钮 */}
          {messages.length > 2 && (
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleUseAnalysis}
                className="flex-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white
                           rounded-lg text-sm flex items-center justify-center gap-2 transition-colors"
              >
                <Check className="w-4 h-4" />
                使用分析结果
              </button>
              <button
                onClick={() => {
                  setMessages([]);
                  setPastedText('');
                }}
                className="px-3 py-2 bg-gray-500 hover:bg-gray-600 text-white
                           rounded-lg text-sm transition-colors"
              >
                重新开始
              </button>
            </div>
          )}

          {/* API Key 提示 */}
          {!apiKey && (
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-300">
                  请先在设置中配置 AI API Key
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
