/**
 * Knowledge Base V2 API Client
 *
 * 知识库V2前端API客户端
 * 基于SQLite + FTS5，无向量
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// ==================== Types ====================

export interface Project {
  id: string;
  name: string;
  code?: string;
  description?: string;
  client_name?: string;
  client_industry?: string;
  project_type?: string;
  status?: string;
  document_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Document {
  id: string;
  filename: string;
  file_type: string;
  file_size?: number;
  file_path?: string;
  title?: string;
  author?: string;
  page_count: number;
  project_id?: string;
  dimension_l1?: string;
  dimension_l2?: string;
  dimension_l3?: string;
  confidence?: number;
  uploaded_at?: string;
}

export interface Page {
  id: string;
  document_id: string;
  page_number: number;
  content: string;
  highlighted_content?: string;
  sections?: any[];
}

export interface SearchResult {
  page_id: string;
  document_id: string;
  page_number: number;
  content: string;
  highlighted_content?: string;
  filename: string;
  document_title?: string;
  project_id?: string;
  project_name?: string;
  dimension: {
    l1?: string;
    l2?: string;
    l3?: string;
    confidence?: number;
  };
  rank: number;
}

export interface SearchResponse {
  query: string;
  total: number;
  results: SearchResult[];
  filters?: Record<string, string>;
}

export interface Dimension {
  id: string;
  code: string;
  name: string;
  description?: string;
  level: number;
  parent_id?: string;
  children?: Dimension[];
}

export interface KBStats {
  total_projects: number;
  total_documents: number;
  total_pages: number;
  by_dimension?: Record<string, number>;
}

// ==================== API Functions ====================

/**
 * 获取项目列表
 */
export async function getProjects(status?: string, limit: number = 100): Promise<Project[]> {
  const params = new URLSearchParams();
  if (status) params.append('status', status);
  params.append('limit', String(limit));

  const response = await fetch(`${API_BASE}/api/knowledge/projects?${params}`);
  if (!response.ok) throw new Error('获取项目列表失败');

  const data = await response.json();
  return data.projects || [];
}

/**
 * 创建项目
 */
export async function createProject(project: Partial<Project>): Promise<string> {
  const response = await fetch(`${API_BASE}/api/knowledge/projects`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project)
  });
  if (!response.ok) throw new Error('创建项目失败');

  const data = await response.json();
  return data.project_id;
}

/**
 * 获取项目详情
 */
export async function getProject(projectId: string): Promise<Project> {
  const response = await fetch(`${API_BASE}/api/knowledge/projects/${projectId}`);
  if (!response.ok) throw new Error('获取项目详情失败');
  return response.json();
}

/**
 * 上传文档
 */
export async function uploadDocument(
  file: File,
  options?: {
    project_id?: string;
    auto_classify?: boolean;
    use_ai?: boolean;
  }
): Promise<{ document_id: string; filename: string; page_count: number; classification: any }> {
  const formData = new FormData();
  formData.append('file', file);
  if (options?.project_id) formData.append('project_id', options.project_id);
  formData.append('auto_classify', String(options?.auto_classify ?? true));
  formData.append('use_ai', String(options?.use_ai ?? false));

  const response = await fetch(`${API_BASE}/api/knowledge/documents/upload`, {
    method: 'POST',
    body: formData
  });
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || '上传文档失败');
  }

  return response.json();
}

/**
 * 获取文档列表
 */
export async function getDocuments(options?: {
  project_id?: string;
  dimension_l1?: string;
  limit?: number;
  offset?: number;
}): Promise<Document[]> {
  const params = new URLSearchParams();
  if (options?.project_id) params.append('project_id', options.project_id);
  if (options?.dimension_l1) params.append('dimension_l1', options.dimension_l1);
  if (options?.limit) params.append('limit', String(options.limit));
  if (options?.offset) params.append('offset', String(options.offset));

  const response = await fetch(`${API_BASE}/api/knowledge/documents?${params}`);
  if (!response.ok) throw new Error('获取文档列表失败');

  const data = await response.json();
  return data.documents || [];
}

/**
 * 获取文档详情
 */
