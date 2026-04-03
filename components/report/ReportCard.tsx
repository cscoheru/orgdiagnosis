'use client';

import { FileText, Download, Eye, Sparkles } from 'lucide-react';

interface ReportCardProps {
  title: string;
  subtitle: string;
  status: 'ready' | 'generating' | 'empty';
  type: 'pptx' | 'pdf' | 'ai';
  onPreview?: () => void;
  onDownload?: () => void;
  onGenerate?: () => void;
}

export default function ReportCard({
  title,
  subtitle,
  status,
  type,
  onPreview,
  onDownload,
  onGenerate,
}: ReportCardProps) {
  const typeIcons = {
    pptx: <FileText className="w-5 h-5 text-orange-500" />,
    pdf: <FileText className="w-5 h-5 text-red-500" />,
    ai: <Sparkles className="w-5 h-5 text-purple-500" />,
  };

  const typeLabels = {
    pptx: 'PPTX',
    pdf: 'PDF',
    ai: 'AI',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center flex-shrink-0">
          {typeIcons[type]}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900">{title}</h3>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">
              {typeLabels[type]}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-100">
        {status === 'ready' && (
          <>
            {onPreview && (
              <button
                onClick={onPreview}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-600 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                预览
              </button>
            )}
            {onDownload && (
              <button
                onClick={onDownload}
                className="flex items-center gap-1 px-2.5 py-1 text-xs text-blue-600 bg-blue-50 rounded-md hover:bg-blue-100 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                下载
              </button>
            )}
          </>
        )}
        {status === 'generating' && (
          <div className="flex items-center gap-2 text-xs text-purple-600">
            <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            AI 生成中...
          </div>
        )}
        {status === 'empty' && onGenerate && (
          <button
            onClick={onGenerate}
            className="flex items-center gap-1 px-2.5 py-1 text-xs text-purple-600 bg-purple-50 rounded-md hover:bg-purple-100 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            AI 生成
          </button>
        )}
      </div>
    </div>
  );
}
