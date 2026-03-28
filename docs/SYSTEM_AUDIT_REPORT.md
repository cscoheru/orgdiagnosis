# Org-Diagnosis 系统审查报告

> 审查日期: 2026-03-27
> 项目: AI 驱动组织健康诊断系统 (五维诊断)
> 审查范围: 架构、逻辑、功能、页面、安全、E2E 测试

---

## 一、E2E 测试结果汇总

### 后端 API 测试 (curl)

| 测试项 | 状态 | 说明 |
|--------|------|------|
| `GET /health` | PASS | 返回 `{"status":"ok"}` |
| `GET /api/health` | PASS | 返回服务信息 |
| `POST /api/projects/` (创建项目) | PASS | 正常创建，含完整 requirement |
| `GET /api/projects/` (列表) | PASS | 返回 2 个项目 |
| `GET /api/projects/{id}` (单项目) | FAIL | ID 提取逻辑问题（nested JSON） |
| `POST /api/projects/{id}/folders` (创建文件夹) | FAIL | 返回 404 Not Found |
| `GET /api/projects/{id}/folders` (列表文件夹) | PARTIAL | 返回 dict 而非 list |
| `POST /api/langgraph/analyze` (提交分析) | PASS | 返回 task_id |
| `GET /api/langgraph/status/{id}` (轮询) | FAIL | 立即 failed |
| `GET /api/langgraph/result/{id}` (获取结果) | FAIL | 无结果 |
| `POST /api/report/start` (启动报告) | FAIL | ClientRequirement 验证错误 (缺 5 个必填字段) |
| `GET /api/report/status/{id}` | FAIL | 同上 |
| `GET /api/knowledge/documents` | PARTIAL | 返回 dict（非预期格式） |
| `POST /api/knowledge/search` | PARTIAL | 返回 dict（非预期格式） |
| `POST /api/requirement/extract` | FAIL | 无返回（可能超时或 crash） |

**通过率: 5/15 (33%)**

### Playwright UI 测试

| 指标 | 结果 |
|------|------|
| 总测试 | 34 |
| 通过 | 15 (44%) |
| 失败 | 16 (47%) |
| 跳过 | 3 (9%) |

**失败分类:**
- API 测试失败 (2): LangGraph 诊断、报告工作流
- UI 页面加载失败 (2): 报告页面相关
- 表单交互失败 (5): 导航、验证、动态字段、按钮选择、预览
- 工作区失败 (2): 无效 task_id 处理
- 导航失败 (2): 侧边栏、提示区域
- 可访问性失败 (2): 键盘导航、标签关联
- 响应式失败 (2): 移动端、平板

---

## 二、安全问题 (P0 - 立即修复)

### S1. API Key 泄露 [严重]
**位置**: `.env.local:3-4`, `lib/ai/zhipu.ts:10`
**现状**: DeepSeek Key `sk-847f...` 和 ZhipuAI Key `b5d7...` 硬编码在前端 `.env.local` 中，通过 `process.env.DEEPSEEK_API_KEY` 直接暴露到客户端 bundle。
**影响**: 任何人可通过浏览器 DevTools 获取 API Key，导致费用被盗用。
**修复方案**:
- 移除 `DEEPSEEK_API_KEY` 和 `ZHIPUAI_API_KEY` 从前端环境变量
- 所有 AI 调用统一走后端 API `/api/langgraph/analyze`
- `.env.local` 仅保留 `NEXT_PUBLIC_*` 前缀的非敏感配置

### S2. CORS 全开 [严重]
**位置**: `backend/app/config.py:21`
**现状**: `CORS_ORIGINS = ["*"]` + `allow_credentials=True`
**影响**: 任何网站可跨域调用后端 API，结合 S1 的 Key 泄露，风险极高。
**修复方案**:
```python
CORS_ORIGINS = [
    os.getenv("FRONTEND_URL", "http://localhost:3000"),
    "https://your-production-domain.com"
]
```

### S3. 无 API 认证 [严重]
**现状**: 所有 API 端点完全开放，无需任何认证。
**影响**: 任何人可创建/删除项目、调用 AI 分析（消耗 API 额度）。
**修复方案**: 添加 Supabase Auth 中间件，验证 Bearer Token。

### S4. 全局异常泄露 [中]
**位置**: `backend/app/main.py:74`
**现状**: DEBUG 模式返回 `str(exc)`，可能暴露数据库结构、文件路径等。
**修复方案**: 生产环境只返回通用错误信息。

### S5. 无速率限制 [中]
**修复方案**: 添加 `slowapi` 中间件。

---

## 三、后端架构问题 (P1)

### A1. 双路由体系 [维护困难]
**现状**:
- `backend/app/api/` - upload, analyze, diagnosis, export_pdf, langgraph_diagnosis
- `backend/api/` - projects, folders, requirement, report, knowledge, layout, knowledge_v2

两套目录结构不同，`app/api/router.py` 混合导入两处。
**修复方案**: 统一到 `backend/api/`，按功能分子模块。

