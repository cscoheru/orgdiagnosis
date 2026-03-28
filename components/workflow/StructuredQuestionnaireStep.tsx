'use client';

import { useState } from 'react';
import type { QuestionnaireData, QuestionnaireItem } from '@/lib/api/workflow-client';
import { smartQuestion } from '@/lib/api/workflow-client';
import { DIMENSION_LABELS } from '@/types/diagnosis';
import type { DimensionKey } from '@/types/diagnosis';

interface StructuredQuestionnaireStepProps {
  onConfirm: (data: QuestionnaireData) => void;
  generating: boolean;
  initialData?: QuestionnaireData | null;
}

const DIMENSION_ORDER: DimensionKey[] = ['strategy', 'structure', 'performance', 'compensation', 'talent'];

export default function StructuredQuestionnaireStep({
  onConfirm,
  generating,
  initialData,
}: StructuredQuestionnaireStepProps) {
  const [rawText, setRawText] = useState('');
  const [editedData, setEditedData] = useState<QuestionnaireData | null>(initialData || null);
  const [activeDimension, setActiveDimension] = useState<DimensionKey>('strategy');
  const [aiQuestions, setAiQuestions] = useState<Array<{ dimension: string; question: string; reason: string }>>([]);
  const [loadingAI, setLoadingAI] = useState(false);

  const currentData = editedData || initialData;

  // Filter items by active dimension
  const dimensionItems = (currentData?.items || []).filter(
    item => item.dimension === activeDimension,
  );

  // Fill from raw text — triggers AI extraction
  const handleExtractFromText = async () => {
    if (!rawText.trim()) return;
    setLoadingAI(true);
    try {
      const result = await smartQuestion({
        raw_text: rawText,
        existing_items: currentData?.items || [],
      });
      if (result.success && result.data) {
        const suggestions = result.data.supplementary_questions || [];
        setAiQuestions(suggestions);

        // Auto-create questionnaire items from AI suggestions
        const newItems: QuestionnaireItem[] = suggestions.map((q, i) => ({
          id: `ai-${activeDimension}-${i}-${Date.now()}`,
          dimension: q.dimension || activeDimension,
          category: q.dimension || 'general',
          question: q.question,
          answer: '',
          is_ai_suggested: true,
        }));

        setEditedData(prev => ({
          items: [...(prev?.items || []), ...newItems],
          raw_text: rawText,
        }));
      }
    } finally {
      setLoadingAI(false);
    }
  };

  // Update an item's answer
  const updateAnswer = (itemId: string, answer: string) => {
    if (!currentData) return;
    setEditedData(prev => ({
      ...prev!,
      items: (prev?.items || []).map(item =>
        item.id === itemId ? { ...item, answer } : item,
      ),
    }));
  };

  // Remove an item
  const removeItem = (itemId: string) => {
    if (!currentData) return;
    setEditedData(prev => ({
      ...prev!,
      items: (prev?.items || []).filter(item => item.id !== itemId),
    }));
  };

  // Add a custom question
  const addCustomQuestion = () => {
    const newItem: QuestionnaireItem = {
      id: `custom-${activeDimension}-${Date.now()}`,
      dimension: activeDimension,
      category: activeDimension,
      question: '',
      answer: '',
    };
    setEditedData(prev => ({
      ...prev!,
      items: [...(prev?.items || []), newItem],
    }));
  };

  // Accept an AI-suggested question (keep it, remove from suggestions)
  const acceptAiQuestion = (index: number) => {
    const q = aiQuestions[index];
    if (!q) return;
    const newItem: QuestionnaireItem = {
      id: `ai-accepted-${Date.now()}`,
      dimension: q.dimension,
      category: q.dimension,
      question: q.question,
      answer: '',
      is_ai_suggested: true,
    };
    setEditedData(prev => ({
      ...prev!,
      items: [...(prev?.items || []), newItem],
    }));
    setAiQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Update question text
  const updateQuestionText = (itemId: string, text: string) => {
    if (!currentData) return;
    setEditedData(prev => ({
      ...prev!,
      items: (prev?.items || []).map(item =>
        item.id === itemId ? { ...item, question: text } : item,
      ),
    }));
  };

  // Stats per dimension
  const getDimensionStats = (dim: DimensionKey) => {
    const items = (currentData?.items || []).filter(i => i.dimension === dim);
    const answered = items.filter(i => i.answer && i.answer.trim().length > 0);
    return { total: items.length, answered: answered.length };
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      {/* Split layout: input left, form right */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Text input */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-700">文本输入</h3>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            className="w-full h-48 px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            placeholder="粘贴客户提供的文本材料（会议纪要、需求描述、调研数据等），AI 将自动分析并生成补充问题..."
          />
          <div className="flex justify-between items-center">
            <span className="text-xs text-gray-400">{rawText.length > 0 ? `${rawText.length} 字` : ''}</span>
            <button
              onClick={handleExtractFromText}
              disabled={loadingAI || rawText.trim().length < 10}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {loadingAI ? (
                <>
                  <span className="animate-spin w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  AI 分析中...
                </>
              ) : (
                'AI 智能分析'
              )}
            </button>
          </div>

          {/* AI suggestions */}
          {aiQuestions.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs font-medium text-gray-500">AI 建议补充问题</h4>
              {aiQuestions.map((q, i) => (
                <div key={i} className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <span className="text-xs text-blue-500">
                        {DIMENSION_LABELS[q.dimension as DimensionKey] || q.dimension}
                      </span>
                      <p className="text-gray-800 mt-0.5">{q.question}</p>
                      <p className="text-xs text-gray-500 mt-1">{q.reason}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => acceptAiQuestion(i)}
                        className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        采用
                      </button>
                      <button
                        onClick={() => setAiQuestions(prev => prev.filter((_, j) => j !== i))}
                        className="px-2 py-1 text-xs text-gray-400 hover:text-gray-600"
                      >
                        忽略
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Questionnaire form */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-700">结构化问卷</h3>
            <button
              onClick={addCustomQuestion}
              className="text-sm text-blue-500 hover:text-blue-700"
            >
              + 添加问题
            </button>
          </div>

          {/* Dimension tabs */}
          <div className="flex gap-1 flex-wrap">
            {DIMENSION_ORDER.map(dim => {
              const stats = getDimensionStats(dim);
              return (
                <button
                  key={dim}
                  onClick={() => setActiveDimension(dim)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                    activeDimension === dim
                      ? 'bg-blue-100 text-blue-700 border border-blue-300'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-transparent'
                  }`}
                >
                  {DIMENSION_LABELS[dim]} ({stats.answered}/{stats.total})
                </button>
              );
            })}
          </div>

          {/* Question items */}
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {dimensionItems.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                当前维度暂无问题，可通过左侧 AI 分析生成或手动添加
              </p>
            ) : (
              dimensionItems.map(item => (
                <div
                  key={item.id}
                  className={`border rounded-lg p-3 space-y-2 ${
                    item.is_ai_suggested ? 'border-blue-200 bg-blue-50/30' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={item.question}
                      onChange={(e) => updateQuestionText(item.id, e.target.value)}
                      className="flex-1 text-sm font-medium text-gray-800 bg-transparent border-none focus:outline-none"
                      placeholder="输入问题..."
                    />
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-gray-400 hover:text-red-500 text-xs shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                  <textarea
                    value={item.answer || ''}
                    onChange={(e) => updateAnswer(item.id, e.target.value)}
                    className="w-full px-2 py-1.5 text-sm border border-gray-100 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    rows={2}
                    placeholder="输入回答..."
                  />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={() => onConfirm(editedData || currentData || { items: [] })}
          disabled={generating || !currentData?.items?.length}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          确认问卷
        </button>
      </div>
    </div>
  );
}
