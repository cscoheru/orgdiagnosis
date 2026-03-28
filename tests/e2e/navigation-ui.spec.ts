/**
 * E2E Tests for Navigation & Page Loading (UI)
 *
 * Tests that the main frontend pages load correctly and display expected content.
 * Verifies page headings, list views, and deprecation banners.
 */

import { test, expect } from '@playwright/test';

const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

test.describe('Page Loading - Overview', () => {
  test('/overview should load and show "总览" heading', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/overview`);

    // Verify page loads — all pages share the same title from root layout
    await expect(page).toHaveTitle(/五维诊断系统/);

    // Use main h1 to avoid sidebar heading "咨询的天空"
    const heading = page.locator('main h1, main h2').first();
    await expect(heading).toContainText('总览');
  });
});

test.describe('Page Loading - Projects', () => {
  test('/projects should load and show project list', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/projects`);

    // Verify page loads
    await expect(page).toHaveTitle(/五维诊断系统/);

    // Verify "项目列表" heading is present in main content
    const projectHeading = page.locator('main h1, main h2').first();
    await expect(projectHeading).toContainText('项目列表');
  });
});

test.describe('Page Loading - Data', () => {
  test('/data should load and show "数据探索"', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/data`);

    // Verify page loads
    await expect(page).toHaveTitle(/五维诊断系统/);

    // Verify "数据探索" heading or text is present
    const dataHeading = page.locator('main h1, main h2').first();
    await expect(dataHeading).toContainText('数据探索');
  });
});

test.describe('Page Loading - Settings', () => {
  test('/settings should load and show "设置"', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/settings`);

    // Verify page loads
    await expect(page).toHaveTitle(/五维诊断系统/);

    // Verify "设置" heading is present in main content
    const settingsHeading = page.locator('main h1, main h2').first();
    await expect(settingsHeading).toContainText('设置');
  });
});

test.describe('Page Loading - Deprecated Pages', () => {
  test('/result should show deprecation banner', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/result`);

    // Wait for the page to finish loading, then check for deprecation text
    const deprecationBanner = page.locator('main >> text=已迁移至新位置').first();
    await expect(deprecationBanner).toBeVisible({ timeout: 10000 });
  });

  test('/input should show deprecation banner', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/input`);

    // /input has different deprecation text
    const deprecationBanner = page.locator('main >> text=已整合至项目工作流').first();
    await expect(deprecationBanner).toBeVisible({ timeout: 10000 });
  });
});
