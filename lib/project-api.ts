/**
 * Project Management API Client
 *
 * Handles all project-related operations with auto-save functionality
 */

import { supabase } from './db/supabase'

// ============================================================
// Supabase Client Wrapper (bypasses strict typing for new tables)
// ============================================================

// Use any to bypass strict typing since tables don't exist in schema yet
// This will be removed once tables are added to types/database.ts
const db = supabase as any

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
  try {
    const { data: { user }, error } = await db.auth.getUser()

    if (error) {
      console.warn('Auth error, falling back to anonymous user:', error.message)
      return getOrCreateAnonymousUserId()
    }

    if (user) {
      return user.id
    }

    // No authenticated user, use anonymous ID
    return getOrCreateAnonymousUserId()
  } catch (error) {
    console.warn('Failed to get user, falling back to anonymous:', error)
    return getOrCreateAnonymousUserId()
  }
}

/**
 * Check if current user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const { data: { user } } = await db.auth.getUser()
    return !!user
  } catch {
    return false
  }
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

// API base URL for backend endpoints
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

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
  const userId = await getUserId()
  console.log('[ProjectAPI] Creating project for user:', userId, 'input:', input)

  const insertData = {
    name: input.name,
    description: input.description,
    client_name: input.client_name,
    client_industry: input.client_industry,
    client_id: input.client_id,
    created_by: userId,
    status: 'draft',
    current_step: 'requirement',
  }
  console.log('[ProjectAPI] Insert data:', JSON.stringify(insertData, null, 2))

  try {
    const { data, error } = await db
      .from('projects')
      .insert(insertData)
      .select()
      .single()

    console.log('[ProjectAPI] Insert response:', { data, error })

    if (error) {
      console.error('[ProjectAPI] Create project error:', JSON.stringify(error, null, 2))
      console.error('[ProjectAPI] Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      throw new Error(error.message || 'Failed to create project')
    }

    console.log('[ProjectAPI] Project created:', data.id)

    // Create initial requirement record
    const { error: reqError } = await db
      .from('project_requirements')
      .insert({
        project_id: data.id,
        form_step: 1,
        form_completed: false,
      })

    if (reqError) {
      console.error('[ProjectAPI] Failed to create requirement record:', reqError)
      // Don't throw - project is created, requirement can be created later
    }

    return data
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
  const userId = await getUserId()
  console.log('[ProjectAPI] Getting projects for user:', userId)

  try {
    let query = db
      .from('projects')
      .select('*', { count: 'exact' })
      .order('updated_at', { ascending: false })

    // Filter by user ID OR null (for testing/dev mode)
    // In production, you may want to remove the null check
    query = query.or(`created_by.eq.${userId},created_by.is.null`)

    if (options?.status) {
      query = query.eq('status', options.status)
    }

    if (options?.limit) {
      query = query.limit(options.limit)
    }

    if (options?.offset) {
      query = query.range(options.offset, options.offset + (options.limit || 10) - 1)
    }

    const { data, error, count } = await query

    if (error) {
      console.error('[ProjectAPI] Query error:', error)
      // If table doesn't exist, return empty array
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Projects table does not exist. Please run database migration.')
        return { projects: [], total: 0 }
      }
      throw error
    }

    console.log('[ProjectAPI] Found projects:', data?.length || 0)
    return { projects: data || [], total: count || 0 }
  } catch (error) {
    console.error('[ProjectAPI] Failed to load projects:', error)
    // Return empty array instead of throwing
    return { projects: [], total: 0 }
  }
}

/**
 * Get a single project with all related data
 * Optimized: parallel queries for faster loading
 */
