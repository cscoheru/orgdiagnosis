/**
 * 绩效管理咨询模块 — API 客户端
 *
 * 与后端 /api/v1/performance/* 端点交互。
 * 所有函数返回 { success, data?, error? } 统一格式。
 */

import { API_BASE_URL } from '@/lib/api-config';
import type {
  PerformancePlan,
  PerformancePlanCreate,
  OrgPerformance,
  PositionPerformance,
  ReviewTemplate,
  RatingModel,
  PerformanceReview,
  CalibrationSession,
  DistributionAnalytics,
  BiasAnalysis,
  PerformanceOverview,
  GenerateOrgPerfRequest,
  GeneratePosPerfRequest,
  GenerateTemplateRequest,
  BatchUpdateItem,
  BatchUpdateResult,
  NineBoxData,
} from '@/types/performance';

export type {
  PerformancePlan,
  PerformancePlanCreate,
  OrgPerformance,
  PositionPerformance,
  ReviewTemplate,
  RatingModel,
  PerformanceReview,
  CalibrationSession,
  DistributionAnalytics,
  BiasAnalysis,
  PerformanceOverview,
  GenerateOrgPerfRequest,
  GeneratePosPerfRequest,
  GenerateTemplateRequest,
  BatchUpdateItem,
  BatchUpdateResult,
  NineBoxData,
};

// ──────────────────────────────────────────────
// 通用请求包装
// ──────────────────────────────────────────────

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Fields that may be JSON strings from the backend — parse them to native types
const JSON_FIELDS = new Set([
  'strategic_kpis', 'management_indicators', 'team_development',
  'engagement_compliance', 'dimension_weights', 'strategic_alignment',
  'performance_goals', 'competency_items', 'values_items', 'development_goals',
  'section_weights', 'leader_config', 'team_performance',
  'scale_definitions', 'distribution_guide', 'reviewer_config',
  'sections', 'section_scores', 'development_actions',
]);

function normalizeJsonFields(obj: Record<string, unknown>): Record<string, unknown> {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string' && JSON_FIELDS.has(key)) {
      try { obj[key] = JSON.parse(val); } catch { /* keep original string */ }
    }
  }
  return obj;
}

async function perfRequest<T>(
  path: string,
  options?: RequestInit,
  timeout = 180000
): Promise<ApiResponse<T>> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`${API_BASE_URL}/api/v1/performance${path}`, {
      headers: { 'Content-Type': 'application/json', ...options?.headers },
      signal: controller.signal,
      ...options,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      return { success: false, error: `服务器错误 ${response.status}: ${text}` };
    }

    const json = await response.json();
    // Normalize JSON-stringified fields in performance objects
    if (Array.isArray(json)) {
      json.forEach((item: Record<string, unknown>) => {
        if (item.properties) normalizeJsonFields(item.properties);
      });
    } else if (json?.properties) {
      normalizeJsonFields(json.properties);
    }
    return { success: true, data: json };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: '请求超时，请稍后重试' };
    }
    return { success: false, error: error instanceof Error ? error.message : '网络错误' };
  }
}

// ──────────────────────────────────────────────
// 绩效方案 Plans
// ──────────────────────────────────────────────

