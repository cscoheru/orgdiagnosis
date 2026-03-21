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
  status: 'pending' | 'generating_modules' | 'modules_ready' | 'generating_page_titles' | 'page_titles_ready' | 'generating_outline' | 'outline_ready' | 'generating_slides' | 'slides_ready' | 'ready_for_export' | 'completed' | 'failed';
  progress_percentage: number;
  created_at: string;
  updated_at: string;
  error_message?: string;
}

export interface ReportOutline {
  task_id?: string;
  report_id?: string;
  client_name?: string;
  // API can return outline nested or flat
  outline?: {
    part1_outline: Record<string, unknown>;
    part2_outline: Record<string, unknown>;
    part3_outline: Record<string, unknown>;
    part4_outline: Record<string, unknown>;
    estimated_slides?: number;
  };
  part1_outline?: Record<string, unknown>;
  part2_outline?: Record<string, unknown>;
  part3_outline?: Record<string, unknown>;
  part4_outline?: Record<string, unknown>;
  estimated_slides?: number;
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

// === Multi-Level Expansion Types ===

export interface Module {
  module_id: string;
  module_name: string;
  module_title: string;
  diagnosis_dimension?: string;
  description: string;
  estimated_pages: number;
  priority: number;
}

export interface PageTitle {
  page_id: string;
  module_id: string;
  page_title: string;
  key_direction: string;
  suggested_layout: string;
  estimated_elements: number;
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
  console.log('[API] Starting report with requirement:', requirement);
  try {
    const response = await fetch(`${API_BASE}/api/report/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requirement }),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: `HTTP ${response.status}` }));
      console.error('[API] Start report failed:', error);
      throw new Error(error.detail || 'Failed to start report');
    }
    const data = await response.json();
    console.log('[API] Report started:', data);
    return data;
  } catch (error) {
    console.error('[API] Start report error:', error);
    throw error;
  }
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${API_BASE}/api/report/status/${taskId}`);
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to get status (${response.status})`);
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `Failed to get slides (${response.status})`);
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

// === Multi-Level Expansion API Functions ===

/**
 * Get generated modules (Step 1)
 */
export async function getModules(taskId: string): Promise<{ task_id: string; modules: Module[]; total_modules: number }> {
  const response = await fetch(`${API_BASE}/api/report/modules/${taskId}`);
  if (!response.ok) {
    throw new Error('Failed to get modules');
  }
  return response.json();
}

/**
 * Confirm modules and continue to page titles (Step 1)
 */
export async function confirmModules(
  taskId: string,
  modifiedModules?: Module[]
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/report/confirm-modules`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, modified_modules: modifiedModules }),
  });
  if (!response.ok) {
    throw new Error('Failed to confirm modules');
  }
  return response.json();
}

/**
 * Get generated page titles (Step 2)
 */
export async function getPageTitles(taskId: string): Promise<{ task_id: string; page_titles: PageTitle[]; total_pages: number }> {
  const response = await fetch(`${API_BASE}/api/report/page-titles/${taskId}`);
  if (!response.ok) {
    throw new Error('Failed to get page titles');
  }
  return response.json();
}

/**
 * Confirm page titles and continue to slides (Step 2)
 */
export async function confirmPageTitles(
  taskId: string,
  modifiedPageTitles?: PageTitle[]
): Promise<{ success: boolean }> {
  const response = await fetch(`${API_BASE}/api/report/confirm-page-titles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ task_id: taskId, modified_page_titles: modifiedPageTitles }),
  });
  if (!response.ok) {
    throw new Error('Failed to confirm page titles');
  }
  return response.json();
}

/**
 * Poll task status until completion
 * Supports both legacy workflow (outline_ready) and multi-level expansion (modules_ready, page_titles_ready)
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

    // Check for terminal/review states (both legacy and multi-level)
    if (
      status.status === 'modules_ready' ||        // Multi-level Step 1
      status.status === 'page_titles_ready' ||    // Multi-level Step 2
      status.status === 'outline_ready' ||        // Legacy workflow
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

// === Layout API ===

export interface LayoutInfo {
  layout_id: string;
  layout_name: string;
  category: string;
  description: string;
  element_count_range: [number, number];
  keywords: string[];
  source?: string;
}

export interface LayoutCategory {
  category_id: string;
  category_label: string;
  layouts: LayoutInfo[];
  count: number;
}

export interface AllLayoutsResponse {
  categories: LayoutCategory[];
  total_layouts: number;
}

/**
 * Get all available layouts (default + uploaded templates)
 */
export async function getAllLayouts(): Promise<AllLayoutsResponse> {
  const response = await fetch(`${API_BASE}/api/layout/all`);
  if (!response.ok) {
    throw new Error('Failed to fetch layouts');
  }
  return response.json();
}

/**
 * Get layout recommendations for specific content
 */
export async function getLayoutRecommendations(
  title: string,
  keyMessage: string,
  bullets: string[]
): Promise<{
  recommendations: Array<{
    layout_id: string;
    layout_name: string;
    confidence: number;
    reason: string;
  }>;
  best_layout_id: string;
  best_layout_reason: string;
}> {
  const response = await fetch(`${API_BASE}/api/layout/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, key_message: keyMessage, bullets }),
  });
  if (!response.ok) {
    throw new Error('Failed to get layout recommendations');
  }
  return response.json();
}

/**
 * Export PPTX with template and layout configuration
 */
export interface ExportOptions {
  template_id: string;
  slide_layouts: Array<{
    slide_id: string;
    layout_id: string;
  }>;
}

export async function exportPptx(
  taskId: string,
  options: ExportOptions
): Promise<{ success: boolean; download_url: string }> {
  const response = await fetch(`${API_BASE}/api/report/export/${taskId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(options),
  });
  if (!response.ok) {
    throw new Error('Failed to export PPTX');
  }
  return response.json();
}
