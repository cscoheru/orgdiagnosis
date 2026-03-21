'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getKBStats,
  getQualityReport,
  formatFileSize,
  getCategoryName,
  type KBStats,
  type QualityReport
} from '@/lib/kb-api';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
  subtext?: string;
}

function StatCard({ title, value, icon, color, subtext }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <span className="text-4xl">{icon}</span>
      </div>
    </div>
  );
}

interface CategoryBarProps {
  category: string;
  count: number;
  total: number;
}

function CategoryBar({ category, count, total }: CategoryBarProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  const name = getCategoryName(category);

  return (
    <div className="flex items-center gap-3 py-2">
      <span className="text-sm text-gray-600 w-20">{name}</span>
      <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-400 to-blue-600 h-full rounded-full transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-sm text-gray-500 w-16 text-right">
        {count} ({percentage.toFixed(0)}%)
      </span>
    </div>
  );
}

export default function KnowledgeDashboardPage() {
  const [stats, setStats] = useState<KBStats | null>(null);
  const [quality, setQuality] = useState<QualityReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [statsData, qualityData] = await Promise.all([
          getKBStats(),
          getQualityReport()
        ]);
        setStats(statsData);
        setQuality(qualityData);
      } catch (err) {
        setError(err instanceof Error ? err.message : '加载数据失败');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-500">加载知识库数据...</p>
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
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const totalDocs = stats?.overview.total_documents || 0;
  const totalChunks = stats?.overview.total_chunks || 0;
  const storageSize = stats?.overview.storage_size_mb || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 知识库仪表盘</h1>
          <p className="text-gray-500 mt-1">管理历史咨询报告，构建 RAG 知识库</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-400">
            上次更新: {stats?.overview.last_updated ?
              new Date(stats.overview.last_updated).toLocaleString('zh-CN') : '--'}
          </span>
          <Link
            href="/knowledge/upload"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2"
          >
            <span>⬆️</span>
            上传文档
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard
          title="文档总数"
          value={totalDocs}
          icon="📄"
          color="text-blue-600"
        />
        <StatCard
          title="文档块数"
          value={totalChunks}
          icon="📦"
          color="text-purple-600"
          subtext={`平均 ${stats?.quality.avg_chunk_size || 512} 字符/块`}
        />
        <StatCard
          title="存储空间"
          value={storageSize > 0 ? `${storageSize} MB` : '-- MB'}
          icon="💾"
          color="text-green-600"
        />
        <StatCard
          title="质量评分"
          value={quality?.overall_score ? `${(quality.overall_score * 100).toFixed(0)}分` : '--'}
          icon="🎯"
          color="text-orange-600"
          subtext={quality?.overall_score && quality.overall_score < 0.7 ? '需要优化' : '状态良好'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Distribution */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">📊 分类分布</h2>
          {stats?.distribution.by_category && Object.keys(stats.distribution.by_category).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(stats.distribution.by_category)
                .sort(([, a], [, b]) => b - a)
                .map(([category, count]) => (
                  <CategoryBar
                    key={category}
                    category={category}
                    count={count}
                    total={totalDocs}
                  />
                ))
              }
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              <span className="text-4xl">📭</span>
              <p className="mt-2">暂无文档数据</p>
              <Link href="/knowledge/upload" className="text-blue-500 hover:underline text-sm">
                上传第一份文档
              </Link>
            </div>
          )}
        </div>

        {/* Quality Analysis */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">🎯 质量分析</h2>
          {quality ? (
            <div className="space-y-4">
              {/* Quality Dimensions */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">覆盖度</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-green-500 h-full rounded-full"
                        style={{ width: `${(quality.dimensions.coverage.score || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {((quality.dimensions.coverage.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">新鲜度</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-blue-500 h-full rounded-full"
                        style={{ width: `${(quality.dimensions.freshness?.score || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {((quality.dimensions.freshness?.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">完整度</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-purple-500 h-full rounded-full"
                        style={{ width: `${(quality.dimensions.completeness.score || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {((quality.dimensions.completeness.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">冗余度</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-orange-500 h-full rounded-full"
                        style={{ width: `${(quality.dimensions.redundancy?.score || 0) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500">
                      {((quality.dimensions.redundancy?.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Suggestions */}
              {quality.suggestions && quality.suggestions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">💡 优化建议</h3>
                  <ul className="space-y-2">
                    {quality.suggestions.slice(0, 3).map((suggestion, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm text-gray-600">
                        <span className={`mt-0.5 ${
                          suggestion.priority === 'high' ? 'text-red-500' :
                          suggestion.priority === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                        }`}>
                          {suggestion.priority === 'high' ? '🔴' :
                           suggestion.priority === 'medium' ? '🟡' : '⚪'}
                        </span>
                        <span>{suggestion.reason}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-400">
              暂无质量数据
            </div>
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-100">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">⚙️ 系统配置</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Embedding 模型</span>
            <p className="font-medium text-gray-800">{stats?.system.embedding_model || '--'}</p>
          </div>
          <div>
            <span className="text-gray-500">向量维度</span>
            <p className="font-medium text-gray-800">{stats?.system.embedding_dimensions || '--'}</p>
          </div>
          <div>
            <span className="text-gray-500">分块大小</span>
            <p className="font-medium text-gray-800">{stats?.system.chunk_config?.size || '--'} 字符</p>
          </div>
          <div>
            <span className="text-gray-500">分块重叠</span>
            <p className="font-medium text-gray-800">{stats?.system.chunk_config?.overlap || '--'} 字符</p>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4">
        <Link
          href="/knowledge/documents"
          className="flex-1 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-2xl">📚</span>
          <p className="mt-2 font-medium text-gray-800">文档管理</p>
          <p className="text-sm text-gray-500">浏览、预览、删除文档</p>
        </Link>
        <Link
          href="/knowledge/upload"
          className="flex-1 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-2xl">⬆️</span>
          <p className="mt-2 font-medium text-gray-800">上传中心</p>
          <p className="text-sm text-gray-500">上传新的历史报告</p>
        </Link>
        <Link
          href="/knowledge/search"
          className="flex-1 bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow text-center"
        >
          <span className="text-2xl">🔍</span>
          <p className="mt-2 font-medium text-gray-800">搜索测试</p>
          <p className="text-sm text-gray-500">测试语义检索效果</p>
        </Link>
      </div>
    </div>
  );
}
