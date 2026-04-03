# DeepConsult Copilot — 项目全景文档

> **版本**: v2.1 (2026-04-02)  
> **定位**: AI 驱动的组织诊断与咨询报告自动生成平台  
> **代码规模**: 后端 ~11K 行 Python，前端 ~28K 行 TypeScript，测试 ~380 行

---

## 一、系统概述

### 1.1 产品定位

DeepConsult Copilot 是一套面向咨询行业的 AI 辅助系统，覆盖从"五维组织诊断"到"结构化项目建议书自动生成"的完整咨询工作流。核心价值在于：

- **结构化诊断**: 基于 IBM/华为 BLM 模型，从组织结构、业务流程、技术能力、人才梯队、企业文化五个维度评估组织健康度
- **智能报告生成**: 通过 LangGraph 编排的多步骤工作流，AI 自动扩写大纲 → 单页内容 → PPTX
- **协作共创**: MindManager 风格的画布工具，支持咨询师与客户实时协作构建方案框架
- **知识管理**: 文档上传 → 解析 → 向量化 → 语义检索，沉淀组织知识资产

### 1.2 目标用户

| 角色 | 使用场景 |
|------|---------|
| 咨询顾问 | 五维诊断、共创画布、报告生成 |
| 项目经理 | 进度追踪、甘特图、交付管理 |
| 客户 | 查看诊断结果、审阅报告 |
| 管理层 | 仪表盘、数据总览、团队管理 |

---

## 二、系统架构

### 2.1 总体拓扑

```
┌─────────────────────────────────────────────────────────────┐
│                    Vercel (HK Region)                        │
│              Next.js 16 + React 19 + TypeScript 5             │
│              https://5d.3strategy.cc                         │
│              静态导出 + ISR + Edge Middleware              │
└──────────────────────────┬──────────────────────────────┘
                           │ HTTPS (CORS: ✅)
                           ▼
┌──────────────────────────▼──────────────────────────────┐
│            Nginx Reverse Proxy (HK: 103.59.103.85)         │
│            SSL 终止 + /api/* 路由 → :8000               │
│            https://org-diagnosis.3strategy.cc               │
└──────┬────────────────┬──────────────────┬────────────────┘
       │                │                  │                  │
┌──────▼──────┐  ┌────▼──────┐  ┌─────────▼──┐  ┌──────────▼──────┐
│ FastAPI     │  │ ArangoDB  │  │ ChromaDB  │  │ MinIO           │
│ :8000      │  │ :8529     │  │ (in-proc) │  │ :9001           │
│            │  │ 图数据库   │  │ 向量存储   │  │ 对象存储        │
│ LangChain  │  └──────────┘  └──────────┘  └──────────┘      │
│ LangGraph  │                                                  │
│ DashScope  │  ┌───────────────────────────────────────────────┐ │
│ DeepSeek   │  │         Supabase (Cloud)                    │ │
│ python-   │  │  • PostgreSQL — 用户认证 + 项目元数据          │ │
│ pptx      │  │  • Row Level Security                      │ │
│            │  └───────────────────────────────────────────────┘ │
└────────────┘                                                │
```

### 2.2 双模式运行

系统支持两种运行模式，通过环境变量 `KERNEL_MODE` 切换：

| 模式 | 数据库 | 用途 |
|------|--------|------|
| **Demo** (默认) | 内存字典 | 开发演示、无需外部依赖 |
| **Production** | ArangoDB + MinIO + ChromaDB | 生产部署，数据持久化 |

Demo 模式下，后端启动时自动 seed 元模型（Workflow、Session、CanvasNode 等）。Production 模式连接真实 ArangoDB。

### 2.3 域础设施配置

| 服务 | 技术 | 域础设施 |
|------|------|---------|
| 前端 | Next.js 16 | Vercel (hkg1, 自动部署) |
| 后端 API | FastAPI + Uvicorn | Docker (HK 103.59.103.85) |
| 反向代理 | Nginx | 同上，SSL 终止 |
| 关系/图 | ArangoDB 7.9 | Docker (同上) |
| 向量 | ChromaDB 0.5 | 进程内 (Python) |
| 认证 | Supabase Auth | Cloud |
| 对象存储 | MinIO 7.2 | Docker (同上) |
| CI/CD | 无 | 手动 `deploy.sh` |

