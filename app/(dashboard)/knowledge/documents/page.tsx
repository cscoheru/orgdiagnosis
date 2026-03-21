'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  getDocuments,
  deleteDocument,
  getCategories,
  formatFileSize,
  getStatusConfig,
  getCategoryName,
  getFileTypeIcon,
  type Document,
  type DocumentList,
  type Category
} from '@/lib/kb-api';

export default function KnowledgeDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    total_pages: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('');

  // Selection for batch operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [docsData, categoriesData] = await Promise.all([
        getDocuments({
          page: pagination.page,
          limit: pagination.limit,
          category: selectedCategory || undefined,
          status: selectedStatus || undefined,
          search: searchQuery || undefined
        }),
        getCategories()
      ]);
      setDocuments(docsData.documents);
      setPagination(docsData.pagination);
      setCategories(categoriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载文档失败');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, selectedCategory, selectedStatus, searchQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleDelete = async (docId: string) => {
    if (!confirm('确定要删除这个文档吗？此操作不可恢复。')) return;

    try {
      await deleteDocument(docId);
      setDocuments(docs => docs.filter(d => d.id !== docId));
      setSelectedIds(ids => {
        const newIds = new Set(ids);
        newIds.delete(docId);
        return newIds;
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === documents.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(documents.map(d => d.id)));
    }
  };

  const handleSelectOne = (docId: string) => {
    setSelectedIds(ids => {
      const newIds = new Set(ids);
      if (newIds.has(docId)) {
        newIds.delete(docId);
      } else {
        newIds.add(docId);
      }
      return newIds;
    });
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '--';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
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
          <p className="text-gray-500 mt-1">管理知识库中的历史咨询报告</p>
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
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
              <input
                type="text"
                placeholder="搜索文档名称..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPagination(p => ({ ...p, page: 1 }));
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPagination(p => ({ ...p, page: 1 }));
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部分类</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPagination(p => ({ ...p, page: 1 }));
            }}
            className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">全部状态</option>
            <option value="pending">等待中</option>
            <option value="processing">处理中</option>
            <option value="ready">就绪</option>
            <option value="error">错误</option>
          </select>

          {/* Reset Filters */}
          {(searchQuery || selectedCategory || selectedStatus) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('');
                setSelectedStatus('');
                setPagination(p => ({ ...p, page: 1 }));
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
          <span className="text-blue-700">
            已选择 {selectedIds.size} 个文档
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (confirm(`确定要删除选中的 ${selectedIds.size} 个文档吗？`)) {
                  selectedIds.forEach(id => handleDelete(id));
                }
              }}
              className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-sm"
            >
              批量删除
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
            >
              取消选择
            </button>
          </div>
        </div>
      )}

      {/* Documents Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedIds.size === documents.length && documents.length > 0}
                  onChange={handleSelectAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">文档名称</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">分类</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">状态</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">大小</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">块数</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">质量</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {documents.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  <span className="text-4xl block mb-2">📭</span>
                  <p>暂无文档</p>
                  <Link href="/knowledge/upload" className="text-blue-500 hover:underline text-sm">
                    上传第一份文档
                  </Link>
                </td>
              </tr>
            ) : (
              documents.map(doc => {
                const statusConfig = getStatusConfig(doc.status);
                return (
                  <tr key={doc.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(doc.id)}
                        onChange={() => handleSelectOne(doc.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{getFileTypeIcon(doc.file_type)}</span>
                        <div>
                          <p className="font-medium text-gray-800">{doc.file_name}</p>
                          <p className="text-xs text-gray-400">{formatDate(doc.uploaded_at)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                        {getCategoryName(doc.category)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1 ${statusConfig.color}`}>
                        <span>{statusConfig.icon}</span>
                        <span className="text-sm">{statusConfig.text}</span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {formatFileSize(doc.file_size_kb)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {doc.chunk_count || '--'}
                    </td>
                    <td className="px-4 py-3">
                      {doc.quality_score ? (
                        <div className="flex items-center gap-1">
                          <div className="w-16 bg-gray-200 rounded-full h-2">
                            <div
                              className={`h-full rounded-full ${
                                doc.quality_score >= 0.8 ? 'bg-green-500' :
                                doc.quality_score >= 0.6 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${doc.quality_score * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500">
                            {Math.round(doc.quality_score * 100)}%
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400">--</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            // TODO: Implement preview
                            alert('预览功能开发中');
                          }}
                          className="p-1 text-gray-400 hover:text-blue-500"
                          title="预览"
                        >
                          👁️
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              共 {pagination.total} 个文档，第 {pagination.page} / {pagination.total_pages} 页
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page - 1 }))}
                disabled={pagination.page <= 1}
                className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                上一页
              </button>
              <button
                onClick={() => setPagination(p => ({ ...p, page: p.page + 1 }))}
                disabled={pagination.page >= pagination.total_pages}
                className="px-3 py-1 border border-gray-200 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                下一页
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
