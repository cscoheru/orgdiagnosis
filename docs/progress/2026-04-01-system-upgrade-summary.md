# ConsultingOS 系统升级总结

> 更新日期: 2026-04-01
> 涵盖模块: 需求分析与项目交付 (W1/W2/W3) + 智能共创套件

---

## 一、项目交付模块 (需求分析与项目交付)

### 1.1 架构概览

基于三阶段工作流引擎，覆盖咨询项目全生命周期：

```
W1: 需求分析与建议书 (6步)
  → 基本信息 → 核心需求 → MDS幻灯片 → 详细大纲 → 模板选择 → 生成PPTX

W2: 调研诊断与报告 (4步)
  → 结构化问卷 → 客户确认 → 五维仪表盘 → PPT输出

W3: 项目解决方案 (4步)
  → 创建订单 → 编辑计划 → 阶段推进 → 阶段报告
```

### 1.2 技术栈

| 层级 | 技术 |
|------|------|
| 前端路由 | Next.js App Router `/projects/[id]/(proposal\|diagnosis\|delivery)` |
| 工作流引擎 | 配置驱动 + `@register_step` 装饰器注册 |
| 状态持久化 | Session 存储到 ArangoDB (sys_objects) |
| AI 生成 | DashScope/DeepSeek (via ai_client.py) |
| PPTX 渲染 | python-pptx + 40+ 布局模板 |
| 可视化 | Recharts (五维仪表盘) |

### 1.3 已完成功能清单

#### W1: 需求分析与建议书
- [x] SmartExtractStep — AI 辅助客户信息提取
- [x] MilestonePlanStep — 里程碑计划编辑 (阶段、关键活动)
- [x] MDSContentStep — 单页高管摘要幻灯片
- [x] ImplementationOutlineStep — 逐节 AI 生成详细大纲
- [x] TemplateSelectionStep — 模板选择 UI
- [x] PPTOutputStep — 最终 PPTX 导出

#### W2: 调研诊断与报告
- [x] StructuredQuestionnaireStep — 结构化问卷 (严重程度分级)
- [x] ClientConfirmStep — 人工确认步骤
- [x] FiveDimensionDashboard — 五维分析仪表盘 (战略/组织/绩效/薪酬/人才)
- [x] DiagnosisPPTStep — 诊断报告 PPT 输出

#### W3: 项目解决方案
- [x] CreateOrderStep — 合同、团队、排期创建
- [x] EditPlanStep — 阶段计划结构化编辑 (负责人管理)
- [x] PhaseExecutionStep — 核心交付阶段管理
  - [x] 任务 CRUD (创建/编辑/删除)
  - [x] 交付成果关联
  - [x] 会议纪要记录
  - [x] 阶段状态追踪 (规划/进行中/已完成)
  - [x] AI 任务生成
- [x] PhaseReportStep — 阶段报告生成与导出

#### 通用功能
- [x] WorkflowStepNavigator — 统一步骤导航
- [x] Session 持久化与自动恢复
- [x] 项目列表 (状态标签: 草稿/需求分析/调研诊断/交付中/已完成)
- [x] 维度模块选择 (战略/组织/绩效/薪酬/人才)
- [x] 项目删除
- [x] 导出 Markdown (步骤 2/3/4)
- [x] CSS Slide 内容渲染器 (Phase 6A)
- [x] PowerPoint 风格布局 (Phase 6B)
- [x] 内联编辑功能 (Phase 6C)
- [x] PPTX 缩略图预览 (Phase 1)

### 1.4 关键文件路径

