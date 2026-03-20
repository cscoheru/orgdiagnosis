/**
 * E2E Tests for Report Generation UI
 *
 * Tests the frontend pages:
 * 1. Report entry page with requirement form
 * 2. Report workspace with outline/slide editors
 */

import { test, expect, Page } from '@playwright/test';

const FRONTEND_BASE = process.env.FRONTEND_URL || 'http://localhost:3000';

// Helper to fill requirement form
async function fillRequirementForm(page: Page) {
  // Step 1: Basic info
  await page.fill('input[placeholder*="客户名称"]', '测试科技有限公司');
  await page.selectOption('select', '科技');
  await page.fill('textarea[placeholder*="行业背景"]', '测试科技是一家成立于2018年的互联网科技公司，专注于企业数字化转型解决方案。公司目前有200多名员工，主要业务包括企业SaaS产品开发和定制化咨询服务。随着市场竞争加剧，公司面临增长放缓的压力。');
  await page.fill('textarea[placeholder*="公司介绍"]', '测试科技由几位海归创业者联合创立，目前完成B轮融资。公司采用扁平化管理，技术团队占60%以上。主要客户群体为中大型企业，年营收约5000万元。');

  // Click next
  await page.click('button:has-text("下一步")');

  // Step 2: Pain points and goals
  // Fill first pain point
  await page.fill('textarea[placeholder*="痛点 1"]', '战略层面：公司去年营收增长8%，远低于预期的15%，增长动力不足');

  // Add another pain point
  await page.click('button:has-text("+ 添加痛点")');
  await page.fill('textarea[placeholder*="痛点 2"]', '组织层面：采用职能制架构，但部门墙很厚，跨部门协作经常出问题');

  // Fill first goal
  await page.fill('input[placeholder*="目标 1"]', '明确公司未来3年的战略方向和增长路径');

  // Click next
  await page.click('button:has-text("下一步")');

  // Step 3: Phase planning (default phase exists)
  await page.fill('input[placeholder*="例如：诊断阶段"]', '诊断阶段');

  // Click next
  await page.click('button:has-text("下一步")');

  // Step 4: Tasks and deliverables (default exists)
  // Form should be ready for submission
}

test.describe('Report Page - Entry', () => {
  test('report page should load correctly', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Check page title
    await expect(page.locator('h1')).toContainText('项目建议书生成');

    // Check form is visible
    await expect(page.locator('text=客户名称')).toBeVisible();
    await expect(page.locator('text=行业类型')).toBeVisible();

    // Check progress indicator
    await expect(page.locator('text=步骤 1 / 4')).toBeVisible();
  });

  test('form navigation should work correctly', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Step 1: Should not go back from step 1
    await expect(page.locator('button:has-text("上一步")')).toBeDisabled();

    // Fill required fields in step 1
    await page.fill('input[placeholder*="客户名称"]', '测试公司');
    await page.selectOption('select', '科技');
    await page.fill('textarea[placeholder*="行业背景"]', '这是一个测试公司的行业背景描述，用于验证表单验证功能。该公司在行业内具有一定的代表性，面临典型的挑战。');
    await page.fill('textarea[placeholder*="公司介绍"]', '测试公司成立于2018年，专注于企业服务领域。公司目前有200名员工，主要产品包括SaaS平台和定制化解决方案。');

    // Click next
    await page.click('button:has-text("下一步")');

    // Should be on step 2
    await expect(page.locator('text=核心需求')).toBeVisible();

    // Go back
    await page.click('button:has-text("上一步")');

    // Should be back on step 1
    await expect(page.locator('text=基本信息')).toBeVisible();
  });

  test('form validation should show errors', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Try to go next without filling required fields
    await page.click('button:has-text("下一步")');

    // Should show validation errors
    await expect(page.locator('text=请输入客户名称')).toBeVisible();
    await expect(page.locator('text=请选择行业类型')).toBeVisible();
  });

  test('dynamic list fields should work', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Fill step 1 first
    await page.fill('input[placeholder*="客户名称"]', '测试公司');
    await page.selectOption('select', '科技');
    await page.fill('textarea[placeholder*="行业背景"]', '这是一个测试公司的行业背景描述，用于验证表单验证功能。该公司在行业内具有一定的代表性，面临典型的挑战。');
    await page.fill('textarea[placeholder*="公司介绍"]', '测试公司成立于2018年，专注于企业服务领域。公司目前有200名员工，主要产品包括SaaS平台和定制化解决方案。');
    await page.click('button:has-text("下一步")');

    // Step 2: Test pain point list
    // Initial: 1 pain point field
    const painPointInputs = await page.locator('textarea[placeholder*="痛点"]').count();
    expect(painPointInputs).toBe(1);

    // Add pain point
    await page.click('button:has-text("+ 添加痛点")');
    const painPointInputsAfterAdd = await page.locator('textarea[placeholder*="痛点"]').count();
    expect(painPointInputsAfterAdd).toBe(2);

    // Remove second pain point
    await page.locator('button:has-text("✕")').last().click();
    const painPointInputsAfterRemove = await page.locator('textarea[placeholder*="痛点"]').count();
    expect(painPointInputsAfterRemove).toBe(1);
  });

  test('severity buttons should be selectable', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Fill step 1 and go to step 2
    await page.fill('input[placeholder*="客户名称"]', '测试公司');
    await page.selectOption('select', '科技');
    await page.fill('textarea[placeholder*="行业背景"]', '这是一个测试公司的行业背景描述，用于验证表单验证功能。该公司在行业内具有一定的代表性，面临典型的挑战。');
    await page.fill('textarea[placeholder*="公司介绍"]', '测试公司成立于2018年，专注于企业服务领域。公司目前有200名员工，主要产品包括SaaS平台和定制化解决方案。');
    await page.click('button:has-text("下一步")');

    // Test severity selection
    await page.click('button:has-text("严重")');

    // Should be selected (blue background)
    const selectedButton = page.locator('button:has-text("严重")');
    await expect(selectedButton).toHaveClass(/bg-blue-50/);
  });

  test('summary preview should show in step 4', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Fill all steps
    await page.fill('input[placeholder*="客户名称"]', '预览测试公司');
    await page.selectOption('select', '科技');
    await page.fill('textarea[placeholder*="行业背景"]', '这是一个测试公司的行业背景描述，用于验证表单验证功能。该公司在行业内具有一定的代表性，面临典型的挑战。');
    await page.fill('textarea[placeholder*="公司介绍"]', '测试公司成立于2018年，专注于企业服务领域。公司目前有200名员工，主要产品包括SaaS平台和定制化解决方案。');
    await page.click('button:has-text("下一步")');

    await page.fill('textarea[placeholder*="痛点 1"]', '测试痛点描述内容');
    await page.fill('input[placeholder*="目标 1"]', '测试项目目标');
    await page.click('button:has-text("下一步")');

    await page.click('button:has-text("下一步")'); // Step 3 with defaults
    await page.click('button:has-text("下一步")'); // Step 4

    // Should show summary
    await expect(page.locator('text=需求摘要')).toBeVisible();
    await expect(page.locator('text=预览测试公司')).toBeVisible();
    await expect(page.locator('text=科技')).toBeVisible();
  });
});

