'use client';

import { useState, useEffect } from 'react';
import { DimensionRadarChart } from '@/components/charts/radar-chart';
import { DIMENSION_LABELS } from '@/types/diagnosis';
import type { FiveDimensionsData, DimensionKey } from '@/types/diagnosis';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface ProjectSummary {
  id: string;
  name: string;
  client_name?: string;
  status: string;
  selected_modules?: string[];
  analysis_data?: FiveDimensionsData;
}

type ViewMode = 'table' | 'chart';

export default function DataPage() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [filterDimension, setFilterDimension] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/projects`);
        if (res.ok) {
          const data = await res.json();
          const list = data.projects || [];
          // Normalize selected_modules: API may return JSON string instead of array
          const normalized = list.map((p: ProjectSummary) => ({
            ...p,
            selected_modules: typeof p.selected_modules === 'string'
              ? (() => { try { return JSON.parse(p.selected_modules); } catch { return []; } })()
              : p.selected_modules || [],
          }));
          setProjects(normalized);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    };
    fetchProjects();
  }, []);

  // Filter projects
  const filtered = projects.filter(p => {
    if (filterDimension && !(p.selected_modules || []).includes(filterDimension)) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (p.name || '').toLowerCase().includes(q) ||
        (p.client_name || '').toLowerCase().includes(q);
    }
    return true;
  });

  // Status labels
  const statusLabels: Record<string, string> = {
    draft: '草稿', requirement: '需求分析', diagnosing: '调研诊断',
    delivering: '交付中', completed: '已完成',
  };
  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-600', requirement: 'bg-blue-100 text-blue-700',
    diagnosing: 'bg-amber-100 text-amber-700', delivering: 'bg-green-100 text-green-700',
    completed: 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">数据探索</h1>
          <p className="text-gray-500 mt-1">跨项目数据查询和分析</p>
        </div>
        <div className="flex items-center gap-2">
          {['table', 'chart'].map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode as ViewMode)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                viewMode === mode
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {mode === 'table' ? '表格' : '图表'}
            </button>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索项目名称或客户..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          {/* Dimension filter */}
          <div className="flex gap-1">
            <button
              onClick={() => setFilterDimension('')}
              className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                !filterDimension ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              全部
            </button>
            {Object.entries(DIMENSION_LABELS).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilterDimension(filterDimension === key ? '' : key)}
                className={`px-3 py-2 rounded-lg text-sm border transition-colors ${
                  filterDimension === key ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <div className="animate-spin w-8 h-8 border-3 border-blue-500 border-t-transparent rounded-full mx-auto" />
          <p className="text-gray-400 mt-3">加载项目数据...</p>
        </div>
      )}

      {/* Table view */}
      {!loading && viewMode === 'table' && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">项目</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">客户</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">维度</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">状态</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-gray-400 text-sm">
                    {searchQuery || filterDimension ? '没有匹配的项目' : '暂无项目数据'}
                  </td>
                </tr>
              ) : (
                filtered.map(project => (
                  <tr
                    key={project.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => setSelectedProject(project)}
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-gray-900">{project.name}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">{project.client_name || '—'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        {(project.selected_modules || []).map(m => (
                          <span key={m} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                            {m}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                        {statusLabels[project.status] || project.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm text-blue-500 hover:text-blue-700">查看 →</span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Chart view */}
      {!loading && viewMode === 'chart' && (
        <div className="space-y-4">
          {filtered.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              {searchQuery || filterDimension ? '没有匹配的项目' : '暂无项目数据'}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map(project => (
                <div
                  key={project.id}
                  onClick={() => setSelectedProject(project)}
                  className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium text-gray-900">{project.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                      {statusLabels[project.status] || project.status}
                    </span>
                  </div>
                  {project.client_name && (
                    <p className="text-xs text-gray-500 mb-2">{project.client_name}</p>
                  )}
                  <div className="flex gap-1">
                    {(project.selected_modules || []).map(m => (
                      <span key={m} className="px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {DIMENSION_LABELS[m as DimensionKey] || m}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Project detail modal */}
      {selectedProject && (
        <div
          className="fixed inset-0 z-50 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setSelectedProject(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{selectedProject.name}</h2>
                  {selectedProject.client_name && (
                    <p className="text-sm text-gray-500 mt-0.5">{selectedProject.client_name}</p>
                  )}
                </div>
                <button
                  onClick={() => setSelectedProject(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400"
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {/* Status + dimensions */}
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-0.5 rounded font-medium ${statusColors[selectedProject.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabels[selectedProject.status] || selectedProject.status}
                </span>
                {(selectedProject.selected_modules || []).map(m => (
                  <span key={m} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                    {DIMENSION_LABELS[m as DimensionKey] || m}
                  </span>
                ))}
              </div>

              {/* Radar chart if analysis data exists */}
              {selectedProject.analysis_data && (
                <DimensionRadarChart data={selectedProject.analysis_data} />
              )}

              {/* Quick links */}
              <div className="flex gap-2">
                <a
                  href={`/projects/${selectedProject.id}/proposal`}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                >
                  需求分析
                </a>
                <a
                  href={`/projects/${selectedProject.id}/diagnosis`}
                  className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 text-sm"
                >
                  调研诊断
                </a>
                <a
                  href={`/projects/${selectedProject.id}/delivery`}
                  className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 text-sm"
                >
                  项目交付
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
