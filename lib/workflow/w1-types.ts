/**
 * W1 需求分析与建议书 — 增强类型定义
 *
 * 对齐旧版 4 步需求收集表单的详细度，
 * 每步支持 AI 智能辅助填充 + 用户手动编辑。
 */

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

export type PainSeverity = 'critical' | 'high' | 'medium' | 'low';

export const PAIN_SEVERITY_OPTIONS: {
  value: PainSeverity;
  label: string;
  description: string;
  color: string;       // Tailwind text color
  bg: string;          // Tailwind bg color
  border: string;      // Tailwind border color
}[] = [
  { value: 'critical', label: '严重', description: '影响业务生存', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  { value: 'high',     label: '高',   description: '显著影响运营效率', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  { value: 'medium',   label: '中',   description: '存在改进空间', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
  { value: 'low',      label: '低',   description: '优化建议', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
];

export const INDUSTRY_OPTIONS = [
  '制造业', '零售', '金融', '科技', '医疗', '教育', '房地产', '其他',
] as const;

export type IndustryOption = (typeof INDUSTRY_OPTIONS)[number];

// ──────────────────────────────────────────────
// Interfaces
// ──────────────────────────────────────────────

/** 单个痛点项（含严重程度） */
export interface PainPointItem {
  id: string;
  description: string;
  severity: PainSeverity;
}

/** Step 1 增强数据：基本信息 + 核心需求 */
export interface EnhancedSmartExtractData {
  client_name: string;
  industry: string;
  company_scale?: string;
  industry_background: string;
  company_info: string;
  core_pain_points: PainPointItem[];
  expected_goals: string[];
  success_criteria: string[];
  other_requirements?: string;
}

/** 增强阶段数据 */
export interface EnhancedPhase {
  id: string;
  phase_name: string;
  phase_order: number;
  duration_weeks: number;
  time_range: string;
  goals: string;
  key_activities: string[];
  deliverables: string[];
}

/** Step 2 增强数据：核心需求与计划 */
export interface EnhancedMilestonePlanData {
  project_goal: string;
  phases: EnhancedPhase[];
  success_criteria: string[];
  main_tasks: string[];
  total_duration_weeks: number;
}

/** Step 3: MDS 表格 — 阶段列 */
export interface MDSPhaseColumn {
  id: string;
  phase_name: string;
  duration_weeks: number;
}

/** Step 3: MDS 表格 — 行（活动或成果） */
export interface MDSRow {
  id: string;
  type: 'activity' | 'deliverable';
  cells: string[];  // 每个阶段对应一个单元格
}

/** Step 3: MDS — 直接从里程碑计划生成的可编辑表格 */
export interface MDSSingleSlide {
  title: string;
  project_goal: string;
  key_message: string;
  phases: MDSPhaseColumn[];
  rows: MDSRow[];
  expected_outcomes: string[];
}

/** Step 4: 详细大纲 — L3 页面 */
export type SlideType = 'content' | 'methodology' | 'case';

export interface OutlineSlide {
  slide_index: number;
  title: string;
  slide_type: SlideType;
  storyline: string;
  arguments: string[];
  evidence: string[];
  supporting_materials: string[];
}

/** Step 4: 详细大纲 — L2 关键活动 */
export interface OutlineActivity {
  id: string;
  activity_name: string;
  slides: OutlineSlide[];
}

/** Step 4: 详细大纲 — L1 阶段 section */
export interface OutlineSection {
  id: string;
  section_name: string;
  activities: OutlineActivity[];
}

/** Step 4: 详细大纲 — 完整数据 */
export interface DetailedOutlineData {
  sections: OutlineSection[];
}

/** Step 5: 主题信息 */
export interface ThemeInfo {
  id: string;
  name: string;
  description: string;
  preview_colors: string[];
}

/** Step 5: Layout 分类信息 */
export interface LayoutCategory {
  category: string;
  category_name: string;
  layouts: string[];
}

/** Step 5: 单页 layout 分配 */
export interface SlideLayoutAssignment {
  slide_index: number;
  slide_title: string;
  section_name: string;
  layout_id: string;
}

/** Step 5: 模板选择数据 */
export interface TemplateSelectionData {
  theme_id: string;
  slide_layouts: SlideLayoutAssignment[];
}

/** 验证错误 */
export interface ValidationErrors {
  [field: string]: string;
}

// ──────────────────────────────────────────────
// Factory helpers
// ──────────────────────────────────────────────

let _uid = 0;
export function uid(): string {
  return `w1-${++_uid}-${Date.now().toString(36)}`;
}

export function createEmptyPainPoint(description = ''): PainPointItem {
  return { id: uid(), description, severity: 'medium' };
}

export function createEmptyPhase(order: number): EnhancedPhase {
  return {
    id: uid(),
    phase_name: `阶段 ${order}`,
    phase_order: order,
    duration_weeks: 2,
    time_range: '',
    goals: '',
    key_activities: [],
    deliverables: [],
  };
}

export function createEmptyOutlineSlide(index: number, slideType: SlideType = 'content'): OutlineSlide {
  return {
    slide_index: index,
    title: `页面 ${index}`,
    slide_type: slideType,
    storyline: '',
    arguments: [],
    evidence: [],
    supporting_materials: [],
  };
}

export function createEmptyOutlineActivity(name: string): OutlineActivity {
  return {
    id: uid(),
    activity_name: name,
    slides: [],
  };
}

export function createEmptyOutlineSection(name: string): OutlineSection {
  return {
    id: uid(),
    section_name: name,
    activities: [],
  };
}

export function createDefaultMDS(): MDSSingleSlide {
  return {
    title: '',
    project_goal: '',
    key_message: '',
    phases: [],
    rows: [],
    expected_outcomes: [],
  };
}

/** 从里程碑计划自动生成 MDS 表格数据 */
export function createMDSFromPlan(planData: EnhancedMilestonePlanData, clientName: string): MDSSingleSlide {
  const phases: MDSPhaseColumn[] = planData.phases.map(p => ({
    id: p.id,
    phase_name: p.phase_name,
    duration_weeks: p.duration_weeks,
  }));

  const rows: MDSRow[] = [];
  const phaseCount = phases.length;
  if (phaseCount === 0) {
    return {
      title: `项目建议书 — ${clientName}`,
      project_goal: planData.project_goal,
      key_message: planData.success_criteria?.[0] || '',
      phases,
      rows,
      expected_outcomes: planData.success_criteria || [],
    };
  }

  // 按行对齐：取各阶段活动/成果的最大数量，每行横跨所有阶段
  const maxActivities = Math.max(...planData.phases.map(p => (p.key_activities || []).length), 0);
  const maxDeliverables = Math.max(...planData.phases.map(p => (p.deliverables || []).length), 0);

  for (let i = 0; i < maxActivities; i++) {
    rows.push({
      id: uid(),
      type: 'activity',
      cells: planData.phases.map(p => (p.key_activities || [])[i] || ''),
    });
  }

  for (let i = 0; i < maxDeliverables; i++) {
    rows.push({
      id: uid(),
      type: 'deliverable',
      cells: planData.phases.map(p => (p.deliverables || [])[i] || ''),
    });
  }

  return {
    title: `项目建议书 — ${clientName}`,
    project_goal: planData.project_goal,
    key_message: planData.success_criteria?.[0] || '',
    phases,
    rows,
    expected_outcomes: planData.success_criteria || [],
  };
}

export function createDefaultTemplateSelection(): TemplateSelectionData {
  return {
    theme_id: 'blue_professional',
    slide_layouts: [],
  };
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

export function validateStep1(data: EnhancedSmartExtractData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.client_name.trim()) errors.client_name = '请输入客户名称';
  if (!data.industry) errors.industry = '请选择行业类型';
  if (data.industry_background.trim().length < 50)
    errors.industry_background = `行业背景至少需要50字（当前 ${data.industry_background.trim().length} 字）`;
  if (data.company_info.trim().length < 50)
    errors.company_info = `公司介绍至少需要50字（当前 ${data.company_info.trim().length} 字）`;
  const validPains = data.core_pain_points.filter(p => p.description.trim());
  if (validPains.length === 0) errors.core_pain_points = '请至少添加一个核心痛点';
  const validGoals = data.expected_goals.filter(g => g.trim());
  if (validGoals.length === 0) errors.expected_goals = '请至少添加一个项目目标';
  return errors;
}

export function validateStep2(data: EnhancedMilestonePlanData): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!data.project_goal.trim()) errors.project_goal = '请输入项目总体目标';
  if (!data.phases || data.phases.length === 0) errors.phases = '请至少添加一个阶段';
  return errors;
}

// ──────────────────────────────────────────────
// AI response → enhanced data mapping
// ──────────────────────────────────────────────

/** Map backend smart-extract response to EnhancedSmartExtractData */
export function mapExtractResponse(raw: Record<string, unknown>): EnhancedSmartExtractData {
  // Normalize pain_points: could be string[] or [{description, severity}]
  const rawPains = raw.core_pain_points ?? raw.pain_points ?? [];
  const core_pain_points: PainPointItem[] = Array.isArray(rawPains)
    ? rawPains.map((p: unknown) =>
        typeof p === 'string'
          ? createEmptyPainPoint(p)
          : createEmptyPainPoint((p as Record<string, string>)?.description || '')
      )
    : [];

  return {
    client_name: (raw.client_name as string) || '',
    industry: (raw.industry as string) || '',
    company_scale: (raw.company_scale as string) || '',
    industry_background: (raw.industry_background as string) || '',
    company_info: (raw.company_info as string) || '',
    core_pain_points,
    expected_goals: ((raw.expected_goals as string[]) || []).filter(Boolean),
    success_criteria: ((raw.success_criteria as string[]) || []).filter(Boolean),
    other_requirements: (raw.other_requirements as string) || '',
  };
}

/** Map backend milestone_plan response to EnhancedMilestonePlanData */
export function mapPlanResponse(raw: Record<string, unknown>): EnhancedMilestonePlanData {
  const rawPhases = raw.phases ?? [];
  const phases: EnhancedPhase[] = Array.isArray(rawPhases)
    ? rawPhases.map((p: Record<string, unknown>, i: number) => ({
        id: (p.id as string) || uid(),
        phase_name: (p.phase_name as string) || `阶段 ${i + 1}`,
        phase_order: (p.phase_order as number) || i + 1,
        duration_weeks: (p.duration_weeks as number) || (p.time_range ? parseInt(String(p.time_range)) || 2 : 2),
        time_range: (p.time_range as string) || '',
        goals: (p.goals as string) || (p.description as string) || '',
        key_activities: ((p.key_activities as string[]) || []).filter(Boolean),
        deliverables: ((p.deliverables as string[]) || []).filter(Boolean),
      }))
    : [];

  const totalWeeks = phases.reduce((sum, p) => sum + p.duration_weeks, 0);

  return {
    project_goal: (raw.project_goal as string) || '',
    phases,
    success_criteria: ((raw.success_criteria as string[]) || []).filter(Boolean),
    main_tasks: ((raw.main_tasks as string[]) || []).filter(Boolean),
    total_duration_weeks: totalWeeks,
  };
}

/** Adapt EnhancedMilestonePlanData → legacy MilestonePlanResult for Steps 3-5 */
export function adaptPlanToLegacy(data: EnhancedMilestonePlanData): Record<string, unknown> {
  return {
    project_goal: data.project_goal,
    phases: data.phases.map(p => ({
      phase_name: p.phase_name,
      phase_order: p.phase_order,
      time_range: p.time_range || `${p.duration_weeks}周`,
      description: p.goals,
      goals: p.goals,
      deliverables: p.deliverables,
    })),
    success_criteria: data.success_criteria,
  };
}

/** Map backend MDS response → MDSSingleSlide (兼容新旧格式) */
export function mapMDSResponse(raw: Record<string, unknown>): MDSSingleSlide {
  // 新格式: phases + rows
  const rawPhases = raw.phases;
  const rawRows = raw.rows;
  if (Array.isArray(rawPhases) && Array.isArray(rawRows)) {
    return {
      title: (raw.title as string) || '',
      project_goal: (raw.project_goal as string) || '',
      key_message: (raw.key_message as string) || '',
      phases: rawPhases.map((p: Record<string, unknown>) => ({
        id: (p.id as string) || uid(),
        phase_name: (p.phase_name as string) || '',
        duration_weeks: (p.duration_weeks as number) || 0,
      })),
      rows: rawRows.map((r: Record<string, unknown>) => ({
        id: (r.id as string) || uid(),
        type: (r.type as 'activity' | 'deliverable') || 'activity',
        cells: (r.cells as string[]) || [],
      })),
      expected_outcomes: ((raw.expected_outcomes as string[]) || []).filter(Boolean),
    };
  }

  // 旧格式: phases_summary → 转为新格式
  const phasesSummary = raw.phases_summary ?? [];
  const oldPhases: MDSPhaseColumn[] = Array.isArray(phasesSummary)
    ? phasesSummary.map((p: Record<string, unknown>) => ({
        id: uid(),
        phase_name: (p.phase_name as string) || '',
        duration_weeks: (p.duration_weeks as number) || 0,
      }))
    : [];

  return {
    title: (raw.title as string) || '',
    project_goal: (raw.project_goal as string) || '',
    key_message: (raw.key_message as string) || '',
    phases: oldPhases,
    rows: [],
    expected_outcomes: ((raw.expected_outcomes as string[]) || []).filter(Boolean),
  };
}

/** Map backend outline response → DetailedOutlineData (兼容新旧格式) */
export function mapOutlineResponse(raw: Record<string, unknown>): DetailedOutlineData {
  const rawSections = raw.sections ?? [];
  if (!Array.isArray(rawSections)) return { sections: [] };

  return {
    sections: rawSections.map((s: Record<string, unknown>, si: number) => {
      const sectionId = (s.id as string) || uid();
      const sectionName = (s.section_name as string) || `阶段 ${si + 1}`;

      // 新格式: sections[].activities[].slides[]
      const rawActivities = s.activities;
      if (Array.isArray(rawActivities) && rawActivities.length > 0) {
        return {
          id: sectionId,
          section_name: sectionName,
          activities: rawActivities.map((a: Record<string, unknown>) => ({
            id: (a.id as string) || uid(),
            activity_name: (a.activity_name as string) || '',
            slides: Array.isArray(a.slides)
              ? a.slides.map((sl: Record<string, unknown>, sli: number) => ({
                  slide_index: (sl.slide_index as number) || sli + 1,
                  title: (sl.title as string) || `页面 ${sli + 1}`,
                  slide_type: (sl.slide_type as SlideType) || 'content',
                  storyline: (sl.storyline as string) || '',
                  arguments: ((sl.arguments as string[]) || []).filter(Boolean),
                  evidence: ((sl.evidence as string[]) || []).filter(Boolean),
                  supporting_materials: ((sl.supporting_materials as string[]) || []).filter(Boolean),
                }))
              : [],
          })),
        };
      }

      // 旧格式兼容: sections[].slides[] → 包装成单个 activity
      const rawSlides = s.slides ?? [];
      if (Array.isArray(rawSlides) && rawSlides.length > 0) {
        return {
          id: sectionId,
          section_name: sectionName,
          activities: [{
            id: uid(),
            activity_name: sectionName,
            slides: rawSlides.map((sl: Record<string, unknown>, sli: number) => ({
              slide_index: (sl.slide_index as number) || sli + 1,
              title: (sl.title as string) || `页面 ${sli + 1}`,
              slide_type: (sl.slide_type as SlideType) || 'content',
              storyline: (sl.storyline as string) || '',
              arguments: ((sl.arguments as string[]) || []).filter(Boolean),
              evidence: ((sl.evidence as string[]) || []).filter(Boolean),
              supporting_materials: ((sl.supporting_materials as string[]) || []).filter(Boolean),
            })),
          }],
        };
      }

      return { id: sectionId, section_name: sectionName, activities: [] };
    }),
  };
}