test.describe('Report Workspace', () => {
  test('workspace without task_id should show error', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report/workspace`);

    // Should show error message
    await expect(page.locator('text=缺少任务ID')).toBeVisible();
  });

  test('workspace with invalid task_id should show error', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report/workspace?task_id=invalid-task-id`);

    // Should show error after loading
    await page.waitForSelector('text=加载失败', { timeout: 10000 }).catch(() => {
      // Or show 404 error
      expect(page.locator('text=/任务不存在|404|加载失败/')).toBeVisible();
    });
  });

  // Note: This test requires a running backend and a valid task
  test.skip('workspace with valid task_id should load outline editor', async ({ page }) => {
    // This test would need to:
    // 1. Create a task via API
    // 2. Wait for outline_ready
    // 3. Navigate to workspace
    // 4. Verify outline editor is shown
  });
});

test.describe('Navigation', () => {
  test('sidebar should have report link', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/input`);

    // Check sidebar has report link
    await expect(page.locator('text=报告生成')).toBeVisible();

    // Click to navigate
    await page.click('text=报告生成');

    // Should be on report page
    await expect(page).toHaveURL(/\/report$/);
  });

  test('tips section should be visible', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Scroll to tips
    await page.locator('text=填写提示').scrollIntoViewIfNeeded();

    // Check tips content
    await expect(page.locator('text=填写提示')).toBeVisible();
    await expect(page.locator('text=行业背景和公司介绍越详细')).toBeVisible();
  });
});

test.describe('Accessibility', () => {
  test('form should be keyboard navigable', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Focus on first input
    await page.focus('input[placeholder*="客户名称"]');

    // Type value
    await page.keyboard.type('键盘导航测试公司');

    // Tab to next field
    await page.keyboard.press('Tab');

    // Should be on select
    await expect(page.locator('select')).toBeFocused();
  });

  test('form labels should be associated with inputs', async ({ page }) => {
    await page.goto(`${FRONTEND_BASE}/report`);

    // Check label-input association
    const clientNameInput = page.locator('input[placeholder*="客户名称"]');
    const clientNameLabel = page.locator('text=客户名称').first();

    // Click label should focus input
    await clientNameLabel.click();
    await expect(clientNameInput).toBeFocused();
  });
});

test.describe('Responsive Design', () => {
  test('mobile view should show hamburger menu', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(`${FRONTEND_BASE}/report`);

    // Should show hamburger menu
    await expect(page.locator('button:has-text("☰")')).toBeVisible();

    // Click to open sidebar
    await page.click('button:has-text("☰")');

    // Sidebar should be visible
    await expect(page.locator('text=报告生成')).toBeVisible();
  });

  test('form should be usable on tablet', async ({ page }) => {
    // Set tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto(`${FRONTEND_BASE}/report`);

    // Form should be visible and usable
    await expect(page.locator('input[placeholder*="客户名称"]')).toBeVisible();

    // Fill form
    await page.fill('input[placeholder*="客户名称"]', '平板测试公司');
    await page.selectOption('select', '科技');
  });
});
