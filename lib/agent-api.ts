/**
 * Agent API Client
 *
 * Communicates with the consulting Agent backend endpoints.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ============================================================
// Types
// ============================================================

export interface UIComponent {
  type: 'input' | 'textarea' | 'select' | 'single_choice' | 'multi_choice' | 'rating' | 'number' | 'file'
  key: string
  label: string
  placeholder?: string
  required: boolean
  options?: string[]
  ui_style?: 'cards' | 'chips' | 'slider'
  allow_custom?: boolean
  min?: number
  max?: number
  accept?: string[]
}

export interface InteractionResponse {
  message: string
  ui_components: UIComponent[]
  context: {
    current_node: string
    progress: number
    benchmark_title: string
    interaction_count: number
    mode: string
  }
}

export interface ChatMessage {
  role: 'assistant' | 'user' | 'system'
  content: string
  metadata?: {
    ui_components?: UIComponent[]
    context?: InteractionResponse['context']
    kernel_objects_created?: string[]
    distilled_spec?: Record<string, unknown>
    pptx_download_url?: string
  }
}

export interface AgentSession {
  _key: string
  _id: string
  properties: {
    project_goal: string
    benchmark_id: string
    project_id?: string
    status: string
    progress: number
    interaction_count: number
    pptx_path?: string
  }
  created_at?: string
}

export interface CreateSessionResult {
  session: AgentSession
  interaction: InteractionResponse
  mode: string
  progress: number
}

export interface ResumeResult {
  mode: string
  progress: number
  interaction_count: number
  interaction?: InteractionResponse
  distilled_spec?: Record<string, unknown>
  kernel_objects_created?: string[]
  error?: string
}

// ============================================================
// API Functions
// ============================================================

/**
 * Create and start an Agent session
 */
export async function createSession(
  projectGoal: string,
  benchmarkId: string,
  projectId?: string,
): Promise<CreateSessionResult> {
  const response = await fetch(`${API_BASE}/api/v1/agent/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_goal: projectGoal,
      benchmark_id: benchmarkId,
      ...(projectId ? { project_id: projectId } : {}),
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Failed to create session: ${response.status}`)
  }

  return response.json()
}

/**
 * Get current session state + interaction UI
 */
export async function getSession(sessionId: string): Promise<{
  session: AgentSession
  mode?: string
  progress?: number
  interaction?: InteractionResponse
}> {
  const response = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}`)

  if (!response.ok) {
    throw new Error(`Failed to get session: ${response.status}`)
  }

  return response.json()
}

/**
 * Submit user data and resume the workflow
 */
export async function resumeSession(
  sessionId: string,
  data: Record<string, unknown>,
): Promise<ResumeResult> {
  const response = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}/resume`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Failed to resume session: ${response.status}`)
  }

  return response.json()
}

/**
 * Get conversation history
 */
export async function getMessages(sessionId: string): Promise<{
  messages: ChatMessage[]
  count: number
}> {
  const response = await fetch(`${API_BASE}/api/v1/agent/sessions/${sessionId}/messages`)

  if (!response.ok) {
    throw new Error(`Failed to get messages: ${response.status}`)
  }

  return response.json()
}

/**
 * List available benchmarks
 */
export async function getBenchmarks(params?: {
  consulting_type?: string
  industry?: string
}): Promise<Array<{
  _key: string
  properties: {
    title: string
    industry: string
    consulting_type: string
    description?: string
    node_order: string[]
  }
}>> {
  const searchParams = new URLSearchParams()
  if (params?.consulting_type) searchParams.set('consulting_type', params.consulting_type)
  if (params?.industry) searchParams.set('industry', params.industry)

  const query = searchParams.toString()
  const url = `${API_BASE}/api/v1/agent/blueprint/benchmarks${query ? `?${query}` : ''}`

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to get benchmarks: ${response.status}`)
  }

  return response.json()
}

/**
 * Create Agent session from existing project data (W1/W2 pre-fill)
 */
export async function createSessionFromProject(
  projectId: string,
  benchmarkId: string,
  projectGoal: string,
  mode: 'proposal' | 'consulting_report' = 'consulting_report',
): Promise<{
  session: AgentSession
  interaction: InteractionResponse
  mode: string
  progress: number
  seeded_nodes: string[]
}> {
  const response = await fetch(`${API_BASE}/api/v1/agent/sessions/from-project`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: projectId,
      benchmark_id: benchmarkId,
      project_goal: projectGoal,
      mode,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Unknown error' }))
    throw new Error(error.detail || `Failed to create session from project: ${response.status}`)
  }

  return response.json()
}
