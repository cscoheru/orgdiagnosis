/**
 * E2E Tests for Workshop Canvas UI
 *
 * Tests the MindManager-like canvas interactions: node creation, editing,
 * deletion, selection, and keyboard shortcuts.
 * Requires a running frontend at baseURL and backend at API_URL.
 */

import { test, expect, Page } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// Helper: create a test session via API and return the page navigated to it
async function setupTestSession(page: Page): Promise<string> {
  // Create session via API
  const response = await page.request.post(`${API_BASE}/api/v1/workshop/sessions`, {
    data: { title: 'UI E2E Test', industry_context: 'technology' },
  });
  const body = await response.json();
  const sessionKey = body._key;

  // Navigate to the workshop canvas
  await page.goto(`/workshop/cocreate/${sessionKey}`);
  await page.waitForSelector('.react-flow', { timeout: 10000 });

  return sessionKey;
}

test.describe('Workshop Canvas UI', () => {
  test('canvas shows empty state with no nodes', async ({ page }) => {
    const sessionKey = await setupTestSession(page);
    await expect(page.getByText('点击「添加节点」开始')).toBeVisible({ timeout: 5000 });
  });

  test('add root node via toolbar', async ({ page }) => {
    await setupTestSession(page);

    // Click "添加节点" button
    await page.getByRole('button', { name: '添加节点' }).click();

    // Type node name and press Enter
    await page.getByPlaceholder('输入节点标题...').fill('My Root Node');
    await page.getByPlaceholder('输入节点标题...').press('Enter');

    // Verify node appears on canvas
    await expect(page.getByText('My Root Node')).toBeVisible({ timeout: 5000 });
  });

  test('double-click to edit node name', async ({ page }) => {
    await setupTestSession(page);

    // Add a node first
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Editable Node');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Editable Node')).toBeVisible({ timeout: 5000 });

    // Double-click to edit
    await page.getByText('Editable Node').dblclick();

    // Should see an input field (SmartNode enters edit mode)
    const input = page.locator('.react-flow__node input').first();
    await expect(input).toBeVisible({ timeout: 3000 });

    // Type new name and press Enter
    await input.fill('Renamed Node');
    await input.press('Enter');

    // Verify the new name is shown
    await expect(page.getByText('Renamed Node')).toBeVisible({ timeout: 3000 });
  });

  test('Enter creates sibling node', async ({ page }) => {
    await setupTestSession(page);

    // Add first root node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Parent');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Parent')).toBeVisible({ timeout: 5000 });

    // Click to select the node
    await page.getByText('Parent').click();

    // Press Enter to create sibling
    await page.keyboard.press('Enter');
    await expect(page.getByText('新节点')).toBeVisible({ timeout: 5000 });
  });

  test('Tab creates child node', async ({ page }) => {
    await setupTestSession(page);

    // Add root node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Parent');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Parent')).toBeVisible({ timeout: 5000 });

    // Click to select
    await page.getByText('Parent').click();

    // Press Tab to create child
    await page.keyboard.press('Tab');
    await expect(page.getByText('新节点')).toBeVisible({ timeout: 5000 });
  });

  test('Delete removes selected node', async ({ page }) => {
    await setupTestSession(page);

    // Add a node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('To Delete');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('To Delete')).toBeVisible({ timeout: 5000 });

    // Select the node
    await page.getByText('To Delete').click();

    // Press Delete key
    await page.keyboard.press('Delete');

    // Node should be removed from canvas
    await expect(page.getByText('To Delete')).not.toBeVisible({ timeout: 3000 });
  });

  test('click selects node and shows keyboard hints', async ({ page }) => {
    await setupTestSession(page);

    // Add a node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Clickable');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Clickable')).toBeVisible({ timeout: 5000 });

    // Click the node
    await page.getByText('Clickable').click();

    // Keyboard shortcuts hint should appear
    await expect(page.getByText('同级')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('子级')).toBeVisible();
  });

  test('clicking pane deselects node', async ({ page }) => {
    await setupTestSession(page);

    // Add a node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Deselect Me');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Deselect Me')).toBeVisible({ timeout: 5000 });

    // Select the node
    await page.getByText('Deselect Me').click();
    await expect(page.getByText('同级')).toBeVisible({ timeout: 3000 });

    // Click the pane background to deselect (use position to ensure we hit blank area)
    const pane = page.locator('.react-flow__pane');
    await pane.click({ position: { x: 10, y: 10 } });
    await expect(page.getByText('同级')).not.toBeVisible({ timeout: 3000 });
  });

  test('edit name persists after creating sibling', async ({ page }) => {
    await setupTestSession(page);

    // Add and rename a node
    await page.getByRole('button', { name: '添加节点' }).click();
    await page.getByPlaceholder('输入节点标题...').fill('Original');
    await page.getByPlaceholder('输入节点标题...').press('Enter');
    await expect(page.getByText('Original')).toBeVisible({ timeout: 5000 });

    // Double-click to edit
    await page.getByText('Original').dblclick();
    const input = page.locator('.react-flow__node input').first();
    await expect(input).toBeVisible({ timeout: 3000 });
    await input.fill('Renamed');
    await input.press('Enter');

    // Verify rename
    await expect(page.getByText('Renamed')).toBeVisible({ timeout: 3000 });

    // Select the renamed node and create sibling
    await page.getByText('Renamed').click();
    await page.keyboard.press('Enter');

    // Original name should still be "Renamed" (optimistic update should not revert)
    await expect(page.getByText('Renamed')).toBeVisible({ timeout: 3000 });
  });
});
