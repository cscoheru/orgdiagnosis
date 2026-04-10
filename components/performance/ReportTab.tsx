'use client';

/**
 * Tab 6: 报告生成
 *
 * AI 生成绩效管理咨询报告。
 */

import { useState } from 'react';
import { generatePerformanceReport } from '@/lib/api/performance-api';
import { FileOutput, Sparkles } from 'lucide-react';

interface Props {
  projectId: string;
}

export default function ReportTab({ projectId }: Props) {
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const res = await generatePerformanceReport(projectId);
      if (res.success && res.data) {
        setResult(res.data as Record<string, unknown>);
      } else {
        setError(res.error || '报告生成失败');
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      {!result && !error && (
        <div className="text-center py-12">
          <FileOutput size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">生成绩效管理咨询报告</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-md mx-auto">
            AI 将基于项目下所有绩效方案、组织绩效、岗位绩效、考核数据生成一份完整的咨询报告，包含执行摘要、现状分析、问题诊断和改进建议。
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="inline-flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Sparkles size={16} />
            {generating ? 'AI 生成中，请稍候...' : 'AI 生成咨询报告'}
          </button>
        </div>
      )}

      {generating && (
        <div className="flex flex-col items-center py-8">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mb-3" />
          <p className="text-sm text-gray-500">正在分析绩效数据并生成报告...</p>
        </div>
      )}

      {error && (
        <div className="border border-red-200 rounded-xl p-4 bg-red-50">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={handleGenerate}
            className="mt-3 text-sm text-red-600 hover:text-red-800 underline"
          >
            重试
          </button>
        </div>
      )}

      {result && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h4 className="font-medium text-gray-900">绩效管理咨询报告</h4>
            <button
              onClick={() => { setResult(null); setError(null); }}
              className="text-xs text-indigo-600 hover:text-indigo-800"
            >
              重新生成
            </button>
          </div>

          <div className="p-4 space-y-4 max-h-[600px] overflow-auto">
            {/* Executive Summary */}
            {result.executive_summary != null && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-1">执行摘要</h5>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{String(result.executive_summary)}</p>
              </div>
            )}

            {/* Sections */}
            {Array.isArray(result.sections) && (result.sections as Array<Record<string, unknown>>).map((section, i) => (
              <div key={i}>
                <h5 className="text-sm font-medium text-gray-700 mb-1">{String(section.title)}</h5>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{String(section.content)}</p>
                {Array.isArray(section.key_findings) && (
                  <ul className="mt-2 space-y-1">
                    {(section.key_findings as string[]).map((f, j) => (
                      <li key={j} className="text-xs text-gray-500 flex items-start gap-1">
                        <span className="text-indigo-500">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}

            {/* Issues */}
            {Array.isArray(result.issues) && (result.issues as Array<Record<string, unknown>>).length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">核心问题</h5>
                <div className="space-y-2">
                  {(result.issues as Array<Record<string, unknown>>).map((issue, i) => (
                    <div key={i} className="bg-red-50/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded font-medium ${
                          issue.priority === 'P0' ? 'bg-red-100 text-red-700' :
                          issue.priority === 'P1' ? 'bg-amber-100 text-amber-700' :
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {String(issue.priority)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{String(issue.title)}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">{String(issue.root_cause)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            {Array.isArray(result.recommendations) && (result.recommendations as Array<Record<string, unknown>>).length > 0 && (
              <div>
                <h5 className="text-sm font-medium text-gray-700 mb-2">改进建议</h5>
                <div className="space-y-2">
                  {(result.recommendations as Array<Record<string, unknown>>).map((rec, i) => (
                    <div key={i} className="bg-green-50/50 rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 text-[10px] rounded ${
                          rec.timeline === '短期' ? 'bg-green-100 text-green-700' :
                          rec.timeline === '中期' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {String(rec.timeline)}
                        </span>
                        <span className="text-sm font-medium text-gray-900">{String(rec.action)}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-1">
                        负责人: {String(rec.responsible)} · 预期效果: {String(rec.expected_outcome)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
