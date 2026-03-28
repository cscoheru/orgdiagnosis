'use client';

import type { QuestionnaireData } from '@/lib/api/workflow-client';
import { DIMENSION_LABELS } from '@/types/diagnosis';
import type { DimensionKey } from '@/types/diagnosis';

interface ClientConfirmStepProps {
  questionnaireData: QuestionnaireData | null;
  onConfirm: () => void;
  loading: boolean;
}

const DIMENSION_ORDER: DimensionKey[] = ['strategy', 'structure', 'performance', 'compensation', 'talent'];

export default function ClientConfirmStep({
  questionnaireData,
  onConfirm,
  loading,
}: ClientConfirmStepProps) {
  if (!questionnaireData) return null;

  const items = questionnaireData.items || [];

  // Stats per dimension
  const dimensionStats = DIMENSION_ORDER.map(dim => {
    const dimItems = items.filter(i => i.dimension === dim);
    const answered = dimItems.filter(i => i.answer && i.answer.trim().length > 0);
    return {
      dimension: dim,
      label: DIMENSION_LABELS[dim],
      total: dimItems.length,
      answered: answered.length,
      completion: dimItems.length > 0 ? Math.round((answered.length / dimItems.length) * 100) : 0,
    };
  });

  const totalItems = items.length;
  const totalAnswered = items.filter(i => i.answer && i.answer.trim().length > 0).length;
  const overallCompletion = totalItems > 0 ? Math.round((totalAnswered / totalItems) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Overall progress */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-700">问卷完成度</h3>
          <span className="text-sm font-bold text-gray-900">{overallCompletion}%</span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${overallCompletion}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">
          已填写 {totalAnswered} / {totalItems} 项
        </p>
      </div>

      {/* Per-dimension stats */}
      <div className="grid grid-cols-5 gap-3">
        {dimensionStats.map(stat => (
          <div key={stat.dimension} className="text-center">
            <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
            <div className="relative w-12 h-12 mx-auto mb-1">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#e5e7eb"
                  strokeWidth="3"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke={stat.completion === 100 ? '#22c55e' : stat.completion > 50 ? '#3b82f6' : '#f59e0b'}
                  strokeWidth="3"
                  strokeDasharray={`${stat.completion}, 100`}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">
                {stat.completion}%
              </span>
            </div>
            <div className="text-xs text-gray-400">{stat.answered}/{stat.total}</div>
          </div>
        ))}
      </div>

      {/* Question summary */}
      <div>
        <h3 className="text-sm font-medium text-gray-700 mb-3">问卷内容汇总</h3>
        <div className="max-h-64 overflow-y-auto space-y-4">
          {dimensionStats.filter(s => s.total > 0).map(stat => {
            const dimItems = items.filter(i => i.dimension === stat.dimension);
            return (
              <div key={stat.dimension}>
                <h4 className="text-xs font-medium text-gray-500 mb-1.5">
                  {stat.label} ({stat.answered}/{stat.total})
                </h4>
                <div className="space-y-1">
                  {dimItems.map(item => (
                    <div
                      key={item.id}
                      className={`text-sm rounded px-2 py-1.5 ${
                        item.answer && item.answer.trim()
                          ? 'bg-gray-50 text-gray-800'
                          : 'bg-amber-50 text-amber-700'
                      }`}
                    >
                      <span className="font-medium">{item.question}</span>
                      {item.answer && item.answer.trim() ? (
                        <span className="text-gray-600 ml-2 truncate">
                          — {item.answer}
                        </span>
                      ) : (
                        <span className="text-amber-500 ml-2">未填写</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Confirm button */}
      <div className="flex justify-end">
        <button
          onClick={onConfirm}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
        >
          {loading ? '提交中...' : '确认提交'}
        </button>
      </div>
    </div>
  );
}
