/**
 * E2E Tests for Workshop Canvas API
 *
 * Tests the backend CRUD operations for workshop sessions, nodes, and relations.
 * Requires a running backend at API_BASE.
 *
 * IMPORTANT: The backend returns raw objects (no { success, data } wrapper).
 * The frontend workshopRequest() client adds that wrapper, but E2E tests
 * hit the API directly.
 *
 * Uses test.describe.serial to ensure tests share session/node state.
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

test.describe.serial('Workshop Canvas API', () => {
  let sessionId: string;
  let nodeId: string;

  test('POST /api/v1/workshop/sessions — create session', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/workshop/sessions`, {
      data: { title: 'E2E Test Session', industry_context: 'technology' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body._key).toBeDefined();
    expect(body.model_key).toBe('Workshop_Session');
    expect(body.properties.title).toBe('E2E Test Session');
    expect(body.properties.industry_context).toBe('technology');
    sessionId = body._key;
  });

  test('GET /api/v1/workshop/sessions/:id — get empty session', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/workshop/sessions/${sessionId}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.session._key).toBe(sessionId);
    expect(body.nodes).toHaveLength(0);
    expect(body.relations).toHaveLength(0);
  });

  test('POST /api/v1/workshop/sessions/:id/nodes — create root node', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/workshop/sessions/${sessionId}/nodes`, {
      data: { name: 'Root Node', node_type: 'scene' },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.properties.name).toBe('Root Node');
    expect(body.properties.node_type).toBe('scene');
    expect(body.model_key).toBe('Canvas_Node');
    nodeId = body._key;
  });

  test('POST /api/v1/workshop/sessions/:id/nodes — create child node with parent', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/v1/workshop/sessions/${sessionId}/nodes`, {
      data: { name: 'Child Node', node_type: 'scene', parent_node_id: nodeId },
    });
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.properties.name).toBe('Child Node');
    expect(body.properties.node_type).toBe('scene');
  });

  test('GET /api/v1/workshop/sessions/:id — get session with nodes and relations', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/v1/workshop/sessions/${sessionId}`);
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.nodes.length).toBeGreaterThanOrEqual(2);
    const parentChildRels = body.relations.filter(
      (r: any) => r.relation_type === 'canvas_parent_child'
    );
    expect(parentChildRels.length).toBeGreaterThanOrEqual(1);
  });

  test('PATCH /api/v1/workshop/sessions/:id/nodes/:nodeId — update node name', async ({ request }) => {
    const response = await request.patch(
      `${API_BASE}/api/v1/workshop/sessions/${sessionId}/nodes/${nodeId}`,
      { data: { name: 'Updated Root' } }
    );
    expect(response.ok()).toBeTruthy();
    const body = await response.json();
    expect(body.properties.name).toBe('Updated Root');
  });

  test('DELETE /api/v1/workshop/sessions/:id/nodes/:nodeId — delete cascades', async ({ request }) => {
    const response = await request.delete(
      `${API_BASE}/api/v1/workshop/sessions/${sessionId}/nodes/${nodeId}`
    );
    expect(response.ok()).toBeTruthy();

    const getResponse = await request.get(`${API_BASE}/api/v1/workshop/sessions/${sessionId}`);
    const body = await getResponse.json();
    const deletedNode = body.nodes.find((n: any) => n._key === nodeId);
    expect(deletedNode).toBeUndefined();
  });
});
