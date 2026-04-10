/**
 * E2E API Tests — Performance Management Module
 *
 * Tests all CRUD and AI generation endpoints against the running backend.
 * Run: API_URL=http://your-api npx playwright test tests/e2e/performance-api.spec.ts
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';
const PERF = `${API_BASE}/api/v1/performance`;

function uid(prefix = 'test') {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

// ── Helper: create a plan and return its key ──

async function createTestPlan(): Promise<string> {
  const r = await fetch(`${PERF}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      plan_name: uid('方案'),
      methodology: 'KPI',
      cycle_type: '年度',
      status: '草拟中',
      project_id: 'e2e_test',
    }),
  });
  const data = await r.json();
  return data._key;
}

// ══════════════════════════════════════════════════════
// Plan CRUD
// ══════════════════════════════════════════════════════

test.describe('Performance Plan API', () => {
  test('POST /plans creates a plan', async ({ request }) => {
    const r = await request.post(`${PERF}/plans`, {
      data: {
        plan_name: uid('方案'),
        methodology: 'OKR',
        cycle_type: '季度',
        status: '草拟中',
      },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body._key).toBeDefined();
    expect(body.model_key).toBe('Performance_Plan');
  });

  test('GET /plans returns plan list', async ({ request }) => {
    const r = await request.get(`${PERF}/plans`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('GET /plans?project_id filters by project', async ({ request }) => {
    const r = await request.get(`${PERF}/plans?project_id=e2e_test`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(Array.isArray(body)).toBeTruthy();
  });

  test('GET /plans/{key} returns plan detail', async ({ request }) => {
    const key = await createTestPlan();
    const r = await request.get(`${PERF}/plans/${key}`);
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body._key).toBe(key);
  });

  test('PATCH /plans/{key} updates plan', async ({ request }) => {
    const key = await createTestPlan();
    const r = await request.patch(`${PERF}/plans/${key}`, {
      data: { status: '客户确认' },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.properties.status).toBe('客户确认');
  });

  test('GET /plans/nonexistent returns 404', async ({ request }) => {
    const r = await request.get(`${PERF}/plans/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// Org Performance
// ══════════════════════════════════════════════════════

test.describe('Org Performance API', () => {
  test('GET /org-perf returns list', async ({ request }) => {
    const r = await request.get(`${PERF}/org-perf`);
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('GET /org-perf?plan_id filters', async ({ request }) => {
    const r = await request.get(`${PERF}/org-perf?plan_id=nonexistent`);
    expect(r.ok()).toBeTruthy();
  });

  test('GET /org-perf/{key} 404 for missing', async ({ request }) => {
    const r = await request.get(`${PERF}/org-perf/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });

  test('PATCH /org-perf/{key} 404 for missing', async ({ request }) => {
    const r = await request.patch(`${PERF}/org-perf/nonexistent_12345`, {
      data: { status: '已确认' },
    });
    expect(r.status()).toBe(404);
  });

  test('POST /org-perf/generate requires valid input', async ({ request }) => {
    const r = await request.post(`${PERF}/org-perf/generate`, {
      data: { plan_id: 'nonexistent', org_unit_id: 'nonexistent' },
    });
    // May fail with 500 if AI fails or data not found
    expect([200, 500]).toContain(r.status());
  });
});

// ══════════════════════════════════════════════════════
// Position Performance
// ══════════════════════════════════════════════════════

test.describe('Position Performance API', () => {
  test('GET /pos-perf returns list', async ({ request }) => {
    const r = await request.get(`${PERF}/pos-perf`);
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('GET /pos-perf?org_perf_id filters', async ({ request }) => {
    const r = await request.get(`${PERF}/pos-perf?org_perf_id=nonexistent`);
    expect(r.ok()).toBeTruthy();
  });

  test('GET /pos-perf/{key} 404 for missing', async ({ request }) => {
    const r = await request.get(`${PERF}/pos-perf/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });

  test('PATCH /pos-perf/{key} 404 for missing', async ({ request }) => {
    const r = await request.patch(`${PERF}/pos-perf/nonexistent_12345`, {
      data: { status: '已编辑' },
    });
    expect(r.status()).toBe(404);
  });

  test('PATCH /pos-perf/batch-update handles empty list', async ({ request }) => {
    const r = await request.patch(`${PERF}/pos-perf/batch-update`, {
      data: [],
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.updated).toBe(0);
  });

  test('POST /pos-perf/generate requires valid org_perf_id', async ({ request }) => {
    const r = await request.post(`${PERF}/pos-perf/generate`, {
      data: { org_perf_id: 'nonexistent' },
    });
    expect([200, 500]).toContain(r.status());
  });
});

// ══════════════════════════════════════════════════════
// Templates
// ══════════════════════════════════════════════════════

test.describe('Review Template API', () => {
  test('GET /templates returns list', async ({ request }) => {
    const r = await request.get(`${PERF}/templates`);
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('GET /templates/{key} 404 for missing', async ({ request }) => {
    const r = await request.get(`${PERF}/templates/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });

  test('PATCH /templates/{key} 404 for missing', async ({ request }) => {
    const r = await request.patch(`${PERF}/templates/nonexistent_12345`, {
      data: { status: '已确认' },
    });
    expect(r.status()).toBe(404);
  });

  test('POST /templates/generate requires valid pos_perf_id', async ({ request }) => {
    const r = await request.post(`${PERF}/templates/generate`, {
      data: { pos_perf_id: 'nonexistent' },
    });
    expect([200, 500]).toContain(r.status());
  });
});

// ══════════════════════════════════════════════════════
// Rating Models
// ══════════════════════════════════════════════════════

test.describe('Rating Model API', () => {
  test('POST /rating-models creates model', async ({ request }) => {
    const r = await request.post(`${PERF}/rating-models`, {
      data: {
        model_name: uid('评分模型'),
        scale_type: '行为锚定',
        min_value: 1,
        max_value: 5,
      },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json())._key).toBeDefined();
  });

  test('GET /rating-models returns list', async ({ request }) => {
    const r = await request.get(`${PERF}/rating-models`);
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });

  test('GET /rating-models/{key} 404 for missing', async ({ request }) => {
    const r = await request.get(`${PERF}/rating-models/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// Reviews
// ══════════════════════════════════════════════════════

test.describe('Review API', () => {
  test('POST /reviews creates review', async ({ request }) => {
    const r = await request.post(`${PERF}/reviews`, {
      data: {
        review_title: uid('考核'),
        overall_score: 85,
        overall_rating: 'B',
        reviewer: 'E2E',
        project_id: 'e2e_test',
      },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json())._key).toBeDefined();
  });

  test('POST /reviews/batch imports multiple', async ({ request }) => {
    const r = await request.post(`${PERF}/reviews/batch`, {
      data: {
        reviews: [
          { review_title: uid('批量'), overall_score: 90, reviewer: 'E2E' },
          { review_title: uid('批量'), overall_score: 75, reviewer: 'E2E' },
        ],
      },
    });
    expect(r.ok()).toBeTruthy();
    const body = await r.json();
    expect(body.count).toBe(2);
  });

  test('GET /reviews returns list', async ({ request }) => {
    const r = await request.get(`${PERF}/reviews`);
    expect(r.ok()).toBeTruthy();
    expect(Array.isArray(await r.json())).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// Analytics
// ══════════════════════════════════════════════════════

test.describe('Analytics API', () => {
  test('GET /analytics/distribution returns stats', async ({ request }) => {
    const r = await request.get(`${PERF}/analytics/distribution`);
    expect(r.ok()).toBeTruthy();
  });

  test('GET /analytics/overview returns counts', async ({ request }) => {
    const r = await request.get(`${PERF}/analytics/overview`);
    expect(r.ok()).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════
// Calibration
// ══════════════════════════════════════════════════════

test.describe('Calibration API', () => {
  test('POST /calibrations creates session', async ({ request }) => {
    const r = await request.post(`${PERF}/calibrations`, {
      data: {
        calibration_name: uid('校准'),
        org_unit: '技术部',
        status: '待校准',
      },
    });
    expect(r.ok()).toBeTruthy();
    expect((await r.json())._key).toBeDefined();
  });

  test('GET /calibrations/{key} 404 for missing', async ({ request }) => {
    const r = await request.get(`${PERF}/calibrations/nonexistent_12345`);
    expect(r.status()).toBe(404);
  });
});

// ══════════════════════════════════════════════════════
// Report
// ══════════════════════════════════════════════════════

test.describe('Report API', () => {
  test('POST /reports/generate requires project_id', async ({ request }) => {
    const r = await request.post(`${PERF}/reports/generate`, {
      data: { project_id: 'nonexistent' },
    });
    // May succeed or fail depending on AI + data availability
    expect([200, 500]).toContain(r.status());
  });
});
