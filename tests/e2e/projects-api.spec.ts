/**
 * E2E Tests for Projects CRUD API
 *
 * Tests project creation, listing, retrieval, and status update.
 * Uses unique project names with timestamps to avoid collisions.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// Generate unique project name to avoid collisions
function uniqueProjectName() {
  return `E2E测试项目_${Date.now()}`;
}

test.describe.serial('Projects CRUD API', () => {
  let createdProjectId: string;
  const projectName = uniqueProjectName();

  test('POST /api/projects should create a new project', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/projects/`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        name: projectName,
        client_name: '测试客户科技有限公司',
        client_industry: '科技',
        selected_modules: ['战略', '组织', '绩效'],
        description: 'E2E自动化测试创建的项目',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.project).toBeDefined();
    expect(body.project.name).toBe(projectName);
    expect(body.project.client_name).toBe('测试客户科技有限公司');
    expect(body.project.selected_modules).toContain('战略');

    createdProjectId = body.project.id;
    expect(createdProjectId).toBeDefined();
  });

  test('GET /api/projects should list projects and contain the new one', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/projects/?limit=50`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.projects).toBeInstanceOf(Array);
    expect(body.projects.length).toBeGreaterThanOrEqual(1);

    // Verify our created project is in the list
    const found = body.projects.find((p: any) => p.id === createdProjectId);
    expect(found).toBeDefined();
    expect(found.name).toBe(projectName);
  });

  test('GET /api/projects/{id} should return project details', async ({ request }) => {
    expect(createdProjectId).toBeDefined();

    const response = await request.get(`${API_BASE}/api/projects/${createdProjectId}`);
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.project).toBeDefined();
    expect(body.project.id).toBe(createdProjectId);
    expect(body.project.name).toBe(projectName);
    expect(body.project.client_name).toBe('测试客户科技有限公司');
  });

  test('PATCH /api/projects/{id} should update project status to "requirement"', async ({ request }) => {
    expect(createdProjectId).toBeDefined();

    const response = await request.patch(`${API_BASE}/api/projects/${createdProjectId}`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        status: 'requirement',
      },
    });

    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.project).toBeDefined();
    expect(body.project.status).toBe('requirement');
  });
});