```
前端页面:
  app/(dashboard)/projects/page.tsx              — 项目列表
  app/(dashboard)/projects/[id]/layout.tsx       — 项目导航头
  app/(dashboard)/projects/[id]/proposal/page.tsx — W1 工作流
  app/(dashboard)/projects/[id]/diagnosis/page.tsx— W2 工作流
  app/(dashboard)/projects/[id]/delivery/page.tsx — W3 工作流

组件:
  components/workflow/WorkflowStepNavigator.tsx   — 步骤导航
  components/workflow/PhaseExecutionStep.tsx      — 阶段执行 (核心)
  components/workflow/SmartExtractStep.tsx       — 信息提取
  components/workflow/MilestonePlanStep.tsx       — 里程碑计划
  components/workflow/EditPlanStep.tsx           — 计划编辑
  components/workflow/CreateOrderStep.tsx        — 订单创建
  components/workflow/PhaseReportStep.tsx        — 阶段报告

API 客户端:
  lib/api/workflow-client.ts                      — 工作流 API 客户端
  lib/api/workflow-types.ts                       — W1/W2/W3 类型定义

后端:
  backend/app/api/v2/workflow.py                  — 工作流引擎
  backend/app/api/v1/projects.py                  — 项目管理 API
  backend/app/models/kernel/meta_model.py          — 元模型定义
```

### 1.5 存在的问题

| 问题 | 状态 | 说明 |
|------|------|------|
| DashScope API 依赖 | 已知限制 | AI 生成功能依赖外部 API，未配置时降级 |
| Session 服务端重启丢失 | 已知限制 | 当前存储在内存/服务器端，重启后需恢复 |
| 多人协作 | 未实现 | 无实时多人编辑能力 |
| 模板自定义 | 未实现 | 无法自定义 PPTX 布局模板 |
| 知识库集成 (RAG) | 未实现 | 计划中，尚未开始 |
| PPTX 实时预览 | 未实现 | 当前只能导出后查看 |

---

## 二、智能共创套件 (Workshop CoCreate)

### 2.1 架构概览

独立的工作坊页面 `/workshop/cocreate`，包含 4 个核心组件：

```
┌──────────────────────────────────────────────────┐
│                 共创工作坊                        │
│                                                    │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐          │
│  │ 画布    │  │ 矩阵    │  │ 标签    │          │
│  │ Canvas  │  │ Matrix  │  │ Tags    │          │
│  └─────────┘  └─────────┘  └─────────┘          │
│                                                    │
│  AI 推荐 ─── 生成同类子节点 (3个)                   │
│  导出 ─────── CSV (路径+节点+维度+标签)             │
└──────────────────────────────────────────────────┘
```

### 2.2 技术栈

| 层级 | 技术 |
|------|------|
| 画布 | ReactFlow + elkjs (LR 树布局) |
| 评价矩阵 | Recharts (散点图 + 滑块) |
| 数据存储 | ArangoDB Kernel (ObjectService + RelationService) |
| AI 推荐 | DashScope/DeepSeek (复用 ai_client.py) |
| 前端 | Next.js + Tailwind CSS |

### 2.3 已完成功能清单

#### 画布 (CoCreateCanvas)
- [x] ReactFlow 画布 + elkjs 自动布局
- [x] 创建节点 (Enter 同级 / Tab 子级)
- [x] 删除节点 (Delete/Backspace，含子树)
- [x] 键盘导航 (方向键 ↑↓←→)
- [x] 编辑节点 (F2 / 双击)
- [x] 手动拖拽连线 (Handle → Handle)
- [x] AI 推荐子节点 (固定 3 个同类节点)
- [x] Ghost 节点预览 + 点击采纳
- [x] 添加根节点弹窗
- [x] Shift+拖拽 框选多节点
- [x] 多节点同时拖动
- [x] 多节点同时删除

#### 评价矩阵 (EvaluationMatrix)
- [x] 四维评分系统 (痛点极值/业务价值/能力鸿沟/格式维)
- [x] 1-5 分滑块交互
- [x] Recharts 散点图可视化
- [x] 高优先级高亮 (>3 同时在 X 和 Y 轴)
- [x] 评价项 CRUD

#### 标签系统 (TaggingSidebar)
- [x] 4 个预定义分类 (场景维/痛点维/技能维/格式维)
- [x] AI 标签推荐 (基于节点内容)
- [x] 新标签 + 已有标签混合推荐
- [x] 节点标签关联
- [x] 按分类分组显示

