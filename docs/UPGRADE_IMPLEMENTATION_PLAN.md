# 升级实施计划：咨询交付物生成平台

> 项目：咨询的天空 v2.0
> 更新日期：2026-03-28
> 文档版本：1.0

---

## 一、升级目标

将现有"组织诊断表单系统"全面升级为**"企业管理咨询交付物生成平台"**，覆盖咨询项目从需求分析到方案交付的完整周期：

| 维度 | 现状 (v1.0) | 目标 (v2.0) |
|------|-------------|-------------|
| 产品定位 | 组织诊断问卷工具 | 咨询交付物生成平台 |
| 工作流 | 单一诊断表单 | 三阶段咨询工作流 (W1/W2/W3) |
| AI 能力 | 表单分析 | 智能提取、补问、报告生成 |
| 产出物 | 诊断报告 | 建议书、诊断报告、项目方案 |
| 用户体验 | 单页表单 | 分步引导 + 项目管理 |

---

## 二、六阶段概览

### Phase 1：后端统一工作流引擎（预计 3 天）

**目标**：建立配置驱动的后端工作流引擎，支持多阶段、多步骤的咨询工作流。

**涉及文件（14 个后端文件）**：

```
backend/
├── workflow/
│   ├── __init__.py              # 工作流引擎导出
│   ├── engine.py                # 核心工作流引擎
│   ├── registry.py              # 步骤注册表 (@register_step 装饰器)
│   ├── config.py                # 工作流配置定义
│   └── types.py                 # 类型定义
├── api/
│   ├── v2/
│   │   ├── __init__.py          # V2 API 路由汇总
│   │   ├── workflow.py          # 工作流状态管理 API
│   │   └── projects.py          # 项目 CRUD API
│   └── ai.py                    # AI 能力接口（复用）
├── services/
│   ├── step_handlers/
│   │   ├── __init__.py          # 步骤处理器注册
│   │   ├── w1_handlers.py       # W1 阶段步骤处理器
│   │   ├── w2_handlers.py       # W2 阶段步骤处理器
│   │   └── w3_handlers.py       # W3 阶段步骤处理器
│   └── ai_service.py            # AI 服务封装（扩展）
└── models/
    └── project.py               # 项目数据模型
```

**核心设计**：

- **配置驱动**：工作流阶段和步骤通过 YAML/Python 配置定义，无需硬编码路由
- **插件系统**：`@register_step("w1.extract")` 装饰器自动注册步骤处理器
- **状态机**：每个项目维护当前阶段、步骤和完成状态

---

### Phase 2：前端新路由架构（预计 3 天）

**目标**：重构前端路由，建立项目管理 + 分步工作流的新页面结构。

**新增页面（6 个）**：

| 路由 | 页面 | 说明 |
|------|------|------|
| `/projects` | 项目列表页 | 项目概览、创建、状态展示 |
| `/projects/new` | 创建项目页 | 项目基本信息录入 |
| `/projects/[id]` | 项目详情页 | 阶段进度、步骤导航 |
| `/projects/[id]/w1` | W1 需求分析页 | 5 步骤引导 |
| `/projects/[id]/w2` | W2 调研诊断页 | 4 步骤引导 |
| `/projects/[id]/w3` | W3 解决方案页 | 3 步骤引导 |

**侧边栏重构**：

```
[Logo] 咨询的天空
├── 项目管理
│   ├── 所有项目
│   └── + 新建项目
├── 当前项目 (展开时)
│   ├── W1 需求分析
│   ├── W2 调研诊断
│   └── W3 解决方案
└── 设置
    └── 系统设置
```

---

### Phase 3：W1 需求分析 & 建议书（预计 4 天）

**目标**：实现咨询第一阶段——需求分析与建议书生成。

**步骤组件（5 个）**：

| 步骤 | 组件名 | 功能 |
|------|--------|------|
| 1. 客户信息 | `ClientInfoStep` | 录入企业名称、行业、规模、联系人 |
| 2. 需求提取 | `RequirementExtractStep` | 上传/粘贴文档 → AI 智能提取需求 |
| 3. AI 补问 | `SmartQuestionStep` | AI 分析需求缺口，生成补充问题 |
| 4. 需求确认 | `RequirementConfirmStep` | 用户确认/编辑最终需求列表 |
| 5. 建议书预览 | `ProposalPreviewStep` | 生成并预览咨询建议书 |

**数据流**：

```
客户信息 → 文档上传 → AI 提取 → AI 补问 → 用户确认 → 建议书生成
                          ↓              ↓
                     smart-extract    smart-question
                     (DashScope)      (DashScope)
```

---

### Phase 4：W2 调研诊断 & 报告（预计 4 天）

**目标**：实现咨询第二阶段——调研诊断与诊断报告生成。

**步骤组件（4 个）**：

