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
  const startTime = Date.now();

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

    // 读取文件
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let result: ParseResult;

    // 根据文件类型处理
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

    console.log(`[Parse File] ${fileName} processed in ${Date.now() - startTime}ms`);

    return NextResponse.json(result);
  } catch (error) {
    console.error('File parse error:', error);

    // 区分错误类型
    let errorMessage = '文件解析失败';
    if (error instanceof Error) {
      if (error.message.includes('timeout') || error.name === 'AbortError') {
        errorMessage = '服务器处理超时，请尝试较小的文件';
      } else if (error.message.includes('memory')) {
        errorMessage = '文件过大，内存不足';
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json<ParseResult>({
      success: false,
      text: '',
      error: errorMessage,
    }, { status: 500 });
  }
}

/**
 * 解析 PDF
 */
async function parsePdf(buffer: Buffer, metadata: any): Promise<ParseResult> {
  try {
    const data = await (pdfParse as any)(buffer, {
      ignoreEncryption: true,
      max: 0, // 无限制
    });

    const text = data.text.trim();

    if (text.length < 50) {
      return {
        success: false,
        text: '',
        error: '此 PDF 文字内容过少，可能是扫描版。建议截图后以图片格式上传',
        metadata: { ...metadata, pageCount: data.numpages },
      };
    }

    return {
      success: true,
      text,
      metadata: { ...metadata, pageCount: data.numpages },
    };
  } catch (error: any) {
    let errorMessage = 'PDF 解析失败';

    if (error.message?.includes('password')) {
      errorMessage = '此 PDF 已加密，请先解除密码保护';
    } else if (error.message?.includes('Invalid PDF')) {
      errorMessage = '无效的 PDF 文件，请检查文件是否损坏';
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
      error: 'Word 文档解析失败，请确保是 .docx 格式',
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
