'use client';

import { useState } from 'react';
import { API_BASE_URL } from '@/lib/api-config';
import type { TemplateSelectionData } from '@/lib/workflow/w1-types';

interface PPTOutputStepProps {
  templateData: TemplateSelectionData | null;
  onExport: () => void;
  exporting: boolean;
  filePath?: string | null;
  slideCount?: number;
}

export default function PPTOutputStep({
  templateData,
  onExport,
  exporting,
  filePath,
  slideCount,
}: PPTOutputStepProps) {
  const [downloading, setDownloading] = useState(false);

  const themeName = templateData?.theme_id === 'blue_professional' ? '商务蓝'
    : templateData?.theme_id === 'green_natural' ? '自然绿'
    : templateData?.theme_id === 'purple_elegant' ? '优雅紫'
    : templateData?.theme_id === 'orange_vibrant' ? '活力橙'
    : templateData?.theme_id === 'gray_corporate' ? '商务灰'
    : templateData?.theme_id || '默认';

  const handleDownload = async () => {
    if (!filePath) return;
    setDownloading(true);
    try {
      const url = filePath.startsWith('http') ? filePath : `${API_BASE_URL}${filePath}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`下载失败: ${res.status}`);
      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filePath.split('/').pop() || 'proposal.pptx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.error('[PPTOutput] Download failed:', e);
      alert('下载失败，请重试');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-6">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">生成 PPTX</h3>
          <p className="text-sm text-gray-500 mt-0.5">
            {slideCount || templateData?.slide_layouts.length || 0} 页幻灯片 | 主题: {themeName}
          </p>
        </div>
        {filePath && (
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            {downloading ? '下载中...' : '下载 PPTX'}
          </button>
        )}
      </div>

      {/* Generate button */}
      {!filePath && (
        <div className="text-center py-8">
          <button
            onClick={onExport}
            disabled={exporting}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm"
          >
            {exporting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full" />
                正在生成 PPTX...
              </span>
            ) : (
              '生成 PPTX'
            )}
          </button>
          {exporting && (
            <p className="text-xs text-gray-400 mt-3">AI 正在根据模板和布局生成演示文稿，请稍候...</p>
          )}
        </div>
      )}

      {/* Success */}
      {filePath && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <div className="text-green-600 text-lg mb-1">✓</div>
          <p className="text-sm font-medium text-green-700">PPT 文件已生成</p>
          <p className="text-xs text-green-500 mt-1">{slideCount} 页 | {themeName} 主题</p>
        </div>
      )}
    </div>
  );
}