---

## 三、数据流

### 3.1 核心数据流: 报告生成

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────┐
│ 结构化需求   │────▶│ LangGraph     │────▶│ AI 内容扩展  │────▶│ PPTX     │
│ 录入 (表单)  │     │ 工作流引擎   │     │ (多级扩写)   │     │ 渲染引擎 │
└─────────────┘     └──────┬───────┘     └──────┬───────┘     └────┬─────┘
                          │                    │                  │
                    ┌──────▼─────┐      ┌────▼──────────┐
                    │ 人工审核     │      │ 甘特图/报价   │
                    │ (interrupt)  │      │ 团队配置     │
                    └────────────┘      └───────────────┘
```

**LangGraph 工作流节点**:
1. **大纲生成** → AI 根据需求生成报告大纲 (4 部分)
2. **内容填充** → 每个大纲节点 AI 扩写为完整单页内容
3. **人工审核** → `interrupt` 暂停，人工可修改后继续
4. **PPTX 渲染** → 加载模板，填充占位符，生成最终 PPTX

### 3.2 核心数据流: 共创画布

```
用户操作          ReactFlow 状态           后端 API
─────────      ───────────────      ──────────
添加根节点  ──▶  setNodes(new)  ──▶  POST /sessions/:id/nodes
Enter 平行   ──▶  setNodes(sib)  ──▶  POST /sessions/:id/nodes  +  setEdges(parent→new)
Tab 子级    ──▶  setNodes(child) ──▶  POST /sessions/:id/nodes  + setEdges(self→new)
双击编辑    ──▶  setNodes(edt)  ──▶  PATCH /nodes/:id
Delete 删除  ──▶  filter nodes   ──▶  DELETE /nodes/:id     (级联删除)
AI 推荐    ──▶  ghost nodes   ──▶  POST /sessions/:id/suggest
框选多选    ──▶  selected=true  ─▶  (本地状态)               → Delete 批量删除
```

**核心设计原则**: ReactFlow 状态是操作后的真实状态 (Source of Truth)。API 调用是 fire-and-forget，成功后本地状态已是最新的，不需要 reload。

### 3.3 数据模型关系

```
Workshop_Session (会话)
  ├── Canvas_Node (画布节点) ←─┐ canvas_parent_child ─── Canvas_Node
  │     ├── name, node_type, description
  │     └── workshop_id → Workshop_Session
  ├── Tag_Category (标签分类)
  │     ├── 场景维 / 痛点维 / 技能维 / 格式维
  │     └── workshop_id → Workshop_Session
  ├── Smart_Tag (标签)
  │     └── workshop_id → Workshop_Session
  └── Evaluation_Item (评价项)
        └── workshop_id → Workshop_Session
