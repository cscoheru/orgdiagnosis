'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getDocuments,
  deleteDocument,
  getProjects,
  getL1Dimensions,
  getDimensionName,
  getDimensionColor,
  getDimensionIcon,
  type Document,
  type Project,
  type Dimension
} from '@/lib/knowledge-v2-api';

export default function KnowledgeDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedL1, setSelectedL1] = useState('');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsData, projectsData, dimensionsData] = await Promise.all([
        getDocuments({
          project_id: selectedProject || undefined,
          dimension_l1: selectedL1 || undefined,
          limit: 50
        }),
        getProjects(),
        getL1Dimensions()
      ]);
      // getDocuments returns Document[] directly
      const docs = Array.isArray(docsData) ? docsData : [];
      setDocuments(docs);
      setTotal(docs.length);
      setProjects(projectsData);
      setDimensions(dimensionsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [selectedProject, selectedL1]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (docId: string) => {
    if (!confirm('确定要删除这个文档吗？此操作不可恢复。')) return;

    try {
      await deleteDocument(docId);
      setDocuments(docs => docs.filter(d => d.id !== docId));
      setTotal(t => t - 1);
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

  if (loading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载文档列表...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <span className="text-6xl">❌</span>
          <h2 className="text-xl font-semibold text-gray-700 mt-4">加载失败</h2>
          <p className="text-gray-500 mt-2">{error}</p>
          <button
            onClick={() => fetchData()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 文档管理</h1>
          <p className="text-gray-500 mt-1">管理知识库中的咨询报告（共 {total} 份）</p>
        </div>
        <Link
          href="/knowledge/upload"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
        >
          <span>⬆️</span>
          上传文档
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-4">
          {/* Project Filter */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">📁 项目</label>
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部项目</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* L1 Dimension Filter */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">🎯 五维维度</label>
            <select
              value={selectedL1}
              onChange={(e) => setSelectedL1(e.target.value)}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部维度</option>
              {dimensions.map(d => (
                <option key={d.id} value={d.code}>
                  {getDimensionIcon(d.code)} {d.name}
                </option>
              ))}
            </select>
          </div>

          {/* Reset Filters */}
          {(selectedProject || selectedL1) && (
            <button
              onClick={() => {
                setSelectedProject('');
                setSelectedL1('');
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 self-end"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Documents Grid */}
      {documents.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <span className="text-4xl block mb-2">📭</span>
          <p>暂无文档</p>
          <Link href="/knowledge/upload" className="text-blue-500 hover:underline text-sm">
            上传第一份文档
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map(doc => (
            <div
              key={doc.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{getFileIcon(doc.file_type)}</span>
                  <div>
                    <h3 className="font-medium text-gray-800 line-clamp-1">
                      {doc.title || doc.filename}
                    </h3>
                    <p className="text-xs text-gray-400">{doc.page_count || 0} 页</p>
                  </div>
                </div>
              </div>

              {/* Classification */}
              {doc.dimension_l1 && (
                <div className="mb-3">
                  <span className={`px-2 py-1 rounded text-xs ${getDimensionColor(doc.dimension_l1)}`}>
                    {getDimensionIcon(doc.dimension_l1)} {getDimensionName(doc.dimension_l1)}
                    {doc.dimension_l2 && ` > ${doc.dimension_l2}`}
                  </span>
                  {doc.confidence && (
                    <span className="text-xs text-gray-400 ml-2">
                      {Math.round(doc.confidence * 100)}% 置信
                    </span>
                  )}
                </div>
              )}

              {/* Metadata */}
              <div className="text-xs text-gray-400 space-y-1">
                {doc.author && <p>👤 {doc.author}</p>}
                <p>📅 {formatDate(doc.uploaded_at)}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <Link
                  href={`/knowledge/documents/${doc.id}`}
                  className="text-sm text-blue-500 hover:text-blue-700"
                >
                  查看详情 →
                </Link>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="text-sm text-red-500 hover:text-red-700"
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <h3 className="font-medium text-gray-800 mb-4">📊 按维度统计</h3>
        <div className="grid grid-cols-5 gap-3">
          {dimensions.map(dim => (
            <div key={dim.id} className="text-center">
              <span className="text-2xl">{getDimensionIcon(dim.code)}</span>
              <p className="text-sm font-medium mt-1">{dim.name}</p>
              <p className="text-xs text-gray-500">
                {documents.filter(d => d.dimension_l1 === dim.code).length} 份
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
