/**
 * Workflow API Client
 *
 * 与后端 /api/v2/workflow/* 端点交互的 TypeScript 客户端。
 */

import { API_BASE_URL } from '@/lib/api-config';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface WorkflowStepConfig {
  id: string;
  name: string;
  type: string;
  is_manual: boolean;
  depends_on: string | null;
}

export interface WorkflowConfig {
  key: string;
  name: string;
  description: string;
  steps: WorkflowStepConfig[];
  initial_step: string;
}

export interface WorkflowState {
  session_id: string;
  project_id: string;
  workflow_type: string;
  workflow_name: string;
  status: string;
  current_step_id: string;
  steps: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    is_manual: boolean;
    data?: Record<string, unknown>;
  }>;
  all_step_data?: Record<string, Record<string, unknown>>;
}

/** @deprecated Use EnhancedSmartExtractData from lib/workflow/w1-types.ts */
export interface SmartExtractResult {
  client_name?: string;
  industry?: string;
  company_scale?: string;
  company_info?: string;
  industry_background?: string;
  core_pain_points?: Array<{ description: string; severity: string }>;
  pain_points?: string[];
  expected_goals?: string[];
  success_criteria?: string[];
  other_requirements?: string;
}

export interface MilestonePlanResult {
  project_goal: string;
  phases: Array<{
    phase_name: string;
    phase_order: number;
    duration_weeks?: number;
    time_range?: string;
    description?: string;
    goals?: string;
    key_activities?: string[];
    deliverables?: string[];
  }>;
  success_criteria?: string[];
  main_tasks?: string[];
  total_duration_weeks?: number;
}

export interface MDSContentResult {
  title: string;
  project_goal: string;
  key_message: string;
  phases_summary: Array<{
    phase_name: string;
    duration_weeks: number;
    key_deliverable: string;
  }>;
  total_duration_weeks: number;
  expected_outcomes: string[];
}

export interface ImplOutlineResult {
  sections: Array<{
    id: string;
    section_name: string;
    slides: Array<{
      slide_index: number;
      title: string;
      storyline: string;
      arguments: string[];
      evidence: string[];
      supporting_materials: string[];
    }>;
  }>;
}

// ──────────────────────────────────────────────
// W2: Diagnosis workflow types
// ──────────────────────────────────────────────

export interface QuestionnaireItem {
  id: string;
  dimension: string;
  category: string;
  question: string;
  answer?: string;
  is_ai_suggested?: boolean;
}

export interface QuestionnaireData {
  items: QuestionnaireItem[];
  raw_text?: string;
}

export interface DiagnosisAnalysisResult {
  five_dimensions: Record<string, unknown>; // FiveDimensionsData from backend
  overall_score: number;
  summary: string;
  recommendations?: string[];
}

// ──────────────────────────────────────────────
// W3: Delivery workflow types
// ──────────────────────────────────────────────

export interface PhaseData {
  phase_id: string;
  phase_name: string;
  phase_order: number;
  time_range?: string;
  goals?: string;
  key_activities?: string[];
  deliverables?: string[];
  assignee_ids?: string[];
  notes?: string;
  status: 'planned' | 'in_progress' | 'completed';
  tasks?: TaskData[];
}

export interface TaskData {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  result_summary?: string;
  file_paths?: string[];
  created_at?: string;
}

export interface PhaseReportData {
  phase_id: string;
  phase_name: string;
  storyline: string;
  arguments: string[];
  evidence: string[];
  supporting_materials: string[];
  deliverables?: string[];
}

// ──────────────────────────────────────────────
// W3 Task / Deliverable / Meeting Note types
// ──────────────────────────────────────────────

export interface TaskItem {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'high' | 'medium' | 'low';
  assignee?: string;
  due_date?: string;
  phase_id?: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DeliverableItem {
  id: string;
  title: string;
  type: string;           // e.g. 'report', 'slides', 'dataset', 'code', 'other'
  source_module?: string;  // which phase/module produced it
  phase_id?: string;
  file_url?: string;
  description?: string;
  created_at?: string;
}

export interface MeetingNote {
  id: string;
  title: string;
  date: string;
  phase_id?: string;
  participants?: string[];
  summary?: string;
  decisions: string[];
  action_items: Array<{ content: string; assignee?: string; due_date?: string }>;
  created_at?: string;
}

// ──────────────────────────────────────────────
// API helpers
// ──────────────────────────────────────────────

async function apiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/v2/workflow${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { success: false, error: err.detail || `HTTP ${res.status}` };
    }
    const body = await res.json();
    // Unwrap the standard { success, data, error } envelope.
    // When body has { success, data } keys, extract body.data (even if null).
    // Otherwise return body as-is (flat response).
    const hasEnvelope = body.success !== undefined && 'data' in body;
    const innerData = hasEnvelope ? body.data : body;
    return {
      success: hasEnvelope ? body.success : true,
      data: innerData as T,
      error: body.error || body.detail,
    };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '网络错误' };
  }
}

