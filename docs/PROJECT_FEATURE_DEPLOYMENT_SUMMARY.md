# DeepConsult Copilot — 项目功能、部署与测试总结

> 更新日期: 2026-03-28

---

## 1. 项目概述

DeepConsult Copilot 是一套 AI 驱动的组织诊断与咨询报告生成平台。核心能力：将客户需求通过结构化工作流，自动生成专业的项目建议书（PPTX 格式），覆盖需求分析、调研诊断、方案交付三大咨询场景。

### 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | Next.js 16 + React 19 + Tailwind CSS v4 | App Router, SSR |
| 后端 | Python FastAPI + Uvicorn | REST API, AI 调度 |
| AI | DashScope (通义千问) | 内容生成、智能提取 |
| 数据库 | SQLite (项目/工作流存储) | 轻量级、零依赖 |
| 文件导出 | python-pptx (PPTXRendererV2) | 40+ 布局的专业 PPTX |

---

## 2. 功能架构

### 2.1 三类咨询工作流

系统通过配置驱动的工作流引擎（`backend/lib/workflow_engine/`）管理三类咨询交付流程：

| 工作流 | 标识 | 步骤数 | 说明 |
|--------|------|--------|------|
| **需求分析与建议书** | `proposal` (W1) | 6 步 | 完整建议书生成流程 |
| **调研诊断与报告** | `diagnosis` (W2) | 4 步 | 五维诊断报告生成 |
| **项目解决方案** | `delivery` (W3) | 4 步 | 阶段性交付管理 |

### 2.2 W1 建议书工作流（核心功能）

```
Step 1: 基本信息与需求（智能提取 + 手动编辑）
    ↓ AI 辅助 / 手动填写
Step 2: 核心需求与计划（里程碑计划）
    ↓ AI 生成 → 用户编辑确认
Step 3: MDS 幻灯片（直接从 Step 2 派生，无需 AI）
    ↓ 自动生成可编辑表格
Step 4: 详细大纲（3 级结构：阶段 → 活动 → 页面）
    ↓ 按阶段/活动分级 AI 生成
Step 5: PPT 模板与布局（主题 + 逐页 layout 选择）
    ↓ 前端操作
Step 6: 生成 PPTX（对接 V2 渲染器）
    → 下载
```

#### Step 1: 智能提取
- 用户粘贴客户原始文本
- AI 自动提取：客户名称、行业、公司规模、痛点（含严重程度）、目标、成功标准
- 用户可手动编辑所有字段
- 支持痛点添加/删除/排序，严重程度 4 级标记（严重/高/中/低）

#### Step 2: 核心需求与计划
- AI 生成项目总体目标和分阶段计划
- 每个阶段包含：名称、周期、目标、关键活动（动态列表）、交付物（动态列表）
- 用户可添加/删除/编辑阶段
- 验证：项目目标必填，至少 1 个阶段

#### Step 3: MDS 幻灯片（Million Dollar Slide）
- **无需 AI 生成**，直接从 Step 2 数据派生
- 可编辑表格视图：列 = 阶段，行 = 活动/成果
- 支持添加/删除行列，单元格可编辑
- 包含：标题、项目目标、核心信息（价值主张）、预期成果

#### Step 4: 详细大纲（3 级结构）
- **L1 阶段** → **L2 关键活动** → **L3 页面**
- 从 `planData` 自动初始化 L1 和 L2
- L3 页面通过 AI 分级生成：
  - 按阶段生成（`/generate-outline-section`）— 生成整个阶段的活动+页面
  - 按活动生成（`/generate-outline-activity`）— 只生成一个活动的页面
- 每页包含 4 要素：storyline（核心观点）、论点、论据、素材
- 页面类型：`content`（内容）、`methodology`（方法论）、`case`（案例）
- 支持新增 3 种类型页面、折叠/展开、手动编辑

#### Step 5: PPT 模板与布局
- 5 个内置主题：商务蓝、自然绿、优雅紫、活力橙、商务灰
- 每页可独立选择 layout 类型
- 自动初始化 layout 映射

#### Step 6: 生成 PPTX
- 对接 `PPTXRendererV2` 渲染器（40+ layouts）
- 读取用户选择的主题和逐页 layout 配置
- 从 3 级大纲（sections → activities → slides）收集所有页面数据
- 返回下载 URL，前端通过 fetch+blob 实现跨域下载

