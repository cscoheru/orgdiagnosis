/**
 * 文件解析 API
 * POST /api/parse-file
 * 处理需要 Node.js 环境的文件格式 (PDF, DOCX, XLSX)
 */

import { NextRequest, NextResponse } from 'next/server';
import mammoth from 'mammoth';
import * as pdfParse from 'pdf-parse';
import * as XLSX from 'xlsx';

export const runtime = 'nodejs';
export const maxDuration = 60;

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

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json<ParseResult>({
        success: false,
        text: '',
        error: '未找到文件',
      }, { status: 400 });
    }

    const fileName = file.name;
    const fileSize = file.size;
    const extension = fileName.split('.').pop()?.toLowerCase() || '';

    const metadata = {
      fileName,
      fileSize,
      fileType: extension,
    };

    // 检查文件大小 (最大 10MB)
    if (fileSize > 10 * 1024 * 1024) {
      return NextResponse.json<ParseResult>({
        success: false,
        text: '',
        error: '文件大小超过 10MB 限制',
        metadata,
      }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let result: ParseResult;

    switch (extension) {
      case 'pdf':
        result = await parsePdf(buffer, metadata);
        break;

      case 'docx':
        result = await parseDocx(buffer, metadata);
        break;

      case 'xlsx':
      case 'xls':
        result = await parseExcel(buffer, metadata);
        break;

      default:
        result = {
          success: false,
          text: '',
          error: `不支持的文件格式: .${extension}`,
          metadata,
        };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('File parse error:', error);
    return NextResponse.json<ParseResult>({
      success: false,
      text: '',
      error: error instanceof Error ? error.message : '文件解析失败',
    }, { status: 500 });
  }
}

/**
 * 解析 PDF
 */
async function parsePdf(buffer: Buffer, metadata: any): Promise<ParseResult> {
  try {
    // pdf-parse 的正确用法
    const data = await (pdfParse as any)(buffer, {
      ignoreEncryption: true,
    });

    const text = data.text.trim();

    // 如果文字太少，可能是扫描版
    if (text.length < 50) {
      return {
        success: false,
        text: '',
        error: '此 PDF 文字内容过少，可能是扫描版。建议：1) 截图后以图片格式上传；2) 或手动复制文字内容',
        metadata: { ...metadata, pageCount: data.numpages },
      };
    }

    return {
      success: true,
      text,
      metadata: { ...metadata, pageCount: data.numpages },
    };
  } catch (error: any) {
    console.error('PDF parse error:', error);

    // 更详细的错误信息
    let errorMessage = 'PDF 解析失败';
    if (error.message?.includes('password')) {
      errorMessage = '此 PDF 已加密，请先解除密码保护';
    } else if (error.message?.includes('Invalid PDF')) {
      errorMessage = '无效的 PDF 文件，请检查文件是否损坏';
    } else if (error.message?.includes('cross stream')) {
      errorMessage = 'PDF 格式不标准，建议用其他工具重新保存';
    }

    return {
      success: false,
      text: '',
      error: errorMessage,
      metadata,
    };
  }
}

/**
 * 解析 DOCX
 */
async function parseDocx(buffer: Buffer, metadata: any): Promise<ParseResult> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    const text = result.value.trim();

    if (!text) {
      return {
        success: false,
        text: '',
        error: 'Word 文档内容为空',
        metadata,
      };
    }

    // 估算页数
    const pageCount = Math.ceil(text.length / 500);

    return {
      success: true,
      text,
      metadata: { ...metadata, pageCount },
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'Word 文档解析失败，请确保是 .docx 格式（不支持旧版 .doc）',
      metadata,
    };
  }
}

/**
 * 解析 Excel
 */
async function parseExcel(buffer: Buffer, metadata: any): Promise<ParseResult> {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });

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
      metadata: { ...metadata, sheetCount },
    };
  } catch (error) {
    return {
      success: false,
      text: '',
      error: 'Excel 文件解析失败',
      metadata,
    };
  }
}
