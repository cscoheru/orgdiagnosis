/**
 * 可靠文件上传工具
 * 调用 Render 后端 API 处理文件
 */

import { uploadFile } from './api-config';

export interface UploadResult {
  success: boolean;
  text: string;
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    processingTime: number;
    isOCR?: boolean;
    retryCount?: number;
  };
}

export interface UploadOptions {
  maxRetries?: number;
  retryDelay?: number;
  onProgress?: (progress: number, status: string) => void;
  onRetry?: (attempt: number, error: string) => void;
}

/**
 * 可靠文件上传
 */
export async function reliableFileUpload(
  file: File,
  options: UploadOptions = {}
): Promise<UploadResult> {
  const {
    maxRetries = 3,
    retryDelay = 1500,
    onProgress,
    onRetry,
  } = options;

  const startTime = Date.now();
  let lastError = '';
  let retryCount = 0;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      onProgress?.(10, '正在上传文件...');

      // 调用后端 API
      const result = await uploadFile(file);

      onProgress?.(90, '处理完成');

      if (result.success) {
        onProgress?.(100, '上传成功');
        return {
          success: true,
          text: result.text,
          metadata: {
            fileName: result.metadata?.fileName || file.name,
            fileSize: result.metadata?.fileSize || file.size,
            fileType: result.metadata?.fileType || file.name.split('.').pop() || '',
            processingTime: Date.now() - startTime,
            isOCR: result.metadata?.isOCR || false,
            retryCount: attempt,
          },
        };
      }

      lastError = result.error || '上传失败';

      // 重试
      if (attempt < maxRetries) {
        retryCount++;
        onRetry?.(retryCount, lastError);
        onProgress?.(0, `上传失败，正在重试 (${retryCount}/${maxRetries})...`);

        // 等待后重试
        await sleep(retryDelay * (attempt + 1));
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : '未知错误';

      if (attempt < maxRetries) {
        retryCount++;
        onRetry?.(retryCount, lastError);
        await sleep(retryDelay * (attempt + 1));
      }
    }
  }

  return {
    success: false,
    text: '',
    error: `上传失败 (${retryCount} 次重试后): ${lastError}`,
    metadata: {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.name.split('.').pop() || '',
      processingTime: Date.now() - startTime,
      retryCount,
    },
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查文件类型是否支持
 */
export function isFileSupported(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const supportedTypes = ['txt', 'md', 'csv', 'json', 'pdf'];
  return supportedTypes.includes(ext);
}

/**
 * 获取支持的文件类型描述
 */
export function getSupportedFileTypes(): string {
  return '.txt, .md, .csv, .json, .pdf';
}
