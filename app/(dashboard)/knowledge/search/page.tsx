'use client';

import { useState, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  search,
  getProjects,
  getDimensions,
  getDimensionName,
  getDimensionColor,
  getDimensionIcon,
  type SearchResult,
  type Project,
  type Dimension
} from '@/lib/knowledge-v2-api';

export default function KnowledgeSearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Filters
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [selectedProject, setSelectedProject] = useState(searchParams.get('project_id') || '');
  const [selectedL1, setSelectedL1] = useState(searchParams.get('l1') || '');
  const [selectedL2, setSelectedL2] = useState(searchParams.get('l2') || '');
  const [selectedL3, setSelectedL3] = useState(searchParams.get('l3') || '');

  // Data
  const [projects, setProjects] = useState<Project[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  // Load filter options
  useEffect(() => {
    Promise.all([
      getProjects(),
      getDimensions()
    ]).then(([projectsData, dimensionsData]) => {
      setProjects(projectsData);
      setDimensions(dimensionsData);
    }).catch(console.error);
  }, []);

  // Get L2 options based on selected L1
  const l2Options = dimensions.find(d => d.code === selectedL1)?.children || [];
  const l3Options = l2Options.find(l2 => l2.code === selectedL2)?.children || [];

  const handleSearch = useCallback(async () => {
    if (!query.trim() && !selectedProject && !selectedL1) {
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setHasSearched(true);

      const response = await search({
        query: query.trim() || '',
        project_id: selectedProject || undefined,
        dimension_l1: selectedL1 || undefined,
        dimension_l2: selectedL2 || undefined,
        dimension_l3: selectedL3 || undefined,
        limit: 20
      });

      setResults(response.results);
      setTotal(response.total);

      // Update URL
      const params = new URLSearchParams();
      if (query) params.set('q', query);
      if (selectedProject) params.set('project_id', selectedProject);
      if (selectedL1) params.set('l1', selectedL1);
      if (selectedL2) params.set('l2', selectedL2);
      if (selectedL3) params.set('l3', selectedL3);
      router.push(`/knowledge/search?${params.toString()}`, { scroll: false });

    } catch (err) {
      setError(err instanceof Error ? err.message : '搜索失败');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query, selectedProject, selectedL1, selectedL2, selectedL3, router]);

  // Auto search when filters change from URL
  useEffect(() => {
    if (searchParams.get('q') || searchParams.get('project_id') || searchParams.get('l1')) {
      handleSearch();
    }
  }, []); // Only on mount

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setQuery('');
    setSelectedProject('');
    setSelectedL1('');
    setSelectedL2('');
    setSelectedL3('');
    setResults([]);
    setHasSearched(false);
    router.push('/knowledge/search');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('已复制到剪贴板');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔍 知识库搜索</h1>
          <p className="text-gray-500 mt-1">全文搜索 + 五维分类 + 项目筛选</p>
        </div>
        <Link
          href="/knowledge/dashboard"
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
        >
          <span>📊</span>
          返回仪表盘
        </Link>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Query Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              搜索关键词
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="输入关键词，例如：战略规划、绩效管理、股权激励..."
                className="flex-1 px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-lg"
              />
              <button
                onClick={handleSearch}
                disabled={loading}
                className="px-8 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-lg"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Project Filter */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">📁 项目</label>
              <select
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* L1 Dimension */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">🎯 L1 维度</label>
              <select
                value={selectedL1}
                onChange={(e) => {
                  setSelectedL1(e.target.value);
                  setSelectedL2('');
                  setSelectedL3('');
                }}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">全部维度</option>
                {dimensions.map(d => (
                  <option key={d.id} value={d.code}>
                    {getDimensionIcon(d.code)} {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* L2 Category */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">📂 L2 分类</label>
              <select
                value={selectedL2}
                onChange={(e) => {
                  setSelectedL2(e.target.value);
                  setSelectedL3('');
                }}
                disabled={!selectedL1}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">全部分类</option>
                {l2Options.map(l2 => (
                  <option key={l2.id} value={l2.code}>{l2.name}</option>
                ))}
              </select>
            </div>

            {/* L3 Item */}
            <div>
              <label className="block text-sm text-gray-600 mb-1">📋 L3 指标</label>
              <select
                value={selectedL3}
                onChange={(e) => setSelectedL3(e.target.value)}
                disabled={!selectedL2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="">全部指标</option>
                {l3Options.map(l3 => (
                  <option key={l3.id} value={l3.code}>{l3.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Filters */}
          {(selectedProject || selectedL1 || selectedL2 || selectedL3) && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-500">当前筛选:</span>
              {selectedProject && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-sm flex items-center gap-1">
                  项目: {projects.find(p => p.id === selectedProject)?.name}
                  <button onClick={() => setSelectedProject('')} className="ml-1 hover:text-purple-900">×</button>
                </span>
              )}
              {selectedL1 && (
                <span className={`px-2 py-1 rounded-full text-sm flex items-center gap-1 ${getDimensionColor(selectedL1)}`}>
                  {getDimensionName(selectedL1)}
                  <button onClick={() => { setSelectedL1(''); setSelectedL2(''); setSelectedL3(''); }} className="ml-1 hover:opacity-70">×</button>
                </span>
              )}
              {selectedL2 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1">
                  {l2Options.find(l2 => l2.code === selectedL2)?.name}
                  <button onClick={() => { setSelectedL2(''); setSelectedL3(''); }} className="ml-1 hover:text-gray-900">×</button>
                </span>
              )}
              {selectedL3 && (
                <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-sm flex items-center gap-1">
                  {l3Options.find(l3 => l3.code === selectedL3)?.name}
                  <button onClick={() => setSelectedL3('')} className="ml-1 hover:text-gray-900">×</button>
                </span>
              )}
              <button
                onClick={clearFilters}
                className="text-sm text-red-500 hover:text-red-700"
              >
                清除全部
              </button>
            </div>
          )}
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
              找到 {total} 个结果
            </h2>
          </div>

          {/* Results List */}
          {results.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <span className="text-4xl block mb-2">🔍</span>
              <p>未找到相关结果</p>
              <p className="text-sm mt-1">尝试调整关键词或筛选条件</p>
            </div>
          ) : (
            <div className="space-y-4">
              {results.map((result, index) => (
                <div
                  key={result.page_id || index}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">
                        {result.filename?.endsWith('.pptx') ? '📊' :
                         result.filename?.endsWith('.pdf') ? '📄' : '📄'}
                      </span>
                      <span className="font-medium text-gray-800">
                        {result.document_title || result.filename}
                      </span>
                      <span className="text-sm text-gray-400">
                        第 {result.page_number} 页
                      </span>
                    </div>
                    {result.dimension?.l1 && (
                      <span className={`px-2 py-0.5 rounded text-xs ${getDimensionColor(result.dimension.l1)}`}>
                        {getDimensionIcon(result.dimension.l1)} {getDimensionName(result.dimension.l1)}
                      </span>
                    )}
                  </div>

                  {/* Content Preview */}
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {result.highlighted_content || result.content?.slice(0, 300) || ''}
                      {(result.content?.length || 0) > 300 && '...'}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center gap-3">
                      {result.project_name && (
                        <>
                          <span>📁 {result.project_name}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>置信度: {((result.dimension?.confidence || 0) * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex gap-2">
                      <Link
                        href={`/knowledge/documents/${result.document_id}`}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        查看文档
                      </Link>
                      <button
                        onClick={() => copyToClipboard(result.content || '')}
                        className="text-blue-500 hover:text-blue-700"
                      >
                        复制
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Dimension Links */}
      {!hasSearched && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="font-medium text-gray-800 mb-4">🎯 按五维维度浏览</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {dimensions.map(dim => (
              <button
                key={dim.id}
                onClick={() => {
                  setSelectedL1(dim.code);
                  handleSearch();
                }}
                className={`p-3 rounded-lg border text-center transition-all hover:shadow-md ${getDimensionColor(dim.code)}`}
              >
                <span className="text-2xl block mb-1">{getDimensionIcon(dim.code)}</span>
                <span className="font-medium">{dim.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
