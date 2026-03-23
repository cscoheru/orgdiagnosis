'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  getProjects,
  getL1Dimensions,
  getKBStats,
  getDimensionName,
  getDimensionColor,
  getDimensionIcon,
  type Project,
  type Dimension,
  type KBStats
} from '@/lib/knowledge-v2-api';

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

interface DimensionCardProps {
  dimension: Dimension;
  documentCount?: number;
}

function DimensionCard({ dimension, documentCount = 0 }: DimensionCardProps) {
  const icon = getDimensionIcon(dimension.code);
  const colorClass = getDimensionColor(dimension.code);

  return (
    <Link
      href={`/knowledge/search?l1=${dimension.code}`}
      className={`block p-4 rounded-xl border ${colorClass} hover:shadow-md transition-all`}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div className="flex-1">
          <h3 className="font-semibold">{dimension.name}</h3>
          <p className="text-xs opacity-75">{dimension.description || ''}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{documentCount}</p>
          <p className="text-xs opacity-75">文档</p>
        </div>
      </div>
    </Link>
  );
}

export default function KnowledgeDashboardPage() {
  const [stats, setStats] = useState<KBStats | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const [statsData, projectsData, dimensionsData] = await Promise.all([
          getKBStats(),
          getProjects(),
          getL1Dimensions()
        ]);
        setStats(statsData);
        setProjects(projectsData);
        setDimensions(dimensionsData);
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

  const totalDocs = stats?.total_documents || 0;
  const totalProjects = stats?.total_projects || 0;
  const totalPages = stats?.total_pages || 0;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📚 知识库仪表盘</h1>
          <p className="text-gray-500 mt-1">管理咨询报告，按项目和五维维度分类检索</p>
        </div>
        <div className="flex items-center gap-3">
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
          title="项目总数"
          value={totalProjects}
          icon="🗂️"
          color="text-purple-600"
        />
        <StatCard
          title="文档总数"
          value={totalDocs}
          icon="📄"
          color="text-blue-600"
        />
        <StatCard
          title="页面总数"
          value={totalPages}
          icon="📑"
          color="text-green-600"
          subtext={`平均 ${totalDocs > 0 ? Math.round(totalPages / totalDocs) : 0} 页/文档`}
        />
        <StatCard
          title="五维分类"
          value="5"
          icon="🎯"
          color="text-orange-600"
          subtext="19 个二级分类"
        />
      </div>

      {/* Five Dimensions Grid */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">🎯 五维分类导航</h2>
          <Link
            href="/knowledge/search"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            查看全部
            <span>→</span>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {dimensions.map((dim) => (
            <DimensionCard
              key={dim.id}
              dimension={dim}
              documentCount={stats?.by_dimension?.[dim.code] || 0}
            />
          ))}
        </div>
      </div>

      {/* Projects List */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-800">🗂️ 项目列表</h2>
          <Link
            href="/projects"
            className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
          >
            管理项目
            <span>→</span>
          </Link>
        </div>
        {projects.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.slice(0, 6).map((project) => (
              <Link
                key={project.id}
                href={`/knowledge/search?project_id=${project.id}`}
                className="p-4 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-medium text-gray-900">{project.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {project.client_name || '未指定客户'}
                    </p>
                  </div>
                  <span className="text-sm text-gray-400">
                    {project.document_count || 0} 文档
                  </span>
                </div>
                {project.description && (
                  <p className="text-xs text-gray-400 mt-2 line-clamp-2">
                    {project.description}
                  </p>
                )}
              </Link>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <span className="text-4xl">📭</span>
            <p className="mt-2">暂无项目</p>
            <Link href="/projects?new=true" className="text-blue-500 hover:underline text-sm">
              创建第一个项目
            </Link>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/knowledge/documents"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">📚</span>
          <div>
            <h3 className="font-medium text-gray-900">文档管理</h3>
            <p className="text-sm text-gray-500">浏览、预览、删除文档</p>
          </div>
        </Link>
        <Link
          href="/knowledge/upload"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">⬆️</span>
          <div>
            <h3 className="font-medium text-gray-900">上传中心</h3>
            <p className="text-sm text-gray-500">上传PPTX/PDF报告</p>
          </div>
        </Link>
        <Link
          href="/knowledge/search"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow flex items-center gap-4"
        >
          <span className="text-3xl">🔍</span>
          <div>
            <h3 className="font-medium text-gray-900">搜索检索</h3>
            <p className="text-sm text-gray-500">全文搜索 + 五维筛选</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