```

所有数据模型通过 ArangoDB 的 `_from` / `_to` 边关系连接，形成图结构。

---

## 四、技术栈详解

### 4.1 前端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16.1.7 | App Router, SSR/ISR, API Routes |
| React | 19.2.3 | UI 框架, Hooks, Context |
| TypeScript | 5.x | 类型安全 |
| Tailwind CSS | 4.x | 原子化 CSS, utility-first |
| ReactFlow | 11.11.4 | 节点图/流程图可视化 (画布、布局编辑器) |
| ELK.js | 0.11.1 | 自动分层图布局算法 |
| Recharts | 3.8.0 | 雷达图、柱状图 |
| Lucide React | 0.577 | 图标库 |
| Zhipu AI | 2.0.0 | 智谱 AI 客户端 (浏览器端 OCR) |
| Supabase JS | 2.99.2 | 认证、数据库客户端 |
| html2canvas | 1.4.1 | 截图/PDF 导出 |
| jsPDF | 4.2.0 | 客户端 PDF 生成 |
| mammoth | 1.12.0 | DOCX 文件解析 |
| pdfjs-dist | 5.5.207 | PDF 查看器 |
| xlsx | 0.18.5 | Excel 文件解析 |

### 4.2 后端技术

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115.0 | REST API 框架, 自动 OpenAPI 文档 |
| Uvicorn | 0.32.0 | ASGI 服务器 |
| Pydantic | 2.6.3 | 请求/响应模型验证 |
| LangChain | 0.3.14 | AI 编排框架 |
| LangGraph | 0.2.59 | 状态机工作流引擎 |
| DashScope | 1.14.0 | 通义千问 API (Qwen 模型, Embeddings) |
| OpenAI | — | DeepSeek API (主模型) |
| LlamaIndex | 0.10.68 | RAG 检索增强生成 |
| ChromaDB | 0.5.23 | 向量数据库 (进程内) |
| python-arango | 7.9.0 | ArangoDB 驱动 |
| Supabase | — | PostgreSQL 认证 |
| MinIO | 7.2.0 | S3 兼容对象存储 |
| python-pptx | 0.6.23 | PPTX 报告生成 |
| pdfplumber | 0.11.0 | PDF 文本提取 |
| python-docx | 1.1.0 | DOCX 文件处理 |
| openpyxl | 3.1.2 | Excel 文件处理 |
| Unstructured | 0.16.12 | 非结构化文档解析 |
| SlowAPI | — | API 速率限制 |
| Loguru | 0.7.2 | 日志记录 |

### 4.3 开发工具

| 工具 | 版本 | 用途 |
|------|------|------|
| Vitest | 4.1.2 | 单元测试框架 |
| Playwright | 1.58.2 | E2E 测试框架 |
| Testing Library | 16.3.2 | React 组件测试 |
| ESLint | 9 | 代码检查 |
| Docker | — | 容器化部署 |

---

## 五、文件体系

### 5.1 项目目录总览

```
org-diagnosis/
├── app/                          # Next.js App Router 页面
│   ├── (auth)/login/             # 认证页
│   ├── (dashboard)/              # 主功能区 (需认证)
│   │   ├── input/               # 结构化需求录入
│   │   ├── data/                # 数据分析视图
│   │   ├── history/             # 历史记录
│   │   ├── kernel/              # ConsultingOS 内核
│   │   │   ├── [modelKey]/        # 模型详情页
│   │   │   └── graph/            # 图可视化
│   │   ├── knowledge/          # 知识库管理
│   │   │   ├── dashboard/        # 知识库仪表盘
│   │   │   ├── documents/[id]/    # 文档预览
│   │   │   ├── files/            # 文件管理器
│   │   │   ├── search/           # 语义搜索
│   │   │   └── upload/          # 文件上传
│   │   ├── projects/[id]/      # 项目全生命周期
│   │   │   ├── delivery/        # 交付管理
│   │   │   ├── diagnosis/      # 诊断结果
│   │   │   └── proposal/       # 项目建议书
│   │   ├── report/             # 报告生成
│   │   │   ├── preview/         # 报告预览
│   │   │   └── workspace/       # 报告工作台
│   │   ├── settings/kernel/     # 内核设置
│   │   ├── templates/          # PPT 模板管理
│   │   ├── layouts/            # 可视化布局编辑器
│   │   ├── overview/          # 概览仪表盘
│   │   └── workshop/          # 工作坊模块
│   │       ├── cocreate/[id]/   # 共创画布 (核心)
│   │       └── competency/     # 能力评估
│   └── api/                  # Next.js API Routes (文件解析代理)
│
├── components/                   # React 组件库 (~40+ 组件)
│   ├── workshop/              # 工作坊 (8 组件)
│   │   ├── CoCreateCanvas.tsx  # 主画布 (ReactFlow + ELK + 快捷键)
│   │   ├── SmartNode.tsx       # 智能节点 (内联编辑, AI推荐)
│   │   ├── EvaluationMatrix.tsx # 评估矩阵视图
│   │   ├── EvaluationChart.tsx  # 评估图表
│   │   ├── TaggingSidebar.tsx  # 标签管理侧边栏
│   │   ├── CompetencyExplorer.tsx # 能力探索器
│   │   └── ...
│   ├── workflow/              # 工作流步骤组件 (20+ 个)
│   ├── layout-editor/         # PPT 可视化布局编辑器
│   ├── kernel/                # 图数据库浏览器
│   ├── file-manager/          # 文件管理器
│   ├── document-preview/       # 文档预览 (DOCX/PPTX/XLSX)
│   ├── charts/                # 图表组件
│   └── ui/                    # 通用 UI 组件
│
├── lib/                         # 前端工具库
│   ├── api/                   # API 客户模块
│   │   ├── api-config.ts       # API 基础配置
│   │   ├── workshop-api.ts    # 共创画布 API (15 个函数)
│   │   ├── kernel-client.ts   # 内核对象/关系 API
│   │   ├── workflow-client.ts # 工作流状态 API
│   │   └── competency-api.ts  # 能力评估 API
│   ├── workshop/
│   │   └── tree-utils.ts      # 树结构工具 (3 个函数)
│   ├── ai/                    # AI 相关
│   │   ├── prompts/            # AI 提示词模板
│   │   └── zhipu.ts          # 智谱 AI 客户端
│   ├── pdf/generator.ts        # PDF 导出
│   └── auth-context.tsx        # 认证上下文
│
├── backend/                    # Python 后端
│   ├── app/
│   │   ├── main.py            # FastAPI 入口 (CORS, Auth, Rate Limit, 启动)
│   │   ├── api/
│   │   │   ├── router.py       # 路由注册 (所有 /api/* 端点)
│   │   │   ├── v1/
│   │   │   │   ├── kernel.py         # 内核 CRUD (对象/关系)
│   │   │   │   ├── workshop.py     # 共创画布 CRUD + AI 推荐
│   │   │   │   ├── competency.py   # 能力评估 CRUD
│   │   │   │   ├── deliverables.py  # 交付物管理
│   │   │   │   ├── meetings.py     # 会议管理
│   │   │   │   └── tasks.py        # 任务管理
│   │   │   ├── v2/
│   │   │   │   └── workflow.py     # 配置驱动工作流引擎
│   │   │   ├── report.py        # 报告生成工作流
│   │   │   ├── langgraph_diagnosis.py  # LangGraph 诊断工作流
│   │   │   ├── knowledge_v2.py  # 知识库 V2
│   │   │   └── ... (共 20 个 API 文件)
│   │   ├── services/           # 业务逻辑层
│   │   │   ├── kernel/         # 内核服务 (对象/关系/报告)
│   │   │   │   ├── object_service.py
│   │   │   │   ├── relation_service.py
│   │   │   │   ├── ppt_generator.py
│   │   │   │   ├── excel_generator.py
│   │   │   │   ├── meta_service.py
│   │   │   │   └── report_service.py
│   │   │   ├── ai_client.py    # AI 客户端 (统一接口)
│   │   │   ├── ai_extractor.py # AI 信息提取
│   │   │   ├── file_parser.py   # 文件解析服务
│   │   │   ├── storage.py       # MinIO 存储集成
│   │   │   └── pdf_generator.py
│   │   ├── models/
│   │   │   ├── schemas.py       # 通用 Pydantic schemas
│   │   │   └── kernel/          # 内核数据模型
│   │   │       ├── meta_model.py  # 元模型定义
│   │   │       ├── relation.py   # 关系模型
│   │   │       └── report.py     # 报告模型
│   │   └── kernel/
│   │       ├── config.py       # 运行模式配置
│   │       ├── database.py     # ArangoDB 连接管理
│   │       └── ...             # 内核初始化
│   ├── scripts/                # 种子数据脚本
│   │   └── seed_meta_models.py
│   ├── Dockerfile               # 生产环境 Docker 镜像
│   └── requirements.txt         # Python 依赖
│
├── tests/                       # 测试
│   ├── setup.ts               # 测试基础设施 (polyfills)
│   ├── unit/                  # 单元测试 (4 文件, 38 tests)
│   │   ├── tree-helpers.test.ts
│   │   ├── SmartNode.test.tsx
│   │   ├── CoCreateCanvas.test.tsx
│   │   └── optimistic-state.test.ts
│   └── e2e/                   # E2E 测试 (16 文件)
│       ├── workshop-canvas-api.spec.ts  # API 测试 (7)
│       ├── workshop-canvas-ui.spec.ts   # UI 测试 (9)
│       └── ...                    # 其他模块测试
│
├── docs/                       # 文档
│   ├── MASTER_ARCHITECTURE_V2.md   # 架构设计文档
│   ├── PROJECT_COMPREHENSIVE_SUMMARY.md  # 本文档
│   └── ...                       # 部署/测试/进度文档
│
├── deploy.sh                    # HK 部署脚本
├── playwright.config.ts          # E2E 测试配置
├── vitest.config.ts             # 单元测试配置
├── vercel.json                 # Vercel 部署配置
└── package.json                 # 项目元数据
```

---

## 六、功能模块详解

### 6.1 共创画布 (Workshop Co-creation Canvas)

**入口**: `/workshop/cocreate/[id]`  
**技术**: ReactFlow 11 + ELK.js 自动布局 + 自定义 SmartNode

**交互操作**:

| 操作 | 效果 |
|------|------|
| 单击节点 | 选中 |
| Ctrl/Cmd+单击 | 追加/移出多选 |
| Shift+拖动空白 | 框选多个节点 |
| 双击节点 | 进入内联编辑 (Enter 保存, Esc 取消) |
| Enter | 在当前节点下方创建平行节点 (继承父关系) |
| Tab | 创建子节点 (连线到当前节点) |
| Delete / Backspace | 删除所有选中的节点和边 |
| F2 | 进入编辑模式 |
| ↑↓←→ | 在节点间导航 |
| Esc | 取消编辑/取消选中 |
| 拖动已选节点 | 所有选中节点一起移动 |

**状态管理策略**:
- 初始加载时从 API 获取 session → nodes → edges → useMemo → ELK 布局 → useNodesState
- 操作后仅更新 ReactFlow 本地状态 (optimistic update)
- API 调用 fire-and-forget，成功后本地状态已是最新的，**不调用 onReloadSession()**
- SmartNode 编辑有 useEffect guard：编辑中不接受外部 label 更新

**树结构工具** (`lib/workshop/tree-utils.ts`):
- `buildTreeNodeMap(nodes, relations)` → 从平面节点+关系构建树结构
- `flattenAllNodes(roots)` → 深度优先展平
- `getSiblingsFlat(treeNodes, nodeId)` → 获取同级节点 ID 列表
- 运行时还维护 `optimisticParentMap` ref，追踪 API 创建的父子关系

### 6.2 五维诊断系统

**入口**: `/input`  
**技术**: 结构化表单 → LangGraph 工作流 → PPTX

五维评估框架:
1. **组织结构** — 层级、治理模式、管理幅度
2. **业务流程** — 标准化程度、自动化水平
3. **技术能力** — 系统成熟度、数字就绪度
4. **人才梯队** — 技能结构、培养体系
5. **企业文化** — 价值观、沟通机制、创新氛围

### 6.3 报告生成引擎

**入口**: `/projects/[id]/proposal`  
**技术**: LangGraph 状态机 + python-pptx

工作流:
```
需求结构化 → AI 大纲生成 → [人工审核] → AI 单页扩写
→ [人工审核] → PPTX 模板填充 → 导出
```

报告模板四部分:
1. 项目需求的理解
2. 项目方法与整体框架 (MDS 模型)
3. 项目实施步骤 (分阶段)
4. 项目计划、团队与报价 (甘特图 + 报价)

### 6.4 知识库

**入口**: `/knowledge/*`  
**技术**: 文档上传 → 解析 (PDF/DOCX/XLSX/OCR) → ChromaDB 向量化 → 语义检索

### 6.5 ConsultingOS 内核数据库

**入口**: `/kernel/*`  
**技术**: ArangoDB 图数据库 (Production) / 内存字典 (Demo)

统一的 CRUD 接口:
- `POST /api/v1/kernel/objects` — 创建对象
- `GET /api/v1/kernel/objects/:id` — 获取对象
- `PATCH /api/v1/kernel/objects/:id` — 更新对象
- `DELETE /api/v1/kernel/objects/:id` — 删除对象
- `POST /api/v1/kernel/relations` — 创建关系
- `GET /api/v1/kernel/relations/:id` — 获取关系
- `DELETE /api/v1/kernel/relations/:id` — 删除关系

### 6.6 能力评估 (Competency Co-pilot)

**入口**: `/workshop/competency`  
**功能**: 雷达图评估 + AI 推荐学习资源

### 6.7 可视化布局编辑器

**入口**: `/layouts/[id]/edit`  
**技术**: ReactFlow (拖拽节点/文本/形状到 PPT 页面布局)

---

## 七、API 端点总览

### 7.1 V1 API

| 前缀 | 功能 |
|------|------|
| `/api/v1/workshop/*` | 共创画布: session/node/evaluation/tag CRUD + AI suggest |
| `/api/v1/kernel/*` | 内核: object/relation CRUD + meta model |
| `/api/v1/competency/*` | 能力评估 CRUD |
| `/api/v1/tasks/*` | 任务管理 |
| `/api/v1/meetings/*` | 会议管理 |
| `/api/v1/deliverables/*` | 交付物管理 |

### 7.2 V2 API

| 前缀 | 功能 |
|------|------|
| `/api/v2/workflow/*` | 配置驱动工作流引擎 (W1 提案/W2 诊断) |

### 7.3 通用 API

| 前缀 | 功能 |
|------|------|
| `/api/report/*` | 报告生成: 启动/状态/大纲/幻灯片/导出 |
| `/api/langgraph/*` | LangGraph 诊断工作流 |
| `/api/knowledge_v2/*` | 知识库 V2 (上传/搜索/RAG) |
| `/api/projects/*` | 项目管理 CRUD |
| `/api/layout/*` | 布局推荐 |
| `/api/templates/*` | PPT 模板管理 |
| `/api/upload` | 文件上传 |
| `/api/analyze` | AI 文本分析 |
| `/api/diagnosis/*` | 诊断记录 |
| `/api/folders/*` | 文件夹管理 |
| `/api/orders/*` | 订单管理 |
| `/api/health` | 健康检查 |

---

## 八、升级与更新记录

### 8.1 重要更新时间线

| 时间 | 版本 | 更新内容 |
|------|------|---------|
| 2026-03-17 | — | 项目初始化，五维诊断 MVP |
| 2026-03-20 | v2.0 | 架构设计文档 v2，LangGraph 工作流设计 |
| 2026-03-28 | — | 系统审计报告，安全加固 |
| 2026-04-01 | — | 共创套件上线: 画布+评估矩阵+标签+导出 |
| 2026-04-02 | v2.1 | **画布 MindManager 化改造 (本次更新)** |

### 8.2 2026-04-02 画布改造详情

**本次更新目标**: 让画布工具达到 MindManager 基本可用水平。

#### 后端修复
| 文件 | 变更 |
|------|------|
| `workshop.py` | `parent_node_id` 用 `_to_id()` 转换，修复子节点创建时关系建立失败 |
| `workshop.py` | `_transform_relation()` 增加 null safety，防止畸形边数据崩溃 |

#### 前端修复
| 文件 | 变更 |
|------|------|
| `CoCreateCanvas.tsx` | **TDZ Bug 修复**: 将 `useNodesState/useEdgesState` 移到 `useCallback` 定义之前，解决 Temporal Dead Zone 崩溃 |
| `CoCreateCanvas.tsx` | **Optimistic State Management**: 操作后不再调 `onReloadSession()`，ReactFlow 状态即为真实状态 |
| `CoCreateCanvas.tsx` | **Ctrl/Cmd+Click 多选**: 替代手动 `onNodeClick` 选择逻辑，改用 ReactFlow 原生选择系统 |
| `CoCreateCanvas.tsx` **光标修复**: 自定义 CSS 覆盖 ReactFlow 默认 grab 光标，节点和空白区域均为箭头 |
| `CoCreateCanvas.tsx` **边选择**: 支持点击选中边 (蓝色高亮)，Delete 删除 |
| `CoCreateCanvas.tsx` **兄弟位置**: 新建平行节点出现在当前节点下方 (y+80)，而非 parent 位置 |
| `CoCreateCanvas.tsx` **父关系继承**: 三层 fallback 查找父节点 (parentMap → optimisticParentMap → ReactFlow edges) |
| `SmartNode.tsx` | **useEffect Guard**: 编辑中不接受外部 label 更新，防止覆盖用户输入 |

#### 新增文件
| 文件 | 用途 |
|------|------|
| `lib/workshop/tree-utils.ts` | 从 CoCreateCanvas 提取的树工具函数，支持单元测试 |
| `vitest.config.ts` | Vitest 配置 (jsdom, setup file, path alias) |
| `tests/setup.ts` | 测试基础设施 (ResizeObserver, PointerCapture polyfills) |
| `tests/unit/tree-helpers.test.ts` | 10 个树工具函数测试 |
| `tests/unit/SmartNode.test.tsx` | 14 个智能节点测试 |
| `tests/unit/CoCreateCanvas.test.tsx` | 9 个画布组件测试 |
| `tests/unit/optimistic-state.test.ts` | 4 个状态管理测试 |
| `tests/e2e/workshop-canvas-api.spec.ts` | 7 个 API E2E 测试 |
| `tests/e2e/workshop-canvas-ui.spec.ts` | 9 个 UI E2E 测试 |
| `docs/PROJECT_COMPREHENSIVE_SUMMARY.md` | 本文档 |

#### commit 历史 (本次)
```
71aefc9 fix(workshop): reliable multi-select via Full mode + selectNodesOnDrag
3ee701a fix(workshop): remove broken onDeleteNode call when deleting edges
add8f1d fix(workshop): sibling parent lookup fallback, restore Shift+drag selection
ca3bd73 fix(workshop): sibling position, optimistic parent tracking, native multi-select
39af785 fix(workshop): Enter key sibling creation, cursor, multi-select for nodes+edges
f0ba603 fix(workshop): replace window.event with ReactFlow callback event
0574049 fix(workshop): canvas optimistic updates, backend parent_node_id fix, full test suite
```

---

## 九、测试体系

### 9.1 测试配置

**单元测试** (`vitest.config.ts`):
- 环境: jsdom
- Setup: `tests/setup.ts` (ResizeObserver, PointerCapture polyfills)
- 路径别名: `@` → 项目根目录
- 包含: `tests/unit/**/*.test.{ts,tsx}`

**E2E 测试** (`playwright.config.ts`):
- 环境: Desktop Chrome
- 测试目录: `tests/e2e`
- 两个项目组: API Tests (`*-api.spec.ts`), UI Tests (`*-ui.spec.ts`)
- 超时: 60 秒
- Reporter: HTML
- CI: 重试 2 次, 1 worker

### 9.2 测试覆盖

| 测试套件 | 测试数 | 覆盖内容 |
|---------|--------|---------|
| `tree-helpers.test.ts` | 10 | buildTreeNodeMap (空/单/多根/嵌套), getSiblingsFlat, flattenAllNodes |
| `SmartNode.test.tsx` | 14 | 渲染, 双击编辑, Enter/Tab/Escape 保存, 模糊匹配, 外部同步守卫, ghost 节点 |
| `CoCreateCanvas.test.tsx` | 9 | 空状态, 节点渲染, 添加根节点对话框, 快捷键提示, 面板取消选中, Enter/Tab 创建 |
| `optimistic-state.test.ts` | 4 | 乐观添加/删除, 边添加, merge 策略 |
| `workshop-canvas-api.spec.ts` | 7 | Session CRUD, Node CRUD, 父子关系, 级联删除 |
| `workshop-canvas-ui.spec.ts` | 9 | 空状态, 添加/编辑/删除节点, Enter/Tab, 框选, 编辑持久化 |
| **总计** | **53** | |

### 9.3 运行命令

```bash
npm run test:unit    # 单元测试 (38 tests, ~1.4s)
npm run test:e2e:api # API E2E 测试 (需后端运行, ~1s)
npm run test:e2e:ui  # UI E2E 测试 (需前后端运行, ~10s)
npm run test:e2e     # 全部 E2E 测试
```

### 9.4 已知测试限制

- E2E 测试依赖运行中的 dev server (localhost:3000) 和 backend (localhost:8000)
- 部分旧 E2E 测试 (langgraph, report, workflow) 因异步 AI 操作超时而失败
- 单元测试中 SmartNode 和 CoCreateCanvas 的某些 mock 需要适配 ReactFlow 的版本升级

---

## 十、部署

### 10.1 部署架构

```
开发者 (git push)  ──▶  GitHub ──▶  Vercel 自动构建
                                                      │
