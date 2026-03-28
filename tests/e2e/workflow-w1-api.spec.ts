/**
 * E2E Tests for Workflow W1 - Proposal (需求分析与建议书)
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe.serial('Workflow W1 - Proposal API', () => {
  test.setTimeout(120_000);

  let sessionId: string;

  test('POST /api/v2/workflow/start should start proposal workflow', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v2/workflow/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        project_id: 'test-proposal-w1',
        workflow_type: 'proposal',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBeDefined();
    expect(body.current_step_id).toBeDefined();
    expect(body.workflow_type).toBe('proposal');

    sessionId = body.session_id;
  });

  test('POST /api/v2/workflow/smart-extract should extract structured data', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v2/workflow/smart-extract`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        text: '客户是一家成立于2018年的科技公司，目前有200多名员工。主要业务包括企业SaaS产品开发和定制化咨询服务。公司去年营收增长8%，远低于预期的15%。公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。薪酬水平在行业中属于中游，但核心员工流失率较高。希望在未来3个月内完成组织诊断，明确战略方向，优化组织架构。',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(body.data.industry || body.data.company_info).toBeDefined();
  });

  test('POST /api/v2/workflow/{session_id}/execute should execute milestone_plan step', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.post(`${API_BASE}/api/v2/workflow/${sessionId}/execute`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        step_id: 'milestone_plan',
        input_data: {
          client_name: '测试科技有限公司',
          industry: '科技',
          pain_points: ['增长不足', '组织混乱'],
          expected_goals: ['明确战略方向'],
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
  });

  test('POST /api/v2/workflow/{session_id}/advance should advance workflow', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.post(`${API_BASE}/api/v2/workflow/${sessionId}/advance`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        step_data: {
          smart_extract: {
            client_name: '测试科技有限公司',
            industry: '科技',
            pain_points: ['增长动力不足', '组织架构不适应', '绩效体系不科学'],
            expected_goals: ['明确战略方向', '优化组织架构', '建立绩效薪酬体系'],
          },
        },
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  test('GET /api/v2/workflow/{session_id}/state should return workflow state', async ({ request }) => {
    expect(sessionId).toBeDefined();

    const response = await request.get(`${API_BASE}/api/v2/workflow/${sessionId}/state`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.session_id).toBe(sessionId);
    expect(body.workflow_type).toBe('proposal');
    expect(body.steps).toBeInstanceOf(Array);
    expect(body.steps.length).toBe(5);
  });
});
