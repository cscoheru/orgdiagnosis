/**
 * Layout Library Types
 *
 * Layout = 智能图形，将零散信息结构化的视觉模型
 * 类似 PowerPoint SmartArt
 */

export type LayoutCategory =
  | 'MATRIX'      // 矩阵：SWOT, BCG, 优先级
  | 'PROCESS'     // 流程：步骤、环节
  | 'PYRAMID'     // 金字塔：层级、组织
  | 'RADAR'       // 雷达图：多维度评估
  | 'COMPARISON'  // 对比：前后、方案比较
  | 'TIMELINE'    // 时间线：里程碑、甘特
  | 'ORG_CHART'   // 组织架构图
  | 'CUSTOM';     // 自定义

export interface LayoutNode {
  id: string;
  type: 'text' | 'shape' | 'image' | 'slot';
  position: { x: number; y: number };
  data: {
    label: string;
    placeholder?: string;
    style?: {
      backgroundColor?: string;
      borderColor?: string;
      textColor?: string;
      fontSize?: number;
      fontWeight?: string;
      width?: number;
      height?: number;
      borderRadius?: number;
    };
  };
}

export interface LayoutEdge {
  id: string;
  source: string;
  target: string;
  type?: 'default' | 'step' | 'smoothstep' | 'straight' | 'bezier';
  animated?: boolean;
  label?: string;
}

export interface LayoutSlot {
  id: string;
  nodeId: string;
  type: 'title' | 'content' | 'image';
  placeholder: string;
  maxLength?: number;
  required?: boolean;
}

export interface LayoutDefinition {
  id: string;
  name: string;
  category: LayoutCategory;
  description: string;
  thumbnail?: string;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  slots: LayoutSlot[];
  isSystem?: boolean;  // 系统预置
  createdAt: string;
  updatedAt: string;
}

export interface LayoutCreateRequest {
  name: string;
  category: LayoutCategory;
  description: string;
  nodes: LayoutNode[];
  edges: LayoutEdge[];
  slots: LayoutSlot[];
}

export interface LayoutUpdateRequest {
  name?: string;
  category?: LayoutCategory;
  description?: string;
  nodes?: LayoutNode[];
  edges?: LayoutEdge[];
  slots?: LayoutSlot[];
  thumbnail?: string;
}

// Category labels for UI
export const LAYOUT_CATEGORY_LABELS: Record<LayoutCategory, string> = {
  MATRIX: '矩阵',
  PROCESS: '流程',
  PYRAMID: '金字塔',
  RADAR: '雷达图',
  COMPARISON: '对比',
  TIMELINE: '时间线',
  ORG_CHART: '组织架构',
  CUSTOM: '自定义',
};

// Category icons for UI
export const LAYOUT_CATEGORY_ICONS: Record<LayoutCategory, string> = {
  MATRIX: '⊞',
  PROCESS: '→',
  PYRAMID: '△',
  RADAR: '◎',
  COMPARISON: '⟷',
  TIMELINE: '―',
  ORG_CHART: ' organizer',
  CUSTOM: '✧',
};
