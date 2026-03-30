/**
 * Competency Co-pilot — 类型定义
 *
 * v2.0: 种子列表验证 + 新发现扩充模式
 */

export type OriginType = 'seed' | 'discovered';
export type BehaviorLevel = '初级' | '中级' | '高级';
export type ModelType = 'delivery_management' | 'business_management';
export type ResourceType = '书籍' | '视频' | '在线课程' | '案例库' | '工具' | '模板';

/** 模型定义 */
export interface ModelDef {
  label: string;
  order: number;
  seeds: string[];
}

/** 学习资源 */
export interface LearningResource {
  title: string;
  type: ResourceType;
  target_level: BehaviorLevel;
  rationale: string;
  code?: string;
}

/** 关键行为 */
export interface Behavior {
  id: string;
  code?: string;
  description: string;
  level: BehaviorLevel;
}

/** 二级能力项 */
export interface SecondaryTerm {
  id: string;
  code?: string;
  term: string;
  description?: string;
  behaviors: Behavior[];
}

/** 一级能力项 */
export interface CompetencyTerm {
  id: string;
  code?: string;
  term: string;
  description?: string;
  score: number;
  origin: OriginType;
  model: ModelType;
  sources: string[];
  secondary_terms: SecondaryTerm[];
  resources?: LearningResource[];
}

/** 预计算输出结构 */
export interface CompetencyOutput {
  meta: {
    generated_at: string;
    source_count: number;
    seed_count: number;
    models: Record<string, { label: string; order: number }>;
  };
  competencies: CompetencyTerm[];
}

/** 专家确认的最终模型 */
export interface FinalModel {
  confirmed_at: string;
  l1_terms: Record<ModelType, string[]>;
  l2_terms: Record<string, Record<string, string[]>>;
  behaviors: Record<string, Record<string, string[]>>;
  resources: string[];
}

/** AI 原始输出 (FR-1.2) */
export interface RawCompetencyItem {
  term: string;
  score: number;
  origin: OriginType;
  sources: string[];
}

/** AI 原始输出 (FR-1.3) */
export interface RawSecondaryItem {
  term: string;
}

/** AI 原始输出 (FR-1.4) */
export interface RawBehaviorItem {
  description: string;
  level: BehaviorLevel;
}

/** 种子列表配置 */
export interface SeedConfig {
  models: Record<string, ModelDef>;
  all_seeds: string[];
}

/** 源材料 */
export interface SourceMaterial {
  source: string;
  content: string;
}

/** 工厂函数 */
export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function createEmptyCompetency(term: string, origin: OriginType, model: ModelType = 'delivery_management'): CompetencyTerm {
  return {
    id: `comp_${uid()}`,
    term,
    score: 0,
    origin,
    model,
    sources: [],
    secondary_terms: [],
  };
}
