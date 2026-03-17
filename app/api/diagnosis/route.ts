/**
 * 诊断会话 API
 * GET /api/diagnosis - 获取列表
 * POST /api/diagnosis - 创建新会话
 */

import { NextRequest, NextResponse } from 'next/server';
import type { DiagnosisSession, FiveDimensionsData } from '@/types/diagnosis';

// 模拟数据库存储 (开发阶段)
// 生产环境替换为 Supabase
const mockSessions: DiagnosisSession[] = [];

/**
 * 获取诊断会话列表
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const clientId = searchParams.get('client_id');
  const limit = parseInt(searchParams.get('limit') || '20');

  let sessions = [...mockSessions];

  if (clientId) {
    sessions = sessions.filter(s => s.client_id === clientId);
  }

  // 按时间倒序
  sessions.sort((a, b) =>
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return NextResponse.json({
    success: true,
    data: sessions.slice(0, limit),
    total: sessions.length
  });
}

/**
 * 创建新的诊断会话
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 验证必填字段
    if (!body.raw_input) {
      return NextResponse.json(
        { success: false, error: 'raw_input is required' },
        { status: 400 }
      );
    }

    if (!body.data) {
      return NextResponse.json(
        { success: false, error: 'data (FiveDimensionsData) is required' },
        { status: 400 }
      );
    }

    // 创建新会话
    const session: DiagnosisSession = {
      id: generateId(),
      client_id: body.client_id || generateId(),
      created_by: body.created_by || 'anonymous',
      raw_input: body.raw_input,
      data: body.data as FiveDimensionsData,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    // 保存到数据库 (当前使用 mock)
    mockSessions.push(session);

    return NextResponse.json({
      success: true,
      data: session
    }, { status: 201 });
  } catch (error) {
    console.error('Create diagnosis error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error'
      },
      { status: 500 }
    );
  }
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

export const runtime = 'nodejs';
export const maxDuration = 30;
