/**
 * Layout Library API Client
 */

import {
  LayoutDefinition,
  LayoutCategory,
  LayoutCreateRequest,
  LayoutUpdateRequest,
} from './layout-types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get all layouts
 */
export async function getLayouts(category?: LayoutCategory): Promise<LayoutDefinition[]> {
  const params = new URLSearchParams();
  if (category) params.append('category', category);

  const response = await fetch(`${API_BASE}/api/layouts?${params}`);
  if (!response.ok) {
    throw new Error('Failed to fetch layouts');
  }
  return response.json();
}

/**
 * Get a single layout by ID
 */
export async function getLayout(id: string): Promise<LayoutDefinition> {
  const response = await fetch(`${API_BASE}/api/layouts/${id}`);
  if (!response.ok) {
    throw new Error('Failed to fetch layout');
  }
  return response.json();
}

/**
 * Create a new layout
 */
export async function createLayout(layout: LayoutCreateRequest): Promise<LayoutDefinition> {
  const response = await fetch(`${API_BASE}/api/layouts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
  if (!response.ok) {
    throw new Error('Failed to create layout');
  }
  return response.json();
}

/**
 * Update an existing layout
 */
export async function updateLayout(id: string, layout: LayoutUpdateRequest): Promise<LayoutDefinition> {
  const response = await fetch(`${API_BASE}/api/layouts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(layout),
  });
  if (!response.ok) {
    throw new Error('Failed to update layout');
  }
  return response.json();
}

/**
 * Delete a layout
 */
export async function deleteLayout(id: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/layouts/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    throw new Error('Failed to delete layout');
  }
}

/**
 * Import a layout from JSON
 */
