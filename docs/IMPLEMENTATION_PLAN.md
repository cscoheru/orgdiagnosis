# ConsultingOS 内核整合 — 项目实施计划

> 生成时间: 2026-03-27
> 状态: 全部 5 个阶段已完成

---

## 一、项目背景

用户在 `/org-diagnosis` 构建了五维诊断系统（Next.js + FastAPI），但前后端脱节、流程跑不通。另起炉灶在 `/fisheros` 构建了 **ConsultingOS 无头内核**（FastAPI + ArangoDB 元模型/对象/关系系统）。本计划将内核整合回 org-diagnosis，用 LangGraph 编排五大咨询领域的独立模块，前端渐进式改造。

### 用户决策

| 决策点 | 选择 | 说明 |
|--------|------|------|
| 数据库策略 | 双库并行 (ArangoDB + Supabase) | 内核数据 vs 业务数据分离 |
| 工作流引擎 | LangGraph 全局编排 | 状态机 + 中断/恢复 |
| 前端改造 | 渐进式 | 不破坏现有功能 |
| 开发策略 | 先搭内核框架 | 自底向上 |

---

## 二、架构设计

### 三层架构

```
┌─────────────────────────────────────────────────┐
│              Next.js 前端 (展示层)                │
│  元数据驱动表单 │ 图谱可视化 │ 诊断仪表盘 │ 报告工作区 │
└─────────────────────┬───────────────────────────┘
                      │ HTTP
┌─────────────────────▼───────────────────────────┐
│              FastAPI 后端 (API 层)                │
│  /api/v1/kernel │ /api/langgraph │ /api/report  │
└──────┬──────────────┬────────────────┬──────────┘
       │              │                │
       ▼              ▼                ▼
┌────────────┐ ┌──────────────┐ ┌───────────┐
│ ArangoDB   │ │ LangGraph    │ │ Supabase  │
│ 内核层     │ │ 编排层       │ │ 业务层    │
│ 元模型/对象│ │ 工作流状态机 │ │ 用户/项目 │
│ 关系/图谱  │ │ 节点调度     │ │ 任务状态  │
└────────────┘ └──────────────┘ └───────────┘
```

| 层 | 职责 | 类比 |
|----|------|------|
| **内核层** | 定义"数据是什么、怎么关联" | OS 内核: 管理内存、进程 |
| **编排层** | 定义"先做什么后做什么" | OS 调度器: 进程执行顺序 |
| **分析层** | 定义"文本意味着什么" | 用户态程序: 业务逻辑 |

### 双模式运行

| 环境 | 数据库 | 数据持久化 | 切换方式 |
|------|--------|-----------|---------|
| 本地开发 | 内存数据库 | 重启后丢失 | `KERNEL_MODE=demo` (默认) |
| 生产部署 | ArangoDB Docker | 永久持久化 | `KERNEL_MODE=production` |

---

## 三、实施阶段

### Phase 1: 内核导入 & 双库搭建 (已完成)

| 任务 | 产出文件 | 验证方式 |
|------|---------|---------|
| 1.1 导入内核核心 | `backend/app/kernel/{database,config,exceptions}.py` | `KERNEL_MODE=demo` 启动成功 |
| 1.2 Pydantic 模型增强 | `backend/app/models/kernel/{meta_model,relation,report}.py` | ENUM/REFERENCE/MONEY/TEXT 类型可用 |
| 1.3 Repository 层 | `backend/app/repositories/{meta,object,relation}_repo.py` | AQL 查询正常 |
| 1.4 Service 层 | `backend/app/services/kernel/{meta,object,relation,report}_service.py` | CRUD + 校验通过 |
| 1.5 API 路由注册 | `backend/app/api/v1/kernel.py` | `/docs` 显示所有 kernel 端点 |
| 1.6 种子元模型 (16个) | `backend/scripts/seed_meta_models.py` | GET /meta 返回 16 个元模型 |
| 1.7 模板迁移 | `backend/app/templates/` | PPTX/XLSX 模板就位 |

### Phase 2: LangGraph 工作流框架 (已完成)

| 任务 | 产出文件 | 验证方式 |
|------|---------|---------|
| 2.1 基础工作流状态 | `backend/lib/workflow/base_state.py` | 共享状态定义 |
| 2.2 KernelBridge | `backend/lib/workflow/kernel_bridge.py` | 进程内 async 桥接 |
| 2.3 节点注册表 | `backend/lib/workflow/node_registry.py` | 装饰器自动发现 |
| 2.4 诊断工作流改造 | `backend/lib/langgraph/workflow.py` | AI 结果写入内核 |
| 2.5 报告工作流改造 | `backend/lib/report_workflow/nodes.py` | 报告引用内核数据 |

### Phase 3: 五大领域模块 (已完成)

