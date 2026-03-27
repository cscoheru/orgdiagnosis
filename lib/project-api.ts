/**
 * Project Management API Client
 *
 * Handles all project-related operations with auto-save functionality
 * Uses backend API instead of direct Supabase connection for better reliability
 */

// API base URL for backend endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ============================================================
// User ID Helper (authenticated or anonymous fallback)
// ============================================================

const ANONYMOUS_USER_KEY = 'org_diagnosis_anonymous_user_id'

function getOrCreateAnonymousUserId(): string {
  if (typeof window === 'undefined') {
    return 'server-anonymous-user'
  }

  let anonymousId = localStorage.getItem(ANONYMOUS_USER_KEY)
  if (!anonymousId) {
    anonymousId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    localStorage.setItem(ANONYMOUS_USER_KEY, anonymousId)
  }
  return anonymousId
}

/**
 * Get user ID - returns authenticated user ID or falls back to anonymous ID
 */
async function getUserId(): Promise<string> {
  // For now, use anonymous user ID
  // TODO: Integrate with actual auth when ready
  return getOrCreateAnonymousUserId()
}

/**
 * Check if current user is authenticated
 * For now, always returns false as we use anonymous users
 */
export async function isAuthenticated(): Promise<boolean> {
  // TODO: Integrate with actual auth when ready
  return false
}

// ============================================================
// Type Definitions
// ============================================================

export type ProjectStatus = 'draft' | 'requirement' | 'outline' | 'slides' | 'export' | 'completed' | 'archived'
export type ProjectStep = 'requirement' | 'outline' | 'slides' | 'export'
export type SlideStatus = 'draft' | 'generated' | 'edited' | 'approved'
export type ExportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface Project {
  id: string
  name: string
  description?: string | null
  client_name?: string | null
  client_industry?: string | null
  status: ProjectStatus
  current_step: ProjectStep
  langgraph_thread_id?: string | null
  langgraph_checkpoint?: string | null
  created_by?: string | null
  client_id?: string | null
  created_at: string
  updated_at: string
}

export type ProjectUpdate = Partial<Omit<Project, 'id' | 'created_at' | 'updated_at'>>

export interface ProjectRequirement {
  id: string
  project_id: string
  form_step: number
  form_completed: boolean
  client_name?: string | null
  industry?: string | null
  company_stage?: string | null
  employee_count?: number | null
  diagnosis_session_id?: string | null
  pain_points?: string[]
  goals?: string[]
  timeline?: string | null
  report_type?: string
  slide_count?: number
  focus_areas?: string[]
  reference_materials?: string[]
  tone?: string
  language?: string
  template_style?: string
  special_requirements?: string | null
  last_saved_at?: string | null
  last_saved_field?: string | null
  created_at: string
  updated_at: string
}

export interface ProjectOutline {
  id: string
  project_id: string
  sections: any[]
  version: number
  is_confirmed: boolean
  confirmed_at?: string | null
  confirmed_by?: string | null
  generation_model?: string | null
  generation_tokens?: number | null
  rag_sources?: any[]
  created_at: string
  updated_at: string
}

export interface ProjectSlide {
  id: string
  project_id: string
  slide_index: number
  section_id?: string | null
  title: string
  subtitle?: string | null
  key_message?: string | null
  content: Record<string, any>
  layout_type: string
  model_id?: string | null
  model_params: Record<string, any>
  status: SlideStatus
  created_at: string
  updated_at: string
}

export interface ProjectExport {
  id: string
  project_id: string
  format: string
  file_path?: string | null
  file_size_kb?: number | null
  download_url?: string | null
  slide_count?: number | null
  generation_time_ms?: number | null
  status: ExportStatus
  error_message?: string | null
  created_at: string
  completed_at?: string | null
  created_by?: string | null
}

export interface ProjectWithDetails extends Project {
  requirement?: ProjectRequirement
  outline?: ProjectOutline
  slides?: ProjectSlide[]
  exports?: ProjectExport[]
}

// ============================================================
// Project CRUD Operations
// ============================================================

export interface CreateProjectInput {
  name: string
  description?: string
  client_name?: string
  client_industry?: string
  client_id?: string
}

/**
 * Create a new project
 */
export async function createProject(input: CreateProjectInput): Promise<Project> {
  console.log('[ProjectAPI] Creating project:', input)

  try {
    const response = await fetch(`${API_BASE}/api/projects/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
      console.error('[ProjectAPI] Create project error:', error)
      throw new Error(error.detail || `Failed to create project: ${response.status}`)
    }

    const result = await response.json()
    console.log('[ProjectAPI] Project created:', result.project?.id)

    return result.project
  } catch (error) {
    console.error('[ProjectAPI] Failed to create project:', error)
    throw error
  }
}

/**
 * Get all projects for current user
 */
export async function getProjects(options?: {
  status?: Project['status']
  limit?: number
  offset?: number
}): Promise<{ projects: Project[]; total: number }> {
  console.log('[ProjectAPI] Getting projects')

  try {
    const params = new URLSearchParams()
    if (options?.status) params.append('status', options.status)
    if (options?.limit) params.append('limit', options.limit.toString())
    if (options?.offset) params.append('offset', options.offset.toString())

    const response = await fetch(`${API_BASE}/api/projects/?${params.toString()}`)

    if (!response.ok) {
      console.error('[ProjectAPI] Failed to fetch projects:', response.status)
      return { projects: [], total: 0 }
    }

    const result = await response.json()
    console.log('[ProjectAPI] Found projects:', result.projects?.length || 0)

    return {
      projects: result.projects || [],
      total: result.total || 0
    }
  } catch (error) {
    console.error('[ProjectAPI] Failed to load projects:', error)
    return { projects: [], total: 0 }
  }
}

/**
 * Get a single project with all related data
 */
export async function getProject(projectId: string): Promise<ProjectWithDetails | null> {
  try {
    const response = await fetch(`${API_BASE}/api/projects/${projectId}`)

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch project: ${response.status}`)
    }

    const result = await response.json()
    return result.project
  } catch (error) {
    console.error('[ProjectAPI] Failed to get project:', error)
    return null
  }
}