#### 导出
- [x] 图遍历展平 (层级路径: L1 > L2 > L3)
- [x] CSV 导出 (节点+维度+标签)
- [x] UTF-8 BOM (Excel 兼容)

### 2.4 后端 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/sessions` | POST/GET | 创建/列表工作坊会话 |
| `/sessions/{id}` | GET | 获取会话详情 (含所有节点) |
| `/sessions/{id}/nodes` | POST | 创建画布节点 |
| `/sessions/{id}/nodes/{id}` | PATCH | 更新节点 |
| `/sessions/{id}/nodes/{id}` | DELETE | 删除节点及子树 (BFS) |
| `/sessions/{id}/suggest` | POST | AI 推断子节点 |
| `/sessions/{id}/evaluations` | GET/POST | 评价项 CRUD |
| `/sessions/{id}/evaluations/{id}` | PATCH/DELETE | 更新/删除评价项 |
| `/sessions/{id}/tags` | GET/POST | 标签管理 |
| `/sessions/{id}/tags/{id}` | PATCH | 更新标签 |
| `/sessions/{id}/suggest-tags` | POST | AI 推荐标签 |
| `/sessions/{id}/export` | GET | 图遍历展平导出 |

### 2.5 数据模型 (元模型)

| 模型 | 说明 |
|------|------|
| `Workshop_Session` | 工作坊容器 (title, industry_context, project_id) |
| `Canvas_Node` | 画布节点 (name, node_type, description, workshop_id) |
| `Evaluation_Item` | 评价项 (name, dim_x/y/z/w, workshop_id) |
| `Tag_Category` | 标签分类 (name, color, display_order, workshop_id) |
| `Smart_Tag` | 标签 (name, color, category_id, workshop_id) |

关系类型: `canvas_parent_child`, `canvas_node_to_tag`

### 2.6 关键文件路径

```
前端:
  app/(dashboard)/workshop/cocreate/page.tsx        — 工作坊列表
  app/(dashboard)/workshop/cocreate/[id]/page.tsx    — 工作坊详情 (三 Tab)
  components/workshop/CoCreateCanvas.tsx             — 画布主组件
  components/workshop/SmartNode.tsx                  — 自定义节点
  components/workshop/EvaluationMatrix.tsx           — 评价矩阵
  components/workshop/TaggingSidebar.tsx             — 标签侧边栏
  lib/api/workshop-api.ts                            — API 客户端

后端:
  backend/app/api/v1/workshop.py                     — 工作坊 API
  backend/app/models/kernel/meta_model.py            — 元模型定义
  backend/scripts/seed_meta_models.py                — 种子数据脚本
```

### 2.7 已解决的问题

| 问题 | 修复方案 | 状态 |
|------|---------|------|
| 节点编辑不保存 | 乐观更新 (useReactFlow.setNodes) + fire-and-forget API | 已修复 |
| 布局效果覆盖乐观更新 | Merge 策略: 只更新位置，保留现有数据 | 已修复 |
| 回调闭包过时 | Ref 模式: actionRefs.current 始终指向最新函数 | 已修复 |
| 画布不能拖动 | panOnDrag=true + selectionOnDrag=true | 已修复 |
| 光标不正确 | CSS !important 覆盖 ReactFlow 默认样式 | 已修复 |
| 删除图标无效 | 移除图标，改用 Delete/Backspace 键 | 已修复 |
| AI 跨类型生成 | Prompt 限制为 "恰好 3 个同类型子节点" | 已修复 |
| 悬停按钮延迟 | 优化 hover 状态检测 | 已修复 |
| 手动拖拽连线 | onConnect 回调 + createRelation API | 已修复 |

### 2.8 未解决的问题

| 问题 | 严重程度 | 说明 |
|------|---------|------|
| 编辑后偶尔回滚 | 高 | Merge 策略已实现，但用户反馈仍有问题，需进一步调试 |
| 多选操作体验 | 中 | Shift+框选已实现，但用户反馈交互不自然 |
| 节点拖动后布局重置 | 中 | ELK 布局在 session 变化时重新计算，覆盖手动拖动位置 |
| 无撤销/重做 | 低 | 未实现 undo/redo 功能 |
| 无协作编辑 | 低 | 单人使用，无实时多人支持 |
| 无模板系统 | 低 | 每次从空白开始，无预设模板 |