### 2.3 关键子系统

#### 工作流引擎 (`backend/lib/workflow_engine/`)

| 文件 | 职责 |
|------|------|
| `engine.py` | 会话生命周期管理，含内存存储 + SQLite 持久化 + 自动恢复 |
| `workflow_config.py` | 3 类工作流的步骤配置（StepConfig） |
| `registry.py` | 步骤处理器注册表（`@register_step` 装饰器） |
| `step.py` | BaseStepHandler 基类和 StepResult 返回类型 |

**Session 持久化**：
- `advance_step()` 和 `execute_step()` 后自动调用 `_persist_session()` → SQLite
- `start_workflow()` 尝试从 DB 恢复已有 session（按 project_id 查找）
- 前端 `startWorkflow()` 返回 `all_step_data`，useEffect 恢复所有步骤状态

#### AI 生成 (`backend/lib/workflow_engine/steps/ai_generate.py`)

| Prompt 标识 | 用途 | 超时 | max_tokens |
|-------------|------|------|------------|
| `milestone_plan` | 生成里程碑计划 | 60s | 4096 |
| `impl_outline` | 全量生成大纲（兼容用） | 180s | 8192 |
| `impl_outline_section` | 按阶段生成大纲 | 60s | 4096 |
| `impl_outline_activity` | 按活动生成大纲 | 60s | 4096 |

使用 DashScope API（`backend/app/services/ai_client.py`），支持 JSON 解析、重试（tenacity）。

#### PPTX 渲染器 (`backend/services/pptx_renderer_v2.py`)

- 40+ 内置 slide layout
- 5 套内置主题配色方案
- 支持逐页 layout 指定 + 自动布局 fallback
- 输出到 `output/pptx/` 目录

#### 布局系统 (`backend/lib/layout/`)

| 文件 | 职责 |
|------|------|
| `template_manager.py` | 5 个内置主题管理 |
| `intelligent_selector.py` | 基于内容分析的智能 layout 推荐 |
| `content_analyzer.py` | 内容分析（文本长度、列表项数等） |

### 2.4 导出 MD 功能

Step 2/3/4 均支持「导出 MD」按钮，将当前步骤数据导出为 Markdown 文件：

| 步骤 | 导出内容 |
|------|---------|
| Step 2 核心需求与计划 | 项目目标 + 阶段表格（活动+交付物） |
| Step 3 MDS 幻灯片 | 标题 + 目标 + 核心信息 + 阶段-活动矩阵表 + 预期成果 |
| Step 4 详细大纲 | 3 级结构：阶段 → 活动 → 页面（含类型标签、论点/论据/素材） |

导出实现：`lib/workflow/export-md.ts` → `Blob` → `URL.createObjectURL` → 下载。

---

## 3. API 接口

### 3.1 基础接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/api/v2/workflow/configs` | 列出所有工作流配置 |
| POST | `/api/v2/workflow/start` | 启动/恢复工作流会话 |

### 3.2 工作流操作接口

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/v2/workflow/{session_id}` | 获取当前步骤状态 |
| GET | `/api/v2/workflow/{session_id}/state` | 获取完整状态（含所有步骤数据） |
| POST | `/api/v2/workflow/{session_id}/advance` | 推进到下一步（附带编辑数据） |
| POST | `/api/v2/workflow/{session_id}/execute` | 手动触发 AI 生成 |
| POST | `/api/v2/workflow/{session_id}/generate-outline-section` | 按阶段生成大纲 |
| POST | `/api/v2/workflow/{session_id}/generate-outline-activity` | 按活动生成大纲 |

### 3.3 内容生成接口

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/v2/workflow/smart-extract` | AI 智能提取结构化需求 |
| POST | `/api/v2/workflow/smart-question` | AI 智能补问 |

### 3.4 文件下载

| 方法 | 端点 | 说明 |
|------|------|------|
| GET | `/api/output/pptx/{filename}` | 下载 PPTX 文件 |

---

## 4. 前端组件

### 4.1 工作流步骤组件 (`components/workflow/`)