export async function createPlan(data: PerformancePlanCreate): Promise<ApiResponse<PerformancePlan>> {
  return perfRequest<PerformancePlan>('/plans', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listPlans(projectId?: string): Promise<ApiResponse<PerformancePlan[]>> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return perfRequest<PerformancePlan[]>(`/plans${query}`);
}

export async function getPlan(key: string): Promise<ApiResponse<PerformancePlan>> {
  return perfRequest<PerformancePlan>(`/plans/${encodeURIComponent(key)}`);
}

export async function updatePlan(key: string, data: Partial<PerformancePlanCreate>): Promise<ApiResponse<PerformancePlan>> {
  return perfRequest<PerformancePlan>(`/plans/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// 组织绩效 Org Performance
// ──────────────────────────────────────────────

export async function generateOrgPerformance(req: GenerateOrgPerfRequest): Promise<ApiResponse<unknown>> {
  return perfRequest('/org-perf/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listOrgPerformances(planId?: string): Promise<ApiResponse<OrgPerformance[]>> {
  const query = planId ? `?plan_id=${encodeURIComponent(planId)}` : '';
  return perfRequest<OrgPerformance[]>(`/org-perf${query}`);
}

export async function getOrgPerformance(key: string): Promise<ApiResponse<OrgPerformance>> {
  return perfRequest<OrgPerformance>(`/org-perf/${encodeURIComponent(key)}`);
}

export async function updateOrgPerformance(key: string, data: Record<string, unknown>): Promise<ApiResponse<OrgPerformance>> {
  return perfRequest<OrgPerformance>(`/org-perf/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// 岗位绩效 Position Performance
// ──────────────────────────────────────────────

export async function generatePositionPerformance(req: GeneratePosPerfRequest): Promise<ApiResponse<unknown>> {
  return perfRequest('/pos-perf/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listPositionPerformances(orgPerfId?: string, planId?: string): Promise<ApiResponse<PositionPerformance[]>> {
  const params = new URLSearchParams();
  if (orgPerfId) params.set('org_perf_id', orgPerfId);
  else if (planId) params.set('plan_id', planId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return perfRequest<PositionPerformance[]>(`/pos-perf${query}`);
}

export async function getPositionPerformance(key: string): Promise<ApiResponse<PositionPerformance>> {
  return perfRequest<PositionPerformance>(`/pos-perf/${encodeURIComponent(key)}`);
}

export async function updatePositionPerformance(key: string, data: Record<string, unknown>): Promise<ApiResponse<PositionPerformance>> {
  return perfRequest<PositionPerformance>(`/pos-perf/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function batchUpdatePositionPerformance(updates: BatchUpdateItem[]): Promise<ApiResponse<BatchUpdateResult>> {
  return perfRequest<BatchUpdateResult>('/pos-perf/batch-update', {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

// ──────────────────────────────────────────────
// 考核表单模板 Templates
// ──────────────────────────────────────────────

export async function generateReviewTemplate(req: GenerateTemplateRequest): Promise<ApiResponse<unknown>> {
  return perfRequest('/templates/generate', {
    method: 'POST',
    body: JSON.stringify(req),
  });
}

export async function listTemplates(planId?: string): Promise<ApiResponse<ReviewTemplate[]>> {
  const query = planId ? `?plan_id=${encodeURIComponent(planId)}` : '';
  return perfRequest<ReviewTemplate[]>(`/templates${query}`);
}

export async function getTemplate(key: string): Promise<ApiResponse<ReviewTemplate>> {
  return perfRequest<ReviewTemplate>(`/templates/${encodeURIComponent(key)}`);
}

export async function updateTemplate(key: string, data: Record<string, unknown>): Promise<ApiResponse<ReviewTemplate>> {
  return perfRequest<ReviewTemplate>(`/templates/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// 评分模型 Rating Models
// ──────────────────────────────────────────────

export async function createRatingModel(data: Record<string, unknown>): Promise<ApiResponse<RatingModel>> {
  return perfRequest<RatingModel>('/rating-models', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listRatingModels(): Promise<ApiResponse<RatingModel[]>> {
  return perfRequest<RatingModel[]>('/rating-models');
}

export async function getRatingModel(key: string): Promise<ApiResponse<RatingModel>> {
  return perfRequest<RatingModel>(`/rating-models/${encodeURIComponent(key)}`);
}

export async function updateRatingModel(key: string, data: Record<string, unknown>): Promise<ApiResponse<RatingModel>> {
  return perfRequest<RatingModel>(`/rating-models/${encodeURIComponent(key)}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ──────────────────────────────────────────────
// 考核记录 Reviews
// ──────────────────────────────────────────────

export async function createReview(data: Record<string, unknown>): Promise<ApiResponse<PerformanceReview>> {
  return perfRequest<PerformanceReview>('/reviews', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function batchImportReviews(reviews: Record<string, unknown>[]): Promise<ApiResponse<{ count: number; ids: string[] }>> {
  return perfRequest('/reviews/batch', {
    method: 'POST',
    body: JSON.stringify({ reviews }),
  });
}

export async function listReviews(projectId?: string, cycleId?: string): Promise<ApiResponse<PerformanceReview[]>> {
  const params = new URLSearchParams();
  if (projectId) params.set('project_id', projectId);
  if (cycleId) params.set('cycle_id', cycleId);
  const query = params.toString() ? `?${params.toString()}` : '';
  return perfRequest<PerformanceReview[]>(`/reviews${query}`);
}

export async function getReview(key: string): Promise<ApiResponse<PerformanceReview>> {
  return perfRequest<PerformanceReview>(`/reviews/${encodeURIComponent(key)}`);
}

// ──────────────────────────────────────────────
// 校准 Calibrations
// ──────────────────────────────────────────────

export async function createCalibration(data: Record<string, unknown>): Promise<ApiResponse<CalibrationSession>> {
  return perfRequest<CalibrationSession>('/calibrations', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function getCalibration(key: string): Promise<ApiResponse<CalibrationSession>> {
  return perfRequest<CalibrationSession>(`/calibrations/${encodeURIComponent(key)}`);
}

export async function analyzeCalibration(key: string): Promise<ApiResponse<unknown>> {
  return perfRequest(`/calibrations/${encodeURIComponent(key)}/analyze`, {
    method: 'POST',
  });
}

export async function getNineBoxData(key: string): Promise<ApiResponse<NineBoxData>> {
  return perfRequest<NineBoxData>(`/calibrations/${encodeURIComponent(key)}/nine-box`);
}

// ──────────────────────────────────────────────
// 统计分析 Analytics
// ──────────────────────────────────────────────

export async function getDistributionAnalytics(projectId?: string): Promise<ApiResponse<DistributionAnalytics>> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return perfRequest<DistributionAnalytics>(`/analytics/distribution${query}`);
}

export async function getBiasAnalysis(projectId?: string): Promise<ApiResponse<BiasAnalysis>> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return perfRequest<BiasAnalysis>(`/analytics/bias${query}`);
}

export async function getPerformanceOverview(projectId?: string): Promise<ApiResponse<PerformanceOverview>> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return perfRequest<PerformanceOverview>(`/analytics/overview${query}`);
}

// ──────────────────────────────────────────────
// 报告生成 Reports
// ──────────────────────────────────────────────

export async function generatePerformanceReport(projectId: string): Promise<ApiResponse<unknown>> {
  return perfRequest('/reports/generate', {
    method: 'POST',
    body: JSON.stringify({ project_id: projectId }),
  });
}
