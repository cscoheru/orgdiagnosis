'use client';

/**
 * AI Chat API — Backend proxy for Zhipu AI.
 *
 * Reuses org-diagnosis's AI service to proxy Zhipu/GLM calls.
 * The strategy decoding components call POST /api/ai/chat with { messages }.
 */

import { callZhipuAPI, type ZhipuMessage } from '@/lib/zhipu-api';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { messages } = body as { messages: ZhipuMessage[] };

    if (!messages || !Array.isArray(messages)) {
      return Response.json({ error: 'messages array required' }, { status: 400 });
    }

    // Use empty apiKey to force backend proxy mode
    const content = await callZhipuAPI('', messages);

    return Response.json({ content });
  } catch (error: unknown) {
    console.error('AI chat API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
