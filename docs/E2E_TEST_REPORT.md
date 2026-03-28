# E2E 测试报告

> 项目：咨询的天空 v2.0
> 测试日期：2026-03-28
> 文档版本：2.0（最终版）

---

## 一、测试环境

| 项目 | 详情 |
|------|------|
| 操作系统 | macOS (Darwin 25.1.0) |
| Python | 3.14 |
| Node.js | 当前版本 |
| 浏览器 | Chromium (Playwright) |
| AI 服务 | DashScope（通义千问 qwen-plus） |
| 测试框架 | Playwright E2E |
| 后端地址 | http://localhost:8000 |
| 前端地址 | http://localhost:3000 |

---

## 二、测试结果总览

| 指标 | 数值 |
|------|------|
| **总测试数** | 60 |
| **通过** | **44** |
| **失败** | 13 |
| **跳过** | 3 |
| **通过率** | **73.3%** |
| **新增测试通过率** | **100% (26/26)** |

### 新增测试（全部通过 ✅）

| 测试文件 | 用例数 | 通过 | 失败 | 状态 |
|---------|--------|------|------|------|
| health-api.spec.ts | 3 | 3 | 0 | ✅ |
| projects-api.spec.ts | 4 | 4 | 0 | ✅ |
| workflow-w1-api.spec.ts | 5 | 5 | 0 | ✅ |
| workflow-w2-api.spec.ts | 4 | 4 | 0 | ✅ |
| workflow-w3-api.spec.ts | 4 | 4 | 0 | ✅ |
| navigation-ui.spec.ts | 6 | 6 | 0 | ✅ |
| **合计** | **26** | **26** | **0** | ✅ |

### 预存测试（已存在的问题）

| 测试文件 | 用例数 | 通过 | 失败 | 备注 |
|---------|--------|------|------|------|
| langgraph-api.spec.ts | 2 | 1 | 1 | LangGraph 集成未完成 |
| report-api.spec.ts | 3 | 2 | 1 | 旧版报告 API |
| report-ui.spec.ts | 11 | 0 | 11 | 旧版报告 UI 页面已弃用 |
| **合计** | **16** | **3** | **13** | 非新增代码问题 |

---

## 三、新增测试详细结果

### 3.1 API 健康检查（3/3 通过）

| # | 测试用例 | 状态 | 耗时 |
|---|---------|------|------|
| 1 | GET /health 返回 `{"status": "ok"}` | ✅ | 343ms |
| 2 | GET /api/health 返回 `{"status": "healthy", ...}` | ✅ | 357ms |
| 3 | GET /api/v2/workflow/configs 返回 3 种工作流配置 | ✅ | 366ms |

### 3.2 项目 CRUD（4/4 通过）

| # | 测试用例 | 状态 | 耗时 |
|---|---------|------|------|
| 4 | POST /api/projects/ 创建新项目（带 selected_modules） | ✅ | 359ms |
| 5 | GET /api/projects/ 列表包含新创建的项目 | ✅ | 11ms |
| 6 | GET /api/projects/{id} 返回项目详情 | ✅ | 51ms |
| 7 | PATCH /api/projects/{id} 更新项目状态 | ✅ | 6ms |

### 3.3 W1 需求分析工作流（5/5 通过）

| # | 测试用例 | 状态 | 耗时 | 备注 |
|---|---------|------|------|------|
| 8 | POST /api/v2/workflow/start (workflow_type=proposal) | ✅ | 12ms | 创建 proposal 工作流 |
| 9 | POST /api/v2/workflow/smart-extract | ✅ | 3.3s | AI 提取结构化数据 |
| 10 | POST /api/v2/workflow/{sid}/execute (milestone_plan) | ✅ | 2.1s | AI 生成里程碑计划 |
| 11 | POST /api/v2/workflow/{sid}/advance | ✅ | 7ms | 推进工作流步骤 |
| 12 | GET /api/v2/workflow/{sid}/state | ✅ | 7ms | 验证 5 步完整状态 |

### 3.4 W2 调研诊断工作流（4/4 通过）

| # | 测试用例 | 状态 | 耗时 | 备注 |
|---|---------|------|------|------|
| 13 | POST /api/v2/workflow/start (workflow_type=diagnosis) | ✅ | 11ms | 创建 diagnosis 工作流 |
| 14 | POST /api/v2/workflow/smart-question | ✅ | 9.2s | AI 生成补充问题 |
| 15 | POST /api/v2/workflow/{sid}/execute (dashboard) | ✅ | 8ms | 执行五维分析 |
| 16 | GET /api/v2/workflow/{sid}/state | ✅ | 5ms | 验证诊断工作流状态 |

### 3.5 W3 项目交付工作流（4/4 通过）

| # | 测试用例 | 状态 | 耗时 | 备注 |
|---|---------|------|------|------|
| 17 | POST /api/v2/workflow/start (workflow_type=delivery) | ✅ | 7ms | 创建 delivery 工作流 |
| 18 | POST /api/v2/workflow/{sid}/advance (create_order) | ✅ | 43ms | 创建咨询订单 |
| 19 | POST /api/v2/workflow/{sid}/execute (phase_execute) | ✅ | 9ms | 执行阶段任务 |
| 20 | GET /api/v2/workflow/{sid}/state | ✅ | 5ms | 验证交付工作流状态 |

