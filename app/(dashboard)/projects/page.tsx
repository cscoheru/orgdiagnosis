'use client'

/**
 * Project Management Dashboard
 * 咨询师视角的项目列表，支持维度模块选择。
 */

import { useState, useEffect, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import StatsOverview from '@/components/project/StatsOverview'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Project = {
  id: string
  name: string
  description?: string | null
  client_name?: string | null
  client_industry?: string | null
  status: string
  current_step: string
  created_at: string
  updated_at: string
  selected_modules?: string[]
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  requirement: '需求分析',
  diagnosing: '调研诊断',
  delivering: '交付中',
  completed: '已完成',
}

const statusColors: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  requirement: 'bg-blue-100 text-blue-700',
  diagnosing: 'bg-amber-100 text-amber-700',
  delivering: 'bg-green-100 text-green-700',
  completed: 'bg-purple-100 text-purple-700',
}

const dimensionColors: Record<string, string> = {
  '战略': 'bg-blue-50 text-blue-700 border-blue-200',
  '组织': 'bg-green-50 text-green-700 border-green-200',
  '绩效': 'bg-amber-50 text-amber-700 border-amber-200',
  '薪酬': 'bg-rose-50 text-rose-700 border-rose-200',
  '人才': 'bg-violet-50 text-violet-700 border-violet-200',
}

const ALL_DIMENSIONS = ['战略', '组织', '绩效', '薪酬', '人才']

export default function ProjectsPage() {
  return (
    <Suspense fallback={<div className="text-center py-12 text-gray-400">加载中...</div>}>
      <ProjectsPageContent />
    </Suspense>
  )
}

function ProjectsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New project form
  const [dialogOpen, setDialogOpen] = useState(searchParams.get('new') === 'true')
  const [newProject, setNewProject] = useState({
    name: '',
    client_name: '',
    client_industry: '',
  })
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  // Fetch function
  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`${API_BASE}/api/projects/`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const data = await response.json()
      // Normalize selected_modules: API may return JSON string instead of array
      const rawProjects = data.projects || []
      const normalized = rawProjects.map((p: Project) => ({
        ...p,
        selected_modules: typeof p.selected_modules === 'string'
          ? (() => { try { return JSON.parse(p.selected_modules); } catch { return []; } })()
          : p.selected_modules || [],
      }))
      setProjects(normalized)
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
      setLoading(false)
    }
  }, [])

  // Fetch on mount
  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])

  // Create project
  const handleCreate = async () => {
    if (!newProject.name.trim()) {
      alert('请输入项目名称')
      return
    }

    try {
      setCreating(true)
      const response = await fetch(`${API_BASE}/api/projects/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProject,
          selected_modules: selectedModules.length > 0 ? selectedModules : undefined,
        }),
      })

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}))
        throw new Error(errData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setDialogOpen(false)
      setNewProject({ name: '', client_name: '', client_industry: '' })
      setSelectedModules([])
      router.push(`/projects/${data.project.id}/proposal`)
    } catch (err) {
      alert('创建失败: ' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      setCreating(false)
    }
  }

  // Delete project
  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此项目？')) return

    try {
      await fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' })
      setProjects(projects.filter(p => p.id !== id))
    } catch {
      alert('删除失败')
    }
  }

  // Toggle dimension module
  const toggleModule = (dim: string) => {
    setSelectedModules(prev =>
      prev.includes(dim)
        ? prev.filter(d => d !== dim)
        : [...prev, dim]
    )
  }

  // Format time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMins / 60)
    const diffDays = Math.floor(diffHours / 24)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}m`
    if (diffHours < 24) return `${diffHours}h`
    if (diffDays < 7) return `${diffDays}d`
    return date.toLocaleDateString('zh-CN')
  }

  // Get project link based on status
  const getProjectLink = (project: Project) => {
    if (project.status === 'delivering') return `/projects/${project.id}/delivery`
    if (project.status === 'diagnosing') return `/projects/${project.id}/diagnosis`
    return `/projects/${project.id}/proposal`
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目总览</h1>
          <p className="text-gray-500 mt-1">管理所有咨询项目</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span>
          新建项目
        </button>
      </div>

      {/* Stats Overview */}
      {!loading && (
        <StatsOverview
          stats={{
            total: projects.length,
            active: projects.filter(p => p.status !== 'completed' && p.status !== 'draft').length,
            completed: projects.filter(p => p.status === 'completed').length,
            recent: projects.filter(p => {
              const d = new Date(p.created_at);
              const now = new Date();
              return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
            }).length,
          }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={fetchProjects} className="text-red-600 hover:underline">
            重试
          </button>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-gray-500">加载项目数据...</p>
          </div>
        </div>
      )}

      {/* Projects Grid */}
      {!loading && projects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(project => (
            <Link
              key={project.id}
              href={getProjectLink(project)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow block"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 line-clamp-1">
                  {project.name}
                </h3>
                <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ml-2 ${statusColors[project.status] || 'bg-gray-100 text-gray-600'}`}>
                  {statusLabels[project.status] || project.status}
                </span>
              </div>

              {project.client_name && (
                <p className="text-sm text-gray-500 mb-2">
                  {project.client_name}
                  {project.client_industry && ` · ${project.client_industry}`}
                </p>
              )}

              {/* Dimension tags */}
              {project.selected_modules && project.selected_modules.length > 0 && (
                <div className="flex gap-1 mb-3">
                  {project.selected_modules.map(m => (
                    <span
                      key={m}
                      className={`px-1.5 py-0.5 rounded text-xs border ${dimensionColors[m] || 'bg-gray-50 text-gray-600 border-gray-200'}`}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {formatTime(project.updated_at)}
                </span>
                <span className="text-sm text-blue-500">
                  进入 →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && projects.length === 0 && !error && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <span className="text-4xl block mb-3">📋</span>
          <p className="text-gray-500 mb-4">暂无项目</p>
          <button
            onClick={() => setDialogOpen(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            创建第一个项目
          </button>
        </div>
      )}

      {/* New Project Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold mb-4">新建项目</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  项目名称 *
                </label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: XX公司组织诊断"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  客户名称
                </label>
                <input
                  type="text"
                  value={newProject.client_name}
                  onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: XX科技有限公司"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  行业
                </label>
                <input
                  type="text"
                  value={newProject.client_industry}
                  onChange={(e) => setNewProject({ ...newProject, client_industry: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="例如: 制造业、互联网、金融"
                />
              </div>

              {/* Dimension Module Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  诊断维度
                </label>
                <div className="flex flex-wrap gap-2">
                  {ALL_DIMENSIONS.map(dim => (
                    <button
                      key={dim}
                      type="button"
                      onClick={() => toggleModule(dim)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                        selectedModules.includes(dim)
                          ? dimensionColors[dim]
                          : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {selectedModules.includes(dim) ? '✓ ' : ''}{dim}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  选择需要诊断的维度模块（可多选）
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
