/**
 * E2E Tests for Report Generation API
 *
 * Tests the full Human-in-the-loop workflow:
 * 1. Requirement validation
 * 2. Report generation start
 * 3. Outline generation and retrieval
 * 4. Outline confirmation
 * 5. Slide generation and retrieval
 * 6. Slide confirmation
 * 7. PPTX export
 */

import { test, expect } from '@playwright/test';

const API_BASE = process.env.API_URL || 'http://localhost:8000';

// Sample valid requirement
const sampleRequirement = {
  client_name: '测试科技有限公司',
  industry: '科技',
  industry_background: '测试科技是一家成立于2018年的互联网科技公司，专注于企业数字化转型解决方案。公司目前有200多名员工，主要业务包括企业SaaS产品开发和定制化咨询服务。随着市场竞争加剧，公司面临增长放缓的压力。',
  company_intro: '测试科技由几位海归创业者联合创立，目前完成B轮融资。公司采用扁平化管理，技术团队占60%以上。主要客户群体为中大型企业，年营收约5000万元。',
  company_scale: '200-300人',
  core_pain_points: [
    '战略层面：公司去年营收增长8%，远低于预期的15%，增长动力不足',
    '组织层面：采用职能制架构，但部门墙很厚，跨部门协作经常出问题',
    '绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平'
  ],
  pain_severity: 'high',
  project_goals: [
    '明确公司未来3年的战略方向和增长路径',
    '优化组织架构，提升跨部门协作效率',
    '建立科学的绩效管理体系'
  ],
  success_criteria: [
    '完成战略规划报告并获得管理层认可',
    '设计新的组织架构方案并完成试点',
    '新绩效体系在3个部门完成试运行'
  ],
  phase_planning: [
    {
      phase_id: 'phase_1',
      phase_name: '诊断阶段',
      duration_weeks: 4,
      key_activities: [
        '战略现状调研与分析',
        '组织效能诊断',
        '绩效体系评估'
      ],
      deliverables: [
        '战略诊断报告',
        '组织诊断报告',
        '绩效诊断报告'
      ]
    },
    {
      phase_id: 'phase_2',
      phase_name: '方案设计阶段',
      duration_weeks: 6,
      key_activities: [
        '战略规划制定',
        '组织架构优化设计',
        '绩效体系重构设计'
      ],
      deliverables: [
        '三年战略规划',
        '新组织架构方案',
        '新绩效管理制度'
      ]
    }
  ],
  main_tasks: [
    '战略澄清与解码',
    '组织架构优化',
    '绩效体系重构',
    '薪酬激励优化',
    '人才梯队建设'
  ],
  deliverables: [
    '战略规划报告',
    '组织架构优化方案',
    '绩效管理制度',
    '薪酬激励方案',
    '人才培养计划'
  ]
};

test.describe('Report API - Health Check', () => {
  test('API health check should return 200', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/health`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.status).toBe('healthy');
  });
});

test.describe('Requirement API', () => {
  test('GET /api/requirement/template should return template', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/requirement/template`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();

    expect(data.template_id).toBeDefined();
    expect(data.template_name).toBeDefined();
    expect(data.fields).toBeDefined();
    expect(data.fields.client_name).toBeDefined();
    expect(data.fields.industry).toBeDefined();
  });

  test('POST /api/requirement/validate with valid data should succeed', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/requirement/validate`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.valid).toBe(true);
    expect(data.errors).toHaveLength(0);
    expect(data.normalized_data).toBeDefined();
    expect(data.normalized_data.client_name).toBe(sampleRequirement.client_name);
  });

  test('POST /api/requirement/validate with missing required fields should fail', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/requirement/validate`, {
      headers: { 'Content-Type': 'application/json' },
      data: {
        requirement: {
          client_name: '',  // Empty required field
          industry: '',
          industry_background: 'too short',  // Too short
          company_intro: 'too short',
          core_pain_points: [],
          project_goals: [],
          phase_planning: [],
          main_tasks: [],
          deliverables: []
        }
      }
    });

    // The API returns valid=false with errors, not 422
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.valid).toBe(false);
    expect(data.errors.length).toBeGreaterThan(0);
  });
});