export async function getDocument(docId: string): Promise<Document & { pages: Page[]; classification?: any }> {
  const response = await fetch(`${API_BASE}/api/knowledge/documents/${docId}`);
  if (!response.ok) throw new Error('获取文档详情失败');
  return response.json();
}

/**
 * 删除文档
 */
export async function deleteDocument(docId: string): Promise<void> {
  const response = await fetch(`${API_BASE}/api/knowledge/documents/${docId}`, {
    method: 'DELETE'
  });
  if (!response.ok) throw new Error('删除文档失败');
}

/**
 * 全文搜索
 */
export async function search(options: {
  query: string;
  project_id?: string;
  dimension_l1?: string;
  dimension_l2?: string;
  dimension_l3?: string;
  limit?: number;
}): Promise<SearchResponse> {
  const params = new URLSearchParams();
  params.append('q', options.query);
  if (options.project_id) params.append('project_id', options.project_id);
  if (options.dimension_l1) params.append('dimension_l1', options.dimension_l1);
  if (options.dimension_l2) params.append('dimension_l2', options.dimension_l2);
  if (options.dimension_l3) params.append('dimension_l3', options.dimension_l3);
  if (options.limit) params.append('limit', String(options.limit));

  const response = await fetch(`${API_BASE}/api/knowledge/search?${params}`);
  if (!response.ok) throw new Error('搜索失败');
  return response.json();
}

/**
 * 按维度筛选
 */
export async function searchByDimension(options: {
  l1?: string;
  l2?: string;
  l3?: string;
  q?: string;
  limit?: number;
}): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (options.l1) params.append('l1', options.l1);
  if (options.l2) params.append('l2', options.l2);
  if (options.l3) params.append('l3', options.l3);
  if (options.q) params.append('q', options.q);
  if (options.limit) params.append('limit', String(options.limit));

  const response = await fetch(`${API_BASE}/api/knowledge/search/by-dimension?${params}`);
  if (!response.ok) throw new Error('按维度筛选失败');
  return response.json();
}

/**
 * 获取五维分类树
 */
export async function getDimensions(): Promise<Dimension[]> {
  const response = await fetch(`${API_BASE}/api/knowledge/dimensions`);
  if (!response.ok) throw new Error('获取分类树失败');

  const data = await response.json();
  return data.dimensions || [];
}

/**
 * 获取L1维度列表
 */
export async function getL1Dimensions(): Promise<Dimension[]> {
  const response = await fetch(`${API_BASE}/api/knowledge/dimensions/l1`);
  if (!response.ok) throw new Error('获取L1维度失败');

  const data = await response.json();
  return data.dimensions || [];
}

/**
 * 获取知识库统计
 */
export async function getKBStats(): Promise<KBStats> {
  const response = await fetch(`${API_BASE}/api/knowledge/stats`);
  if (!response.ok) throw new Error('获取统计信息失败');
  return response.json();
}

// ==================== Helper Functions ====================

/**
 * 获取维度名称
 */
export function getDimensionName(code: string): string {
  const names: Record<string, string> = {
    'strategy': '战略',
    'structure': '组织',
    'performance': '绩效',
    'compensation': '薪酬',
    'talent': '人才'
  };
  return names[code] || code;
}

/**
 * 获取维度颜色
 */
export function getDimensionColor(code: string): string {
  const colors: Record<string, string> = {
    'strategy': 'bg-blue-100 text-blue-700 border-blue-200',
    'structure': 'bg-purple-100 text-purple-700 border-purple-200',
    'performance': 'bg-green-100 text-green-700 border-green-200',
    'compensation': 'bg-orange-100 text-orange-700 border-orange-200',
    'talent': 'bg-pink-100 text-pink-700 border-pink-200'
  };
  return colors[code] || 'bg-gray-100 text-gray-700 border-gray-200';
}

/**
 * 获取维度图标
 */
export function getDimensionIcon(code: string): string {
  const icons: Record<string, string> = {
    'strategy': '🎯',
    'structure': '🏢',
    'performance': '📊',
    'compensation': '💰',
    'talent': '👥'
  };
  return icons[code] || '📁';
}
