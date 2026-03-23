'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  getDocument,
  deleteDocument,
  getDimensionName,
  getDimensionColor,
  getDimensionIcon,
  type Document
} from '@/lib/knowledge-v2-api';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Dynamic import to avoid SSR issues
const DocumentPreview = dynamic(() => import('@/components/document-preview'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full"></div>
    </div>
  )
});

interface DocumentDetail extends Document {
  classification?: {
    dimension_l1?: string;
    dimension_l2?: string;
    dimension_l3?: string;
    confidence?: number;
    method?: string;
  };
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const docId = params.id as string;

  const [document, setDocument] = useState<DocumentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDocument() {
      try {
        setLoading(true);
        const data = await getDocument(docId);
        setDocument(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载文档失败');
      } finally {
        setLoading(false);
      }
    }

    fetchDocument();
  }, [docId]);

  const handleDelete = async () => {
    if (!confirm('确定要删除这个文档吗？此操作不可恢复。')) return;

    try {
      await deleteDocument(docId);
      router.push('/knowledge/documents');
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (!bytes) return '--';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  const getFileIcon = (type: string) => {
    const icons: Record<string, string> = {
      pptx: '📊',
      pdf: '📄',
      docx: '📝',
      xlsx: '📈',
      xls: '📈',
      md: '📑',
      json: '📋',
      png: '🖼️',
      jpg: '🖼️',
      jpeg: '🖼️'
    };
    return icons[type] || '📄';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载文档详情...</p>
        </div>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="text-6xl">❌</span>
          <h2 className="text-xl font-semibold text-gray-700 mt-4">加载失败</h2>
          <p className="text-gray-500 mt-2">{error || '文档不存在'}</p>
          <Link
            href="/knowledge/documents"
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 inline-block"
          >
            返回文档列表
          </Link>
        </div>
      </div>
    );
  }

  const previewUrl = `${API_BASE}/api/knowledge/documents/${docId}/preview`;
  const downloadUrl = `${API_BASE}/api/knowledge/documents/${docId}/download`;

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/knowledge/dashboard" className="hover:text-gray-700">知识库</Link>
        <span>›</span>
        <Link href="/knowledge/documents" className="hover:text-gray-700">文档管理</Link>
        <span>›</span>
        <span className="text-gray-800 truncate max-w-[200px]">{document.title || document.filename}</span>
      </nav>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{getFileIcon(document.file_type)}</span>
            <div>
              <h1 className="text-lg font-bold text-gray-900">
                {document.title || document.filename}
              </h1>
              <p className="text-sm text-gray-500">
                {document.file_type.toUpperCase()} · {document.page_count || 0} 页 · {formatFileSize(document.file_size)} · {formatDate(document.uploaded_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={downloadUrl}
              download={document.filename}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm flex items-center gap-2"
            >
              <span>⬇️</span>
              下载
            </a>
            <button
              onClick={handleDelete}
              className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              删除
            </button>
          </div>
        </div>
      </div>

      {/* Classification */}
      {document.classification?.dimension_l1 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="font-medium text-gray-800 mb-3">📋 五维分类</h3>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`px-3 py-1.5 rounded-lg text-sm ${getDimensionColor(document.classification.dimension_l1)}`}>
              {getDimensionIcon(document.classification.dimension_l1)} {getDimensionName(document.classification.dimension_l1)}
            </span>
            {document.classification.dimension_l2 && (
              <>
                <span className="text-gray-400">→</span>
                <span className="px-3 py-1.5 bg-gray-100 rounded-lg text-sm text-gray-700">
                  {document.classification.dimension_l2}
                </span>
              </>
            )}
            {document.classification.confidence && (
              <span className="text-xs text-gray-400">
                置信度 {Math.round(document.classification.confidence * 100)}%
              </span>
            )}
          </div>
        </div>
      )}

      {/* Document Preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="font-medium text-gray-800">👁️ 文档预览</h3>
        </div>
        <div className="p-4">
          <DocumentPreview
            url={previewUrl}
            fileType={document.file_type}
            filename={document.filename}
            onDownload={() => {
              const a = window.document.createElement('a');
              a.href = downloadUrl;
              a.download = document?.filename || 'document';
              a.click();
            }}
          />
        </div>
      </div>
    </div>
  );
}