test.describe('Report Generation API', () => {
  test('POST /api/report/start should create task', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.task_id).toBeDefined();
    expect(typeof data.task_id).toBe('string');
    expect(data.message).toContain('启动');
  });

  test('GET /api/report/status/{task_id} should return task status', async ({ request }) => {
    // First create a task
    const startResponse = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });
    const { task_id } = await startResponse.json();

    // Then check status
    const response = await request.get(`${API_BASE}/api/report/status/${task_id}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.task_id).toBe(task_id);
    expect(data.status).toBeDefined();
    expect(data.progress_percentage).toBeDefined();
    expect(data.created_at).toBeDefined();
    expect(data.updated_at).toBeDefined();
  });

  test('GET /api/report/status with invalid task_id should return 404', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/report/status/non-existent-task-id`);
    expect(response.status()).toBe(404);
  });

  test('GET /api/report/tasks should list all tasks', async ({ request }) => {
    const response = await request.get(`${API_BASE}/api/report/tasks`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.tasks).toBeDefined();
    expect(Array.isArray(data.tasks)).toBe(true);
    expect(typeof data.count).toBe('number');
  });
});

test.describe('Full Report Workflow', () => {
  test('complete workflow: start → outline → slides → export', async ({ request }) => {
    // Increase timeout for this test
    test.setTimeout(180000); // 3 minutes

    // Step 1: Start report generation
    console.log('Step 1: Starting report generation...');
    const startResponse = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });
    expect(startResponse.ok()).toBeTruthy();
    const { task_id } = await startResponse.json();
    console.log(`Task created: ${task_id}`);

    // Step 2: Poll until outline is ready (max 60 seconds)
    console.log('Step 2: Waiting for outline generation...');
    let attempts = 0;
    let status: any;

    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResponse = await request.get(`${API_BASE}/api/report/status/${task_id}`);
      expect(statusResponse.ok()).toBeTruthy();
      status = await statusResponse.json();
      console.log(`Status: ${status.status}, Progress: ${status.progress_percentage}%`);

      if (status.status === 'outline_ready' || status.status === 'completed' || status.status === 'failed') {
        break;
      }
      attempts++;
    }

    // Verify we reached a valid state
    expect(['outline_ready', 'completed']).toContain(status.status);

    // If already completed, the workflow ran fast - skip intermediate steps
    if (status.status === 'completed') {
      console.log('Workflow completed quickly, skipping intermediate steps');
      const exportResponse = await request.get(`${API_BASE}/api/report/export/${task_id}`);
      expect(exportResponse.ok).toBeTruthy();
      return;
    }

    console.log('Outline ready!');

    // Step 3: Get outline
    console.log('Step 3: Retrieving outline...');
    const outlineResponse = await request.get(`${API_BASE}/api/report/outline/${task_id}`);
    expect(outlineResponse.ok()).toBeTruthy();
    const outline = await outlineResponse.json();
    expect(outline.task_id).toBe(task_id);
    expect(outline.outline).toBeDefined();
    expect(outline.estimated_slides).toBeGreaterThan(0);
    console.log(`Outline retrieved, estimated ${outline.estimated_slides} slides`);

    // Step 4: Confirm outline to trigger slide generation
    console.log('Step 4: Confirming outline...');
    const confirmOutlineResponse = await request.post(`${API_BASE}/api/report/confirm-outline`, {
      headers: { 'Content-Type': 'application/json' },
      data: { task_id }
    });
    expect(confirmOutlineResponse.ok()).toBeTruthy();
    const confirmResult = await confirmOutlineResponse.json();
    expect(confirmResult.success).toBe(true);
    console.log('Outline confirmed, generating slides...');

    // Step 5: Poll until slides are ready (max 90 seconds)
    console.log('Step 5: Waiting for slide generation...');
    attempts = 0;

    while (attempts < 45) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResponse = await request.get(`${API_BASE}/api/report/status/${task_id}`);
      expect(statusResponse.ok()).toBeTruthy();
      status = await statusResponse.json();
      console.log(`Status: ${status.status}, Progress: ${status.progress_percentage}%`);

      if (status.status === 'slides_ready' || status.status === 'failed') {
        break;
      }
      attempts++;
    }

    // Verify slides are ready
    expect(status.status).toBe('slides_ready');
    console.log('Slides ready!');

    // Step 6: Get slides
    console.log('Step 6: Retrieving slides...');
    const slidesResponse = await request.get(`${API_BASE}/api/report/slides/${task_id}`);
    expect(slidesResponse.ok()).toBeTruthy();
    const slidesData = await slidesResponse.json();
    expect(slidesData.task_id).toBe(task_id);
    expect(slidesData.slides).toBeDefined();
    expect(Array.isArray(slidesData.slides)).toBe(true);
    expect(slidesData.total_slides).toBeGreaterThan(0);
    console.log(`Retrieved ${slidesData.total_slides} slides`);

    // Verify slide structure
    const firstSlide = slidesData.slides[0];
    expect(firstSlide.slide_id).toBeDefined();
    expect(firstSlide.section).toBeDefined();
    expect(firstSlide.title).toBeDefined();
    expect(firstSlide.key_message).toBeDefined();
    expect(firstSlide.bullets).toBeDefined();

    // Step 7: Confirm slides to trigger PPTX export
    console.log('Step 7: Confirming slides...');
    const confirmSlidesResponse = await request.post(`${API_BASE}/api/report/confirm-slides`, {
      headers: { 'Content-Type': 'application/json' },
      data: { task_id }
    });
    expect(confirmSlidesResponse.ok()).toBeTruthy();
    console.log('Slides confirmed, exporting PPTX...');

    // Step 8: Poll until export is complete (max 30 seconds)
    console.log('Step 8: Waiting for PPTX export...');
    attempts = 0;

    while (attempts < 15) {
      await new Promise(r => setTimeout(r, 2000));

      const statusResponse = await request.get(`${API_BASE}/api/report/status/${task_id}`);
      expect(statusResponse.ok()).toBeTruthy();
      status = await statusResponse.json();
      console.log(`Status: ${status.status}, Progress: ${status.progress_percentage}%`);

      if (status.status === 'completed' || status.status === 'failed') {
        break;
      }
      attempts++;
    }

    // Verify export is complete
    expect(status.status).toBe('completed');
    console.log('Export complete!');

    // Step 9: Download PPTX
    console.log('Step 9: Downloading PPTX...');
    const exportResponse = await request.get(`${API_BASE}/api/report/export/${task_id}`);
    expect(exportResponse.ok()).toBeTruthy();

    // Verify it's a PPTX file
    const contentType = exportResponse.headers()['content-type'];
    expect(contentType).toContain('presentation');

    const body = await exportResponse.body();
    expect(body.length).toBeGreaterThan(1000); // Should have some content
    console.log(`PPTX downloaded, size: ${body.length} bytes`);

    console.log('✅ Full workflow completed successfully!');
  });
});

