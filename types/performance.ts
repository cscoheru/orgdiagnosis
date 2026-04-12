/**
 * 绩效管理咨询模块 — TypeScript 类型定义
 *
 * 覆盖绩效方案、组织绩效(四维度)、岗位绩效(四分区)、
 * 考核表单、评分模型、考核记录、校准会话等十大元模型。
 */

// ============================================
// 通用类型
// ============================================

export type Methodology = 'KPI' | 'OKR' | '360度评估' | '混合';
export type CycleType = '月度' | '季度' | '半年度' | '年度';
export type PlanStatus = '草拟中' | '客户确认' | '执行中' | '评估中' | '已完成';
export type OrgPerfStatus = '生成中' | '待确认' | '已确认' | '已分解';
export type PosPerfStatus = '已生成' | '已编辑' | '已确认';
export type TemplateType = 'KPI考核' | 'OKR评估' | '360度评估' | '综合考核' | '试用期考核';
export type ReviewStatus = '待自评' | '待主管评' | '待校准' | '已完成' | '已申诉';
export type CalibrationType = '部门内' | '跨部门' | '全员' | '高管';
export type CalibrationStatus = '待校准' | '进行中' | '已完成';
export type GoalType = 'revenue_target' | 'profit_target' | 'strategic_initiative' | 'operational_kpi' | 'capability_building';
export type PeriodType = 'annual' | 'quarterly' | 'monthly';
export type PerfType = 'company' | 'department';

export interface BusinessContext {
  client_profile?: string;
  business_review?: string;
  market_insights?: string;
  swot_data?: string;
  strategic_direction?: string;
  bsc_cards?: string;
  action_plans?: string;
  targets?: string;
  source_files?: string[];
}

export interface Milestone {
  phase: string;
  date: string;
  deliverable: string;
}

export interface TargetMetric {
  metric_name: string;
  unit: string;
  target_value: number;
  actual_value?: number;
}

export interface LinkedKPI {
  kpi_goal_id: string;
  weight: number;
}

// ============================================
// 绩效方案 Performance_Plan
// ============================================

export interface WeightConfig {
  performance_weight: number;
  competency_weight: number;
  values_weight: number;
}

export interface PerformancePlan {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    plan_name: string;
    project_id: string;
    client_name?: string;
    industry?: string;
    employee_count?: number;
    methodology: Methodology;
    cycle_type: CycleType;
    weight_config?: WeightConfig;
    calibration_required?: boolean;
    status: PlanStatus;
    description?: string;
    scope?: string[];
    business_context?: BusinessContext;
  };
  created_at?: string;
  updated_at?: string;
}

export interface PerformancePlanCreate {
  plan_name: string;
  project_id: string;
  client_name?: string;
  industry?: string;
  employee_count?: number;
  methodology: Methodology;
  cycle_type: CycleType;
  weight_config?: WeightConfig;
  calibration_required?: boolean;
  status?: PlanStatus;
  description?: string;
  scope?: string[];
  business_context?: BusinessContext;
}

// ============================================
// 组织绩效 Org_Performance (四维度)
// ============================================

export interface StrategicKPI {
  name: string;
  metric: string;
  weight: number;
  target: string;
  unit: string;
  source_goal: string;
}

export interface ManagementIndicator {
  name: string;
  metric: string;
  weight: number;
  target: string;
  unit: string;
  description?: string;
}

export interface TeamDevelopmentIndicator {
  name: string;
  metric: string;
  weight: number;
  target: string;
  unit: string;
  description?: string;
}

export interface EngagementComplianceIndicator {
  name: string;
  metric: string;
  weight: number;
  target: string;
  unit: string;
  description?: string;
}

export interface DimensionWeights {
  strategic: number;
  management: number;
  team_development: number;
  engagement: number;
}

export interface StrategicAlignment {
  strategic_goal_id: string;
  alignment_desc: string;
}

