'use client'

/**
 * Project Management Dashboard
 *
 * Allows users to:
 * - View all their projects
 * - Create new projects
 * - Resume draft projects
 * - Delete projects
 */

import { Suspense, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  getProjects,
  getProjectStats,
  createProject,
  deleteProject,
  hasDraftProjects,
  type ProjectWithDetails,
} from '@/lib/project-api'

type Project = ProjectWithDetails

// Status badge colors
const statusColors: Record<string, string> = {
  draft: 'bg-gray-500',
  requirement: 'bg-blue-500',
  outline: 'bg-yellow-500',
  slides: 'bg-purple-500',
  export: 'bg-orange-500',
  completed: 'bg-green-500',
  archived: 'bg-gray-400',
}

const statusLabels: Record<string, string> = {
  draft: '草稿',
  requirement: '需求',
  outline: '大纲',
  slides: '幻灯片',
  export: '导出中',
  completed: '已完成',
  archived: '已归档',
}

const stepLabels: Record<string, string> = {
  requirement: '需求录入',
  outline: '大纲审核',
  slides: '内容编辑',
  export: '导出报告',
}

function ProjectsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const showNewDialog = searchParams.get('new') === 'true'

  const [projects, setProjects] = useState<Project[]>([])
  const [stats, setStats] = useState<{
    total: number
    by_status: Record<string, number>
    recent: Project[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<string>('all')

  // New project dialog state
  const [dialogOpen, setDialogOpen] = useState(showNewDialog)
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    client_name: '',
    client_industry: '',
  })
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Draft recovery dialog
  const [draftDialogOpen, setDraftDialogOpen] = useState(false)
  const [draftProject, setDraftProject] = useState<Project | null>(null)

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setLoading(true)

      // Check for draft projects first
      const draft = await hasDraftProjects()
      if (draft) {
        setDraftProject(draft as unknown as Project)
        setDraftDialogOpen(true)
      }

      // Load projects and stats in parallel
      const [projectsResult, statsResult] = await Promise.all([
        getProjects({ limit: 50 }),
        getProjectStats(),
      ])

      setProjects(projectsResult.projects as unknown as Project[])
      setStats(statsResult)
    } catch (err) {
      console.error('Failed to load projects:', err)
      setError('无法加载项目列表')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Create new project
  const handleCreateProject = async () => {
    if (!newProject.name.trim()) {
      setError('请输入项目名称')
      return
    }

    try {
      setCreating(true)
      setError(null)
      const project = await createProject(newProject)

      setDialogOpen(false)
      setNewProject({
        name: '',
        description: '',
        client_name: '',
        client_industry: '',
      })

      // Navigate to requirement page with project ID
      router.push(`/report?project=${project.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
      setError('无法创建项目')
    } finally {
      setCreating(false)
    }
  }

  // Delete project
  const handleDeleteProject = async () => {
    if (!deleteTarget) return

    try {
      await deleteProject(deleteTarget.id)
      setProjects(projects.filter((p) => p.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch (err) {
      console.error('Failed to delete project:', err)
      setError('删除失败')
    }
  }

  // Resume draft project
  const handleResumeDraft = () => {
    if (draftProject) {
      router.push(`/report?project=${draftProject.id}`)
    }
    setDraftDialogOpen(false)
  }

  // Get next step for project
  const getNextStep = (project: Project): string => {
    switch (project.current_step) {
      case 'requirement':
        return `/report?project=${project.id}`
      case 'outline':
        return `/report/workspace?project=${project.id}&step=outline`
      case 'slides':
        return `/report/workspace?project=${project.id}&step=slides`
      case 'export':
        return `/report/workspace?project=${project.id}&step=export`
      default:
        return `/report?project=${project.id}`
    }
  }

  // Format relative time
  const formatRelativeTime = (dateStr: string): string => {
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

  // Filter projects
  const filteredProjects =
    filter === 'all' ? projects : projects.filter((p) => p.status === filter)

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">项目管理</h1>
          <p className="text-gray-500 mt-1">
            管理您的报告项目，所有输入自动保存
          </p>
        </div>

        <button
          onClick={() => setDialogOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建项目
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">总项目数</div>
            <div className="text-3xl font-bold">{stats.total}</div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">进行中</div>
            <div className="text-3xl font-bold text-blue-500">
              {(stats.by_status['draft'] || 0) +
                (stats.by_status['requirement'] || 0) +
                (stats.by_status['outline'] || 0) +
                (stats.by_status['slides'] || 0)}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">已完成</div>
            <div className="text-3xl font-bold text-green-500">
              {stats.by_status['completed'] || 0}
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-gray-200">
            <div className="text-sm text-gray-500 mb-1">草稿</div>
            <div className="text-3xl font-bold text-gray-500">
              {stats.by_status['draft'] || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">全部项目</option>
          <option value="draft">草稿</option>
          <option value="requirement">需求</option>
          <option value="outline">大纲</option>
          <option value="slides">幻灯片</option>
          <option value="completed">已完成</option>
        </select>
      </div>

      {/* Projects List */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      ) : filteredProjects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center">
          <svg
            className="w-16 h-16 mx-auto text-gray-400 mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-lg font-medium mb-2">暂无项目</p>
          <p className="text-gray-500 mb-4">
            点击"新建项目"开始创建您的第一份报告
          </p>
          <button
            onClick={() => setDialogOpen(true)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            新建项目
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              className="bg-white p-6 rounded-xl border border-gray-200 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{project.name}</h3>
                    <span className={`px-2 py-1 text-xs text-white rounded ${statusColors[project.status]}`}>
                      {statusLabels[project.status]}
                    </span>
                  </div>

                  {project.client_name && (
                    <p className="text-gray-500 mb-1">
                      客户：{project.client_name}
                      {project.client_industry && ` · ${project.client_industry}`}
                    </p>
                  )}

                  {project.description && (
                    <p className="text-gray-500 text-sm mb-2 line-clamp-2">
                      {project.description}
                    </p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-400">
                    <span>当前步骤：{stepLabels[project.current_step]}</span>
                    <span>更新于 {formatRelativeTime(project.updated_at)}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Link href={getNextStep(project)}>
                    <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                      {project.status === 'completed' ? '查看' : '继续'}
                    </button>
                  </Link>

                  <button
                    onClick={() => setDeleteTarget(project)}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* New Project Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-2">创建新项目</h2>
            <p className="text-gray-500 mb-6">
              创建项目后，所有输入将自动保存到数据库
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  项目名称 <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="例如：XX公司组织诊断报告"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">客户名称</label>
                <input
                  type="text"
                  placeholder="客户公司名称"
                  value={newProject.client_name}
                  onChange={(e) => setNewProject({ ...newProject, client_name: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">行业</label>
                <input
                  type="text"
                  placeholder="例如：制造业、金融、互联网..."
                  value={newProject.client_industry}
                  onChange={(e) => setNewProject({ ...newProject, client_industry: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">项目描述</label>
                <textarea
                  placeholder="项目背景、目标等（可选）"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                disabled={creating}
              >
                取消
              </button>
              <button
                onClick={handleCreateProject}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? '创建中...' : '创建项目'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Draft Recovery Dialog */}
      {draftDialogOpen && draftProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-2">发现未完成的项目</h2>
            <p className="text-gray-500 mb-4">
              您有一个正在进行中的项目，是否继续编辑？
            </p>

            <div className="p-4 bg-gray-50 rounded-lg mb-6">
              <p className="font-medium">{draftProject.name}</p>
              <p className="text-sm text-gray-500 mt-1">
                当前步骤：{stepLabels[draftProject.current_step]}
              </p>
              <p className="text-sm text-gray-500">
                更新于 {formatRelativeTime(draftProject.updated_at)}
              </p>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDraftDialogOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                查看其他项目
              </button>
              <button
                onClick={handleResumeDraft}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                继续编辑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl">
            <h2 className="text-xl font-bold mb-2">确认删除</h2>
            <p className="text-gray-600 mb-6">
              确定要删除项目「{deleteTarget.name}」吗？此操作无法撤销，
              所有相关的需求、大纲、幻灯片数据都将被删除。
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                onClick={handleDeleteProject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ProjectsLoading() {
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto" />
          <p className="mt-4 text-gray-500">加载中...</p>
        </div>
      </div>
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<ProjectsLoading />}>
      <ProjectsContent />
    </Suspense>
  )
}
