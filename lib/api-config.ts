/**
 * API 配置
 * 根据环境自动切换 API 地址
 */

// API 基础地址
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * 文件上传
 */
export async function uploadFile(file: File): Promise<{
  success: boolean;
  text: string;
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    isOCR?: boolean;
  };
}> {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        text: '',
        error: `服务器错误: ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * AI 文本分析
 */
export async function analyzeText(text: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
  processing_time?: number;
}> {
  try {
    // AI 分析可能需要较长时间，设置 3 分钟超时
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 180000); // 3 分钟

    const response = await fetch(`${API_BASE_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        error: `服务器错误: ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        error: '分析超时，请稍后重试',
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 创建诊断记录
 */
export async function createDiagnosis(rawInput: string, data: any): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diagnosis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raw_input: rawInput, data }),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `服务器错误: ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 获取诊断记录
 */
export async function getDiagnosis(sessionId: string): Promise<{
  success: boolean;
  data?: any;
  error?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/diagnosis/${sessionId}`);

    if (!response.ok) {
      return {
        success: false,
        error: `服务器错误: ${response.status}`,
      };
    }

    return await response.json();
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 导出 PDF
 */
export function exportPDF(sessionId: string): void {
  window.open(`${API_BASE_URL}/api/export/${sessionId}`, '_blank');
}

/**
 * 获取历史记录
 */
export async function getDiagnosisHistory(limit = 20, offset = 0): Promise<any[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/api/diagnosis?limit=${limit}&offset=${offset}`
    );

    if (!response.ok) {
      return [];
    }

    return await response.json();
  } catch (error) {
    return [];
  }
}
