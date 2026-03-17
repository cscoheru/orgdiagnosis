/**
 * 可靠文件上传工具
 * - 客户端优先处理（避免服务器超时）
 * - 重试机制
 * - 进度反馈
 * - 错误恢复
 */

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
    retryDelay = 1000,
    onProgress,
    onRetry,
  } = options;

  const startTime = Date.now();
  const fileName = file.name;
  const fileSize = file.size;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  let lastError = '';
  let retryCount = 0;

  // 客户端可直接处理的文件类型 (包括 PDF，使用 pdfjs-dist)
  const clientSideTypes = ['txt', 'md', 'csv', 'json', 'png', 'jpg', 'jpeg', 'pdf'];

  // 需要服务端处理的文件类型 (仅 DOCX/XLSX，服务端经常超时)
  const serverSideTypes = ['docx', 'xlsx', 'xls'];

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 客户端处理
      if (clientSideTypes.includes(extension)) {
        onProgress?.(10, '正在读取文件...');
        return await processClientSide(file, extension, onProgress);
      }

      // 服务端处理
      if (serverSideTypes.includes(extension)) {
        onProgress?.(10, '正在上传文件...');

        const result = await uploadToServer(file, extension, onProgress, attempt);

        if (result.success) {
          return {
            ...result,
            metadata: {
              ...result.metadata!,
              fileName,
              fileSize,
              fileType: extension,
              processingTime: Date.now() - startTime,
              retryCount: attempt,
            },
          };
        }

        lastError = result.error || '未知错误';

        // 如果是超时错误，尝试客户端备用方案
        if (isTimeoutError(lastError)) {
          onProgress?.(50, '服务器响应慢，尝试本地处理...');
          const fallbackResult = await tryClientFallback(file, extension, onProgress);
          if (fallbackResult.success) {
            return {
              ...fallbackResult,
              metadata: {
                ...fallbackResult.metadata!,
                fileName,
                fileSize,
                fileType: extension,
                processingTime: Date.now() - startTime,
                retryCount: attempt,
              },
            };
          }
        }

        // 重试
        if (attempt < maxRetries) {
          retryCount++;
          onRetry?.(retryCount, lastError);
          onProgress?.(0, `上传失败，正在重试 (${retryCount}/${maxRetries})...`);
          await sleep(retryDelay * (attempt + 1)); // 指数退避
        }
        // 继续下一次循环进行重试
        continue;
      }

      // 不支持的格式 (只有当既不是客户端类型也不是服务端类型时才返回)
      return {
        success: false,
        text: '',
        error: `不支持的文件格式: .${extension}`,
        metadata: { fileName, fileSize, fileType: extension, processingTime: 0 },
      };

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
      fileName,
      fileSize,
      fileType: extension,
      processingTime: Date.now() - startTime,
      retryCount,
    },
  };
}

/**
 * 客户端处理文件
 */