| 步骤 | 组件名 | 功能 |
|------|--------|------|
| 1. 五维评估 | `FiveDimAssessStep` | 战略/组织/流程/人才/文化五维评估 |
| 2. 深度调研 | `DeepResearchStep` | 专项调研问卷、访谈记录 |
| 3. 数据分析 | `DataAnalysisStep` | 可视化图表、趋势分析 |
| 4. 诊断报告 | `DiagnosisReportStep` | 生成诊断报告预览 |

**依赖**：W1 阶段完成后方可进入 W2。

---

### Phase 5：W3 项目解决方案（预计 3 天）

**目标**：实现咨询第三阶段——解决方案输出。

**步骤组件（3 个）**：

| 步骤 | 组件名 | 功能 |
|------|--------|------|
| 1. 方案框架 | `SolutionFrameworkStep` | 基于诊断结果生成方案框架 |
| 2. 实施计划 | `ImplementationPlanStep` | 时间表、里程碑、资源规划 |
| 3. 方案预览 | `SolutionPreviewStep` | 完整方案文档预览与导出 |

**依赖**：W2 阶段完成后方可进入 W3。

---

### Phase 6：数据探索 + 设置 + 清理（预计 2 天）

**目标**：补充辅助功能，完善用户体验。

**工作内容**：

- [ ] 数据探索页面优化
- [ ] 系统设置页面（AI 模型选择、API Key 管理）
- [ ] 旧版诊断页面清理/归档
- [ ] 项目数据导入/导出
- [ ] 错误处理和边界情况完善

---

## 三、架构设计

### 3.1 配置驱动工作流引擎

```python
# backend/workflow/config.py
WORKFLOW_STAGES = {
    "w1": {
        "name": "需求分析 & 建议书",
        "steps": [
            {"id": "client_info", "name": "客户信息", "type": "form"},
            {"id": "extract", "name": "需求提取", "type": "ai"},
            {"id": "smart_question", "name": "AI 补问", "type": "ai"},
            {"id": "confirm", "name": "需求确认", "type": "form"},
            {"id": "proposal", "name": "建议书预览", "type": "preview"},
        ],
    },
    "w2": { ... },
    "w3": { ... },
}
```

### 3.2 三层组件模式

```
┌─────────────────────────────────────────────┐
│  Layer 3: Page Orchestrator                 │
│  (projects/[id]/w1/page.tsx)                │
│  - 步骤导航控制                              │
│  - 阶段状态管理                              │
│  - 数据汇总与提交                            │
├─────────────────────────────────────────────┤
│  Layer 2: Step Component                    │
│  (components/steps/W1/ExtractStep.tsx)       │
│  - 单步骤 UI + 交互逻辑                      │
│  - 调用 API Client                          │
│  - 本地状态管理                              │
├─────────────────────────────────────────────┤
│  Layer 1: API Client                        │
│  (lib/api/workflow.ts)                      │
│  - HTTP 请求封装                             │
│  - 错误处理 & 重试                           │
│  - 数据转换                                  │
└─────────────────────────────────────────────┘
```

### 3.3 步骤注册系统

```python
# backend/services/step_handlers/w1_handlers.py
from workflow.registry import register_step

@register_step("w1.extract")
async def handle_extract(project_id: str, payload: dict) -> dict:
    """调用 AI 从文档中提取需求"""
    ...
```

---

## 四、新增文件清单

### 后端文件（Backend）

| 文件路径 | 类型 | 说明 |
|----------|------|------|
| `backend/workflow/__init__.py` | 模块 | 工作流引擎包 |
| `backend/workflow/engine.py` | 核心 | 工作流状态机引擎 |
| `backend/workflow/registry.py` | 核心 | 步骤注册表 |
| `backend/workflow/config.py` | 配置 | 阶段/步骤配置定义 |
| `backend/workflow/types.py` | 类型 | Pydantic 模型定义 |
| `backend/api/v2/__init__.py` | 路由 | V2 API 路由汇总 |
| `backend/api/v2/workflow.py` | 路由 | 工作流 API 端点 |
| `backend/api/v2/projects.py` | 路由 | 项目 CRUD API |
| `backend/services/step_handlers/__init__.py` | 模块 | 步骤处理器包 |
| `backend/services/step_handlers/w1_handlers.py` | 服务 | W1 步骤处理器 |
| `backend/services/step_handlers/w2_handlers.py` | 服务 | W2 步骤处理器 |
| `backend/services/step_handlers/w3_handlers.py` | 服务 | W3 步骤处理器 |
| `backend/models/project.py` | 模型 | 项目数据模型 |
| `backend/services/ai_service.py` | 服务 | AI 服务封装（扩展） |

### 前端文件（Frontend）

