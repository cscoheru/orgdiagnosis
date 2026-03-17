'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InputPage() {
  const router = useRouter();
  const [rawText, setRawText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (rawText.length < 50) {
      setError('请输入至少 50 个字符的文本');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      });

      const result = await response.json();

      if (!result.success) {
        setError(result.error || '分析失败，请重试');
        setIsLoading(false);
        return;
      }

      // 保存诊断结果
      const saveResponse = await fetch('/api/diagnosis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: rawText,
          data: result.data,
        }),
      });

      const savedSession = await saveResponse.json();

      if (savedSession.success) {
        // 跳转到结果页面
        router.push(`/result/${savedSession.data.id}`);
      } else {
        setError('保存失败，请重试');
      }
    } catch (err) {
      setError('网络错误，请检查连接');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    setRawText(text);
  };

  const exampleText = `客户是一家成立于2018年的科技公司，目前有200多名员工。
主要问题：
1. 战略层面：公司去年营收增长8%，远低于预期的15%。创始人认为错过了两个重要的市场机会。
2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
4. 薪酬层面：薪酬水平在行业中属于中游，但核心员工流失率较高。
5. 人才层面：老员工混日子的情况比较严重，新员工留不住，去年入职的10个新人走了6个。`;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">新建诊断</h1>
        <p className="text-gray-600">
          输入会议记录、访谈文字或语音转写，AI 将自动分析并映射到五维模型
        </p>
      </div>

      {/* Input Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <label className="block text-sm font-medium text-gray-700">
            原始文本
          </label>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-400">
              {rawText.length} / 100,000 字符
            </span>
            <label className="cursor-pointer text-sm text-blue-600 hover:text-blue-700">
              📎 上传文件
              <input
                type="file"
                accept=".txt,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>
        </div>

        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="粘贴会议记录、访谈文字或语音转写..."
          className="w-full h-80 p-4 border border-gray-200 rounded-xl resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-gray-700 placeholder:text-gray-400"
        />

        {error && (
          <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setRawText(exampleText)}
          className="text-sm text-gray-500 hover:text-gray-700 underline"
        >
          使用示例文本
        </button>

        <button
          onClick={handleAnalyze}
          disabled={isLoading || rawText.length < 50}
          className={`px-8 py-3 rounded-xl font-medium text-white transition-all ${
            isLoading || rawText.length < 50
              ? 'bg-gray-300 cursor-not-allowed'
              : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg shadow-blue-500/25'
          }`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              AI 分析中...
            </span>
          ) : (
            '🚀 开始分析'
          )}
        </button>
      </div>

      {/* Tips */}
      <div className="mt-8 p-4 bg-blue-50 rounded-xl">
        <h3 className="font-medium text-blue-900 mb-2">💡 提示</h3>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 尽量包含具体的数据和事实，如"营收增长8%"、"离职率20%"</li>
          <li>• 多角度描述问题，包括战略、组织、绩效、薪酬、人才等方面</li>
          <li>• 可以包含多个会议或访谈的内容，AI 会自动识别和归类</li>
        </ul>
      </div>
    </div>
  );
}
