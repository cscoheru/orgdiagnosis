'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic imports to avoid SSR issues
const PPTXPreview = dynamic(() => import('./pptx-preview'), { ssr: false });
const DOCXPreview = dynamic(() => import('./docx-preview'), { ssr: false });
const XLSXPreview = dynamic(() => import('./xlsx-preview'), { ssr: false });

interface DocumentPreviewProps {
  url: string;
  fileType: string;
  filename?: string;
  onDownload?: () => void;
}

export default function DocumentPreview({ url, fileType, filename, onDownload }: DocumentPreviewProps) {
  const [previewError, setPreviewError] = useState<string | null>(null);

  const type = fileType.toLowerCase();

  // PDF - use native iframe
  if (type === 'pdf') {
    return (
      <div className="w-full">
        <iframe
          src={url}
          className="w-full border-0 rounded-lg"
          style={{ height: '700px' }}
          title="PDF预览"
          onError={() => setPreviewError('PDF加载失败')}
        />
      </div>
    );
  }

  // Images - use native img
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(type)) {
    return (
      <div className="flex justify-center">
        <img
          src={url}
          alt={filename || '图片预览'}
          className="max-w-full h-auto rounded-lg shadow-md"
          onError={() => setPreviewError('图片加载失败')}
        />
      </div>
    );
  }

  // PPTX
  if (type === 'pptx') {
    if (previewError) {
      return <PreviewFallback error={previewError} onDownload={onDownload} />;
    }
    return <PPTXPreview url={url} filename={filename} onError={setPreviewError} onDownload={onDownload} />;
  }

  // DOCX
  if (type === 'docx') {
    if (previewError) {
      return <PreviewFallback error={previewError} onDownload={onDownload} />;
    }
    return <DOCXPreview url={url} onError={setPreviewError} onDownload={onDownload} />;
  }

  // XLSX / XLS
  if (['xlsx', 'xls'].includes(type)) {
    if (previewError) {
      return <PreviewFallback error={previewError} onDownload={onDownload} />;
    }
    return <XLSXPreview url={url} onError={setPreviewError} onDownload={onDownload} />;
  }

  // Markdown - render as text with syntax highlighting
  if (type === 'md') {
    return (
      <div className="bg-gray-50 rounded-lg p-6 max-h-[600px] overflow-auto">
        <p className="text-sm text-gray-500 mb-3">Markdown 文件预览 (下载查看完整格式)</p>
        <div className="prose prose-sm max-w-none">
          <p className="text-gray-400">请下载文件查看 Markdown 格式内容</p>
        </div>
      </div>
    );
  }

  // JSON - display formatted
  if (type === 'json') {
    return <JSONPreview url={url} />;
  }

  // Unsupported format
  return (
    <div className="text-center py-16">
      <span className="text-6xl block mb-4">📄</span>
      <p className="text-gray-500 mb-2">此文件格式暂不支持在线预览</p>
      <p className="text-sm text-gray-400 mb-4">格式: {type.toUpperCase()}</p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center gap-2"
        >
          <span>⬇️</span>
          下载文件查看
        </button>
      )}
    </div>
  );
}

// Fallback component when preview fails
function PreviewFallback({ error, onDownload }: { error: string; onDownload?: () => void }) {
  return (
    <div className="text-center py-16">
      <span className="text-6xl block mb-4">⚠️</span>
      <p className="text-gray-500 mb-2">预览加载失败</p>
      <p className="text-sm text-red-400 mb-4">{error}</p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center gap-2"
        >
          <span>⬇️</span>
          下载文件查看
        </button>
      )}
    </div>
  );
}

// JSON Preview component
function JSONPreview({ url }: { url: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);

  useState(() => {
    fetch(url)
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-10 text-red-500">
        <p>JSON 解析失败: {error}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg p-4 max-h-[600px] overflow-auto">
      <pre className="text-green-400 text-sm font-mono whitespace-pre-wrap">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
