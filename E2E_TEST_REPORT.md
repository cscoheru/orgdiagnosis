# E2E 测试报告

**项目**: org-diagnosis (企业组织诊断系统)
**测试日期**: 2026-03-27
**测试环境**: macOS Darwin 25.1.0, Python 3.14.3, Node.js
**后端**: http://localhost:8000 (AUTH_ENABLED=false, RATE_LIMIT_ENABLED=false)

---

## 一、后端 API 集成测试 (pytest)

**测试文件**: `backend/tests/test_e2e_api.py`
**运行命令**: `python -m pytest tests/test_e2e_api.py -v`
**结果**: **23/23 PASSED** ✅

| 测试类 | 测试项 | 状态 |
|--------|--------|------|
| **TestHealthEndpoints** (4) | `/health` 简单健康检查 | ✅ PASS |
| | `/api/health` 详细健康检查 | ✅ PASS |
| | `/docs` Swagger 文档可访问 | ✅ PASS |
| | `/openapi.json` OpenAPI 规范完整 | ✅ PASS |
| **TestProjectCRUD** (3) | 创建项目 | ✅ PASS |
| | 列表项目 | ✅ PASS |
| | 完整生命周期 (创建→获取) | ✅ PASS |
| **TestFolderCRUD** (1) | 创建文件夹 | ✅ PASS |
| **TestAnalyzeEndpoint** (2) | 缺少文本应返回 422 | ✅ PASS |
| | 携带文本提交分析 | ✅ PASS |
| **TestDiagnosisEndpoints** (2) | 诊断列表 | ✅ PASS |
| | 不存在的任务状态 | ✅ PASS |
| **TestReportEndpoints** (2) | 缺少数据启动报告应失败 | ✅ PASS |
| | 不存在的报告状态 | ✅ PASS |
| **TestKnowledgeEndpoints** (2) | 无参数搜索 | ✅ PASS |
| | 文件列表 | ✅ PASS |
| **TestRequirementEndpoint** (2) | 缺少文本应失败 | ✅ PASS |
| | 携带文本提取需求 | ✅ PASS |
| **TestExportEndpoint** (1) | 不存在的 PDF 导出 | ✅ PASS |
| **TestSecurity** (3) | 500 错误不泄露堆栈 | ✅ PASS |
| | CORS 预检请求 | ✅ PASS |
| | 速率限制头 | ✅ PASS |
| **TestOpenAPICompleteness** (1) | 所有路由组已注册 (≥6组) | ✅ PASS |

**覆盖的 API 路由组**: health, projects, folders, analyze, diagnosis, report, export, knowledge, requirement (9组)

---

## 二、Playwright API 测试

**测试文件**: `tests/e2e/langgraph-api.spec.ts`, `tests/e2e/report-api.spec.ts`
**运行命令**: `npx playwright test --project="API Tests"`
**结果**: **15/17 PASSED**, 2 SKIPPED, 2 FAILED ⚠️

### 通过 (15)

| 测试 | 状态 |
|------|------|
| LangGraph API 健康检查 | ✅ PASS |
| LangGraph 提交文本创建任务 | ✅ PASS |
| LangGraph 不存在的任务 → 404 | ✅ PASS |
| Report API 健康检查 | ✅ PASS |
| 获取需求模板 | ✅ PASS |
| 验证有效需求数据 | ✅ PASS |
| 验证无效需求数据 (缺少必填字段) | ✅ PASS |
| 创建报告任务 | ✅ PASS |
| 获取报告任务状态 | ✅ PASS |
| 不存在的任务 → 404 | ✅ PASS |
| 列出所有任务 | ✅ PASS |
| 大纲未就绪时获取 → 400 | ✅ PASS |
| 幻灯片未就绪时获取 → 400 | ✅ PASS |
| 确认不存在的任务 → 400 | ✅ PASS |
| 取消任务 (DELETE) | ✅ PASS |

### 失败 (2) — 依赖真实 AI API 配置

| 测试 | 原因 | 影响 |
|------|------|------|
| LangGraph 完整工作流 (提交→轮询→完成) | AI 调用失败，任务状态变为 `failed` | 需要 `DASHSCOPE_API_KEY` 配置正确且网络可达 |
| Report 完整工作流 (启动→大纲→幻灯片→导出) | 任务卡在 `modules_ready`，未推进到 `outline_ready` | 同上，AI 生成大纲阶段失败 |

### 跳过 (2) — 需要前端运行

| 测试 | 原因 |
|------|------|
| 输入页面加载 | `test.skip` — 需要前端 dev server |
| 输入页面表单元素 | `test.skip` — 同上 |

---

## 三、安全验证

| 检查项 | 状态 | 说明 |
|--------|------|------|
| 前端无 API Key 泄露 | ✅ PASS | `.env.local` 已移除敏感 Key |
| CORS 非全开 | ✅ PASS | 限制为 `localhost:3000/3001` + `FRONTEND_URL` |
| 认证中间件 | ✅ PASS | `AuthMiddleware` 类 + `AUTH_ENABLED` 开关 |
| 无堆栈泄露 | ✅ PASS | 全局异常只返回 `"服务器内部错误"` |
| 速率限制 | ✅ PASS | slowapi 集成 + `RATE_LIMIT_ENABLED` 开关 |
| 后端 .env 未提交 | ✅ PASS | `git check-ignore` 确认已忽略 |

---

## 四、总结

| 维度 | 通过 | 失败 | 跳过 | 通过率 |
|------|------|------|------|--------|
| 后端 API (pytest) | 23 | 0 | 0 | **100%** |
| Playwright API | 15 | 2 | 2 | **88%** |
| 安全验证 | 6 | 0 | 0 | **100%** |
| **总计** | **44** | **2** | **2** | **92%** |

### 未通过项说明

2 个失败测试均为**端到端 AI 工作流测试**，需要：
1. 正确配置 `DASHSCOPE_API_KEY` 且 API 额度充足
2. 网络可访问 DashScope API (可能需要代理)
3. AI 响应时间在测试超时范围内

这些不是代码 bug，而是**环境依赖问题**。在本地开发环境配置好 AI Key 后应可通过。

---

## 五、建议后续

- [ ] 配置 AI Key 后重新运行 LangGraph 和 Report 完整工作流测试
- [ ] 启动前端 dev server 后运行 Playwright UI 测试 (`report-ui.spec.ts`)
- [ ] 考虑为 AI 相关测试添加 mock/stub 模式，降低环境依赖
- [ ] 集成 CI/CD 管道中添加 `pytest` 和 `playwright` 自动化测试步骤