---

## 三、Kernel 基础设施

### 3.1 元模型扩展

两次升级共新增/修改元模型:

| 模型 | 所属模块 | 状态 |
|------|---------|------|
| `Workshop_Session` | 共创套件 | 已创建 |
| `Canvas_Node` | 共创套件 | 已创建 |
| `Evaluation_Item` | 共创套件 | 已创建 |
| `Tag_Category` | 共创套件 | 已创建 |
| `Smart_Tag` | 共创套件 | 已创建 |
| 16 个诊断域模型 | 项目交付 | 已创建 |

### 3.2 数据库

- **ArangoDB**: 对象存储 (sys_objects) + 关系存储 (sys_relations)
- **ObjectService**: CRUD 操作
- **RelationService**: 关系管理 (canvas_parent_child, canvas_node_to_tag)

---

## 四、待办事项 (按优先级)

### P0 — 生产阻塞

1. **画布编辑持久化验证** — 用户反馈编辑仍不生效，需深入调试 ReactFlow 状态管理
2. **多选交互优化** — Shift+框选 + Delete 删除需要更直观的交互反馈

### P1 — 功能完善

3. **节点拖动位置保持** — ELK 布局应仅在结构变化时重算，数据编辑不应触发重布局
4. **知识库 RAG 集成** — 为 AI 推荐提供行业知识库上下文
5. **工作坊模板** — 预设常见行业的工作坊模板

### P2 — 体验优化

6. **撤销/重做** — Ctrl+Z / Ctrl+Shift+Z
7. **实时 PPTX 预览** — 在线预览而非下载
8. **多人协作** — WebSocket 实时同步
9. **搜索/筛选** — 节点和标签的搜索功能

---

## 五、任务完成记录

### 项目交付模块 (Tasks #123-#139)

| Task | 描述 | 状态 |
|------|------|------|
| #123 | PPTX 缩略图预览组件 | 已完成 |
| #125 | 创建订单 — 合同+团队+排期 | 已完成 |
| #129 | Kernel Meta-Models 扩展 | 已完成 |
| #130 | PowerPoint 风格布局 | 已完成 |
| #131 | CSS Slide 内容渲染器 | 已完成 |
| #132 | 内联编辑 | 已完成 |
| #133 | 编辑计划结构化 | 已完成 |
| #134 | 任务 CRUD API + 前端 | 已完成 |
| #135 | 会议纪要 API + 前端 | 已完成 |
| #136 | 交付成果关联 API + 前端 | 已完成 |
| #137 | workflow-client.ts 类型与 API | 已完成 |
| #138 | PhaseExecutionStep 详情区域增强 | 已完成 |
| #139 | delivery/page.tsx 传递 projectId | 已完成 |

### 智能共创套件 (Tasks #140-#159)

| Task | 描述 | 状态 |
|------|------|------|
| #140 | Workshop Backend API | 已完成 |
| #141 | TaggingSidebar 组件 | 已完成 |
| #142 | CoCreateCanvas 组件 | 已完成 |
| #143 | Meta-Model 定义 | 已完成 |
| #144 | Integration + 导航 | 已完成 |
| #145 | Workshop Pages | 已完成 |
| #146 | API Client + elkjs | 已完成 |
| #147 | EvaluationMatrix 组件 | 已完成 |
| #148-#150 | API 文件 + 路由注册 | 已完成 |
| #151 | 手动拖拽连线 | 已完成 |
| #152 | 节点编辑保存 | 已完成 |
| #153 | AI 跨类型生成 | 已完成 |
| #154 | 悬停按钮修复 | 已完成 |
| #155 | 节点样式面板 | 已完成 |
| #156 | 自定义节点类型 | 已完成 |
| #157 | 乐观本地更新 | 已完成 |
| #158 | 画布光标修复 | 已完成 |
| #159 | 移除删除图标 | 已完成 |
