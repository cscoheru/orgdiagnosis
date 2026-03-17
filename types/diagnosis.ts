/**
 * 五维组织诊断模型 - TypeScript 类型定义
 * Based on IBM/华为 BLM (Business Leading Model)
 */

// ============================================
// L3 层级：最细颗粒度的评估项
// ============================================

export interface L3Item {
  /** 评分 0-100 */
  score: number;
  /** 原文证据 */
  evidence: string;
  /** 置信度 */
  confidence: 'high' | 'medium' | 'low';
  /** 备注 */
  notes?: string;
}

// ============================================
// L2 层级：子维度
// ============================================

export interface L2Category {
  /** L2 维度标签 */
  label?: string;
  /** L2 维度评分 (由 L3 聚合) */
  score: number;
  /** L3 评估项 */
  L3_items: Record<string, L3Item>;
}

// ============================================
// L1 层级：五大维度
// ============================================

export interface DimensionData {
  /** 维度名称 */
  label: string;
  /** 维度描述 */
  description?: string;
  /** 维度总分 (由 L2 聚合) */
  score: number;
  /** L2 子维度 */
  L2_categories: Record<string, L2Category>;
}

// ============================================
// 完整的五维诊断数据
// ============================================

export interface FiveDimensionsData {
  strategy: DimensionData;
  structure: DimensionData;
  performance: DimensionData;
  compensation: DimensionData;
  talent: DimensionData;
  /** 整体健康度 (加权平均) */
  overall_score: number;
}

// ============================================
// 诊断会话
// ============================================

export interface DiagnosisSession {
  id: string;
  client_id: string;
  created_by: string;
  /** 原始输入文本 */
  raw_input: string;
  /** 五维数据 */
  data: FiveDimensionsData;
  /** 创建时间 */
  created_at: string;
  /** 更新时间 */
  updated_at: string;
}

// ============================================
// 客户信息
// ============================================

export interface Client {
  id: string;
  name: string;
  industry?: string;
  employee_count?: number;
  created_by: string;
  created_at: string;
}

// ============================================
// 用户档案
// ============================================

export interface Profile {
  id: string;
  name?: string;
  role: 'consultant' | 'admin';
  created_at: string;
}

// ============================================
// AI 抽取结果
// ============================================

export interface ExtractionResult {
  success: boolean;
  data?: FiveDimensionsData;
  error?: string;
  /** AI 处理耗时 (ms) */
  processing_time?: number;
}

// ============================================
// API 请求/响应类型
// ============================================

export interface ExtractRequest {
  text: string;
  client_id?: string;
}

export interface ExtractResponse {
  success: boolean;
  session_id?: string;
  data?: FiveDimensionsData;
  error?: string;
}

// ============================================
// 图表数据类型
// ============================================

export interface RadarChartData {
  dimension: string;
  score: number;
  fullMark: number;
}

export interface BarChartData {
  name: string;
  score: number;
  category: string;
}

export interface WarningItem {
  name: string;
  label: string;
  score: number;
  status: 'danger' | 'warning' | 'success';
  evidence: string;
}

// ============================================
// 维度键类型 (用于类型安全的访问)
// ============================================

export type DimensionKey = 'strategy' | 'structure' | 'performance' | 'compensation' | 'talent';

export const DIMENSION_KEYS: DimensionKey[] = [
  'strategy',
  'structure',
  'performance',
  'compensation',
  'talent'
];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  strategy: '战略',
  structure: '组织',
  performance: '绩效',
  compensation: '薪酬',
  talent: '人才'
};

// ============================================
// 评分等级
// ============================================

export function getScoreLevel(score: number): 'danger' | 'warning' | 'success' {
  if (score < 50) return 'danger';
  if (score < 70) return 'warning';
  return 'success';
}

export function getScoreColor(score: number): string {
  if (score < 50) return '#ef4444'; // red
  if (score < 70) return '#f59e0b'; // yellow
  return '#22c55e'; // green
}