| 组件 | 步骤 | 核心功能 |
|------|------|----------|
| `SmartExtractStep` | Step 1 | 智能提取 + 痛点编辑 + 问卷 |
| `MilestonePlanStep` | Step 2 | 阶段规划 + AI 生成 + 导出 MD |
| `MDSContentStep` | Step 3 | 可编辑表格 + 自动从计划生成 + 导出 MD |
| `ImplementationOutlineStep` | Step 4 | 3 级大纲 + 分级 AI 生成 + 导出 MD |
| `TemplateSelectionStep` | Step 5 | 主题选择 + 逐页 layout |
| `PPTOutputStep` | Step 6 | PPTX 生成 + 下载 |
| `WorkflowStepNavigator` | 导航器 | 步骤进度条 + 前后导航 |

### 4.2 通用组件

| 组件 | 用途 |
|------|------|
| `DynamicListInput` | 可动态添加/删除的字符串列表输入 |
| `PhaseCard` | 阶段卡片（名称/周期/目标/活动/交付物） |

---

## 5. 数据模型

### 5.1 数据库（SQLite）

| 表 | 用途 |
|----|------|
| `projects` | 项目基本信息 + workflow_data JSON + workflow_session_id |
| `project_requirements` | 需求表单数据 |
| `project_outlines` | 大纲数据（版本化） |
| `project_slides` | 单页幻灯片数据 |
| `project_exports` | 导出记录 |

### 5.2 核心 TypeScript 类型 (`lib/workflow/w1-types.ts`)

| 类型 | 说明 |
|------|------|
| `EnhancedSmartExtractData` | Step 1: 客户需求（痛点含严重程度） |
| `EnhancedMilestonePlanData` | Step 2: 里程碑计划（阶段+活动+交付物） |
| `MDSSingleSlide` | Step 3: MDS 表格（phases + rows） |
| `DetailedOutlineData` | Step 4: 3 级大纲（sections → activities → slides） |
| `TemplateSelectionData` | Step 5: 模板选择（theme + slide_layouts） |

---

## 6. 部署方案

### 6.1 后端部署

```bash
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

- **运行环境**: Python 3.10+
- **启动方式**: uvicorn + --reload（开发）/ gunicorn（生产）
- **数据库**: SQLite，自动初始化（含迁移）
- **AI 服务**: DashScope API（需配置 `DASHSCOPE_API_KEY`）

### 6.2 前端部署

```bash
cd org-diagnosis
npm run dev    # 开发: http://localhost:3000
npm run build  # 生产构建
```

- **框架**: Next.js 16，App Router
- **运行端口**: 3000
- **CORS**: 后端已配置 `http://localhost:3000` 跨域访问

### 6.3 环境变量

后端 `.env` 需要配置：
```
DASHSCOPE_API_KEY=sk-xxx    # DashScope API 密钥（AI 生成必需）
```

前端 `.env.local`（如使用独立 API 地址）：
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### 6.4 目录结构总览

```
org-diagnosis/
├── app/                              # Next.js App Router 前端
│   ├── (auth)/                       # 认证页面
│   ├── (dashboard)/                  # 主应用
│   │   └── projects/[id]/proposal/  # W1 建议书工作流
│   └── api/                         # 前端 API routes
├── backend/                         # Python FastAPI 后端
│   ├── app/
│   │   ├── main.py                 # 应用入口 + 中间件
│   │   ├── api/
│   │   │   ├── router.py            # 路由注册 + PPTX 下载
│   │   │   └── v2/workflow.py      # 工作流 API（含分级生成）
│   │   └── services/
│   │       ├── ai_client.py        # DashScope AI 客户端
│   │       └── pptx_renderer_v2.py # PPTX V2 渲染器
│   └── lib/
│       ├── workflow_engine/         # 工作流引擎
│       │   ├── engine.py           # 会话管理 + 持久化
│   │   ├── workflow_config.py    # 工作流配置
│       │   ├── registry.py         # 处理器注册
│       │   └── steps/
│       │       ├── ai_generate.py   # AI 生成处理器
│       │       └── ppt_export.py    # PPT 导出处理器
│       ├── projects/store.py       # 项目 SQLite 存储
│       ├── layout/                # 布局系统
│       └── workflow/
│           ├── w1-types.ts         # W1 类型定义 + 工厂函数
│           ├── export-md.ts        # Markdown 导出
│           └── workflow-client.ts   # 前端 API 客户端
├── components/workflow/           # 工作流步骤组件
└── output/pptx/                  # PPTX 文件输出目录
```

