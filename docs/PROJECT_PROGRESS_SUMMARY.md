# 项目进度总结

> 项目：咨询的天空 v2.0 — 企业管理咨询交付物生成平台
> 更新日期：2026-03-28
> 文档版本：1.0

---

## 一、项目概述

**咨询的天空 v2.0** 是一个面向企业管理咨询行业的交付物生成平台。系统通过 AI 驱动的分步工作流，将咨询项目从需求分析、调研诊断到方案交付的全流程数字化，自动生成咨询建议书、诊断报告和项目解决方案。

### 核心能力

- **三阶段工作流**：W1 需求分析、W2 调研诊断、W3 解决方案
- **AI 智能提取**：基于 DashScope（通义千问）的文档智能分析
- **AI 补问系统**：自动识别需求缺口，生成针对性补充问题
- **可视化评估**：五维组织能力评估（战略/组织/流程/人才/文化）
- **报告生成**：自动生成咨询建议书和诊断报告

---

## 二、各阶段完成状态

| Phase | 范围 | 状态 | 核心产出 |
|-------|------|------|----------|
| Phase 1 | 后端统一工作流引擎 | ✅ 已完成 | 工作流引擎、步骤注册系统、V2 API、项目模型 |
| Phase 2 | 前端新路由架构 | ✅ 已完成 | 6 个新页面、侧边栏重构、步骤导航器 |
| Phase 3 | W1 需求分析 & 建议书 | ✅ 已完成 | 5 个步骤组件、AI 提取/补问、建议书预览 |
| Phase 4 | W2 调研诊断 & 报告 | ✅ 已完成 | 4 个步骤组件、五维评估、诊断报告 |
| Phase 5 | W3 项目解决方案 | ✅ 已完成 | 3 个步骤组件、方案框架、实施计划 |
| Phase 6 | 数据探索 + 设置 + 清理 | 🟡 进行中 | 设置页面完成，旧页面待清理 |

---

## 三、功能矩阵

### W1 需求分析 & 建议书

| 步骤 | 组件 | AI 能力 | 状态 |
|------|------|---------|------|
| 1. 客户信息 | `ClientInfoStep` | - | ✅ 完成 |
| 2. 需求提取 | `ExtractStep` | smart-extract (DashScope) | ✅ 完成 |
| 3. AI 补问 | `SmartQuestionStep` | smart-question (DashScope) | ✅ 完成 |
| 4. 需求确认 | `ConfirmStep` | - | ✅ 完成 |
| 5. 建议书预览 | `ProposalPreviewStep` | 生成建议书内容 | ✅ 完成 |

### W2 调研诊断 & 报告

| 步骤 | 组件 | AI 能力 | 状态 |
|------|------|---------|------|
| 1. 五维评估 | `FiveDimAssessStep` | 五维分析 | ✅ 完成 |
| 2. 深度调研 | `DeepResearchStep` | - | ✅ 完成 |
| 3. 数据分析 | `DataAnalysisStep` | 图表可视化 | ✅ 完成 |
| 4. 诊断报告 | `DiagnosisReportStep` | 生成诊断报告 | ✅ 完成 |

### W3 项目解决方案

| 步骤 | 组件 | AI 能力 | 状态 |
|------|------|---------|------|
| 1. 方案框架 | `SolutionFrameworkStep` | 生成方案框架 | ✅ 完成 |
| 2. 实施计划 | `ImplementationPlanStep` | - | ✅ 完成 |
| 3. 方案预览 | `SolutionPreviewStep` | 生成完整方案 | ✅ 完成 |

---

## 四、技术栈

### 前端（Frontend）

| 技术 | 版本 | 用途 |
|------|------|------|
| Next.js | 16 | 应用框架（App Router） |
| React | 19 | UI 库 |
| Tailwind CSS | v4 | 样式系统 |
| Recharts | v3 | 数据可视化（图表） |
| Playwright | latest | E2E 测试 |
| TypeScript | 5.x | 类型安全 |

### 后端（Backend）

| 技术 | 版本 | 用途 |
|------|------|------|
| FastAPI | 0.115+ | Web 框架 |
| DashScope / 通义千问 | latest | AI 大模型服务 |
| InMemoryDB | - | 开发环境数据存储 |
| SQLite | 3.x | 生产环境持久化 |
| Pydantic | 2.x | 数据验证 |

### 工作流引擎（Workflow Engine）

| 特性 | 说明 |
|------|------|
| 配置驱动 | 阶段和步骤通过配置定义，无需硬编码 |
| `@register_step` 插件系统 | 步骤处理器通过装饰器自动注册 |
| 状态机管理 | 每个项目独立维护工作流状态 |
| 前后向导航 | 支持步骤间的自由跳转和返回 |

---

## 五、代码统计

### 新增组件

| 类别 | 数量 | 说明 |
|------|------|------|
| 步骤组件（Step Components） | 12 | W1(5) + W2(4) + W3(3) |
| 工作流组件（Workflow Components） | 3 | StepNavigator, StageProgress, StepRenderer |
| 布局组件（Layout Components） | 2 | Sidebar 重构, ProjectLayout |
| 通用组件（Shared Components） | ~3 | 各步骤复用的 UI 组件 |
| **合计** | **~20** | |

### 页面文件

| 类别 | 数量 | 说明 |
|------|------|------|
| 新增页面 | 6 | projects, new, [id], w1, w2, w3 |
| 重写页面 | ~4 | 首页、诊断页等适配新架构 |
| **合计** | **~10** | |

### 后端文件

| 类别 | 数量 | 说明 |
|------|------|------|
| 工作流引擎 | 5 | engine, registry, config, types, __init__ |
| API 路由 | 3 | v2/workflow, v2/projects, __init__ |
| 步骤处理器 | 4 | w1/w2/w3 handlers + __init__ |
| 数据模型 | 1 | project.py |
| AI 服务 | 1 | ai_service.py 扩展 |
| **合计** | **14** | |

### 步骤处理器

| 阶段 | 处理器数量 | 说明 |
|------|-----------|------|
| W1 | 5 | client_info, extract, smart_question, confirm, proposal |
| W2 | 4 | five_dim, deep_research, data_analysis, diagnosis_report |
| W3 | 3 | framework, implementation, preview |
| **合计** | **10 (handler functions)** | 通过 @register_step 注册 |

---

## 六、已知限制

| 限制项 | 影响 | 计划解决时间 |
|--------|------|-------------|
| **PPTX 生成使用 fallback** | 建议书和报告目前以 HTML/Markdown 预览，未生成实际 .pptx 文件 | v2.1 |
| **DeepSeek API 未配置** | 备用 AI 模型不可用，仅依赖 DashScope | 待配置 API Key |
| **测试覆盖待完善** | E2E 测试框架已搭建，部分用例待补充 | v2.1 |
| **数据库使用 InMemoryDB** | 开发环境数据重启丢失，生产环境需迁移 SQLite/PostgreSQL | 部署时 |
| **用户认证缺失** | 当前无登录/权限系统 | v2.2 |
| **文件上传限制** | 文档上传功能待完善（大小限制、格式校验） | v2.1 |

---

## 七、里程碑时间线

```
2026-03-20  Phase 1 启动 — 后端工作流引擎设计
2026-03-22  Phase 1 完成 — 工作流引擎 + V2 API
2026-03-23  Phase 2 完成 — 前端路由重构
2026-03-25  Phase 3 完成 — W1 全部步骤上线
2026-03-26  Phase 4 完成 — W2 全部步骤上线
2026-03-27  Phase 5 完成 — W3 全部步骤上线
2026-03-28  Phase 6 进行中 — 清理和优化
```
