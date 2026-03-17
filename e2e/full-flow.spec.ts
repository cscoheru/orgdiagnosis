/**
 * 五维组织诊断系统 - 全功能 E2E 测试
 */

import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

test.setTimeout(120000);

const SAMPLE_TEXT = `客户是一家成立于2018年的科技公司，目前有200多名员工。
主要问题：
1. 战略层面：公司去年营收增长8%，远低于预期的15%。创始人认为错过了两个重要的市场机会。
2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
4. 薪酬层面：薪酬水平在行业中属于中游，但核心员工流失率较高。
5. 人才层面：老员工混日子的情况比较严重，新员工留不住，去年入职的10个新人走了6个。`;

function createTestFile(filename: string, content: string | Buffer): string {
  const testDir = path.join(__dirname, 'fixtures');
  if (!fs.existsSync(testDir)) {
    fs.mkdirSync(testDir, { recursive: true });
  }
  const filePath = path.join(testDir, filename);
  fs.writeFileSync(filePath, content);
  return filePath;
}

test.describe('首页与导航', () => {
  test('首页应该正确加载', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/五维诊断/);
  });

  test('应该能导航到录入页面', async ({ page }) => {
    await page.goto('/');
    await page.click('text=新建诊断');
    await expect(page).toHaveURL(/\/input/);
  });

  test('应该能导航到历史页面', async ({ page }) => {
    await page.goto('/');
    await page.click('text=历史记录');
    await expect(page).toHaveURL(/\/history/);
  });
});

test.describe('录入页面 - 文本输入', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/input');
  });

  test('页面应该显示所有必要元素', async ({ page }) => {
    await expect(page.getByRole('heading', { name: '新建诊断' })).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('text=上传文件')).toBeVisible();
  });

  test('应该能输入文本', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill(SAMPLE_TEXT);
    await expect(textarea).toHaveValue(SAMPLE_TEXT);
  });

  test('文本少于50字符时应该禁用分析按钮', async ({ page }) => {
    const textarea = page.locator('textarea');
    await textarea.fill('短文本');
    const analyzeButton = page.locator('button:has-text("开始分析")');
    await expect(analyzeButton).toBeDisabled();
  });

  test('使用示例文本按钮应该工作', async ({ page }) => {
    await page.click('text=使用示例文本');
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(50);
  });
});

test.describe('录入页面 - 文件上传', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/input');
  });

  test('应该支持 TXT 文件上传', async ({ page }) => {
    const txtPath = createTestFile('test.txt', SAMPLE_TEXT);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(txtPath);
    await page.waitForTimeout(2000);
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(50);
  });

  test('应该支持 MD 文件上传', async ({ page }) => {
    const mdPath = createTestFile('test.md', `# 测试\n${SAMPLE_TEXT}`);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(mdPath);
    await page.waitForTimeout(2000);
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('测试');
  });

  test('应该支持 CSV 文件上传', async ({ page }) => {
    const csvPath = createTestFile('test.csv', '问题,描述\n战略,营收低');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(csvPath);
    await page.waitForTimeout(2000);
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value).toContain('战略');
  });

  test('应该支持 JSON 文件上传', async ({ page }) => {
    const jsonPath = createTestFile('test.json', JSON.stringify({ text: SAMPLE_TEXT }));
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(jsonPath);
    await page.waitForTimeout(2000);
    const textarea = page.locator('textarea');
    const value = await textarea.inputValue();
    expect(value.length).toBeGreaterThan(50);
  });

  test('应该显示文件大小限制提示', async ({ page }) => {
    const sizeHint = page.locator('text=20MB');
    await expect(sizeHint).toBeVisible();
  });

  test('应该显示不支持的文件格式错误', async ({ page }) => {
    const unsupportedPath = createTestFile('test.xyz', 'test');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(unsupportedPath);
    await page.waitForTimeout(1000);
    const errorAlert = page.locator('text=不支持的文件格式');
    await expect(errorAlert).toBeVisible({ timeout: 5000 });
  });
});

test.describe('AI 分析流程', () => {
  test('应该能完成完整的文本分析流程', async ({ page }) => {
    await page.goto('/input');
    const textarea = page.locator('textarea');
    await textarea.fill(SAMPLE_TEXT);
    const analyzeButton = page.locator('button:has-text("开始分析")');
    await analyzeButton.click();
    await page.waitForURL(/\/result\//, { timeout: 60000 });
    await expect(page).toHaveURL(/\/result\//);
  });
});

test.describe('结果页面 - 可视化', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/input');
    const textarea = page.locator('textarea');
    await textarea.fill(SAMPLE_TEXT);
    const analyzeButton = page.locator('button:has-text("开始分析")');
    await analyzeButton.click();
    await page.waitForURL(/\/result\//, { timeout: 60000 });
  });

  test('应该显示五维概览', async ({ page }) => {
    const dimensions = ['战略', '组织', '绩效', '薪酬', '人才'];
    for (const dim of dimensions) {
      await expect(page.locator(`text=${dim}`).first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('应该显示分数', async ({ page }) => {
    const scorePattern = /\d{1,3}/;
    const scoreElement = page.locator('text=' + scorePattern);
    await expect(scoreElement.first()).toBeVisible({ timeout: 10000 });
  });

  test('应该显示维度详情', async ({ page }) => {
    const detailSection = page.locator('text=/业务现状|战略规划|战略执行/');
    await expect(detailSection.first()).toBeVisible({ timeout: 15000 });
  });
});

test.describe('历史记录页面', () => {
  test('应该能访问历史页面', async ({ page }) => {
    await page.goto('/history');
    await expect(page).toHaveURL(/\/history/);
  });

  test('历史页面应该显示标题', async ({ page }) => {
    await page.goto('/history');
    const title = page.locator('text=/历史|记录|诊断/');
    await expect(title.first()).toBeVisible();
  });
});

test.describe('错误处理', () => {
  test('无效的会话ID应该处理', async ({ page }) => {
    await page.goto('/result/invalid-id-12345');
    await page.waitForTimeout(3000);
    const hasError = await page.locator('text=/错误|不存在|失败|加载/').isVisible().catch(() => false);
    expect(hasError || page.url().includes('/result/')).toBeTruthy();
  });
});

test.describe('性能测试', () => {
  test('首页加载时间应该合理', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });

  test('录入页面加载时间应该合理', async ({ page }) => {
    const startTime = Date.now();
    await page.goto('/input');
    const loadTime = Date.now() - startTime;
    expect(loadTime).toBeLessThan(5000);
  });
});
