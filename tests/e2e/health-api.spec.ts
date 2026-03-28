/**
 * E2E Tests for Health & Workflow Config API
 *
 * Tests basic API health endpoints and workflow configuration listing.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe('Health Check API', () => {
  test('GET /health should return status "ok"', async ({ request }) => {
    const response = await request.get(`${API_BASE}/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/health should return status "healthy"', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.status).toBe('healthy');
    expect(body.service).toBeDefined();
    expect(body.version).toBeDefined();
  });
});

test.describe('Workflow Configs API', () => {
  test('GET /api/v2/workflow/configs should return 3 workflows', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v2/workflow/configs`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.workflows).toBeDefined();
    expect(body.workflows.length).toBeGreaterThanOrEqual(3);

    // Verify the three expected workflow types exist
    const keys = body.workflows.map((w: any) => w.key);
    expect(keys).toContain('proposal');
    expect(keys).toContain('diagnosis');
    expect(keys).toContain('delivery');

    // Verify each workflow has required fields
    for (const workflow of body.workflows) {
      expect(workflow.key).toBeDefined();
      expect(workflow.name).toBeDefined();
      expect(workflow.description).toBeDefined();
      expect(workflow.steps).toBeInstanceOf(Array);
      expect(workflow.steps.length).toBeGreaterThan(0);
      expect(workflow.initial_step).toBeDefined();
    }
  });
});