// ──────────────────────────────────────────────
// Workflow API
// ──────────────────────────────────────────────

/** Start a workflow session */
export async function startWorkflow(
  projectId: string,
  workflowType: string,
  inputData?: Record<string, unknown>,
  sessionId?: string,
) {
  return apiRequest<{
    session_id: string;
    workflow_type: string;
    current_step_id: string;
    status: string;
    steps: Array<{ id: string; name: string; type: string; status: string; is_manual: boolean }>;
    all_step_data?: Record<string, unknown>;
  }>('/start', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      workflow_type: workflowType,
      input_data: inputData,
      session_id: sessionId,
    }),
  });
}

/** Get current step info */
export async function getWorkflowStep(sessionId: string) {
  return apiRequest<{
    session_id: string;
    current_step: { id: string; name: string; type: string; is_manual: boolean };
    step_data: Record<string, unknown>;
    status: string;
  }>(`/${sessionId}`);
}

/** Advance to next step */
export async function advanceWorkflowStep(
  sessionId: string,
  stepData?: Record<string, unknown>,
) {
  return apiRequest<{
    session_id: string;
    current_step?: { id: string; name: string; type: string; is_manual: boolean };
    status: string;
    auto_result?: Record<string, unknown>;
  }>(`/${sessionId}/advance`, {
    method: 'POST',
    body: JSON.stringify({ step_data: stepData }),
  });
}

/** Execute a step (trigger AI generation) */
export async function executeWorkflowStep(
  sessionId: string,
  stepId: string | null,
  inputData?: Record<string, unknown>,
) {
  return apiRequest<{
    data: Record<string, unknown>;
    error?: string;
  }>(`/${sessionId}/execute`, {
    method: 'POST',
    body: JSON.stringify({ step_id: stepId, input_data: inputData }),
  });
}

/** Get full workflow state */
export async function getWorkflowState(sessionId: string) {
  return apiRequest<WorkflowState>(`/${sessionId}/state`);
}