/**
 * Update project metadata
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdate
): Promise<Project> {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Failed to update project: ${response.status}`)
  }

  const result = await response.json()
  return result.project
}

/**
 * Delete a project (cascades to all related data)
 */
export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/projects/${projectId}`, {
    method: 'DELETE',
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Failed to delete project: ${response.status}`)
  }
}

// ============================================================
// Requirement Auto-Save Operations
// ============================================================

export interface RequirementFormData {
  // Step 1
  client_name?: string
  industry?: string
  company_stage?: string
  employee_count?: number
  // Step 2
  diagnosis_session_id?: string
  pain_points?: string[]
  goals?: string[]
  timeline?: string
  // Step 3
  report_type?: string
  slide_count?: number
  focus_areas?: string[]
  reference_materials?: string[]
  // Step 4
  tone?: string
  language?: string
  template_style?: string
  special_requirements?: string
}

/**
 * Auto-save requirement form data
 * Uses debouncing in the calling component
 */
export async function saveRequirement(
  projectId: string,
  data: RequirementFormData,
  formStep: number
): Promise<ProjectRequirement> {
  const response = await fetch(`${API_BASE}/api/projects/requirements/save`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      project_id: projectId,
      form_step: formStep,
      ...data,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    let errorMessage = `HTTP ${response.status}`
    try {
      const errorJson = JSON.parse(errorText)
      // FastAPI validation errors have 'detail' field
      if (errorJson.detail) {
        if (typeof errorJson.detail === 'string') {
          errorMessage = errorJson.detail
        } else if (Array.isArray(errorJson.detail)) {
          // FastAPI validation error format
          errorMessage = errorJson.detail.map((e: { msg?: string; loc?: string[] }) =>
            `${e.loc?.join('.')}: ${e.msg}`
          ).join(', ')
        }
      }
    } catch {
      errorMessage = errorText || errorMessage
    }
    throw new Error(errorMessage)
  }

  const result = await response.json()
  return result.requirement
}

/**
 * Get requirement data for a project
 */
export async function getRequirement(projectId: string): Promise<ProjectRequirement | null> {
  try {
    const response = await fetch(`${API_BASE}/api/projects/requirements/${projectId}`)

    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error(`Failed to fetch requirement: ${response.status}`)
    }

    const result = await response.json()
    return result.requirement
  } catch (error) {
    console.error('[ProjectAPI] Failed to get requirement:', error)
    return null
  }
}

// ============================================================
// Outline Operations (Types only - operations via backend API)
// ============================================================

export interface OutlineSection {
  id: string
  title: string
  key_message?: string
  subsections?: OutlineSection[]
  key_points?: string[]
  slides?: {
    index: number
    title: string
    layout_type: string
  }[]
}

// ============================================================
// Slides Operations (Types only - operations via backend API)
// ============================================================

export interface SlideData {
  slide_index: number
  section_id?: string
  title: string
  subtitle?: string
  key_message?: string
  content?: Record<string, any>
  layout_type?: string
  model_id?: string
  model_params?: Record<string, any>
}

// ============================================================
// Export Operations
// ============================================================

/**
 * Trigger PPTX export via backend API
 */
export async function triggerExport(
  projectId: string
): Promise<{ export_id: string; status: string }> {
  const response = await fetch(`${API_BASE}/api/report/export/${projectId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`)
  }

  return response.json()
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if user has any draft projects to recover
 */
export async function hasDraftProjects(): Promise<Project | null> {
  try {
    const response = await fetch(`${API_BASE}/api/projects/draft/check`)

    if (!response.ok) {
      console.error('[ProjectAPI] Failed to check draft projects:', response.status)
      return null
    }

    const result = await response.json()
    return result.draft || null
  } catch (error) {
    console.error('[ProjectAPI] Failed to check for draft projects:', error)
    return null
  }
}

/**
 * Get project statistics for dashboard
 */
export async function getProjectStats(): Promise<{
  total: number
  by_status: Record<string, number>
  recent: Project[]
}> {
  try {
    const response = await fetch(`${API_BASE}/api/projects/stats/summary`)

    if (!response.ok) {
      console.error('[ProjectAPI] Failed to get project stats:', response.status)
      return { total: 0, by_status: {}, recent: [] }
    }

    const result = await response.json()
    return {
      total: result.total || 0,
      by_status: result.by_status || {},
      recent: result.recent || [],
    }
  } catch (error) {
    console.error('[ProjectAPI] Failed to get project stats:', error)
    return { total: 0, by_status: {}, recent: [] }
  }
}
