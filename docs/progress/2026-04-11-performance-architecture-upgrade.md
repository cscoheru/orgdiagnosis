# 2026-04-11: 绩效管理架构升级 — 4 阶段实施总结

> 基于 Workday Cascading Goals + Supervisory Hierarchy + Review Cycles 机制设计的四阶段增量升级方案。

## 背景

绩效模块已完成基础功能（后端 30+ API、7 个 AI 节点、前端 8 个组件），UI 已从卡片式改为表格布局。但在实际使用中发现三个核心问题：

1. **AI 信息量不足**：仅凭战略目标名称+优先级，AI 无法生成有意义的绩效方案
2. **只有 KPI，没有战略举措**：缺少"车间自动化产线升级""质量合格率提升"等战略级重点任务
3. **没有层级分解**：组织绩效和岗位绩效都是扁平的，没有公司→部门→岗位的逐级分解

## 架构设计

参考 Workday 的三个核心机制：
- **Cascading Goals**: 目标从公司级向下逐级分解（copy+assign 模式）
- **Supervisory Hierarchy**: 组织层级决定目标路由和可见性
- **Review Cycles**: 年度主周期 + 季度/月度 check-in

## 部署顺序

```
Phase 1 (Schema) → Phase 2 (Context) → Phase 3 (Initiatives) → Phase 4 (Hierarchy)
   纯后端增量        立即改善AI质量      增加表达力        最复杂，最后上
```

每个 Phase 独立可部署，Phase 2-4 在 Phase 1 未部署时优雅降级。

---

## Phase 1: Meta-Model Schema 演进

**目标**：为所有现有模型添加新字段，支持层级分解和丰富上下文。纯增量，完全向后兼容。

### 后端变更

| 文件 | 变更 |
|------|------|
| `backend/scripts/seed_meta_models.py` | 5 个模型新增 14 个字段 + `upgrade_meta_models()` 函数 |
| `backend/app/models/kernel/relation.py` | 3 个新关系类型：PARENT_ORG, DECOMPOSED_FROM, LINKED_KPI |
| `backend/lib/workflow/kernel_bridge.py` | 2 个新方法：`get_objects_by_field()`, `get_ancestors()` |
| `backend/app/services/kernel/meta_service.py` | `add_fields_to_model()` 方法 |
| `backend/app/main.py` | 启动时调用 `upgrade_meta_models()` |

### 新增字段明细

**Strategic_Goal** (+8 字段):
- `goal_type` (enum): revenue_target / profit_target / strategic_initiative / operational_kpi / capability_building
- `milestones` (object): [{phase, date, deliverable}]
- `target_metrics` (object): [{metric_name, unit, target_value, actual_value}]
- `linked_kpis` (object): [{kpi_goal_id, weight}]
- `description` (text): 目标详细描述
- `parent_goal_ref` (reference → Strategic_Goal): 上级目标
- `period_type` (enum): annual / quarterly / monthly
- `owner_org_ref` (reference → Org_Unit): 责任组织单元

**Org_Unit** (+1 字段): `parent_org_ref` (reference → Org_Unit)

**Org_Performance** (+3 字段): `perf_type` (company/department), `parent_goal_ref` (reference → Org_Performance), `period_target` (string, e.g. "2026-Q1")

**Position_Performance** (+1 字段): `period_target` (string)

**Performance_Plan** (+1 字段): `business_context` (object: {client_profile, business_review, market_insights, swot_data, strategic_direction, bsc_cards, action_plans, targets, source_files})

### 关键设计决策

- **`upgrade_meta_models()` 合并策略**：读取现有 fields，按 field_name 去重后追加新字段。不删除旧字段，不破坏现有数据。
- **`get_objects_by_field()`**：直接运行 AQL 查询 `doc.properties[@field_name]`，避免全量加载+应用层过滤。
- **`get_ancestors()`**：沿 INBOUND 边遍历关系图，构建祖先链（bottom-up）。

### 前端变更

| 文件 | 变更 |
|------|------|
| `types/performance.ts` | 新增 GoalType, PeriodType, PerfType, BusinessContext, Milestone, TargetMetric, LinkedKPI 类型；更新 PerformancePlan, OrgPerformance, PositionPerformance 接口 |
| `tests/unit/performance/PlanOverviewTab.test.tsx` | 修复 mock 数据缺失 project_id |

---

## Phase 2: 战略上下文富化 + 文件上传集成

**目标**：让 AI 节点获得丰富的业务上下文，解决"AI 凭空想象"的问题。

