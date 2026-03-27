'use client';

import { useState, useEffect } from 'react';
import {
  Folder,
  Plus,
  Check,
  ChevronDown,
  Search,
  Loader2,
} from 'lucide-react';

// ====================
// Types
// ====================

export interface Project {
  id: string;
  name: string;
  client_name?: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectSelectorProps {
  selectedProjectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  placeholder?: string;
}

// ====================
// API Functions
// ====================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

async function fetchProjects(): Promise<Project[]> {
  const response = await fetch(`${API_BASE}/api/projects/`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch projects' }));
    throw new Error(error.detail || 'Failed to fetch projects');
  }
  const data = await response.json();
  return data.projects || [];
}

// ====================
// Utility Functions
// ====================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  if (diffYears > 1) return `${diffYears}y ago`;
  if (diffMonths > 1) return `${diffMonths}mo ago`;
  if (diffWeeks > 1) return `${diffWeeks}w ago`;
  if (diffDays > 0) return `${diffDays}d ago`;
  return 'Just now';
}

function getStatusBadge(status: string): { text: string; className: string } {
  const badges: Record<string, { text: string; className: string }> = {
    draft: { text: '草稿', className: 'bg-gray-100 text-gray-600' },
    active: { text: '进行中', className: 'bg-blue-100 text-blue-600' },
    review: { text: '审核中', className: 'bg-yellow-100 text-yellow-600' },
    completed: { text: '已完成', className: 'bg-green-100 text-green-600' },
    archived: { text: '已归档', className: 'bg-gray-100 text-gray-400' },
  };
  return badges[status] || badges.draft;
}

// ====================
// Component
// ====================

export default function ProjectSelector({
  selectedProjectId,
  onProjectChange,
  placeholder = '选择项目...',
}: ProjectSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载项目失败');
    } finally {
      setLoading(false);
    }
  };

  // Filter projects by search query
  const filteredProjects = projects.filter(project =>
    project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    project.client_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get selected project
  const selectedProject = projects.find(p => p.id === selectedProjectId);

  // Handle project selection
  const handleSelect = (projectId: string) => {
    onProjectChange(projectId);
    setIsOpen(false);
    setSearchQuery('');
  };

  // Handle clear selection
  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onProjectChange(null);
  };

  return (
    <div className="relative">
      {/* Trigger Button */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 bg-white border border-gray-200 rounded-lg hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2 truncate">
          <Folder size={16} className="text-gray-400 flex-shrink-0" />
          {selectedProject ? (
            <span className="truncate">{selectedProject.name}</span>
          ) : (
            <span className="text-gray-400">{placeholder}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {selectedProject && (
            <span
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
            >
              ×
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索项目..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            </div>
          </div>

          {/* Project List */}
          <div className="max-h-60 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 size={20} className="animate-spin text-gray-400" />
              </div>
            ) : error ? (
              <div className="p-4 text-center text-sm text-red-500">{error}</div>
            ) : filteredProjects.length === 0 ? (
              <div className="p-4 text-center text-sm text-gray-500">
                {searchQuery ? '没有找到匹配的项目' : '暂无项目'}
              </div>
            ) : (
              filteredProjects.map(project => (
                <button
                  key={project.id}
                  onClick={() => handleSelect(project.id)}
                  className={`w-full flex items-center justify-between px-3 py-2 hover:bg-gray-50 transition-colors ${
                    selectedProjectId === project.id ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <Folder size={14} className="text-blue-500 flex-shrink-0" />
                    <div className="truncate">
                      <div className="text-sm font-medium truncate">{project.name}</div>
                      {project.client_name && (
                        <div className="text-xs text-gray-400 truncate">
                          {project.client_name}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-1.5 py-0.5 rounded ${getStatusBadge(project.status).className}`}>
                      {getStatusBadge(project.status).text}
                    </span>
                    {selectedProjectId === project.id && (
                      <Check size={14} className="text-blue-500" />
                    )}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Create New */}
          <div className="p-2 border-t border-gray-100">
            <button
              onClick={() => {
                setIsOpen(false);
                window.location.href = '/projects?action=create';
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors"
            >
              <Plus size={14} />
              <span>创建新项目</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
