/**
 * Report Generation API Client

 * Handles communication with the backend report generation workflow.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Types
export interface ClientRequirement {
  client_name: string;
  industry: string;
  industry_background: string;
  company_intro: string;
  company_scale?: string;
  core_pain_points: string[];
  pain_severity?: string;
  project_goals: string[];
  success_criteria?: string[];
  phase_planning: Array<{
    phase_id: string;
    phase_name: string;
    duration_weeks: number;
    key_activities: string[];
    deliverables: string[];
  }>;
  main_tasks: string[];
  deliverables: string[];
  gantt_chart_data?: Array<{
    task_id: string;
    task_name: string;
    start_date?: string;
    end_date?: string;
    owner?: string;
    dependencies?: string[];
  }>;
  five_d_diagnosis?: Record<string, unknown>;
}

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'generating_outline' | 'outline_ready' | 'generating_slides' | 'slides_ready' | 'ready_for_export' | 'completed' | 'failed';
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface ReportOutline {
  report_id: string;
  client_name: string;
  part1_outline: Record<string, unknown>;
  part2_outline: Record<string, unknown>;
  part3_outline: Record<string, unknown>;
  part4_outline: Record<string, unknown>;
  estimated_slides: number;
}

export interface SlideDraft {
  slide_id: string;
  section: 'part1' | 'part2' | 'part3' | 'part4';
  subsection: string;
  layout: string;
  visual_strategy: string;
  title: string;
  key_message: string;
  bullets: string[];
  retrieved_evidence?: string;
  source_ref: string;
  chart_data?: Record<string, unknown>;
  image_prompt?: string;
}

// API Functions

/**
 * Get requirement input template
 */
export async function getRequirementTemplate() {
  const response = await fetch(`${API_BASE}/api/requirement/template`);
  if (!response.ok) {
    throw new Error('Failed to get template');
  }
  return response.json();
}

/**
 * Validate requirement data
 */
export async function validateRequirement(requirement: ClientRequirement) {
  const response = await fetch(`${API_BASE}/api/requirement/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirement }),
  });
  if (!response.ok) {
    throw new Error('Validation failed');
  }
  return response.json();
}

/**
 * Start report generation task
 */
export async function startReport(requirement: ClientRequirement): Promise<{ task_id: string }> {
  const response = await fetch(`${API_BASE}/api/report/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requirement }),
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to start report');
  }
  return response.json();
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${API_BASE}/api/report/status/${taskId}`);
  if (!response.ok) {
    throw new Error('Failed to get status');
  }
  return response.json();
}

/**
 * Get generated outline
 */
export async function getOutline(taskId: string): Promise<ReportOutline> {
  const response = await fetch(`${API_BASE}/api/report/outline/${taskId}`);
  if (!response.ok) {
    throw new Error('Failed to get outline');
  }
  return response.json();
}

/**
 * Confirm outline and continue
 */
export async function confirmOutline(
  taskId: string,
  modifiedOutline?: ReportOutline
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/report/confirm-outline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, modified_outline: modifiedOutline }),
  });
  if (!response.ok) {
    throw new Error('Failed to confirm outline');
  }
  return response.json();
}

/**
 * Get generated slides
 */
export async function getSlides(taskId: string): Promise<{ slides: SlideDraft[]; total_slides: number }> {
  const response = await fetch(`${API_BASE}/api/report/slides/${taskId}`);
  if (!response.ok) {
    throw new Error('Failed to get slides');
  }
  return response.json();
}

/**
 * Confirm slides and export
 */
export async function confirmSlides(
  taskId: string,
  modifiedSlides?: SlideDraft[]
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/report/confirm-slides`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, modified_slides: modifiedSlides }),
  });
  if (!response.ok) {
    throw new Error('Failed to confirm slides');
  }
  return response.json();
}

/**
 * Get PPTX download URL
 */
export function getPptxUrl(taskId: string): string {
  return `${API_BASE}/api/report/export/${taskId}`;
}

/**
 * Poll task status until completion
 */
export async function pollUntilComplete(
  taskId: string,
  onProgress?: (status: TaskStatus) => void,
  interval = 2000,
  timeout = 300000
): Promise<TaskStatus> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const status = await getTaskStatus(taskId);

    if (onProgress) {
      onProgress(status);
    }

    if (
      status.status === 'outline_ready' ||
      status.status === 'slides_ready' ||
      status.status === 'completed' ||
      status.status === 'failed'
    ) {
      return status;
    }

    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('Timeout waiting for task completion');
}
