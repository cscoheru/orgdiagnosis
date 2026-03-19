/**
 * LangGraph Diagnosis Client
 *
 * Frontend client for the LangGraph-based diagnosis workflow.
 * Handles async task submission, polling, and result retrieval.
 */

export interface TaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress_percentage: number;
  current_dimension: string;
  completed_dimensions: string[];
  error?: string;
  result?: DiagnosticReport;
}

export interface DiagnosticReport {
  task_id: string;
  report_name: string;
  overall_score: number;
  overall_insight: string;
  dimensions: DimensionResult[];
  completed_at: string;
}

export interface DimensionResult {
  category: string;
  display_name: string;
  total_score: number;
  summary_insight: string;
  secondary_metrics: SecondaryMetric[];
}

export interface SecondaryMetric {
  name: string;
  display_name: string;
  avg_score: number;
  tertiary_metrics: TertiaryMetric[];
}

export interface TertiaryMetric {
  name: string;
  display_name: string;
  score: number;
  evidence: string;
  analysis: string;
  confidence: 'high' | 'medium' | 'low';
}

export interface AnalyzeResponse {
  success: boolean;
  task_id: string;
  message: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/langgraph';

/**
 * Submit text for analysis
 */
export async function submitAnalysis(text: string): Promise<AnalyzeResponse> {
  const response = await fetch(`${API_BASE}/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit analysis: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Submit file for analysis
 */
export async function submitFileAnalysis(file: File): Promise<AnalyzeResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/analyze-file`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to submit file: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get task status
 */
export async function getTaskStatus(taskId: string): Promise<TaskStatus> {
  const response = await fetch(`${API_BASE}/status/${taskId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Task not found');
    }
    throw new Error(`Failed to get status: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get full task result
 */
export async function getTaskResult(taskId: string): Promise<DiagnosticReport> {
  const response = await fetch(`${API_BASE}/result/${taskId}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Task not found');
    }
    if (response.status === 400) {
      throw new Error('Task not completed yet');
    }
    throw new Error(`Failed to get result: ${response.statusText}`);
  }

  const data = await response.json();
  return data.result;
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/task/${taskId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel task: ${response.statusText}`);
  }
}

/**
 * Poll task status until completion
 */
export async function pollUntilComplete(
  taskId: string,
  onProgress?: (status: TaskStatus) => void,
  pollIntervalMs: number = 2000,
  timeoutMs: number = 300000 // 5 minutes
): Promise<DiagnosticReport> {
  const startTime = Date.now();

  while (true) {
    const status = await getTaskStatus(taskId);

    // Call progress callback
    onProgress?.(status);

    // Check completion
    if (status.status === 'completed') {
      return getTaskResult(taskId);
    }

    if (status.status === 'failed') {
      throw new Error(status.error || 'Analysis failed');
    }

    if (status.status === 'cancelled') {
      throw new Error('Task was cancelled');
    }

    // Check timeout
    if (Date.now() - startTime > timeoutMs) {
      throw new Error('Analysis timed out');
    }

    // Wait before next poll
    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }
}

/**
 * Full analysis workflow helper
 */
export async function runFullAnalysis(
  text: string,
  onProgress?: (status: TaskStatus) => void
): Promise<DiagnosticReport> {
  // Submit
  const { task_id } = await submitAnalysis(text);

  // Poll until complete
  return pollUntilComplete(task_id, onProgress);
}

/**
 * Full file analysis workflow helper
 */
export async function runFileAnalysis(
  file: File,
  onProgress?: (status: TaskStatus) => void
): Promise<DiagnosticReport> {
  // Submit
  const { task_id } = await submitFileAnalysis(file);

  // Poll until complete
  return pollUntilComplete(task_id, onProgress);
}