### A2. LangGraph 诊断全是 Mock [核心功能失效]
**位置**: `backend/lib/langgraph/workflow.py:119-137`
**现状**: `_analyze_with_ai()` 直接返回硬编码的 mock 数据：
```python
def _analyze_with_ai(task_id, dimension, context):
    # 临时返回 mock 数据
    return {"category": dimension, "total_score": 50.0, ...}
```
E2E 测试确认：LangGraph 分析任务提交后立即 failed。
**根因**: 没有集成真实 AI API，且 LangGraph 工作流的异步执行有问题。
**修复方案**: 复用 `ai_extractor.py` 的 DeepSeek 调用逻辑。

### A3. 内存状态管理 [数据丢失]
**位置**: `backend/lib/langgraph/workflow.py:316`
**现状**: `_task_status: Dict[str, Dict]` 使用内存字典。
**修复方案**: 改用 `lib/storage/task_store.py` (SQLite)。

### A4-A7. 代码质量问题
- `nodes.py:83-228` - `_generate_modules()` 和 `_generate_modules_fallback()` 完全重复（~145 行）
- `requirement.py:152-165` - 3 个连续不可达的 return 语句
- `report.py:69-94` - `ModulesResponse` 重复定义
- `report.py:561-565` - `get_page_titles` 末尾不可达的 return

### A8-A10. 功能缺陷
- `ai_service.py:42` - 用 URL 包含 "dashscope" 判断模型，极度脆弱
- `pptx_renderer.py:33-46` - 所有 11 种布局映射到空白布局 6
- `pptx_renderer.py:328-354` - `data_chart` 渲染为纯文本 bullet list

---

## 四、前端架构问题 (P1)

### F1. 知识库页面空实现
**位置**: `app/(dashboard)/knowledge/page.tsx`
**现状**: 直接 `redirect('/dashboard')`，无任何功能。

### F2. 结果列表页未完成
**位置**: `app/(dashboard)/result/page.tsx`
**现状**: 有 TODO 注释，未连接 API。

### F3. 无 Error Boundary
**影响**: 任何子组件报错会导致整个应用白屏。

### F4. 前端直接调 AI API
**位置**: `lib/ai/zhipu.ts:69-88`
**现状**: 从客户端直接调用 `https://api.deepseek.com/v1/chat/completions`。
**影响**:
- API Key 暴露 (S1)
- 受浏览器 CORS 限制（DeepSeek 可能不允许跨域）
- Vercel Serverless Function 有 10s 超时限制

### F5. 前后端数据模型不统一
- 前端 `types/diagnosis.ts`: `L2_categories`, `L3_items`, `overall_score` (camelCase)
- 后端 `app/models/schemas.py`: 类似的 snake_case 结构
- 没有统一的转换层

---

## 五、数据流问题 (P1)

### D1. AI 调用双轨制
```
前端 zhipu.ts → DeepSeek API → 直接返回结果
后端 ai_extractor.py → DeepSeek API → 不同格式
后端 langgraph/workflow.py → Mock 数据
```
三条路径，三种格式，完全不同步。

### D2. 诊断结果无持久化
LangGraph 诊断完成后，结果只存在 `MemorySaver` 中，不存 Supabase。

### D3. 报告状态混合存储
`ReportWorkflowManager` 同时使用:
- `MemorySaver` (LangGraph checkpoint)
- `task_store.py` (SQLite)

两者数据可能不一致。

---

## 六、E2E 测试发现的功能缺陷

| # | 缺陷 | 严重性 | 详情 |
|---|------|--------|------|
| E1 | **LangGraph 诊断完全无法工作** | 严重 | 提交后立即 failed，mock AI 未正确集成 |
| E2 | **报告生成缺少必填字段验证** | 严重 | 前端发送的简化 requirement 不满足后端 Pydantic 校验 |
| E3 | **文件夹 API 404** | 中 | `/api/projects/{id}/folders` POST 返回 404 |
| E4 | **项目 ID 嵌套提取失败** | 中 | 返回的是 nested JSON，curl 解析 ID 失败 |
| E5 | **需求提取无响应** | 中 | 可能超时或 DashScope API 未配置 |
| E6 | **知识库返回格式不一致** | 低 | 返回 dict 而非预期的 list |

---

## 七、系统规划建议

### 架构优化

#### 1. 统一 AI 调用层 (Week 1)
```
当前: 前端→DeepSeek, 后端→DeepSeek+Mock, LangGraph→Mock
目标: 前端→后端API→统一AI服务层→DeepSeek/DashScope/ZhipuAI
```
- 创建 `backend/app/services/ai_service.py` 统一 AI 服务
- 支持多模型 fallback: DeepSeek → DashScope → ZhipuAI
- 前端移除 `zhipu.ts` 的直接调用

#### 2. 统一路由架构 (Week 1)
```
backend/
  api/
    __init__.py
    router.py          # 主路由注册
    auth.py            # 认证
    projects.py        # 项目管理
    diagnosis.py       # 诊断
    reports.py         # 报告
    knowledge.py       # 知识库
    upload.py          # 文件上传
```

