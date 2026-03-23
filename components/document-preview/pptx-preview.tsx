'use client';

import { useState, useEffect } from 'react';

interface PPTXPreviewProps {
  url: string;
  filename?: string;
  onError?: (error: string) => void;
  onDownload?: () => void;
}

export default function PPTXPreview({ url, filename, onError, onDownload }: PPTXPreviewProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slides, setSlides] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    let mounted = true;

    async function loadPPTX() {
      try {
        setLoading(true);
        setError(null);

        // Fetch PPTX file and extract basic info
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`加载失败: ${response.status}`);
        }

        // Get file size for display
        const contentLength = response.headers.get('content-length');
        const sizeKB = contentLength ? Math.round(parseInt(contentLength) / 1024) : 0;

        if (mounted) {
          // PPTX preview in browser is limited
          // Show placeholder with download option
          setLoading(false);
        }

      } catch (err) {
        if (mounted) {
          const errorMsg = err instanceof Error ? err.message : '加载PPTX失败';
          setError(errorMsg);
          setLoading(false);
          onError?.(errorMsg);
        }
      }
    }

    loadPPTX();

    return () => {
      mounted = false;
    };
  }, [url, onError]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="animate-spin w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">加载PPTX预览...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-3">❌</span>
        <p className="text-red-500">{error}</p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            下载文件查看
          </button>
        )}
      </div>
    );
  }

  // PPTX browser preview is limited - show download option
  return (
    <div className="text-center py-16 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl">
      <span className="text-6xl block mb-4">📊</span>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">PowerPoint 文件</h3>
      <p className="text-gray-500 mb-2">{filename || '演示文稿'}</p>
      <p className="text-sm text-gray-400 mb-6">
        PPTX 格式暂不支持在线预览
      </p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 inline-flex items-center gap-2 shadow-lg"
        >
          <span>⬇️</span>
          下载文件查看
        </button>
      )}
      <p className="text-xs text-gray-400 mt-4">
        建议使用 Microsoft PowerPoint 或 WPS 打开
      </p>
    </div>
  );
}
