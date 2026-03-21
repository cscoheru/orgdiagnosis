'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import {
  searchKB,
  getCategories,
  getCategoryName,
  type SearchResult,
  type Category
} from '@/lib/kb-api';

export default function KnowledgeSearchPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [topK, setTopK] = useState(5);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [queryTime, setQueryTime] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load categories on mount
  useState(() => {
    getCategories().then(setCategories).catch(console.error);
  });

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const response = await searchKB({
        query: query.trim(),
        category: selectedCategory || undefined,
        top_k: topK
      });

      setResults(response.results);
      setQueryTime(response.query_time_ms);
    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedCategory, topK]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100';
    if (score >= 0.6) return 'text-blue-600 bg-blue-100';
    if (score >= 0.4) return 'text-yellow-600 bg-yellow-100';
    return 'text-gray-600 bg-gray-100';
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔍 搜索测试</h1>
          <p className="text-gray-500 mt-1">测试知识库的语义检索效果</p>
        </div>
        <Link
          href="/knowledge/documents"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <span>📚</span>
          文档管理
        </Link>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索查询
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入问题或关键词，例如：如何设计股权激励方案"
                className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !query.trim()}
                className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="animate-spin">⏳</span>
                    搜索中
                  </>
                ) : (
                  <>
                    <span>🔍</span>
                    搜索
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-4">
            <div>
              <label className="block text-sm text-gray-600 mb-1">分类过滤</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部分类</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">返回数量</label>
              <select
                value={topK}
                onChange={(e) => setTopK(Number(e.target.value))}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value={3}>3 条</option>
                <option value={5}>5 条</option>
                <option value={10}>10 条</option>
                <option value={20}>20 条</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
          <span className="mr-2">❌</span>
          {error}
        </div>
      )}

      {/* Results */}
      {hasSearched && !loading && (
        <div className="space-y-4">
          {/* Results Summary */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">
              找到 {results.length} 个结果
            </h2>
            {queryTime > 0 && (
              <span className="text-sm text-gray-500">
                耗时 {queryTime}ms
              </span>
            )}
          </div>

          {/* Results List */}
          {results.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <span className="text-4xl block mb-2">🔍</span>
              <p>未找到相关结果</p>
              <p className="text-sm mt-1">尝试调整查询词或移除分类过滤</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.chunk_id}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {result.file_name.endsWith('.pdf') ? '📄' :
                         result.file_name.endsWith('.docx') ? '📝' :
                         result.file_name.endsWith('.pptx') ? '📊' : '📄'}
                      </span>
                      <span className="font-medium text-gray-800">
                        {result.file_name}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs ${getScoreColor(result.score)}`}>
                        相关度 {Math.round(result.score * 100)}%
                      </span>
                    </div>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                      {getCategoryName(result.category)}
                    </span>
                  </div>

                  {/* Content Preview */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {result.content.length > 300
                        ? result.content.slice(0, 300) + '...'
                        : result.content}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      <span>来源: {result.chunk_id}</span>
                      <span>•</span>
                      <span>文档ID: {result.document_id}</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyToClipboard(result.content)}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        复制内容
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      {!hasSearched && (
        <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h3 className="font-medium text-gray-800 mb-3">💡 搜索技巧</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <h4 className="font-medium text-gray-700 mb-1">语义搜索</h4>
              <p>使用自然语言描述问题，系统会理解语义并返回相关结果</p>
              <p className="mt-1 text-gray-500">例：如何设计股权激励方案</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-1">关键词搜索</h4>
              <p>也可以使用关键词组合进行搜索</p>
              <p className="mt-1 text-gray-500">例：绩效考核 KPI 指标</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-1">分类过滤</h4>
              <p>选择分类可以缩小搜索范围，提高结果相关性</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-700 mb-1">结果数量</h4>
              <p>调整返回数量查看更多结果，但相关度会逐渐降低</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
