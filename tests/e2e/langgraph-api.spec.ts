/**
 * E2E Tests for LangGraph Diagnosis API
 *
 * Tests the full workflow from text input to result retrieval
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000/api/langgraph';

test.describe('LangGraph Diagnosis API', () => {
  test('health check should return 200', async ({ request }) => {
    const response = await request.get(`${API_BASE.replace('/api/langgraph', '')}/api/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });

  test('analyze text should create task', async ({ request }) => {
    const response = await request.post(`${API_BASE}/analyze`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        text: '客户是一家科技公司，主要问题是战略不清晰，组织架构混乱，绩效体系不完善。'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.task_id).toBeDefined();
    expect(typeof data.task_id).toBe('string');
  });

  test('full workflow: submit and poll until complete', async ({ request }) => {
    // Submit analysis
    const submitResponse = await request.post(`${API_BASE}/analyze`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        text: `
          客户是一家成立于2018年的科技公司，目前有200多名员工。
          主要问题：
          1. 战略层面：公司去年营收增长8%，远低于预期的15%。
          2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
          3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
          4. 薪酬层面：薪酬水平在行业中属于中游，但核心员工流失率较高。
          5. 人才层面：老员工混日子的情况比较严重，新员工留不住。
        `
      }
    });

    expect(submitResponse.ok()).toBeTruthy();
    const { task_id } = await submitResponse.json();
    expect(task_id).toBeDefined();

    // Poll until complete (max 30 seconds)
    let attempts = 0;
    let status: any;

    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResponse = await request.get(`${API_BASE}/status/${task_id}`);
      expect(statusResponse.ok()).toBeTruthy();
      status = await statusResponse.json();

      if (status.status === 'completed' || status.status === 'failed') {
        break;
      }
      attempts++;
    }

    // Verify completion
    expect(status.status).toBe('completed');
    expect(status.progress_percentage).toBe(100);
    expect(status.completed_dimensions).toHaveLength(5);
    expect(status.completed_dimensions).toContain('strategy');
    expect(status.completed_dimensions).toContain('structure');
    expect(status.completed_dimensions).toContain('performance');
    expect(status.completed_dimensions).toContain('compensation');
    expect(status.completed_dimensions).toContain('talent');

    // Get final result
    const resultResponse = await request.get(`${API_BASE}/result/${task_id}`);
    expect(resultResponse.ok()).toBeTruthy();
    const result = await resultResponse.json();
    expect(result.success).toBe(true);
    expect(result.result).toBeDefined();
    expect(result.result.dimensions).toHaveLength(5);
  });

  test('invalid task id should return 404', async ({ request }) => {
    const response = await request.get(`${API_BASE}/status/invalid-task-id-12345`);
    expect(response.status()).toBe(404);
  });
});

test.describe('Frontend Integration', () => {
  test.skip('input page should load', async ({ page }) => {
    await page.goto('/input');
    await expect(page.locator('h1')).toContainText('新建诊断');
  });

  test.skip('should show textarea and submit button', async ({ page }) => {
    await page.goto('/input');
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.getByRole('button', { name: /开始分析/ })).toBeVisible();
  });
});