/** Smart extract: text → structured form */
export async function smartExtract(text: string) {
  return apiRequest<SmartExtractResult>('/smart-extract', {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

/** Smart question: find missing info in questionnaire */
export async function smartQuestion(questionnaireData: Record<string, unknown>) {
  return apiRequest<{
    missing_dimensions: string[];
    supplementary_questions: Array<{ dimension: string; question: string; reason: string }>;
    completeness_score: number;
  }>('/smart-question', {
    method: 'POST',
    body: JSON.stringify({ questionnaire_data: questionnaireData }),
  });
}

/** List available workflow configs */
export async function listWorkflowConfigs() {
  return apiRequest<{ workflows: WorkflowConfig[] }>('/configs');
}

/** Generate outline for a single section (阶段) */
export async function generateOutlineSection(
  sessionId: string,
  sectionIndex: number,
) {
  return apiRequest<{
    section_index: number;
  } & Record<string, unknown>>(`/${sessionId}/generate-outline-section`, {
    method: 'POST',
    body: JSON.stringify({ section_index: sectionIndex }),
  });
}

/** Generate outline for a single activity (关键活动) */
export async function generateOutlineActivity(
  sessionId: string,
  sectionIndex: number,
  activityIndex: number,
) {
  return apiRequest<{
    section_index: number;
    activity_index: number;
  } & Record<string, unknown>>(`/${sessionId}/generate-outline-activity`, {
    method: 'POST',
    body: JSON.stringify({ section_index: sectionIndex, activity_index: activityIndex }),
  });
}

// ──────────────────────────────────────────────
// Template API (separate base path)
// ──────────────────────────────────────────────

async function templateApiRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<{ success: boolean; data?: T; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/templates${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      return { success: false, error: err.detail || `HTTP ${res.status}` };
    }
    const body = await res.json();
    return { success: true, data: body as T };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '网络错误' };
  }
}

/** Get available PPT themes */
export async function getThemes() {
  return templateApiRequest<Array<{
    id: string;
    name: string;
    description: string;
    preview_colors: string[];
  }>>('/themes');
}

/** Get available PPT layouts */
export async function getLayouts() {
  return templateApiRequest<{
    categories: Array<{
      category: string;
      category_name: string;
      layouts: string[];
    }>;
  }>('/layouts');
}

/** AI-recommend a layout for a slide */
export async function recommendLayout(content: string) {
  return templateApiRequest<{ layout_id: string }>('/recommend', {
    method: 'POST',
    body: JSON.stringify({ content }),
  });
}

// ──────────────────────────────────────────────
// Order API (Phase 3 — 合同 + 团队 + 排期)
// ──────────────────────────────────────────────

import type { CreateOrderFormData } from '@/lib/workflow/w3-types';

const ORDER_BASE = (projectId: string) => `${API_BASE_URL}/api/projects/${projectId}/order`;

export async function saveProjectOrder(projectId: string, data: CreateOrderFormData) {
  const res = await fetch(ORDER_BASE(projectId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
  return res.json();
}

export async function getProjectOrder(projectId: string) {
  const res = await fetch(ORDER_BASE(projectId));
  if (!res.ok) return { success: false, error: `HTTP ${res.status}` };
  return res.json();
}

// ──────────────────────────────────────────────
// Task CRUD API
// ──────────────────────────────────────────────

const TASKS_BASE = (projectId: string) => `${API_BASE_URL}/api/projects/${projectId}/tasks`;

export async function fetchTasks(projectId: string, phaseId?: string) {
  const params = phaseId ? `?phase_id=${encodeURIComponent(phaseId)}` : '';
  return apiRequest<TaskItem[]>(`${TASKS_BASE(projectId)}${params}`);
}

export async function createTask(
  projectId: string,
  task: Omit<TaskItem, 'id' | 'created_at' | 'updated_at'>,
) {
  return apiRequest<TaskItem>(TASKS_BASE(projectId), {
    method: 'POST',
    body: JSON.stringify(task),
  });
}

export async function updateTask(
  projectId: string,
  taskId: string,
  updates: Partial<Omit<TaskItem, 'id' | 'created_at'>>,
) {
  return apiRequest<TaskItem>(`${TASKS_BASE(projectId)}/${taskId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteTask(projectId: string, taskId: string) {
  return apiRequest<null>(`${TASKS_BASE(projectId)}/${taskId}`, {
    method: 'DELETE',
  });
}

// ──────────────────────────────────────────────
// Meeting Notes CRUD API
// ──────────────────────────────────────────────

const MEETINGS_BASE = (projectId: string) => `${API_BASE_URL}/api/projects/${projectId}/meetings`;

export async function fetchMeetings(projectId: string, phaseId?: string) {
  const params = phaseId ? `?phase_id=${encodeURIComponent(phaseId)}` : '';
  return apiRequest<MeetingNote[]>(`${MEETINGS_BASE(projectId)}${params}`);
}

export async function createMeeting(
  projectId: string,
  meeting: Omit<MeetingNote, 'id' | 'created_at'>,
) {
  return apiRequest<MeetingNote>(MEETINGS_BASE(projectId), {
    method: 'POST',
    body: JSON.stringify(meeting),
  });
}

export async function updateMeeting(
  projectId: string,
  meetingId: string,
  updates: Partial<Omit<MeetingNote, 'id' | 'created_at'>>,
) {
  return apiRequest<MeetingNote>(`${MEETINGS_BASE(projectId)}/${meetingId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteMeeting(projectId: string, meetingId: string) {
  return apiRequest<null>(`${MEETINGS_BASE(projectId)}/${meetingId}`, {
    method: 'DELETE',
  });
}

// ──────────────────────────────────────────────
// Deliverables CRUD API
// ──────────────────────────────────────────────

const DELIVERABLES_BASE = (projectId: string) => `${API_BASE_URL}/api/projects/${projectId}/deliverables`;

export async function fetchDeliverables(projectId: string, phaseId?: string) {
  const params = phaseId ? `?phase_id=${encodeURIComponent(phaseId)}` : '';
  return apiRequest<DeliverableItem[]>(`${DELIVERABLES_BASE(projectId)}${params}`);
}

export async function createDeliverable(
  projectId: string,
  deliverable: Omit<DeliverableItem, 'id' | 'created_at'>,
) {
  return apiRequest<DeliverableItem>(DELIVERABLES_BASE(projectId), {
    method: 'POST',
    body: JSON.stringify(deliverable),
  });
}

export async function updateDeliverable(
  projectId: string,
  deliverableId: string,
  updates: Partial<Omit<DeliverableItem, 'id' | 'created_at'>>,
) {
  return apiRequest<DeliverableItem>(`${DELIVERABLES_BASE(projectId)}/${deliverableId}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteDeliverable(projectId: string, deliverableId: string) {
  return apiRequest<null>(`${DELIVERABLES_BASE(projectId)}/${deliverableId}`, {
    method: 'DELETE',
  });
}