### 3.6 UI 导航（6/6 通过）

| # | 测试用例 | 状态 | 耗时 |
|---|---------|------|------|
| 21 | /overview 加载并显示"总览"标题 | ✅ | 703ms |
| 22 | /projects 加载并显示项目列表 | ✅ | 689ms |
| 23 | /data 加载并显示"数据探索" | ✅ | 734ms |
| 24 | /settings 加载并显示"设置" | ✅ | 692ms |
| 25 | /result 显示弃用迁移横幅 | ✅ | 4.2s |
| 26 | /input 显示弃用迁移横幅 | ✅ | 300ms |

---

## 四、AI LLM 联调结果

### 4.1 DashScope 通义千问 qwen-plus 集成

| 项目 | 详情 |
|------|------|
| 模型 | DashScope qwen-plus |
| API Key | 已配置于 `backend/.env` |
| 自动检测 | 后端 `ai_client.py` 自动识别 DashScope provider |

### 4.2 AI 端点验证

| 端点 | 用途 | 响应时间 | 状态 |
|------|------|---------|------|
| POST /api/v2/workflow/smart-extract | 需求文本结构化提取 | ~3.3s | ✅ 通过 |
| POST /api/v2/workflow/smart-question | AI 补充问题生成 | ~9.2s | ✅ 通过 |
| POST /api/v2/workflow/{sid}/execute (milestone_plan) | 里程碑计划生成 | ~2.1s | ✅ 通过 |

**验证结论**: AI LLM 服务正常，返回结构化 JSON 数据（非 mock），响应时间在可接受范围内。

---

## 五、发现并修复的问题

### 5.1 后端路由顺序问题（已修复）

| 问题 | 严重程度 | 修复 |
|------|---------|------|
| `GET /api/v2/workflow/configs` 被 `/{session_id}` 动态路由拦截，返回"会话不存在: configs" | 高 | 调整路由注册顺序，静态路由在前 |

### 5.2 Playwright 测试并发问题（已修复）

| 问题 | 严重程度 | 修复 |
|------|---------|------|
| 共享状态变量（sessionId, projectId）在 `fullyParallel` 模式下跨 worker 不可见 | 高 | 使用 `test.describe.serial` 替代 `test.describe` |

### 5.3 selected_modules JSON 字符串问题（已修复）

| 问题 | 严重程度 | 修复 |
|------|---------|------|
| API 返回 `selected_modules` 为 JSON 字符串而非数组，导致 `.map()` 报错，Overview/Projects/Data 页面崩溃 | 高 | 前端统一做防御性 JSON.parse，影响 4 个页面文件 |

**修复的文件**:
- `app/(dashboard)/overview/page.tsx` — 添加 normalize 逻辑
- `app/(dashboard)/projects/page.tsx` — 添加 normalize 逻辑
- `app/(dashboard)/data/page.tsx` — 添加 normalize 逻辑
- `app/(dashboard)/projects/[id]/layout.tsx` — 添加 normalize 逻辑

### 5.4 UI 测试选择器问题（已修复）

| 问题 | 修复 |
|------|------|
| 页面标题匹配：所有页面共享 "五维诊断系统" 标题 | 更新 title 正则 |
| h1 选择器：sidebar 的 "咨询的天空" 被优先匹配 | 使用 `main h1` 限定范围 |
| 弃用横幅文本不统一：`/result` 和 `/input` 用不同文本 | 分别匹配对应文本 |

---

## 六、待观察问题

| # | 问题描述 | 严重程度 | 备注 |
|---|---------|---------|------|
| 1 | DashScope API 偶发超时 | 中 | 网络波动时响应可能超 30s |
| 2 | InMemoryDB 重启数据丢失 | 低 | 开发环境已知限制 |
| 3 | selected_modules 后端返回字符串格式 | 低 | 已在前端修复，建议后端统一返回数组 |

---

## 七、测试结论

### 整体评估

| 维度 | 评估 |
|------|------|
| 功能完整性 | W1/W2/W3 三阶段工作流全部实现，前端页面完整 |
| API 稳定性 | V2 API 端点全部正常，路由顺序问题已修复 |
| AI 集成 | DashScope qwen-plus 联调通过，smart-extract/smart-question 正常工作 |
| UI 交互 | 页面导航、弃用横幅、维度标签渲染全部验证通过 |
| 数据一致性 | selected_modules 字段格式不一致已修复 |

### 结论

**新增的 26 个 E2E 测试全部通过（100%），前后端联调正常，AI LLM 服务集成验证成功。** 预存的 13 个失败测试属于旧版报告页面和 LangGraph 集成（非本次开发范围），不影响新功能。

---

## 附录：测试命令

```bash
# 启动后端
cd backend && python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

# 启动前端
npm run dev

# 运行全部 E2E 测试
npx playwright test

# 仅运行 API 测试
npx playwright test --project='API Tests'

# 仅运行 UI 测试
npx playwright test --project='UI Tests'

# 运行指定测试文件
npx playwright test tests/e2e/navigation-ui.spec.ts

# 查看测试报告
npx playwright show-report
```