#### 3. 认证与安全 (Week 1)
- Supabase Auth JWT 中间件
- CORS 白名单
- Rate limiting (slowapi)
- 移除前端 AI Key

### 功能完善

#### 4. 修复 LangGraph 诊断 (Week 2)
- 将 `_analyze_with_ai()` 连接到 `ai_extractor.py`
- 修复异步任务执行（当前 asyncio.create_task 可能在请求结束后被取消）
- 结果持久化到 Supabase

#### 5. 修复报告生成流程 (Week 2)
- 前后端对齐 `ClientRequirement` 的必填字段
- 前端表单补充缺失字段（industry_background, company_intro, phase_planning 等）
- 修复 `E2E 测试发现的字段缺失问题

#### 6. 完成未实现页面 (Week 2)
- `/knowledge` - 知识库管理
- `/result` - 诊断历史列表

### 代码质量

#### 7. 清理技术债 (Week 2)
- 删除重复的 `_generate_modules()` / `_generate_modules_fallback()`
- 删除死代码 (requirement.py 的 3 个 return, report.py 重复定义)
- 统一 Pydantic model 定义

#### 8. PPTX 渲染增强 (Week 3)
- 实现雷达图布局（使用 python-pptx 图表 API）
- 实现甘特图布局
- 实现双列对比布局

### 依赖优化

#### 9. 精简依赖 (Week 3)
- 移除 LlamaIndex（被 LangChain 覆盖）
- 评估 `unstructured` 的必要性
- Python 版本降级到 3.12（稳定版）
- 升级 FastAPI

---

## 八、实施计划

### Phase 1: 安全加固 & 架构清理 (Week 1, 5 天)

| 天 | 任务 | 优先级 |
|----|------|--------|
| D1 | S1: 移除前端 `.env.local` 中的 API Key | P0 |
| D1 | S2: 后端 CORS 限制白名单 | P0 |
| D1 | A5/A6/A7: 清理死代码和重复定义 | P1 |
| D2 | F3: 添加全局 Error Boundary | P1 |
| D3 | A1: 统一后端路由结构 | P1 |
| D4 | S3: 添加 Supabase Auth 中间件 | P0 |
| D5 | S4: 生产环境关闭 DEBUG 详情 | P1 |

### Phase 2: 核心功能修复 (Week 2, 5 天)

| 天 | 任务 | 优先级 |
|----|------|--------|
| D6 | A2: LangGraph 诊断集成真实 AI | P0 |
| D6 | A3: 诊断任务状态持久化 | P1 |
| D7 | D1: 统一 AI 调用层 | P0 |
| D7 | F4: 移除前端直接 AI 调用 | P0 |
| D8 | E2: 修复报告生成字段缺失 | P0 |
| D9 | D2/D3: 诊断结果持久化 + 统一状态管理 | P1 |
| D9 | F5: 前后端数据模型统一 | P1 |
| D10 | F1/F2: 完成知识库和结果列表页 | P1 |

### Phase 3: 功能增强 (Week 3, 5 天)

| 天 | 任务 | 优先级 |
|----|------|--------|
| D11 | A9/A10: PPTX 高级布局渲染 | P1 |
| D12 | S5: 添加 rate limiting | P1 |
| D13 | DEP1-DEP4: 依赖精简 | P2 |
| D14 | 响应式优化 | P2 |
| D15 | 加载体验优化 (骨架屏/进度条) | P2 |

### Phase 4: 质量保证 (Week 4, 5 天)

| 天 | 任务 | 优先级 |
|----|------|--------|
| D16 | 后端 API E2E 测试全通过 | P0 |
| D17 | Playwright UI 测试全通过 | P0 |
| D18 | 性能测试 | P1 |
| D19 | 安全扫描 | P1 |
| D20 | 代码审查 & 文档更新 | P2 |

---

## 九、风险提示

1. **Render 免费层休眠**: 后端部署在 Render 免费层，15 分钟无请求会休眠，首次请求冷启动 ~30s
2. **DeepSeek API 额度**: 当前 Mock 降级策略意味着生产环境实际可能无法使用 AI
3. **Supabase RLS**: 匿名访问的 RLS 策略可能导致数据安全问题
4. **Python 3.14**: preview 版本，部分第三方库可能不兼容

---

## 十、总结

| 维度 | 评分 | 说明 |
|------|------|------|
| **架构** | 6/10 | 双路由、双 AI 调用路径，架构不统一 |
| **安全** | 3/10 | API Key 泄露、CORS 全开、无认证 |
| **功能完成度** | 5/10 | 核心诊断流程不工作，多个页面空实现 |
| **代码质量** | 5/10 | 大量重复代码、死代码、Mock 未清理 |
| **测试覆盖** | 4/10 | E2E 通过率 33-44%，缺少单元测试 |
| **可维护性** | 4/10 | 依赖过重、Python 版本不稳定 |
| **生产就绪度** | 3/10 | 不建议直接上线 |

**整体评估: 当前项目处于 MVP 原型阶段，核心 AI 诊断功能尚未真正工作。建议按上述 4 周计划逐步修复，Phase 1 的安全加固应立即执行。**
