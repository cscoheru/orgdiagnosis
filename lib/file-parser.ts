/**
 * 文件解析工具
 * 支持: txt, md, docx, pdf, xlsx, xls, csv, json
 */

import mammoth from 'mammoth';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

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
  };
}

/**
 * 解析文件内容
 */
export async function parseFile(file: File): Promise<ParseResult> {
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
        const pdfResult = await parsePdf(file);
        return {
          ...pdfResult,
          metadata: { ...metadata, pageCount: pdfResult.pageCount },
        };

      case 'xlsx':
      case 'xls':
        const excelResult = await parseExcel(file);
        return {
          ...excelResult,
          metadata: { ...metadata, sheetCount: excelResult.sheetCount },
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
async function parsePdf(file: File): Promise<{ success: boolean; text: string; pageCount?: number; error?: string }> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await (pdfParse as any).default(buffer);

    return {
      success: true,
      text: data.text,
      pageCount: data.numpages,
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'PDF 解析失败，可能是扫描版 PDF 或加密文件',
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