export async function getProject(projectId: string): Promise<ProjectWithDetails | null> {
  const userId = await getUserId()

  // Get project first
  const { data: project, error: projectError } = await db
    .from('projects')
    .select('*')
    .eq('id', projectId)
    .single()

  if (projectError) {
    if (projectError.code === 'PGRST116') return null
    throw projectError
  }

  // Fetch all related data in parallel for better performance
  const [
    requirementResult,
    outlineResult,
    slidesResult,
    exportsResult
  ] = await Promise.all([
    db.from('project_requirements').select('*').eq('project_id', projectId).single(),
    db.from('project_outlines').select('*').eq('project_id', projectId).order('version', { ascending: false }).limit(1).single(),
    db.from('project_slides').select('*').eq('project_id', projectId).order('slide_index', { ascending: true }),
    db.from('project_exports').select('*').eq('project_id', projectId).order('created_at', { ascending: false })
  ])

  return {
    ...project,
    requirement: requirementResult.data || undefined,
    outline: outlineResult.data || undefined,
    slides: slidesResult.data || undefined,
    exports: exportsResult.data || undefined,
  }
}

/**
 * Update project metadata
 */
export async function updateProject(
  projectId: string,
  updates: ProjectUpdate
): Promise<Project> {
  const { data, error } = await db
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Delete a project (cascades to all related data)
 */
export async function deleteProject(projectId: string): Promise<void> {
  const { error } = await db
    .from('projects')
    .delete()
    .eq('id', projectId)

  if (error) throw error
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
  const now = new Date().toISOString()

  // Find the last changed field for debugging
  const lastSavedField = Object.keys(data).pop()

  // Use upsert to handle both create and update
  const { data: result, error } = await db
    .from('project_requirements')
    .upsert({
      project_id: projectId,
      ...data,
      form_step: formStep,
      last_saved_at: now,
      last_saved_field: lastSavedField || null,
      form_completed: formStep >= 4,
    }, {
      onConflict: 'project_id'
    })
    .select()
    .single()

  if (error) {
    console.error('[ProjectAPI] saveRequirement error:', JSON.stringify(error, null, 2))
    throw new Error(error.message || 'Failed to save requirement')
  }

  // Update project status if needed
  if (formStep >= 4) {
    await db
      .from('projects')
      .update({ status: 'requirement', current_step: 'outline' })
      .eq('id', projectId)
  }

  return result
}

/**
 * Get requirement data for a project
 */
export async function getRequirement(projectId: string): Promise<ProjectRequirement | null> {
  const { data, error } = await db
    .from('project_requirements')
    .select('*')
    .eq('project_id', projectId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data
}

// ============================================================
// Outline Operations
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

/**
 * Save outline (creates new version)
 */
export async function saveOutline(
  projectId: string,
  sections: OutlineSection[],
  metadata?: {
    generation_model?: string
    generation_tokens?: number
    rag_sources?: Array<{ id: string; title: string; score: number }>
  }
): Promise<ProjectOutline> {
  // Get current version
  const { data: existing } = await db
    .from('project_outlines')
    .select('version')
    .eq('project_id', projectId)
    .order('version', { ascending: false })
    .limit(1)
    .single()

  const nextVersion = (existing?.version || 0) + 1

  const { data, error } = await db
    .from('project_outlines')
    .insert({
      project_id: projectId,
      sections: sections as any,
      version: nextVersion,
      generation_model: metadata?.generation_model,
      generation_tokens: metadata?.generation_tokens,
      rag_sources: metadata?.rag_sources as any,
    })
    .select()
    .single()

  if (error) throw error

  // Update project status
  await db
    .from('projects')
    .update({ status: 'outline', current_step: 'outline' })
    .eq('id', projectId)

  return data
}

/**
 * Confirm outline (user approves)
 */
export async function confirmOutline(
  projectId: string,
  outlineId: string
): Promise<ProjectOutline> {
  const userId = await getUserId()

  const { data, error } = await db
    .from('project_outlines')
    .update({
      is_confirmed: true,
      confirmed_at: new Date().toISOString(),
      confirmed_by: userId,
    })
    .eq('id', outlineId)
    .select()
    .single()

  if (error) throw error

  // Update project to move to slides step
  await db
    .from('projects')
    .update({ current_step: 'slides' })
    .eq('id', projectId)

  return data
}

/**
 * Get outline (latest version or specific)
 */
export async function getOutline(
  projectId: string,
  version?: number
): Promise<ProjectOutline | null> {
  let query = db
    .from('project_outlines')
    .select('*')
    .eq('project_id', projectId)

  if (version) {
    query = query.eq('version', version)
  } else {
    query = query.order('version', { ascending: false }).limit(1)
  }

  const { data, error } = await query.single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return data
}

// ============================================================
// Slides Operations
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

/**
 * Save or update a single slide
 */
export async function saveSlide(
  projectId: string,
  slide: SlideData
): Promise<ProjectSlide> {
  const { data, error } = await db
    .from('project_slides')
    .upsert({
      project_id: projectId,
      ...slide,
      status: 'edited',
    }, {
      onConflict: 'project_id,slide_index',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Batch save slides (from AI generation)
 */
export async function saveSlides(
  projectId: string,
  slides: SlideData[]
): Promise<ProjectSlide[]> {
  const { data, error } = await db
    .from('project_slides')
    .upsert(
      slides.map(s => ({
        project_id: projectId,
        ...s,
        status: 'generated',
      })),
      { onConflict: 'project_id,slide_index' }
    )
    .select()

  if (error) throw error

  // Update project status
  await db
    .from('projects')
    .update({ status: 'slides', current_step: 'slides' })
    .eq('id', projectId)

  return data
}

/**
 * Get all slides for a project
 */
export async function getSlides(projectId: string): Promise<ProjectSlide[]> {
  const { data, error } = await db
    .from('project_slides')
    .select('*')
    .eq('project_id', projectId)
    .order('slide_index', { ascending: true })

  if (error) throw error
  return data || []
}

/**
 * Confirm slides (user approves for export)
 */
export async function confirmSlides(projectId: string): Promise<void> {
  const userId = await getUserId()

  // Update all slides to approved
  await db
    .from('project_slides')
    .update({ status: 'approved' })
    .eq('project_id', projectId)

  // Update project to move to export step
  await db
    .from('projects')
    .update({ current_step: 'export' })
    .eq('id', projectId)
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

/**
 * Get export status
 */
export async function getExportStatus(exportId: string): Promise<ProjectExport> {
  const { data, error } = await db
    .from('project_exports')
    .select('*')
    .eq('id', exportId)
    .single()

  if (error) throw error
  return data
}

/**
 * Get download URL for completed export
 */
export async function getDownloadUrl(exportId: string): Promise<string | null> {
  const export_ = await getExportStatus(exportId)

  if (export_.status !== 'completed') {
    return null
  }

  return export_.download_url || null
}

// ============================================================
// Utility Functions
// ============================================================

/**
 * Check if user has any draft projects to recover
 */
export async function hasDraftProjects(): Promise<Project | null> {
  const userId = await getUserId()

  try {
    const { data, error } = await db
      .from('projects')
      .select('*')
      .eq('created_by', userId)
      .in('status', ['draft', 'requirement', 'outline', 'slides'])
      .order('updated_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      // No draft found or table doesn't exist
      if (error.code === 'PGRST116' || error.code === '42P01') {
        return null
      }
      console.error('Error checking for draft projects:', JSON.stringify(error, null, 2))
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      return null
    }

    return data
  } catch (error) {
    console.error('Failed to check for draft projects:', error)
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
  const userId = await getUserId()

  try {
    const { data: projects, error } = await db
      .from('projects')
      .select('status')
      .eq('created_by', userId)

    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        console.warn('Projects table does not exist. Please run database migration.')
        return { total: 0, by_status: {}, recent: [] }
      }
      throw error
    }

    const by_status: Record<string, number> = {}
    projects?.forEach((p: { status: string }) => {
      by_status[p.status] = (by_status[p.status] || 0) + 1
    })

    const { data: recent } = await db
      .from('projects')
      .select('*')
      .eq('created_by', userId)
      .order('updated_at', { ascending: false })
      .limit(5)

    return {
      total: projects?.length || 0,
      by_status,
      recent: recent || [],
    }
  } catch (error) {
    console.error('Failed to get project stats:', error)
    return { total: 0, by_status: {}, recent: [] }
  }
}
