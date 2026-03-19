'use client';

import { useLangGraphDiagnosis } from '@/hooks/useLangGraphDiagnosis';
import { Upload, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';

interface LangGraphProgressProps {
  onComplete?: (report: any) => void;
}

export function LangGraphProgress({ onComplete }: LangGraphProgressProps) {
  const {
    isAnalyzing,
    progress,
    currentDimension,
    completedDimensions,
    status,
    error,
    report,
    analyzeText,
    analyzeFile,
    cancel,
    reset,
    getDimensionLabel,
  } = useLangGraphDiagnosis({
    onComplete,
    onError: (err) => console.error('Analysis error:', err),
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await analyzeFile(file);
    }
  };

  const handleTextSubmit = async () => {
    const text = prompt('请输入要分析的文本:');
    if (text) {
      await analyzeText(text);
    }
  };

  if (status === 'idle') {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">组织诊断分析</h3>
        <div className="space-y-4">
          <button
            onClick={handleTextSubmit}
            className="flex items-center gap-2 w-full px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
          >
            <FileText className="w-5 h-5" />
            <span>输入文本分析</span>
          </button>

          <label className="flex items-center gap-2 w-full px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition cursor-pointer">
            <Upload className="w-5 h-5" />
            <span>上传文件分析</span>
            <input
              type="file"
              accept=".txt,.md,.pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">
          {status === 'completed' ? '分析完成' : '正在分析...'}
        </h3>
        {isAnalyzing && (
          <button
            onClick={cancel}
            className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
          >
            取消
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>整体进度</span>
          <span>{progress.toFixed(0)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${progress}%`,
              background: progress >= 100
                ? 'linear-gradient(90deg, #10B981, #059669)'
                : 'linear-gradient(90deg, #3B82F6, #2563EB)',
            }}
          />
        </div>
      </div>

      {/* Current Dimension */}
      {currentDimension && status === 'processing' && (
        <div className="flex items-center gap-2 text-sm text-gray-600 mb-6">
          <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
          <span>正在分析: {getDimensionLabel(currentDimension)}</span>
        </div>
      )}

      {/* Dimension Checklist */}
      <div className="space-y-3">
        {['strategy', 'structure', 'performance', 'compensation', 'talent'].map((dim) => {
          const isCompleted = completedDimensions.includes(dim);
          const isCurrent = currentDimension === dim;

          return (
            <div
              key={dim}
              className={`flex items-center gap-3 p-3 rounded-lg ${
                isCompleted
                  ? 'bg-green-50'
                  : isCurrent
                  ? 'bg-blue-50'
                  : 'bg-gray-50'
              }`}
            >
              {isCompleted ? (
                <CheckCircle className="w-5 h-5 text-green-500" />
              ) : isCurrent ? (
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              ) : (
                <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />
              )}
              <span
                className={`${
                  isCompleted
                    ? 'text-green-700'
                    : isCurrent
                    ? 'text-blue-700'
                    : 'text-gray-400'
                }`}
              >
                {getDimensionLabel(dim)}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error State */}
      {status === 'failed' && (
        <div className="mt-6 p-4 bg-red-50 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-700">分析失败</p>
            <p className="text-sm text-red-600 mt-1">{error}</p>
            <button
              onClick={reset}
              className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              重新开始
            </button>
          </div>
        </div>
      )}

      {/* Completed State */}
      {status === 'completed' && report && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="font-medium text-green-700">分析完成</span>
          </div>

          <div className="grid grid-cols-5 gap-2 mb-4">
            {report.dimensions?.map((dim: any) => (
              <div
                key={dim.category}
                className="text-center p-2 bg-white rounded"
              >
                <div className="text-2xl font-bold text-gray-800">
                  {dim.total_score?.toFixed(0) || '--'}
                </div>
                <div className="text-xs text-gray-500">{dim.display_name}</div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm text-gray-600">综合评分</span>
              <span className="ml-2 text-2xl font-bold text-blue-600">
                {report.overall_score?.toFixed(1) || '--'}
              </span>
            </div>
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              新建分析
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