| 领域 | 路径 | 元模型 | 核心节点 |
|------|------|--------|---------|
| 战略 | `lib/domain/strategy/` | Strategic_Goal, Strategic_Initiative, Market_Context | analyze_strategy |
| 组织 | `lib/domain/organization/` | Org_Unit, Job_Role, Process_Flow | analyze_structure |
| 绩效 | `lib/domain/performance/` | Performance_Metric, Competency, Review_Cycle | analyze_performance |
| 薪酬 | `lib/domain/compensation/` | Salary_Band, Pay_Component, Market_Benchmark | analyze_compensation |
| 人才 | `lib/domain/talent/` | Employee, Talent_Pipeline, Learning_Development | analyze_talent |

编排式诊断工作流: `backend/lib/workflow/orchestrated_diagnosis.py`

```
parse_input → parallel_domain_analysis (5节点并行) → cross_domain_synthesis → report_assembly
```

### Phase 4: 前端 API 抽象 & 渐进改造 (已完成)

| 任务 | 产出文件 | 功能 |
|------|---------|------|
| 4.1 统一 API 客户端 | `lib/api/kernel-client.ts` | TypeScript 类型安全调用 |
| 4.2 元数据驱动表单 | `components/kernel/MetaModelForm.tsx` | 动态渲染任意元模型表单 |
| 4.3 内核浏览组件 | `components/kernel/{ObjectBrowser,ObjectDetail,GraphViewer}.tsx` | 对象浏览 + 图谱可视化 |
| 4.4 内核管理页面 | `app/(dashboard)/kernel/` (3个页面) | 仪表盘 + 对象浏览器 + 图谱查看器 |
| 4.5 渐进改造 | `result/[id]`, `projects` 页面增强 | 诊断结果展示内核图谱 |

### Phase 5: 集成测试 & 部署 (已完成)

| 任务 | 产出文件 | 覆盖范围 |
|------|---------|---------|
| 5.1 E2E 测试: 诊断+内核 | `tests/test_e2e_diagnosis_kernel.py` | 7个测试类, CRUD/图谱/校验 |
| 5.2 E2E 测试: 报告+内核 | `tests/test_e2e_report_kernel.py` | 5个测试类, 跨域查询 |
| 5.3 破损页面检查 | — | 30个路由全部编译通过 |
| 5.4 部署配置 | `.env.example`, `render.yaml` | KERNEL_MODE + ARANGO_* |

---

## 四、16 个元模型清单

| # | 元模型 | 领域 | 关键字段 |
|---|--------|------|---------|
| 1 | Strategic_Goal | 战略 | goal_name, owner, priority, progress |
| 2 | Strategic_Initiative | 战略 | initiative_name, goal_id, status, owner_org |
| 3 | Market_Context | 战略 | market_name, trend, competitor_landscape |
| 4 | Org_Unit | 组织 | unit_name, unit_type, level, budget |
| 5 | Job_Role | 组织 | role_name, role_level, salary_grade |
| 6 | Process_Flow | 组织 | flow_name, scope, owner_unit |
| 7 | Performance_Metric | 绩效 | metric_name, target_value, actual_value |
| 8 | Competency | 绩效 | competency_name, category, level_description |
| 9 | Review_Cycle | 绩效 | cycle_name, period_type, status |
| 10 | Salary_Band | 薪酬 | band_name, grade_min, grade_max, currency |
| 11 | Pay_Component | 薪酬 | component_name, type, calculation_method |
| 12 | Market_Benchmark | 薪酬 | benchmark_name, market_percentile, data_source |
| 13 | Employee | 人才 | employee_name, department, position |
| 14 | Talent_Pipeline | 人才 | pipeline_name, employee_id, target_role |
| 15 | Learning_Development | 人才 | program_name, target_group, status |
| 16 | Consulting_Engagement | 跨领域 | engagement_name, client, scope |

---

## 五、关键 API 端点

```
内核 API (Kernel)
  POST/GET/PATCH/DELETE  /api/v1/kernel/meta[/{key}]
  POST/GET/PATCH/DELETE  /api/v1/kernel/objects[/{key}]
  POST/GET/DELETE        /api/v1/kernel/relations[/{key}]
  GET                    /api/v1/kernel/graph?start_obj_id=...&depth=...&direction=...

诊断 API (LangGraph)
  POST  /api/analyze          — 提交诊断文本
  GET   /api/langgraph/status/{task_id} — 查询状态
  GET   /api/langgraph/result/{task_id} — 获取结果

报告 API (Report Workflow)
  POST  /api/report/start     — 启动报告生成
  GET   /api/report/status/{task_id}
  GET   /api/report/modules/{task_id}
  GET   /api/report/slides/{task_id}

业务 API (Supabase)
  POST/GET  /api/projects
  POST/GET  /api/knowledge/*
```

---

## 六、启动方式

```bash
# 后端 (demo 模式, 无需 ArangoDB)
cd backend
KERNEL_MODE=demo python -m uvicorn app.main:app --port 8000 --reload

# 前端
cd org-diagnosis
npm run dev

# 种子元模型 (首次启动后运行一次)
cd backend
python scripts/seed_meta_models.py
```
