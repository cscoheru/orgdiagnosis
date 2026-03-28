'use client';

import { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

type Project = {
  id: string;
  name: string;
  client_name?: string | null;
  status: string;
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

const tabs = [
  { name: '需求分析', href: 'proposal', icon: '📋', key: 'requirement' },
  { name: '调研诊断', href: 'diagnosis', icon: '🔍', key: 'diagnosing' },
  { name: '项目交付', href: 'delivery', icon: '🚀', key: 'delivering' },
];

export default function ProjectLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const pathname = usePathname();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects/${projectId}`);
        if (res.ok) {
          const data = await res.json();
          const p = data.project;
          // Normalize selected_modules: API may return JSON string instead of array
          if (p && typeof p.selected_modules === 'string') {
            try { p.selected_modules = JSON.parse(p.selected_modules); } catch { p.selected_modules = []; }
          }
          setProject(p);
        }
      } catch {
        // Silently fail — header just won't show project info
      } finally {
        setLoading(false);
      }
    };
    if (projectId) fetchProject();
  }, [projectId]);

  // Determine active tab from pathname
  const activeTab = tabs.find(t => pathname.endsWith(t.href));

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/projects" className="hover:text-gray-700">
          项目列表
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">
          {loading ? '加载中...' : project?.name || '未知项目'}
        </span>
        {activeTab && (
          <>
            <span>/</span>
            <span className="text-gray-700">{activeTab.name}</span>
          </>
        )}
      </nav>

      {/* Project Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {loading ? '...' : project?.name || '未知项目'}
              </h1>
              {project?.client_name && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {project.client_name}
                  {project.selected_modules && project.selected_modules.length > 0 && (
                    <span className="ml-3">
                      {project.selected_modules.map(m => (
                        <span key={m} className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs mr-1">
                          {m}
                        </span>
                      ))}
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {!loading && project && (
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
              {statusLabels[project.status] || project.status}
            </span>
          )}
        </div>
      </div>

      {/* Project Navigation Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-6">
          {tabs.map(tab => {
            const href = `/projects/${projectId}/${tab.href}`;
            const isActive = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={tab.key}
                href={href}
                className={`flex items-center gap-2 px-1 py-3 border-b-2 transition-colors ${
                  isActive
                    ? 'border-blue-600 text-blue-600 font-medium'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span>{tab.icon}</span>
                <span>{tab.name}</span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Page Content */}
      {children}
    </div>
  );
}