### 后端变更

| 文件 | 变更 |
|------|------|
| `backend/app/api/v1/performance.py` | 2 个新端点：`POST /plans/{key}/enrich-context`, `POST /plans/{key}/bridge-strategy` |
| `backend/lib/domain/performance/nodes.py` | 新增 `_build_enriched_context()` 函数；增强 `generate_org_performance_node` 的战略目标数据（goal_type, description, milestones, target_metrics）；enriched_context 传入 AI 提示词 |
| `backend/lib/domain/performance/prompts.py` | `ORG_PERFORMANCE_GENERATION_PROMPT` 增加 `{enriched_context}` 占位符 |

### 前端变更

| 文件 | 变更 |
|------|------|
| `components/performance/ContextEnrichmentPanel.tsx` | **新建** — 4 个上下文分区卡片（客户概况/业务复盘/市场洞察/战略方向），支持文本粘贴 + 从战略解码导入 |
| `components/performance/PlanOverviewTab.tsx` | 嵌入 ContextEnrichmentPanel |
| `lib/api/performance-api.ts` | 2 个新 API 函数：`enrichPlanContext()`, `bridgeStrategyData()` |

### 关键设计决策

- **`business_context` 作为 JSON scratchpad**：所有上下文存储在 Performance_Plan 的单个 JSON 字段中，前端按 key 映射 UI 分区。简单且灵活。
- **`bridge-strategy` 端点读 kernel objects**：不依赖 workflow step data 内部实现，直接读取 Strategic_Goal / Market_Context / Strategic_Initiative 对象。两模块解耦。
- **`_build_enriched_context()` 是纯函数**：输入 plan_props，输出格式化字符串。可测试、可组合。

---

## Phase 3: 战略举措 + 增强目标模型

**目标**：支持战略级重点任务，让 AI 有分解的落脚点。

### 后端变更

| 文件 | 变更 |
|------|------|
| `backend/lib/domain/performance/goal_decomposer.py` | **新建** — AI 分解节点：举措 → 里程碑 + 关联 KPI + LINKED_KPI 关系 |
| `backend/lib/domain/performance/prompts.py` | 新增 `INITIATIVE_DECOMPOSITION_PROMPT` |
| `backend/app/api/v1/performance.py` | 4 个新端点：strategic goal CRUD + decompose |

### 前端变更

| 文件 | 变更 |
|------|------|
| `components/performance/StrategicGoalsTab.tsx` | **新建** — 按类型分组的战略目标列表 + 战略举措展开面板 + AI 分解按钮 |
| `lib/api/performance-api.ts` | 4 个新 API 函数：createStrategicGoal, listStrategicGoals, updateStrategicGoal, decomposeInitiative |

### 关键设计决策

- **Goal types 作为一等公民**：`goal_type` enum 区分战略举措（方向性）和 KPI（可量化）。前端按类型分组展示。
- **分解是独立 AI 节点**：不嵌入 org perf 生成。用户可独立分解举措，结果持久化回对象。
- **LINKED_KPI 边**：分解创建的 KPI 目标通过图关系连接到原始举措，Phase 4 的级联遍历可利用。

---

## Phase 4: 层级分解 + 周期管理

**目标**：公司→部门→岗位的目标级联分解，支持年度→季度→月度的时间维度。

### 后端变更

| 文件 | 变更 |
|------|------|
| `backend/lib/workflow/hierarchy_utils.py` | **新建** — get_org_tree, get_goal_cascade_chain, get_period_variants |
| `backend/lib/domain/performance/cascade_orchestrator.py` | **新建** — generate_full_cascade（递归 top-down） |
| `backend/lib/domain/performance/period_decomposer.py` | **新建** — AI 年度→季度分解 + DECOMPOSED_FROM 关系 |
| `backend/app/api/v1/performance.py` | 4 个新端点：cascade/generate, cascade/tree, org-perf/decompose-period, org-units/set-parent |

### 前端变更

| 文件 | 变更 |
|------|------|
| `components/performance/CascadeTreeTab.tsx` | **新建** — 可折叠树形层级视图 + 一键级联 + 分解到季度 |
| `lib/api/performance-api.ts` | 4 个新 API 函数：cascadeGenerate, getCascadeTree, decomposePeriod, setParentOrg |

### 关键设计决策

