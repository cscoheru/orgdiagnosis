/**
 * 文件解析工具
 * 支持: txt, md, docx, pdf, xlsx, xls, csv, json
 * 图片 OCR: png, jpg, jpeg
 */

import mammoth from 'mammoth';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';
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
    let text = '';

    switch (extension) {
      case 'txt':
      case 'md':
      case 'csv':
      case 'json':
        text = await parseTextFile(file);
        break;

      case 'docx':
        const docxResult = await parseDocx(file);
        return {
          ...docxResult,
          metadata: { ...metadata, pageCount: docxResult.pageCount },
        };

      case 'pdf':
        const pdfResult = await parsePdf(file, onOCRProgress);
        return {
          ...pdfResult,
          metadata: { ...metadata, pageCount: pdfResult.pageCount, isOCR: pdfResult.isOCR },
        };

      case 'xlsx':
      case 'xls':
        const excelResult = await parseExcel(file);
        return {
          ...excelResult,
          metadata: { ...metadata, sheetCount: excelResult.sheetCount },
        };

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
 * 解析纯文本文件
 */
async function parseTextFile(file: File): Promise<string> {
  return await file.text();
}

/**
 * 解析 Word 文档 (.docx)
 */
async function parseDocx(file: File): Promise<{ success: boolean; text: string; pageCount?: number; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer });

    // 估算页数（每页约 500 字）
    const pageCount = Math.ceil(result.value.length / 500);

    return {
      success: true,
      text: result.value,
      pageCount,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'Word 文档解析失败，请确保文件格式正确',
    };
  }
}

/**
 * 解析 PDF 文件
 */
async function parsePdf(
  file: File,
  onOCRProgress?: OCRProgressCallback
): Promise<{ success: boolean; text: string; pageCount?: number; isOCR?: boolean; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await (pdfParse as any).default(buffer);

    // 如果提取到的文字太少，可能是扫描版 PDF，尝试 OCR
    if (data.text.trim().length < 50) {
      onOCRProgress?.(0, '检测到扫描版 PDF，正在启动 OCR...');

      // 将 PDF 转为图片再 OCR（这里简化处理，直接提示用户）
      return {
        success: false,
        text: '',
        pageCount: data.numpages,
        error: '此 PDF 文字内容过少，可能是扫描版。建议：1) 使用图片格式上传；2) 或手动复制文字内容',
      };
    }

    return {
      success: true,
      text: data.text,
      pageCount: data.numpages,
      isOCR: false,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'PDF 解析失败，可能是加密文件或格式损坏',
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
 * 解析 Excel 文件
 */
async function parseExcel(file: File): Promise<{ success: boolean; text: string; sheetCount?: number; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    const texts: string[] = [];
    const sheetCount = workbook.SheetNames.length;

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);

      texts.push(`\n【工作表: ${sheetName}】\n${csv}`);
    }

    return {
      success: true,
      text: texts.join('\n\n'),
      sheetCount,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'Excel 文件解析失败',
    };
  }
}

/**
 * 支持的文件类型
 */
export const SUPPORTED_FILE_TYPES = {
  // 文本类
  txt: { name: '纯文本', mime: 'text/plain' },
  md: { name: 'Markdown', mime: 'text/markdown' },
  csv: { name: 'CSV 表格', mime: 'text/csv' },
  json: { name: 'JSON 数据', mime: 'application/json' },

  // 文档类
  docx: { name: 'Word 文档', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
  pdf: { name: 'PDF 文档', mime: 'application/pdf' },

  // 表格类
  xlsx: { name: 'Excel 表格', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  xls: { name: 'Excel 表格 (旧版)', mime: 'application/vnd.ms-excel' },

  // 图片类 (OCR)
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
