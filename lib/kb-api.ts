/**
 * Knowledge Base API Client
 *
 * Provides functions for interacting with the knowledge base backend API.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// API path for knowledge base
const KB_API = `${API_BASE}/api/kb`;

// ============================================================================
// Types
// ============================================================================

export interface KBStats {
  overview: {
    total_documents: number;
    total_chunks: number;
    storage_size_mb: number;
    last_updated: string;
  };
  distribution: {
    by_category: Record<string, number>;
    by_file_type: Record<string, number>;
  };
  quality: {
    avg_chunk_size: number;
    coverage_score: number;
    duplicate_rate: number;
    completeness: number;
  };
  system: {
    embedding_model: string;
    embedding_dimensions: number;
    chunk_config: {
      size: number;
      overlap: number;
    };
  };
}

export interface Document {
  id: string;
  file_name: string;
  category: string;
  file_type: string;
  file_size_kb: number;
  chunk_count: number;
  status: 'pending' | 'processing' | 'ready' | 'error';
  uploaded_at: string;
  processed_at: string | null;
  quality_score: number | null;
  preview: string | null;
}

export interface DocumentList {
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

export interface UploadResponse {
  task_id: string;
  status: string;
  message: string;
}

export interface UploadStatus {
  task_id: string;
  status: 'processing' | 'completed' | 'failed';
  progress: number;
  document_id: string | null;
  chunks_created: number | null;
  error: string | null;
}

export interface SearchResult {
  chunk_id: string;
  document_id: string;
  file_name: string;
  content: string;
  score: number;
  category: string;
  metadata: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  query_time_ms: number;
  total_results: number;
}

export interface Category {
  id: string;
  name: string;
  count: number;
}

export interface QualityReport {
  overall_score: number;
  dimensions: {
    coverage: {
      score: number;
      details: Record<string, string>;
      recommendations: string[];
    };
    freshness: {
      score: number;
      recommendations: string[];
    };
    completeness: {
      score: number;
      recommendations: string[];
    };
    redundancy: {
      score: number;
      recommendations: string[];
    };
  };
  suggestions: Array<{
    priority: string;
    action: string;
    reason: string;
  }>;
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * Get knowledge base statistics
 */
export async function getKBStats(): Promise<KBStats> {
  const response = await fetch(`${KB_API}/stats`);
  if (!response.ok) {
    throw new Error(`Failed to get stats: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get document list with pagination and filters
 */
export async function getDocuments(params?: {
  page?: number;
  limit?: number;
  category?: string;
  status?: string;
  search?: string;
}): Promise<DocumentList> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', params.page.toString());
  if (params?.limit) searchParams.set('limit', params.limit.toString());
  if (params?.category) searchParams.set('category', params.category);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.search) searchParams.set('search', params.search);

  const response = await fetch(`${KB_API}/documents?${searchParams.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to get documents: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get single document by ID
 */
export async function getDocument(docId: string): Promise<Document> {
  const response = await fetch(`${KB_API}/documents/${docId}`);
  if (!response.ok) {
    throw new Error(`Failed to get document: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Upload a document
 */
export async function uploadDocument(
  file: File,
  category?: string,
  onProgress?: (progress: number) => void
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (category) {
    formData.append('category', category);
  }

  const response = await fetch(`${KB_API}/documents/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload document: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get upload status (for polling)
 */
export async function getUploadStatus(uploadId: string): Promise<UploadStatus> {
  const response = await fetch(`${KB_API}/documents/upload/${uploadId}`);
  if (!response.ok) {
    throw new Error(`Failed to get upload status: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Delete a document
 */
export async function deleteDocument(docId: string): Promise<{ success: boolean }> {
  const response = await fetch(`${KB_API}/documents/${docId}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Failed to delete document: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Search knowledge base
 */
export async function searchKB(params: {
  query: string;
  category?: string;
  top_k?: number;
}): Promise<SearchResponse> {
  const searchParams = new URLSearchParams();
  searchParams.set('query', params.query);
  if (params.category) searchParams.set('category', params.category);
  if (params.top_k) searchParams.set('top_k', params.top_k.toString());

  const response = await fetch(`${KB_API}/search?${searchParams.toString()}`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to search: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get category list
 */
export async function getCategories(): Promise<Category[]> {
  const response = await fetch(`${KB_API}/categories`);
  if (!response.ok) {
    throw new Error(`Failed to get categories: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Get quality report
 */
export async function getQualityReport(): Promise<QualityReport> {
  const response = await fetch(`${KB_API}/quality`);
  if (!response.ok) {
    throw new Error(`Failed to get quality report: ${response.statusText}`);
  }
  return response.json();
}

/**
 * Health check
 */
export async function kbHealthCheck(): Promise<{ status: string; service: string }> {
  const response = await fetch(`${KB_API}/health`);
  if (!response.ok) {
    throw new Error(`Health check failed: ${response.statusText}`);
  }
  return response.json();
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format file size for display
 */
export function formatFileSize(kb: number): string {
  if (kb < 1024) {
    return `${kb} KB`;
  } else if (kb < 1024 * 1024) {
    return `${(kb / 1024).toFixed(1)} MB`;
  } else {
    return `${(kb / 1024 / 1024).toFixed(2)} GB`;
  }
}

/**
 * Get status display text and color
 */
export function getStatusConfig(status: Document['status']): {
  text: string;
  color: string;
  icon: string;
} {
  const configs = {
    pending: { text: '等待中', color: 'text-gray-500', icon: '⏳' },
    processing: { text: '处理中', color: 'text-blue-500', icon: '🔄' },
    ready: { text: '就绪', color: 'text-green-500', icon: '✅' },
    error: { text: '错误', color: 'text-red-500', icon: '❌' },
  };
  return configs[status];
}

/**
 * Get category display name
 */
export function getCategoryName(categoryId: string): string {
  const names: Record<string, string> = {
    strategy: '战略规划',
    hr: '人力资源',
    performance: '绩效管理',
    compensation: '薪酬激励',
    talent: '人才管理',
    finance: '财务管理',
    operations: '运营管理',
    general: '通用',
  };
  return names[categoryId] || categoryId;
}

/**
 * Get file type icon
 */
export function getFileTypeIcon(fileType: string): string {
  const icons: Record<string, string> = {
    pdf: '📄',
    docx: '📝',
    pptx: '📊',
    md: '📑',
    txt: '📃',
  };
  return icons[fileType] || '📁';
}

/**
 * Poll upload status until completion
 */
export async function pollUploadStatus(
  uploadId: string,
  onComplete: (status: UploadStatus) => void,
  onError: (error: string) => void,
  intervalMs: number = 2000,
  maxAttempts: number = 60
): Promise<void> {
  let attempts = 0;

  const poll = async () => {
    try {
      const status = await getUploadStatus(uploadId);

      if (status.status === 'completed') {
        onComplete(status);
      } else if (status.status === 'failed') {
        onError(status.error || 'Upload failed');
      } else if (attempts < maxAttempts) {
        attempts++;
        setTimeout(poll, intervalMs);
      } else {
        onError('Upload timed out');
      }
    } catch (error) {
      onError(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  await poll();
}
