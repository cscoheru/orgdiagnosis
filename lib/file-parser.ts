/**
 * 文件解析工具
 * 前端处理: txt, md, csv, json, 图片 OCR
 * API 处理: pdf, docx, xlsx, xls (需要 Node.js 环境)
 */

import Tesseract from 'tesseract.js';

export interface ParseResult {
  success: boolean;
  text: string;
  error?: string;
  metadata?: {
    fileName: string;
    fileSize: number;
    fileType: string;
    pageCount?: number;
    sheetCount?: number;
    isOCR?: boolean;
  };
}

// OCR 进度回调
export type OCRProgressCallback = (progress: number, status: string) => void;

/**
 * 解析文件内容
 */
export async function parseFile(
  file: File,
  onOCRProgress?: OCRProgressCallback
): Promise<ParseResult> {
  const fileName = file.name;
  const fileSize = file.size;
  const extension = fileName.split('.').pop()?.toLowerCase() || '';

  const metadata = {
    fileName,
    fileSize,
    fileType: extension,
  };

  try {
    // 需要后端处理的文件类型
    if (['pdf', 'docx', 'xlsx', 'xls'].includes(extension)) {
      return await parseViaAPI(file, metadata);
    }

    // 前端处理的文件类型
    let text = '';

    switch (extension) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
        text = await file.text();
        break;

      case 'png':
      case 'jpg':
      case 'jpeg':
        const imageResult = await parseImage(file, onOCRProgress);
        return {
          ...imageResult,
          metadata: { ...metadata, isOCR: true },
        };

      default:
        return {
          success: false,
          text: '',
          error: `不支持的文件格式: .${extension}`,
          metadata,
        };
    }

    return {
      success: true,
      text,
      metadata,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '文件解析失败',
      metadata,
    };
  }
}

/**
 * 通过 API 解析文件 (PDF, DOCX, XLSX)
 */
async function parseViaAPI(file: File, metadata: any): Promise<ParseResult> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/parse-file', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    return {
      ...result,
      metadata: { ...metadata, ...result.metadata },
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: '文件上传失败，请检查网络连接',
      metadata,
    };
  }
}

/**
 * 解析图片文件 (OCR)
 */
async function parseImage(
  file: File,
  onOCRProgress?: OCRProgressCallback
): Promise<{ success: boolean; text: string; error?: string }> {
  try {
    onOCRProgress?.(0, '正在初始化 OCR 引擎...');

    const result = await Tesseract.recognize(file, 'chi_sim+eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          const progress = Math.round(m.progress * 100);
          onOCRProgress?.(progress, `正在识别文字... ${progress}%`);
        } else if (m.status === 'loading language traineddata') {
          onOCRProgress?.(10, '正在加载中文语言包...');
        } else if (m.status === 'initializing api') {
          onOCRProgress?.(5, '正在初始化...');
        }
      },
    });

    const text = result.data.text.trim();

    if (!text) {
      return {
        success: false,
        text: '',
        error: '未能从图片中识别出文字，请确保图片清晰',
      };
    }

    onOCRProgress?.(100, '识别完成');

    return {
      success: true,
      text,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: '图片 OCR 失败，请重试或手动输入文字',
    };
  }
}

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = {
  // 文本类 (前端处理)
  txt: { name: '纯文本', mime: 'text/plain' },
  md: { name: 'Markdown', mime: 'text/markdown' },
  csv: { name: 'CSV 表格', mime: 'text/csv' },
  json: { name: 'JSON 数据', mime: 'application/json' },

  // 文档类 (API 处理)
  docx: { name: 'Word 文档', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pdf: { name: 'PDF 文档', mime: 'application/pdf' },

  // 表格类 (API 处理)
  xlsx: { name: 'Excel 表格', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { name: 'Excel 表格 (旧版)', mime: 'application/vnd.ms-excel' },

  // 图片类 (前端 OCR)
  png: { name: 'PNG 图片', mime: 'image/png' },
  jpg: { name: 'JPG 图片', mime: 'image/jpeg' },
  jpeg: { name: 'JPEG 图片', mime: 'image/jpeg' },
};

/**
 * 获取文件接受字符串
 */
export function getAcceptString(): string {
  return Object.keys(SUPPORTED_FILE_TYPES).map(ext => `.${ext}`).join(',');
}

/**
 * 检查文件类型是否支持
 */
export function isFileTypeSupported(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ext in SUPPORTED_FILE_TYPES;
}
