'use client';

import { useState, useCallback, useRef } from 'react';
import {
  submitAnalysis,
  submitFileAnalysis,
  getTaskStatus,
  getTaskResult,
  cancelTask,
  pollUntilComplete,
  type TaskStatus,
  type DiagnosticReport,
} from '@/lib/langgraph-client';

export interface UseLangGraphDiagnosisOptions {
  /** Poll interval in milliseconds (default: 2000) */
  pollInterval?: number;
  /** Timeout in milliseconds (default: 300000 = 5 minutes) */
  timeout?: number;
  /** Callback when progress updates */
  onProgress?: (status: TaskStatus) => void;
  /** Callback when analysis completes */
  onComplete?: (report: DiagnosticReport) => void;
  /** Callback when error occurs */
  onError?: (error: Error) => void;
}

export interface DiagnosisState {
  /** Current task ID */
  taskId: string | null;
  /** Current status */
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  /** Progress percentage (0-100) */
  progress: number;
  /** Current dimension being analyzed */
  currentDimension: string;
  /** Completed dimensions */
  completedDimensions: string[];
  /** Final report (when completed) */
  report: DiagnosticReport | null;
  /** Error message (if failed) */
  error: string | null;
  /** Is currently analyzing */
  isAnalyzing: boolean;
}

export function useLangGraphDiagnosis(options: UseLangGraphDiagnosisOptions = {}) {
  const {
    pollInterval = 2000,
    timeout = 300000,
    onProgress,
    onComplete,
    onError,
  } = options;

  const [state, setState] = useState<DiagnosisState>({
    taskId: null,
    status: 'idle',
    progress: 0,
    currentDimension: '',
    completedDimensions: [],
    report: null,
    error: null,
    isAnalyzing: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Update state helper
   */
  const updateState = useCallback((updates: Partial<DiagnosisState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Handle progress updates
   */
  const handleProgress = useCallback((status: TaskStatus) => {
    updateState({
      status: status.status as DiagnosisState['status'],
      progress: status.progress_percentage,
      currentDimension: status.current_dimension,
      completedDimensions: status.completed_dimensions,
    });
    onProgress?.(status);
  }, [updateState, onProgress]);

  /**
   * Analyze text
   */
  const analyzeText = useCallback(async (text: string) => {
    try {
      updateState({
        status: 'pending',
        progress: 0,
        currentDimension: 'initializing',
        completedDimensions: [],
        report: null,
        error: null,
        isAnalyzing: true,
      });

      // Submit analysis
      const response = await submitAnalysis(text);
      updateState({ taskId: response.task_id });

      // Create abort controller for this task
      abortControllerRef.current = new AbortController();

      // Poll until complete
      const report = await pollUntilComplete(
        response.task_id,
        handleProgress,
        pollInterval,
        timeout
      );

      updateState({
        status: 'completed',
        progress: 100,
        report,
        isAnalyzing: false,
      });

      onComplete?.(report);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateState({
        status: 'failed',
        error: errorMessage,
        isAnalyzing: false,
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [updateState, handleProgress, pollInterval, timeout, onComplete, onError]);

  /**
   * Analyze file
   */
  const analyzeFile = useCallback(async (file: File) => {
    try {
      updateState({
        status: 'pending',
        progress: 0,
        currentDimension: 'initializing',
        completedDimensions: [],
        report: null,
        error: null,
        isAnalyzing: true,
      });

      // Submit file analysis
      const response = await submitFileAnalysis(file);
      updateState({ taskId: response.task_id });

      // Create abort controller
      abortControllerRef.current = new AbortController();

      // Poll until complete
      const report = await pollUntilComplete(
        response.task_id,
        handleProgress,
        pollInterval,
        timeout
      );

      updateState({
        status: 'completed',
        progress: 100,
        report,
        isAnalyzing: false,
      });

      onComplete?.(report);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      updateState({
        status: 'failed',
        error: errorMessage,
        isAnalyzing: false,
      });
      onError?.(error instanceof Error ? error : new Error(errorMessage));
    }
  }, [updateState, handleProgress, pollInterval, timeout, onComplete, onError]);

  /**
   * Cancel current analysis
   */
  const cancel = useCallback(async () => {
    if (state.taskId) {
      try {
        await cancelTask(state.taskId);
        updateState({
          status: 'cancelled',
          isAnalyzing: false,
        });
      } catch (error) {
        console.error('Failed to cancel task:', error);
      }
    }

    // Abort any pending requests
    abortControllerRef.current?.abort();
  }, [state.taskId, updateState]);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    updateState({
      taskId: null,
      status: 'idle',
      progress: 0,
      currentDimension: '',
      completedDimensions: [],
      report: null,
      error: null,
      isAnalyzing: false,
    });
  }, [updateState]);

  /**
   * Get dimension label in Chinese
   */
  const getDimensionLabel = useCallback((dimension: string): string => {
    const labels: Record<string, string> = {
      strategy: '战略维度',
      structure: '组织维度',
      performance: '绩效维度',
      compensation: '薪酬维度',
      talent: '人才维度',
      initializing: '初始化中',
      completed: '分析完成',
    };
    return labels[dimension] || dimension;
  }, []);

  return {
    // State
    ...state,

    // Actions
    analyzeText,
    analyzeFile,
    cancel,
    reset,

    // Helpers
    getDimensionLabel,
  };
}

export default useLangGraphDiagnosis;