---

## 7. 测试方案

### 7.1 单元测试

**后端 Python 测试**:
```bash
cd backend
python3 -m pytest tests/ -v
```

**前端 TypeScript 类型检查**:
```bash
npx tsc --noEmit
```

### 7.2 API 接口测试

**健康检查**:
```bash
curl http://localhost:8000/health
```

**启动工作流**:
```bash
curl -X POST http://localhost:8000/api/v2/workflow/start \
  -H 'Content-Type: application/json' \
  -d '{"project_id": "test-uuid", "workflow_type": "proposal"}'
```

**智能提取**:
```bash
curl -X POST http://localhost:8000/api/v2/workflow/smart-extract \
  -H 'Content-Type: application/json' \
  -d '{"text": "XX科技是一家制造业企业，员工500人..."}'
```

**按阶段生成大纲**:
```bash
curl -X POST http://localhost:8000/api/v2/workflow/{session_id}/generate-outline-section \
  -H 'Content-Type: application/json' \
  -d '{"section_index": 0}'
```

**PPTX 下载**:
```bash
curl http://localhost:8000/api/output/pptx/{filename} -o output.pptx
```

### 7.3 E2E 测试流程

1. 打开 `http://localhost:3000`
2. 创建新项目
3. 进入「需求分析与建议书」工作流
4. **Step 1**: 粘贴客户文本 → 点击「智能提取」→ 检查提取结果 → 手动编辑 → 确认
5. **Step 2**: 点击「一键生成」→ 检查阶段计划 → 编辑阶段/活动/交付物 → 确认
6. **Step 3**: 验证表格自动从 Step 2 生成 → 编辑 → 确认
7. **Step 4**: 点击某个阶段的「AI 生成」→ 检查 3 级大纲结构 → 点击「AI」按钮生成单个活动 → 确认
8. **Step 5**: 选择主题 → 逐页调整 layout → 确认
9. **Step 6**: 点击「生成 PPTX」→ 下载 → 验证 PPTX 内容
10. **返回项目列表** → 重新打开项目 → 验证所有步骤数据已恢复（Session 持久化）
11. **导出 MD**: 在 Step 2/3/4 点击「导出 MD」→ 验证 Markdown 文件内容

### 7.4 关键验证点

| 验证项 | 预期结果 |
|--------|----------|
| AI 智能提取 | 正确提取客户信息、痛点、目标 |
| 大纲 3 级结构 | 阶段 → 活动 → 页面，页面有类型标签 |
| 按阶段 AI 生成 | 只生成选中阶段，不影响其他阶段 |
| 按活动 AI 生成 | 只生成选中活动，合并到现有大纲 |
| Session 持久化 | 关闭页面重新打开，数据完整恢复 |
| MDS 自动生成 | 进入 Step 3 时表格自动从 Step 2 派生 |
| PPTX 下载 | fetch+blob 跨域下载成功，非 about:blank |
| 导出 MD | 3 个步骤均可导出，内容格式正确 |
| Hydration | 无 button 嵌套错误 |

---

## 8. 已知限制与待办

### 当前限制

1. **AI API 依赖**: 需要 DashScope API Key 才能使用 AI 生成功能
2. **Session 存储**: 工作流 session 存储在内存 + SQLite，服务器重启后内存数据丢失（但 DB 数据可恢复）
3. **PPTX 布局**: 部分 layout 可能需要根据内容长度进一步优化

### 后续优化方向

1. **RAG 知识库**: 接入向量数据库（如 ChromaDB），为 AI 生成提供行业知识支撑
2. **多用户协作**: 当前为单用户系统，需要添加用户认证和权限管理
3. **模板上传**: 支持用户上传自定义 PPTX 模板
4. **实时协作**: WebSocket 实时同步编辑
5. **W2/W3 工作流**: 完善诊断工作流和交付工作流的前端组件
6. **PPTX 预览**: 在线预览生成的 PPTX 文件