| 文件路径 | 类型 | 说明 |
|----------|------|------|
| `app/(dashboard)/projects/page.tsx` | 页面 | 项目列表页 |
| `app/(dashboard)/projects/new/page.tsx` | 页面 | 创建项目页 |
| `app/(dashboard)/projects/[id]/page.tsx` | 页面 | 项目详情页 |
| `app/(dashboard)/projects/[id]/w1/page.tsx` | 页面 | W1 工作流页 |
| `app/(dashboard)/projects/[id]/w2/page.tsx` | 页面 | W2 工作流页 |
| `app/(dashboard)/projects/[id]/w3/page.tsx` | 页面 | W3 工作流页 |
| `components/steps/W1/ClientInfoStep.tsx` | 组件 | 客户信息步骤 |
| `components/steps/W1/ExtractStep.tsx` | 组件 | 需求提取步骤 |
| `components/steps/W1/SmartQuestionStep.tsx` | 组件 | AI 补问步骤 |
| `components/steps/W1/ConfirmStep.tsx` | 组件 | 需求确认步骤 |
| `components/steps/W1/ProposalPreviewStep.tsx` | 组件 | 建议书预览步骤 |
| `components/steps/W2/FiveDimAssessStep.tsx` | 组件 | 五维评估步骤 |
| `components/steps/W2/DeepResearchStep.tsx` | 组件 | 深度调研步骤 |
| `components/steps/W2/DataAnalysisStep.tsx` | 组件 | 数据分析步骤 |
| `components/steps/W2/DiagnosisReportStep.tsx` | 组件 | 诊断报告步骤 |
| `components/steps/W3/SolutionFrameworkStep.tsx` | 组件 | 方案框架步骤 |
| `components/steps/W3/ImplementationPlanStep.tsx` | 组件 | 实施计划步骤 |
| `components/steps/W3/SolutionPreviewStep.tsx` | 组件 | 方案预览步骤 |
| `lib/api/workflow.ts` | API | 工作流 API 客户端 |
| `lib/api/projects.ts` | API | 项目 API 客户端 |
| `components/layout/Sidebar.tsx` | 组件 | 侧边栏（重构） |
| `components/workflow/StepNavigator.tsx` | 组件 | 步骤导航器 |
| `components/workflow/StageProgress.tsx` | 组件 | 阶段进度条 |

---

## 五、部署检查清单

### 5.1 环境变量

```bash
# 必需
DASHSCOPE_API_KEY=sk-xxx          # DashScope AI API Key
AI_MODEL=qwen-plus                # 默认 AI 模型
DATABASE_URL=sqlite:///./data.db  # 数据库连接

# 可选
DEEPSEEK_API_KEY=sk-xxx           # DeepSeek 备用模型
LOG_LEVEL=INFO                    # 日志级别
CORS_ORIGINS=https://xxx.vercel.app  # 前端域名
```

### 5.2 Python 依赖

```txt
# requirements.txt 新增
fastapi>=0.115.0
uvicorn>=0.34.0
pydantic>=2.0
httpx>=0.28.0
dashscope>=1.20.0
openai>=1.60.0      # DeepSeek 兼容
python-pptx>=1.0.0  # PPTX 生成
```

### 5.3 Node.js 依赖

```json
{
  "dependencies": {
    "next": "^16.x",
    "react": "^19.x",
    "recharts": "^3.x",
    "@ai-sdk/openai": "^1.x"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "tailwindcss": "^4.x"
  }
}
```

### 5.4 数据库迁移

```sql
-- 项目表
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT,
    industry TEXT,
    company_size TEXT,
    contact_name TEXT,
    contact_email TEXT,
    current_stage TEXT DEFAULT 'w1',
    current_step TEXT DEFAULT 'client_info',
    status TEXT DEFAULT 'in_progress',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 步骤数据表（JSON 存储）
CREATE TABLE IF NOT EXISTS step_data (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    stage TEXT NOT NULL,
    step TEXT NOT NULL,
    data JSON NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 六、后续迭代方向

### 短期（v2.1）

- [ ] **实际 PPTX 生成**：替换当前 fallback，使用 python-pptx 生成真实咨询建议书
- [ ] **AI 补问优化**：基于上下文的多轮对话式补问，支持用户追问
- [ ] **阶段报告导出**：支持导出 PDF/Word 格式的诊断报告和项目方案

### 中期（v2.2）

- [ ] **多项目管理**：支持咨询顾问同时管理多个客户项目
- [ ] **模板系统**：自定义建议书模板、报告模板
- [ ] **协作功能**：多人协作编辑、审批流程

### 长期（v3.0）

- [ ] **知识库集成**：接入行业知识库，提升 AI 分析质量
- [ ] **客户门户**：客户可在线查看项目进度和交付物
- [ ] **数据分析看板**：咨询项目效能分析、交付质量追踪