- **递归级联**：orchestrator 遍历组织树，每个节点调用 AI 时传入父级绩效数据作为上下文。子目标从父目标继承并分解。
- **DECOMPOSED_FROM 边形成面包屑**：每个子 Org_Performance 有 DECOMPOSED_FROM 关系指向父级。`get_ancestors()` 可重建完整链。
- **周期分解是独立操作**：不捆绑在级联生成中（避免 AI 调用指数增长）。先年度级联，再选择性分解到季度。
- **级联树 API**：`/cascade/tree` 返回嵌套树结构，包含 org_performance 和 position_performance 两层节点。

---

## 文件清单汇总

### 修改的文件 (9)

| 文件 | Phase | 变更类型 |
|------|-------|---------|
| `backend/scripts/seed_meta_models.py` | 1 | 新增字段 + upgrade 函数 |
| `backend/app/models/kernel/relation.py` | 1 | 新增 3 个关系类型 |
| `backend/lib/workflow/kernel_bridge.py` | 1 | 新增 2 个方法 |
| `backend/app/services/kernel/meta_service.py` | 1 | 新增 add_fields_to_model |
| `backend/app/main.py` | 1 | 调用 upgrade_meta_models |
| `backend/app/api/v1/performance.py` | 2-4 | 13 个新端点 |
| `backend/lib/domain/performance/nodes.py` | 2 | enriched context + 增强目标数据 |
| `backend/lib/domain/performance/prompts.py` | 2-3 | 2 个新提示词模板 |
| `types/performance.ts` | 1 | 新增类型定义 |

### 新建的文件 (7)

| 文件 | Phase | 说明 |
|------|-------|------|
| `backend/lib/domain/performance/goal_decomposer.py` | 3 | AI 分解节点 |
| `backend/lib/domain/performance/cascade_orchestrator.py` | 4 | 级联编排器 |
| `backend/lib/domain/performance/period_decomposer.py` | 4 | 周期分解节点 |
| `backend/lib/workflow/hierarchy_utils.py` | 4 | 层级工具 |
| `components/performance/ContextEnrichmentPanel.tsx` | 2 | 上下文输入面板 |
| `components/performance/StrategicGoalsTab.tsx` | 3 | 战略目标管理 |
| `components/performance/CascadeTreeTab.tsx` | 4 | 级联树可视化 |

### 新增 API 端点汇总 (13)

| 端点 | 方法 | Phase | 说明 |
|------|------|-------|------|
| `/plans/{key}/enrich-context` | POST | 2 | 文本粘贴富化上下文 |
| `/plans/{key}/bridge-strategy` | POST | 2 | 从战略解码导入 |
| `/strategic-goals` | POST | 3 | 创建战略目标 |
| `/strategic-goals` | GET | 3 | 列表战略目标 |
| `/strategic-goals/{key}` | PATCH | 3 | 更新战略目标 |
| `/strategic-goals/decompose` | POST | 3 | AI 分解举措 |
| `/cascade/generate` | POST | 4 | 一键级联生成 |
| `/cascade/tree` | GET | 4 | 获取级联树 |
| `/org-perf/{key}/decompose-period` | POST | 4 | 周期分解 |
| `/org-units/{key}/set-parent` | PATCH | 4 | 设置上级部门 |

---

## 向后兼容策略

1. 所有新字段为 optional（`is_required=False`）
2. 现有节点用 `.get()` 访问新字段，缺失时安全降级
3. `upgrade_meta_models()` 只合并字段不删除
4. 新 API 端点不影响已有端点签名
5. 前端组件对 undefined 新字段有兜底显示

## 验证方式

1. **Phase 1**: `upgrade_meta_models()` 运行后，创建含新字段的对象验证 round-trip
2. **Phase 2**: 上传 PDF → bridge 战略解码数据 → 生成组织绩效 → 验证 AI 输出包含业务上下文
3. **Phase 3**: 创建战略举措 → AI 分解 → 验证里程碑 + 关联 KPI 正确生成
4. **Phase 4**: 一键级联 → 验证公司→部门→岗位完整链 → 周期分解 → 前端树展示

## 后续 TODO

- [ ] 将 CascadeTreeTab 和 StrategicGoalsTab 注册到 PerformanceOverview 的 Tab 列表中
- [ ] Phase 2 文件上传端点（PDF/DOCX/Excel → 解析 → business_context）
- [ ] Phase 4 的岗位绩效周期选择器 UI
- [ ] E2E 测试覆盖新增端点
- [ ] 在 `module.py` 中注册新增的 AI 节点（goal_decomposer, cascade_orchestrator, period_decomposer）
