/**
 * E2E Tests for Workflow W3 - Delivery (项目解决方案)
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe.serial('Workflow W3 - Delivery API', () => {
  test.setTimeout(120_000);

  let sessionId: string;

  test('POST /api/v2/workflow/start should start delivery workflow', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v2/workflow/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        project_id: 'test-delivery-w3',
        workflow_type: 'delivery',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBeDefined();
    expect(body.workflow_type).toBe('delivery');

    sessionId = body.session_id;
  });

  test('POST /api/v2/workflow/{session_id}/advance should advance with plan data', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.post(`${API_BASE}/api/v2/workflow/${sessionId}/advance`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        step_data: {
          create_order: {
            plan: {
              project_goal: '优化组织管理能力',
              phases: [
                { phase_name: '需求分析', phase_order: 1, goals: '明确需求' },
                { phase_name: '调研诊断', phase_order: 2, goals: '完成诊断' },
                { phase_name: '方案设计', phase_order: 3, goals: '输出方案' },
              ],
            },
          },
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('POST /api/v2/workflow/{session_id}/execute should execute phase_execute step', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.post(`${API_BASE}/api/v2/workflow/${sessionId}/execute`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        step_id: 'phase_execute',
        input_data: {
          phase_id: 'phase-2',
          phase_name: '调研诊断',
          goals: '完成五维诊断',
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/v2/workflow/{session_id}/state should return delivery workflow state', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.get(`${API_BASE}/api/v2/workflow/${sessionId}/state`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBe(sessionId);
    expect(body.workflow_type).toBe('delivery');
    expect(body.steps).toBeInstanceOf(Array);
  });
});