用户浏览器 ◀────── https://5d.3strategy.cc ◀─┐ HTTPS
                                                      │
                                         ▼
                              Nginx (HK) ──┐ https://org-diagnosis.3strategy.cc/api/*
                                                      │
                                         ▼
                              FastAPI Docker (:8000) ──▶ ArangoDB + ChromaDB + MinIO
```

### 10.2 前端部署 (Vercel)

- **触发**: git push 到 main 分支自动构建
- **区域**: hkg1 (香港)
- **环境变量**: 通过 `vercel.json` 注入
  - `NEXT_PUBLIC_API_URL`: 后端 API 地址
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`: 认证
- **构建**: `npm run build` (Next.js)
- **预渲染**: 动态关 (dashboard 页面因 ReactFlow 不支持 SSR)

### 10.3 后端部署 (HK Docker)

```bash
./deploy.sh [branch]
```

**流程**:
1. `rsync` 同步 backend/ 到 HK 服务器 (排除 venv, __pycache__, .env, data/)
2. `docker build` 在 HK 上构建镜像
3. `docker run` 创建新容器 (映射 .env 和 data 卷, 连接 docker_internal 网络)
4. Health check: `curl http://localhost:8000/api/health`

### 10.4 环境变量

**必需**:
| 变量 | 说明 | 示例值 |
|------|------|--------|
| `KERNEL_MODE` | 运行模式 | `demo` / `production` |
| `ARANGO_HOST` | ArangoDB 地址 (仅 production) | `localhost` |
| `ARANGO_DATABASE` | 数据库名 | `org_diagnosis` |
| `NEXT_PUBLIC_API_URL` | 后端 API 地址 | `https://org-diagnosis.3strategy.cc` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase URL | — |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase 匿名密钥 | — |