export interface OrgPerformance {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    org_unit_ref: string;
    org_unit_name?: string;
    plan_ref: string;
    project_id: string;
    strategic_kpis: StrategicKPI[];
    management_indicators: ManagementIndicator[];
    team_development: TeamDevelopmentIndicator[];
    engagement_compliance: EngagementComplianceIndicator[];
    dimension_weights: DimensionWeights;
    strategic_alignment?: StrategicAlignment[];
    period?: CycleType;
    status: OrgPerfStatus;
    generated_at?: string;
    perf_type?: PerfType;
    parent_goal_ref?: string;
    period_target?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 岗位绩效 Position_Performance (四分区)
// ============================================

export interface PerformanceGoal {
  name: string;
  metric: string;
  weight: number;
  target: string;
  unit: string;
  source_dept_kpi: string;
  evaluation_criteria: string;
}

export interface CompetencyItem {
  competency_id?: string;
  name: string;
  required_level: string;
  weight: number;
  behavioral_indicators: string[];
}

export interface ValuesItem {
  name: string;
  description: string;
  weight: number;
  behavioral_examples: string[];
}

export interface DevelopmentGoal {
  name: string;
  action_items: string[];
  timeline: string;
  weight: number;
}

export interface SectionWeights {
  performance: number;
  competency: number;
  values: number;
  development: number;
}

export interface LeaderConfig {
  is_leader: boolean;
  personal_weight: number;
  team_weight: number;
  team_kpi_source?: string;
}

export interface TeamPerformance {
  dept_kpi_achievement?: number;
  team_development_achievement?: number;
  management_effectiveness?: {
    subordinate_distribution?: string;
    turnover_rate?: number;
    team_satisfaction?: number;
  };
}

export interface PositionPerformance {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    job_role_ref: string;
    job_role_name?: string;
    org_perf_ref: string;
    plan_ref: string;
    project_id: string;
    performance_goals: PerformanceGoal[];
    competency_items: CompetencyItem[];
    values_items: ValuesItem[];
    development_goals: DevelopmentGoal[];
    section_weights: SectionWeights;
    is_leader: boolean;
    leader_config?: LeaderConfig;
    team_performance?: TeamPerformance;
    auto_generated?: boolean;
    is_edited?: boolean;
    status: PosPerfStatus;
    period_target?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 考核表单模板 Review_Template
// ============================================

export interface TemplateSectionItem {
  name: string;
  description?: string;
  scoring_criteria?: string;
  weight?: number;
}

export interface TemplateSection {
  section_name: string;
  weight: number;
  items: TemplateSectionItem[];
}

export interface ReviewerConfig {
  self_review: boolean;
  manager_review: boolean;
  peer_review: boolean;
  subordinate_review: boolean;
  external_review: boolean;
}

export interface RatingRecommendation {
  scale_type: string;
  min_value: number;
  max_value: number;
  distribution_guide: Record<string, number>;
}

export interface ReviewTemplate {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    template_name: string;
    template_type: TemplateType;
    applicable_roles?: string[];
    sections: TemplateSection[];
    total_weight: number;
    rating_model_ref?: string;
    reviewer_config?: ReviewerConfig;
    rating_recommendation?: RatingRecommendation;
    plan_ref?: string;
    position_ref?: string;
    status: string;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 评分模型 Rating_Model
// ============================================

export interface ScaleDefinition {
  value: number;
  label: string;
  description?: string;
  behavioral_indicators?: string[];
}

export interface RatingModel {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    model_name: string;
    scale_type: '行为锚定' | '数值等级' | '百分比' | '描述性';
    min_value: number;
    max_value: number;
    step?: number;
    scale_definitions: ScaleDefinition[];
    distribution_guide?: Record<string, number>;
    is_default?: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 考核记录 Performance_Review
// ============================================

export interface PerformanceReview {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    review_title: string;
    employee?: string;
    position?: string;
    template?: string;
    cycle_ref?: string;
    reviewer?: string;
    project_id?: string;
    overall_score?: number;
    overall_rating?: string;
    section_scores?: Record<string, number>;
    self_assessment?: string;
    manager_comments?: string;
    development_actions?: string[];
    status: ReviewStatus;
    calibrated_score?: number;
    calibration_ref?: string;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 校准会话 Calibration_Session
// ============================================

export interface CalibrationSession {
  _key: string;
  _id?: string;
  model_key?: string;
  properties: {
    session_name: string;
    cycle_ref?: string;
    org_unit?: string;
    calibration_type: CalibrationType;
    project_id?: string;
    distribution_before?: Record<string, unknown>;
    distribution_after?: Record<string, unknown>;
    nine_box_data?: Record<string, unknown>;
    adjustment_notes?: string;
    status: CalibrationStatus;
  };
  created_at?: string;
  updated_at?: string;
}

// ============================================
// 统计分析
// ============================================

export interface ScoreStatistics {
  count: number;
  mean: number;
  median: number;
  std_dev: number;
  min: number;
  max: number;
}

export interface DistributionAnalytics {
  rating_distribution: Record<string, number>;
  score_statistics: ScoreStatistics;
  total_reviews: number;
}

export interface BiasDetection {
  type: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  affected_reviewers: string[];
}

export interface OutlierReviewer {
  reviewer: string;
  avg_score: number;
  deviation: number;
  recommendation: string;
}

export interface BiasAnalysis {
  bias_detected: BiasDetection[];
  distribution_analysis: {
    mean: number;
    std_dev: number;
    skewness?: string;
    by_department?: Record<string, unknown>;
  };
  outlier_reviewers: OutlierReviewer[];
  recommendations: string[];
}

export interface PerformanceOverview {
  plans: number;
  org_performances: number;
  position_performances: number;
  leaders: number;
  professionals: number;
  templates: number;
  reviews: number;
  calibrations: number;
  auto_generated: number;
  edited: number;
}

// ============================================
// API 请求/响应类型
// ============================================

export interface GenerateOrgPerfRequest {
  plan_id: string;
  org_unit_id: string;
}

export interface GeneratePosPerfRequest {
  org_perf_id: string;
}

export interface GenerateTemplateRequest {
  pos_perf_id: string;
}

export interface BatchUpdateItem {
  key: string;
  [field: string]: unknown;
}

export interface BatchUpdateResult {
  updated: number;
  results: Array<{
    key: string;
    status: 'updated' | 'not_found' | 'skipped';
    error?: string;
  }>;
}

export interface NineBoxData {
  nine_box_data: Record<string, unknown>;
}

// ============================================
// 常量
// ============================================

export const METHODOLOGY_LABELS: Record<Methodology, string> = {
  KPI: 'KPI',
  OKR: 'OKR',
  '360度评估': '360度评估',
  混合: '混合模式',
};

export const CYCLE_TYPE_LABELS: Record<CycleType, string> = {
  月度: '月度',
  季度: '季度',
  半年度: '半年度',
  年度: '年度',
};

export const PLAN_STATUS_LABELS: Record<PlanStatus, string> = {
  草拟中: '草拟中',
  客户确认: '客户确认',
  执行中: '执行中',
  评估中: '评估中',
  已完成: '已完成',
};

export const PLAN_STATUS_COLORS: Record<PlanStatus, string> = {
  草拟中: 'bg-gray-100 text-gray-600',
  客户确认: 'bg-blue-100 text-blue-700',
  执行中: 'bg-amber-100 text-amber-700',
  评估中: 'bg-orange-100 text-orange-700',
  已完成: 'bg-green-100 text-green-700',
};

export const ORG_PERF_STATUS_LABELS: Record<OrgPerfStatus, string> = {
  生成中: '生成中',
  待确认: '待确认',
  已确认: '已确认',
  已分解: '已分解',
};

export const POS_PERF_STATUS_LABELS: Record<PosPerfStatus, string> = {
  已生成: '已生成',
  已编辑: '已编辑',
  已确认: '已确认',
};

export const DEFAULT_DIMENSION_WEIGHTS: DimensionWeights = {
  strategic: 50,
  management: 25,
  team_development: 15,
  engagement: 10,
};

export const DEFAULT_SECTION_WEIGHTS: SectionWeights = {
  performance: 55,
  competency: 25,
  values: 10,
  development: 10,
};

// ============================================
// 指标库 (Metrics Library)
// ============================================

export type MetricDimension =
  | '财务' | '客户' | '内部流程' | '学习与成长'
  | '战略' | '运营' | '人才发展' | '胜任力';

export type MetricLevel = '组织级' | '部门级' | '岗位级';

export type MetricStatus = 'published' | 'draft';

export type MetricSource = 'best_practice' | 'ai_generated' | 'user_created';

export type OrgDimensionMapping =
  | 'strategic_kpis' | 'management_indicators'
  | 'team_development' | 'engagement_compliance';

export type PosSectionMapping =
  | 'performance_goals' | 'competency_items'
  | 'values_items' | 'development_goals';

export type CategoryType = 'industry' | 'dimension' | 'level' | 'custom';

export interface MetricCategory {
  _key?: string;
  category_name: string;
  category_type: CategoryType;
  parent_category_ref?: string;
  description?: string;
  display_order?: number;
  icon?: string;
}

export interface MetricTemplate {
  _key: string;
  metric_name: string;
  dimension: MetricDimension;
  applicable_level: MetricLevel;
  industries: string[];
  source: MetricSource;
  status: MetricStatus;
  default_weight: number;
  unit: string;
  target_template: string;
  evaluation_criteria?: string;
  description?: string;
  metric_formula?: string;
  data_source_hint?: string;
  tags: string[];
  org_dimension_mapping?: OrgDimensionMapping;
  pos_section_mapping?: PosSectionMapping;
  is_verified?: boolean;
  usage_count?: number;
}
