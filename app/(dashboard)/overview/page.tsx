'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Project = {
  id: string;
  name: string;
  client_name?: string | null;
  client_industry?: string | null;
  status: string;
  updated_at: string;
  selected_modules?: string[];
};

const statusLabels: Record<string, string> = {
  draft: '草稿',
  requirement: '需求分析',
  diagnosing: '调研诊断',
  delivering: '交付中',
  completed: '已完成',
};

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  requirement: 'bg-blue-100 text-blue-700',
  diagnosing: 'bg-amber-100 text-amber-700',
  delivering: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
};

const dimensionColors: Record<string, string> = {
  '战略': 'bg-blue-50 text-blue-700 border-blue-200',
  '组织': 'bg-green-50 text-green-700 border-green-200',
  '绩效': 'bg-amber-50 text-amber-700 border-amber-200',
  '薪酬': 'bg-rose-50 text-rose-700 border-rose-200',
  '人才': 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function OverviewPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<{ total: number; by_status: Record<string, number> }>({
    total: 0,
    by_status: {},
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, statsRes] = await Promise.all([
          fetch(`${API_BASE}/api/projects/`),
          fetch(`${API_BASE}/api/projects/stats/summary`),
        ]);

        if (projectsRes.ok) {
          const data = await projectsRes.json();
          setProjects(data.projects || []);
        }
        if (statsRes.ok) {
          const data = await statsRes.json();
          setStats({ total: data.total || 0, by_status: data.by_status || {} });
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Normalize selected_modules: API may return JSON string instead of array
  const normalize = (p: Project) => ({
    ...p,
    selected_modules: typeof p.selected_modules === 'string'
      ? (() => { try { return JSON.parse(p.selected_modules); } catch { return []; } })()
      : p.selected_modules || [],
  });
  const normalizedProjects = projects.map(normalize);

  const activeProjects = normalizedProjects.filter(p => !['draft', 'completed'].includes(p.status));
  const completedProjects = normalizedProjects.filter(p => p.status === 'completed');

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffHours / 24);
    if (diffHours < 1) return '刚刚';
    if (diffHours < 24) return `${diffHours}h 前`;
    if (diffDays < 7) return `${diffDays}d 前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">总览</h1>
          <p className="text-gray-500 mt-1">咨询项目管理概览</p>
        </div>
        <Link
          href="/projects?new=true"
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span>
          新建项目
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">总项目</p>
          <p className="text-3xl font-bold mt-1">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">进行中</p>
          <p className="text-3xl font-bold mt-1 text-blue-600">{activeProjects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">已完成</p>
          <p className="text-3xl font-bold mt-1 text-green-600">{completedProjects.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-sm text-gray-500">需求分析</p>
          <p className="text-3xl font-bold mt-1 text-amber-600">
            {stats.by_status['requirement'] || 0}
          </p>
        </div>
      </div>

      {/* Active Projects */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-medium">活跃项目</h2>
          <Link href="/projects" className="text-sm text-blue-500 hover:text-blue-700">
            查看全部
          </Link>
        </div>
        {loading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : activeProjects.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            <p className="mb-3">暂无活跃项目</p>
            <Link href="/projects?new=true" className="text-blue-500 hover:underline">
              创建第一个项目
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {activeProjects.slice(0, 5).map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}/proposal`}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div>
                    <p className="font-medium text-gray-900 truncate">{project.name}</p>
                    <p className="text-sm text-gray-500">
                      {project.client_name || '未设置客户'}
                      {project.client_industry && ` · ${project.client_industry}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {project.selected_modules && project.selected_modules.length > 0 && (
                    <div className="flex gap-1">
                      {project.selected_modules.slice(0, 3).map((m: string) => (
                        <span
                          key={m}
                          className={`px-1.5 py-0.5 rounded text-xs border ${dimensionColors[m] || 'bg-gray-50 text-gray-600 border-gray-200'}`}
                        >
                          {m}
                        </span>
                      ))}
                      {project.selected_modules.length > 3 && (
                        <span className="px-1.5 py-0.5 text-xs text-gray-400">
                          +{project.selected_modules.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                    {statusLabels[project.status] || project.status}
                  </span>
                  <span className="text-xs text-gray-400 w-16 text-right">
                    {formatTime(project.updated_at)}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link
          href="/projects"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <span className="text-2xl block mb-2">📂</span>
          <h3 className="font-medium">项目列表</h3>
          <p className="text-sm text-gray-500 mt-1">管理所有咨询项目</p>
        </Link>
        <Link
          href="/data"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <span className="text-2xl block mb-2">🔍</span>
          <h3 className="font-medium">数据探索</h3>
          <p className="text-sm text-gray-500 mt-1">跨项目数据查询和分析</p>
        </Link>
        <Link
          href="/settings/kernel"
          className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <span className="text-2xl block mb-2">⚙️</span>
          <h3 className="font-medium">内核管理</h3>
          <p className="text-sm text-gray-500 mt-1">元模型和内核数据管理</p>
        </Link>
      </div>
    </div>
  );
}
