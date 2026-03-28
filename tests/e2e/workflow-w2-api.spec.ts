/**
 * E2E Tests for Workflow W2 - Diagnosis (调研诊断与报告)
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe.serial('Workflow W2 - Diagnosis API', () => {
  test.setTimeout(120_000);

  let sessionId: string;

  test('POST /api/v2/workflow/start should start diagnosis workflow', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v2/workflow/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        project_id: 'test-diagnosis-w2',
        workflow_type: 'diagnosis',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBeDefined();
    expect(body.workflow_type).toBe('diagnosis');

    sessionId = body.session_id;
  });

  test('POST /api/v2/workflow/smart-question should generate supplementary questions', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v2/workflow/smart-question`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        questionnaire_data: {
          items: [
            { dimension: 'strategy', question: '公司有明确的战略规划吗？', answer: '不太清晰' },
            { dimension: 'structure', question: '组织架构是什么形态？', answer: '职能制' },
          ],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('POST /api/v2/workflow/{session_id}/execute should execute dashboard step', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.post(`${API_BASE}/api/v2/workflow/${sessionId}/execute`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        step_id: 'dashboard',
        input_data: {
          questionnaire: {
            items: [
              { dimension: 'strategy', answer: '战略不清晰' },
              { dimension: 'structure', answer: '职能制架构' },
              { dimension: 'performance', answer: 'KPI不科学' },
            ],
          },
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('GET /api/v2/workflow/{session_id}/state should return diagnosis workflow state', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.get(`${API_BASE}/api/v2/workflow/${sessionId}/state`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBe(sessionId);
    expect(body.workflow_type).toBe('diagnosis');
    expect(body.steps).toBeInstanceOf(Array);
  });
});