**AI 服务** (至少配一个):
| 变量 | 说明 |
|------|------|
| `DASHSCOPE_API_KEY` | 阿里通千问 API (Qwen + Embeddings) |
| `OPENAI_API_KEY` | OpenAI/DeepSeek API |

**可选**:
| 变量 | 说明 |
|------|------|
| `AUTH_ENABLED` | 启用认证中间件 | `false` |
| `MINIO_ENDPOINT` | MinIO 对象存储 | — |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | — |

### 10.5 域础设施配置

**HK 服务器**:
- IP: 103.59.103.85 (通过 SSH bastion `hk-jump` 访问)
- Docker 容器: `org-diagnosis-api` (端口 8000, 仅本地绑定)
- Docker 网络: `docker_internal` (连接 ArangoDB/MinIO)
- 数据卷: `/opt/org-diagnosis/backend/.env` (配置), `/opt/org-diagnosis/data` (持久化数据)

**域名**:
| 域名 | 指向 | 服务 |
|------|------|------|
| `5d.3strategy.cc` | Vercel | 前端 |
| `org-diagnosis.3strategy.cc` | Nginx → Docker:8000 | 后端 API |

---

## 十一、上下文信息

### 11.1 开发团队

- **开发者**: cscoheru
- **代码仓库**: github.com:cscoheru/orgdiagnosis (private)
- **部署方式**: 手动 `deploy.sh` (无 CI/CD pipeline)
- **协作模式**: AI 辅助开发 (Claude Code) + 人工审核