export async function importLayout(file: File): Promise<LayoutDefinition> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/api/layouts/import`, {
    method: 'POST',
    body: formData,
  });
  if (!response.ok) {
    throw new Error('Failed to import layout');
  }
  return response.json();
}

/**
 * Export a layout as JSON
 */
export async function exportLayout(id: string): Promise<Blob> {
  const response = await fetch(`${API_BASE}/api/layouts/${id}/export`);
  if (!response.ok) {
    throw new Error('Failed to export layout');
  }
  return response.blob();
}

/**
 * Get system preset layouts
 */
export const SYSTEM_LAYOUTS: LayoutDefinition[] = [
  // SWOT Matrix
  {
    id: 'swot-matrix',
    name: 'SWOT 矩阵',
    category: 'MATRIX',
    description: '战略分析四象限矩阵，分析优势、劣势、机会、威胁',
    thumbnail: '',
    nodes: [
      { id: 'title', type: 'text', position: { x: 200, y: 0 }, data: { label: 'SWOT 分析', placeholder: '输入标题' } },
      { id: 'q1', type: 'shape', position: { x: 0, y: 60 }, data: { label: 'S', placeholder: '优势 Strengths', style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 180, height: 120 } } },
      { id: 'q2', type: 'shape', position: { x: 200, y: 60 }, data: { label: 'W', placeholder: '劣势 Weaknesses', style: { backgroundColor: '#fef3c7', borderColor: '#d97706', width: 180, height: 120 } } },
      { id: 'q3', type: 'shape', position: { x: 0, y: 200 }, data: { label: 'O', placeholder: '机会 Opportunities', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 180, height: 120 } } },
      { id: 'q4', type: 'shape', position: { x: 200, y: 200 }, data: { label: 'T', placeholder: '威胁 Threats', style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 180, height: 120 } } },
    ],
    edges: [],
    slots: [
      { id: 'title', nodeId: 'title', type: 'title', placeholder: 'SWOT 分析标题', required: true },
      { id: 'q1', nodeId: 'q1', type: 'content', placeholder: '输入优势' },
      { id: 'q2', nodeId: 'q2', type: 'content', placeholder: '输入劣势' },
      { id: 'q3', nodeId: 'q3', type: 'content', placeholder: '输入机会' },
      { id: 'q4', nodeId: 'q4', type: 'content', placeholder: '输入威胁' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  // 3-Step Process
  {
    id: 'process-3-step',
    name: '三步流程',
    category: 'PROCESS',
    description: '横向三步流程展示',
    thumbnail: '',
    nodes: [
      { id: 'step1', type: 'shape', position: { x: 0, y: 100 }, data: { label: '步骤 1', placeholder: '第一步', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 120, height: 80, borderRadius: 8 } } },
      { id: 'step2', type: 'shape', position: { x: 160, y: 100 }, data: { label: '步骤 2', placeholder: '第二步', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 120, height: 80, borderRadius: 8 } } },
      { id: 'step3', type: 'shape', position: { x: 320, y: 100 }, data: { label: '步骤 3', placeholder: '第三步', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 120, height: 80, borderRadius: 8 } } },
    ],
    edges: [
      { id: 'e1-2', source: 'step1', target: 'step2', type: 'default', animated: true },
      { id: 'e2-3', source: 'step2', target: 'step3', type: 'default', animated: true },
    ],
    slots: [
      { id: 'step1', nodeId: 'step1', type: 'content', placeholder: '步骤1内容' },
      { id: 'step2', nodeId: 'step2', type: 'content', placeholder: '步骤2内容' },
      { id: 'step3', nodeId: 'step3', type: 'content', placeholder: '步骤3内容' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  // Pyramid
  {
    id: 'pyramid-3-level',
    name: '三层金字塔',
    category: 'PYRAMID',
    description: '三层金字塔结构，适合展示层级关系',
    thumbnail: '',
    nodes: [
      { id: 'level1', type: 'shape', position: { x: 160, y: 0 }, data: { label: '顶层', placeholder: '战略层', style: { backgroundColor: '#fef3c7', borderColor: '#d97706', width: 120, height: 50, borderRadius: 4 } } },
      { id: 'level2', type: 'shape', position: { x: 100, y: 70 }, data: { label: '中层', placeholder: '战术层', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 240, height: 50, borderRadius: 4 } } },
      { id: 'level3', type: 'shape', position: { x: 40, y: 140 }, data: { label: '底层', placeholder: '执行层', style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 360, height: 50, borderRadius: 4 } } },
    ],
    edges: [],
    slots: [
      { id: 'level1', nodeId: 'level1', type: 'content', placeholder: '顶层内容' },
      { id: 'level2', nodeId: 'level2', type: 'content', placeholder: '中层内容' },
      { id: 'level3', nodeId: 'level3', type: 'content', placeholder: '底层内容' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  // Before/After Comparison
  {
    id: 'comparison-before-after',
    name: '前后对比',
    category: 'COMPARISON',
    description: '变革前后对比展示',
    thumbnail: '',
    nodes: [
      { id: 'before', type: 'shape', position: { x: 0, y: 60 }, data: { label: '现状', placeholder: '变革前', style: { backgroundColor: '#fee2e2', borderColor: '#dc2626', width: 180, height: 150, borderRadius: 8 } } },
      { id: 'arrow', type: 'text', position: { x: 200, y: 120 }, data: { label: '→', style: { fontSize: 32 } } },
      { id: 'after', type: 'shape', position: { x: 240, y: 60 }, data: { label: '未来', placeholder: '变革后', style: { backgroundColor: '#dcfce7', borderColor: '#16a34a', width: 180, height: 150, borderRadius: 8 } } },
    ],
    edges: [],
    slots: [
      { id: 'before', nodeId: 'before', type: 'content', placeholder: '现状描述' },
      { id: 'after', nodeId: 'after', type: 'content', placeholder: '未来描述' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  // Radar Chart (simplified)
  {
    id: 'radar-5d',
    name: '五维雷达',
    category: 'RADAR',
    description: '五维度评估雷达图',
    thumbnail: '',
    nodes: [
      { id: 'center', type: 'shape', position: { x: 180, y: 140 }, data: { label: '', style: { backgroundColor: 'transparent', borderColor: '#6b7280', width: 2, height: 2, borderRadius: 50 } } },
      { id: 'd1', type: 'text', position: { x: 180, y: 0 }, data: { label: '维度1', placeholder: '战略' } },
      { id: 'd2', type: 'text', position: { x: 320, y: 80 }, data: { label: '维度2', placeholder: '组织' } },
      { id: 'd3', type: 'text', position: { x: 280, y: 260 }, data: { label: '维度3', placeholder: '绩效' } },
      { id: 'd4', type: 'text', position: { x: 80, y: 260 }, data: { label: '维度4', placeholder: '薪酬' } },
      { id: 'd5', type: 'text', position: { x: 40, y: 80 }, data: { label: '维度5', placeholder: '人才' } },
    ],
    edges: [
      { id: 'e-c1', source: 'center', target: 'd1', type: 'straight' },
      { id: 'e-c2', source: 'center', target: 'd2', type: 'straight' },
      { id: 'e-c3', source: 'center', target: 'd3', type: 'straight' },
      { id: 'e-c4', source: 'center', target: 'd4', type: 'straight' },
      { id: 'e-c5', source: 'center', target: 'd5', type: 'straight' },
    ],
    slots: [
      { id: 'd1', nodeId: 'd1', type: 'content', placeholder: '维度1' },
      { id: 'd2', nodeId: 'd2', type: 'content', placeholder: '维度2' },
      { id: 'd3', nodeId: 'd3', type: 'content', placeholder: '维度3' },
      { id: 'd4', nodeId: 'd4', type: 'content', placeholder: '维度4' },
      { id: 'd5', nodeId: 'd5', type: 'content', placeholder: '维度5' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
  // Timeline
  {
    id: 'timeline-milestone',
    name: '里程碑时间线',
    category: 'TIMELINE',
    description: '项目里程碑时间线',
    thumbnail: '',
    nodes: [
      { id: 'm1', type: 'shape', position: { x: 0, y: 100 }, data: { label: '里程碑1', placeholder: 'Q1', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 80, height: 40, borderRadius: 20 } } },
      { id: 'm2', type: 'shape', position: { x: 120, y: 100 }, data: { label: '里程碑2', placeholder: 'Q2', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 80, height: 40, borderRadius: 20 } } },
      { id: 'm3', type: 'shape', position: { x: 240, y: 100 }, data: { label: '里程碑3', placeholder: 'Q3', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 80, height: 40, borderRadius: 20 } } },
      { id: 'm4', type: 'shape', position: { x: 360, y: 100 }, data: { label: '里程碑4', placeholder: 'Q4', style: { backgroundColor: '#dbeafe', borderColor: '#2563eb', width: 80, height: 40, borderRadius: 20 } } },
    ],
    edges: [
      { id: 'e-1-2', source: 'm1', target: 'm2', type: 'straight' },
      { id: 'e-2-3', source: 'm2', target: 'm3', type: 'straight' },
      { id: 'e-3-4', source: 'm3', target: 'm4', type: 'straight' },
    ],
    slots: [
      { id: 'm1', nodeId: 'm1', type: 'content', placeholder: '里程碑1' },
      { id: 'm2', nodeId: 'm2', type: 'content', placeholder: '里程碑2' },
      { id: 'm3', nodeId: 'm3', type: 'content', placeholder: '里程碑3' },
      { id: 'm4', nodeId: 'm4', type: 'content', placeholder: '里程碑4' },
    ],
    isSystem: true,
    createdAt: '2026-03-21T00:00:00Z',
    updatedAt: '2026-03-21T00:00:00Z',
  },
];
