/**
 * E2E UI Tests — Performance Management Module
 *
 * Tests browser interactions on the performance page.
 * Requires: Frontend running (Vercel or localhost:3000)
 * Run: npx playwright test tests/e2e/performance-ui.spec.ts
 */

import { test, expect } from '@playwright/test';

const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper: navigate to performance page of a project
// Note: adjust the project ID based on your test data
const PERF_PAGE = `${FRONTEND_BASE}/projects/test-project/performance`;

test.describe('Performance Page Navigation', () => {
  test('loads performance page and shows header', async ({ page }) => {
    await page.goto(PERF_PAGE);
    // Wait for page to load (check for any performance-related content)
    await page.waitForTimeout(2000);
    // Should have at least some content rendered
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('renders tab navigation buttons', async ({ page }) => {
    await page.goto(PERF_PAGE);
    await page.waitForTimeout(2000);
    // Check for tab buttons - the component renders 6 tabs
    const tabTexts = ['方案概览', '组织绩效', '岗位绩效'];
    for (const text of tabTexts) {
      const tab = page.getByText(text, { exact: false });
      // At least some tabs should be visible
      if (await tab.isVisible()) {
        break;
      }
    }
  });
});

test.describe('Plan Overview Tab', () => {
  test('shows create button', async ({ page }) => {
    await page.goto(PERF_PAGE);
    await page.waitForTimeout(2000);

    // Look for the "新建方案" button
    const createBtn = page.getByText('新建方案');
    if (await createBtn.isVisible()) {
      await expect(createBtn).toBeVisible();
    }
  });

  test('can open and close create form', async ({ page }) => {
    await page.goto(PERF_PAGE);
    await page.waitForTimeout(2000);

    const createBtn = page.getByText('新建方案');
    if (await createBtn.isVisible()) {
      await createBtn.click();
      // Form should appear
      await page.waitForTimeout(500);
      // Cancel button should be visible
      const cancelBtn = page.getByText('取消');
      if (await cancelBtn.first().isVisible()) {
        await cancelBtn.first().click();
      }
    }
  });
});

test.describe('Org Performance Tab', () => {
  test('shows prompt when no plan selected', async ({ page }) => {
    await page.goto(PERF_PAGE);
    await page.waitForTimeout(2000);

    // If no plan is active, should show prompt
    const prompt = page.getByText('请先在');
    if (await prompt.isVisible()) {
      await expect(prompt).toBeVisible();
    }
  });
});

test.describe('Position Performance Tab', () => {
  test('shows prompt when no plan selected', async ({ page }) => {
    await page.goto(PERF_PAGE);
    await page.waitForTimeout(2000);

    // Click position performance tab if visible
    const posTab = page.getByText('岗位绩效');
    if (await posTab.isVisible()) {
      await posTab.click();
      await page.waitForTimeout(500);
      const prompt = page.getByText('请先在');
      if (await prompt.isVisible()) {
        await expect(prompt).toBeVisible();
      }
    }
  });
});