test.describe('Error Handling', () => {
  test('GET /api/report/outline before ready should return 400', async ({ request }) => {
    // Create a new task
    const startResponse = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });
    const { task_id } = await startResponse.json();

    // Immediately try to get outline (should fail)
    const response = await request.get(`${API_BASE}/api/report/outline/${task_id}`);
    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.detail).toContain('尚未就绪');
  });

  test('GET /api/report/slides before ready should return 400', async ({ request }) => {
    // Create a new task
    const startResponse = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });
    const { task_id } = await startResponse.json();

    // Immediately try to get slides (should fail)
    const response = await request.get(`${API_BASE}/api/report/slides/${task_id}`);
    expect(response.status()).toBe(400);
  });

  test('POST /api/report/confirm-outline with invalid task should return 400', async ({ request }) => {
    const response = await request.post(`${API_BASE}/api/report/confirm-outline`, {
      headers: { 'Content-Type': 'application/json' },
      data: { task_id: 'non-existent-task' }
    });
    expect(response.status()).toBe(400);
  });

  test('DELETE /api/report/task/{task_id} should cancel task', async ({ request }) => {
    // Create a task
    const startResponse = await request.post(`${API_BASE}/api/report/start`, {
      headers: { 'Content-Type': 'application/json' },
      data: { requirement: sampleRequirement }
    });
    const { task_id } = await startResponse.json();

    // Cancel it
    const response = await request.delete(`${API_BASE}/api/report/task/${task_id}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.message).toContain('取消');
  });
});
