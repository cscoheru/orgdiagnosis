'use client'

/**
 * Project Management Dashboard - Simplified
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  requirement: '需求',
  outline: '大纲',
  slides: '幻灯片',
  export: '导出中',
  completed: '已完成',
}

const stepLabels: Record<string, string> = {
  requirement: '需求录入',
  outline: '大纲审核',
  slides: '内容编辑',
  export: '导出报告',
}

export default function ProjectsPage() {
  const router = useRouter()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // New project form
  const [dialogOpen, setDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    name: '',
    client_name: '',
    client_industry: '',
  })
  const [creating, setCreating] = useState(false)

  // Fetch projects on mount
  useEffect(() => {
    let cancelled = false

    async function loadProjects() {
      try {
        setLoading(true)
        setError(null)

        const response = await fetch(`${API_BASE}/api/projects/`, {
          headers: { 'Accept': 'application/json' }
        })

        if (cancelled) return

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`)
        }

        const data = await response.json()
        if (!cancelled) {
          setProjects(data.projects || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    loadProjects()

    return () => { cancelled = true }
  }, [])

  // Reload function
  const reload = () => {
    window.location.reload()
  }

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
        body: JSON.stringify(newProject),
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const data = await response.json()
      router.push(`/report?project=${data.project.id}`)
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
    } catch (err) {
      alert('删除失败')
    }
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
    if (diffMins < 60) return `${diffMins} 分钟前`
    if (diffHours < 24) return `${diffHours} 小时前`
    if (diffDays < 7) return `${diffDays} 天前`
    return date.toLocaleDateString('zh-CN')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">项目管理</h1>
          <p className="text-gray-500 mt-1">共 {projects.length} 个项目</p>
        </div>
        <button
          onClick={() => setDialogOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <span>+</span>
          新建项目
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-center justify-between">
          <span>⚠️ {error}</span>
          <button onClick={reload} className="text-red-600 hover:underline">
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
            <div
              key={project.id}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900 line-clamp-1">
                  {project.name}
                </h3>
                <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                  {statusLabels[project.status] || project.status}
                </span>
              </div>

              {project.client_name && (
                <p className="text-sm text-gray-500 mb-2">
                  🏢 {project.client_name}
                  {project.client_industry && ` · ${project.client_industry}`}
                </p>
              )}

              <p className="text-xs text-gray-400 mb-3">
                当前步骤: {stepLabels[project.current_step] || project.current_step}
              </p>

              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-400">
                  {formatTime(project.updated_at)}
                </span>
                <div className="flex gap-2">
                  <Link
                    href={`/report?project=${project.id}`}
                    className="text-sm text-blue-500 hover:text-blue-700"
                  >
                    继续 →
                  </Link>
                  <button
                    onClick={() => handleDelete(project.id)}
                    className="text-sm text-red-400 hover:text-red-600"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
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