async function processClientSide(
  file: File,
  extension: string,
  onProgress?: (progress: number, status: string) => void
): Promise<UploadResult> {
  try {
    // 纯文本文件
    if (['txt', 'md', 'csv', 'json'].includes(extension)) {
      onProgress?.(30, '正在读取文本...');
      const text = await file.text();
      onProgress?.(100, '读取完成');

      return {
        success: true,
        text,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: extension,
          processingTime: 0,
        },
      };
    }

    // PDF 文件 - 使用 pdfjs-dist 客户端解析
    if (extension === 'pdf') {
      onProgress?.(10, '正在初始化 PDF 解析器...');

      try {
        // 动态导入 pdf.js
        const pdfjsLib = await import('pdfjs-dist');

        // 设置 worker (使用 CDN)
        pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

        onProgress?.(20, '正在读取 PDF...');

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        onProgress?.(30, `正在解析 PDF (${pdf.numPages} 页)...`);

        let text = '';
        const numPages = pdf.numPages;

        for (let i = 1; i <= numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: any) => item.str)
            .join(' ');
          text += pageText + '\n';

          const progress = 30 + Math.round((i / numPages) * 60);
          onProgress?.(progress, `正在解析 PDF... (${i}/${numPages} 页)`);
        }

        text = text.trim();

        if (text.length < 50) {
          return {
            success: false,
            text: '',
            error: '此 PDF 文字内容过少，可能是扫描版。建议：1) 复制文字直接粘贴；2) 或截图后以图片格式上传',
            metadata: {
              fileName: file.name,
              fileSize: file.size,
              fileType: extension,
              processingTime: 0,
            },
          };
        }

        onProgress?.(100, 'PDF 解析完成');

        return {
          success: true,
          text,
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: extension,
            processingTime: 0,
            isOCR: false,
          },
        };
      } catch (pdfError) {
        return {
          success: false,
          text: '',
          error: 'PDF 解析失败。建议：1) 复制文字直接粘贴；2) 或截图后以图片格式上传',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: extension,
            processingTime: 0,
          },
        };
      }
    }

    // 图片 OCR
    if (['png', 'jpg', 'jpeg'].includes(extension)) {
      onProgress?.(20, '正在初始化 OCR...');

      // 动态导入 Tesseract
      const Tesseract = (await import('tesseract.js')).default;

      onProgress?.(30, '正在识别文字...');

      const result = await Tesseract.recognize(file, 'chi_sim+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(30 + m.progress * 60);
            onProgress?.(progress, `正在识别文字... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      const text = result.data.text.trim();

      if (!text) {
        return {
          success: false,
          text: '',
          error: '未能从图片中识别出文字',
          metadata: {
            fileName: file.name,
            fileSize: file.size,
            fileType: extension,
            processingTime: 0,
            isOCR: true,
          },
        };
      }

      onProgress?.(100, '识别完成');

      return {
        success: true,
        text,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: extension,
          processingTime: 0,
          isOCR: true,
        },
      };
    }

    return {
      success: false,
      text: '',
      error: '不支持的文件格式',
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '处理失败',
    };
  }
}

/**
 * 上传到服务器
 */
async function uploadToServer(
  file: File,
  extension: string,
  onProgress?: (progress: number, status: string) => void,
  attempt: number = 0
): Promise<UploadResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // 使用 AbortController 控制超时
    const controller = new AbortController();
    const timeout = 25000; // 25 秒超时

    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    onProgress?.(20 + attempt * 10, `正在上传... (尝试 ${attempt + 1})`);

    const response = await fetch('/api/parse-file', {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      return {
        success: false,
        text: '',
        error: `服务器错误: ${response.status} ${errorText}`,
      };
    }

    onProgress?.(80, '正在解析...');

    const result = await response.json();

    return {
      ...result,
      metadata: {
        ...result.metadata,
        isOCR: false,
      },
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        success: false,
        text: '',
        error: '服务器响应超时，请尝试较小的文件或稍后重试',
      };
    }
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '网络错误',
    };
  }
}

/**
 * 客户端备用方案（当服务器超时时）
 */
async function tryClientFallback(
  file: File,
  extension: string,
  onProgress?: (progress: number, status: string) => void
): Promise<UploadResult> {
  onProgress?.(60, '服务器超时，尝试备用方案...');

  // 对于 PDF，尝试使用 pdf.js 读取
  if (extension === 'pdf') {
    try {
      // 动态导入 pdf.js
      const pdfjsLib = await import('pdfjs-dist');

      // 设置 worker
      pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

      onProgress?.(70, '正在本地解析 PDF...');

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

      let text = '';
      const numPages = pdf.numPages;

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items
          .map((item: any) => item.str)
          .join(' ');
        text += pageText + '\n';

        const progress = 70 + Math.round((i / numPages) * 25);
        onProgress?.(progress, `正在解析 PDF... (${i}/${numPages}页)`);
      }

      text = text.trim();

      if (text.length < 50) {
        return {
          success: false,
          text: '',
          error: '此 PDF 文字内容过少，可能是扫描版。建议：1) 复制文字直接粘贴；2) 或截图后以图片格式上传',
        };
      }

      onProgress?.(100, '解析完成');

      return {
        success: true,
        text,
        metadata: {
          fileName: file.name,
          fileSize: file.size,
          fileType: extension,
          processingTime: 0,
          isOCR: false,
        },
      };
    } catch (error) {
      return {
        success: false,
        text: '',
        error: 'PDF 解析失败。建议：1) 复制文字直接粘贴；2) 或截图后以图片格式上传',
      };
    }
  }

  // DOCX/XLSX 无法在客户端处理
  const suggestions: Record<string, string> = {
    docx: '建议：1) 复制 Word 文档中的文字直接粘贴；2) 或另存为 .txt 格式',
    xlsx: '建议：1) 复制 Excel 表格内容直接粘贴；2) 或另存为 .csv 格式',
    xls: '建议：1) 复制 Excel 表格内容直接粘贴；2) 或另存为 .csv 格式',
  };

  return {
    success: false,
    text: '',
    error: `服务器处理超时。\n${suggestions[extension] || '请尝试其他格式'}`,
  };
}

/**
 * 检查是否为超时错误
 */
function isTimeoutError(error: string): boolean {
  const timeoutKeywords = ['timeout', '超时', 'abort', 'network', '网络', 'ETIMEDOUT', 'ECONNRESET'];
  return timeoutKeywords.some(keyword => error.toLowerCase().includes(keyword.toLowerCase()));
}

/**
 * 延迟函数
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 检查文件类型是否支持
 */
export function isFileSupported(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const supportedTypes = ['txt', 'md', 'csv', 'json', 'pdf', 'docx', 'xlsx', 'xls', 'png', 'jpg', 'jpeg'];
  return supportedTypes.includes(ext);
}

/**
 * 获取支持的文件类型描述
 */
export function getSupportedFileTypes(): string {
  return '.txt, .md, .csv, .json, .pdf, .docx, .xlsx, .xls, .png, .jpg, .jpeg';
}
