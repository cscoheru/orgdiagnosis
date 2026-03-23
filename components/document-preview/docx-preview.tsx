'use client';

import { useState } from 'react';

interface DOCXPreviewProps {
  url: string;
  onError?: (error: string) => void;
  onDownload?: () => void;
}

/**
 * DOCX Preview Component
 *
 * Uses iframe-based preview as a simple fallback since docx-preview library
 * has SSR issues with Next.js.
 */
export default function DOCXPreview({ url, onDownload }: DOCXPreviewProps) {
  const [loadError, setLoadError] = useState(false);

  // Try iframe first - works for some browsers
  if (!loadError) {
    return (
      <div className="w-full">
        <iframe
          src={url}
          className="w-full border-0 rounded-lg"
          style={{ height: '700px' }}
          title="DOCX预览"
          onError={() => setLoadError(true)}
        />
      </div>
    );
  }

  // Fallback to download option
  return (
    <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl">
      <span className="text-6xl block mb-4">📝</span>
      <h3 className="text-xl font-semibold text-gray-800 mb-2">Word 文档</h3>
      <p className="text-gray-500 mb-2">浏览器不支持直接预览DOCX格式</p>
      <p className="text-sm text-gray-400 mb-6">
        建议下载后使用 Microsoft Word 或 WPS 查看
      </p>
      {onDownload && (
        <button
          onClick={onDownload}
          className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-flex items-center gap-2 shadow-lg"
        >
          <span>⬇️</span>
          下载文件查看
        </button>
      )}
    </div>
  );
}
