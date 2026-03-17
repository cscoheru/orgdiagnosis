/**
 * AI 信息抽取 API
 * POST /api/extract
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractDiagnosisData } from '@/lib/ai/zhipu';
import type { ExtractRequest, ExtractResponse } from '@/types/diagnosis';

export async function POST(request: NextRequest) {
  try {
    const body: ExtractRequest = await request.json();

    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          error: 'Text is required'
        },
        { status: 400 }
      );
    }

    // 文本长度检查
    if (body.text.length < 50) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          error: 'Text is too short (minimum 50 characters)'
        },
        { status: 400 }
      );
    }

    if (body.text.length > 100000) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          error: 'Text is too long (maximum 100,000 characters)'
        },
        { status: 400 }
      );
    }

    // 调用 AI 抽取
    const result = await extractDiagnosisData(body.text);

    if (!result.success) {
      return NextResponse.json<ExtractResponse>(
        {
          success: false,
          error: result.error
        },
        { status: 500 }
      );
    }

    return NextResponse.json<ExtractResponse>({
      success: true,
      data: result.data
    });
  } catch (error) {
    console.error('Extract API error:', error);
    return NextResponse.json<ExtractResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

// 配置路由
export const runtime = 'nodejs'; // 使用 Node.js 运行时（支持 AI SDK）
export const maxDuration = 60; // 最长 60 秒