### 11.2 技术决策记录

| 决策 | 原因 | 影响 |
|------|------|------|
| ArangoDB 作为图数据库 | 需要 parent-child 等关系型数据 | 适合画布/知识图谱场景 |
| Demo/Production 双模式 | 开发无需安装 ArangoDB | 降低开发门槛 |
| ChromaDB 进程内 | 向量检索延迟低 | 无需额外服务 |
| ELK.js 自动布局 | 画布节点自动排列 | 避免手动计算坐标 |
| Optimistic State Management | 避免操作后回滚 | 提升交互体验 |
| Fire-and-forget API 调用 | 操作不阻塞 UI | 响应速度优先 |

### 11.3 已知限制与未来规划

| 项目 | 说明 |
|------|------|
| 无 GitHub Actions CI/CD | 部署完全手动，无自动化测试 |
| ChromaDB 进程内 | 重启后向量索引丢失，需重新构建 |
| 无实时协作 | 画布无 WebSocket 同步 |
| 无 Undo/Redo | 画布操作不可撤销 |
| 前端静态导出 | PPTX 导出仅在服务端，无前端实时预览 |
| 单语言 | 中文 UI，未做国际化 |

### 11.4 技术债务

| 项目 | 说明 | 建议 |
|------|------|------|
| `backend/main.py` | 中间件和路由注册耦合在一起 | 拆分为子模块 |
| API 响应格式不统一 | 后端返回原始对象，前端 `workshopRequest` 包装为 `{success, data}` | 统一格式 |
| 部分旧 E2E 测试失败 | langgraph/report/workflow 测试因 AI 异步超时 | 修复或标记 skip |
| 文档分散 | docs/ 下有大量历史文档 | 定期清理归档 |
