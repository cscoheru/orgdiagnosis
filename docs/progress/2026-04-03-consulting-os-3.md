# Consulting OS 3.0 — AI 顾问集成到项目交付工作流

> 日期：2026-04-03
> 版本：b36001c
> 状态：已部署

## 背景

M1-M4 Agent 开发完成后，存在三个核心问题：
1. **孤岛运行**：Agent 在 `/agent` 独立页面，与项目管理体系脱节
2. **数据不继承**：W1/W2 已收集的数据，Agent 重新询问
3. **交互体验差**：用户填表（input/textarea/select），而非选择式交互

## 架构决策

### 核心结论：底层零修改

| 层级 | 是否修改 | 说明 |
|------|---------|------|
| LangGraph 状态机 | 否 | `collected_data` 预填充即可 |
| 蓝图服务 blueprint_service | 否 | 已支持任意 field_type |
| 节点逻辑 nodes.py | 否 | 已支持预填充数据 |
| 工作流引擎 workflow_engine | 否 | 不动 |
| W1/W2/W3 页面 | 是 | 新增 AI 按钮 + AgentPanel |
| Agent API | 是 | 新增 `/sessions/from-project` |
| Agent Workflow | 微调 | `start_with_seed()` |
| 前端组件 | 是 | ChoiceCard + AgentPanel |

### 数据流设计

```
现有工作流 (不变):
  W1 (SQLite) ──→ W2 (SQLite) ──→ W3 (SQLite)

新增数据桥接:
  W1 workflow_data ──┐
                      ├──→ seed_mapper.py ──→ Agent collected_data ──→ LangGraph ──→ PPTX
  W2 workflow_data ──┘
```

---

## Phase 1：数据桥接层

### 1.1 seed_mapper.py

将 W1/W2 工作流数据映射为 Agent 的 `collected_data` 格式。

**W1 字段映射**：
| W1 字段 | → Agent 节点 | → Agent 字段 |
|---------|-------------|-------------|
| client_name | company_overview | company_name |
| industry | company_overview | industry |
| company_scale | company_overview | employee_count |
| company_info | company_overview | core_business |
| industry_background | industry_analysis | industry_trend |
| core_pain_points | SWOT | weaknesses |
| expected_goals | strategic_recommendations | strategic_priorities |
| phases | implementation_roadmap | phases |

**W2 字段映射**：
| W2 字段 | → Agent 节点 | → Agent 字段 |
|---------|-------------|-------------|
| structure.score+evidence | organizational_structure | org_pain_points |
| performance.score+evidence | performance_diagnosis | performance_pain_points |
| talent.score+evidence | talent_assessment | talent_pain_points |
| strategy.score+evidence | strategic_recommendations | strategic_context |

### 1.2 workflow.py — start_with_seed()

```python
async def start_with_seed(session_id, benchmark_id, project_goal, seed_data, project_id=None):
    initial_state = {
        "collected_data": seed_data,  # 预填充！
        ...
    }
```

### 1.3 api.py — /sessions/from-project

```
POST /api/v1/agent/sessions/from-project
{
  "project_id": "...",
  "benchmark_id": "...",
  "project_goal": "...",
  "mode": "proposal" | "consulting_report"
}
```

返回 `session + interaction + seeded_nodes`（已预填充的节点列表）。

### 1.4 新增"项目建议书"Benchmark

5 个节点（比通用组织诊断少 3 个）：
company_overview → industry_analysis → SWOT → strategic_recommendations → implementation_roadmap

---

## Phase 2：交互体验升级

### 2.1 字段类型升级

| 之前 | 之后 | 效果 |
|------|------|------|
| select | single_choice (cards) | 可点击卡片，选中高亮 |
| textarea | multi_choice (chips) | 可切换标签，支持自定义输入 |

### 2.2 ChoiceCard.tsx

- `SingleChoiceGroup`：cards (2 列网格) 或 chips (行内按钮)
- `MultiChoiceGroup`：chips (圆角标签) 或 cards (勾选卡片)
- `CustomInput`：`allow_custom` 时的"+ 自定义"文本输入

### 2.3 新增字段类型

```typescript
type UIComponent = {
  type: 'single_choice' | 'multi_choice' | 'rating' | ...
  ui_style?: 'cards' | 'chips' | 'slider'
  allow_custom?: boolean
}
```

---

## Phase 3：项目集成 UI

### 3.1 AgentPanel.tsx

可复用的侧滑面板组件：
- 打开时自动调用 `createSessionFromProject()` 创建带种子数据的会话
- 内嵌 `AgentChat` 显示交互流
- 完成后 `onComplete` 回调
- 关闭不丢失会话（后端持久化）

### 3.2 AIGenerateButton.tsx

"AI 一键生成"入口按钮，两种模式：
- `proposal`（橙色）— 建议书
- `consulting_report`（蓝色）— 咨询报告

### 3.3 页面集成点

| 页面 | 位置 | 条件 |
|------|------|------|
| W1 proposal | Step 2 (核心需求与计划) | planData 存在时 |
| W2 diagnosis | Step 3 (五维仪表盘) | analysisData 存在时 |
| W3 delivery | Step 4 (阶段报告) | 始终显示（两个选项） |

---

## Phase 4：输出集成

### 4.1 project_exports.source 列

```sql
ALTER TABLE project_exports ADD COLUMN source TEXT DEFAULT 'manual'
```

### 4.2 save_export() 方法

自动计算文件大小，生成 download_url，标记 `source='agent'`。

### 4.3 自动关联

在 `resume` 端点中，当 Agent 完成且有 `project_id` 时，自动创建 `project_exports` 记录。

---

## 文件变更清单

### 新建 (4)
- `backend/app/agent/seed_mapper.py`
- `components/agent/AgentPanel.tsx`
- `components/agent/AIGenerateButton.tsx`
- `components/agent/ChoiceCard.tsx`

### 修改 (10)
- `backend/app/agent/workflow.py` — start_with_seed()
- `backend/app/agent/api.py` — /sessions/from-project + export 关联
- `backend/app/agent/models.py` — AgentSessionFromProject
- `backend/app/agent/seed_blueprints.py` — 项目建议书 + 字段类型
- `backend/lib/projects/store.py` — source 列 + save_export()
- `lib/agent-api.ts` — 类型扩展 + createSessionFromProject()
- `components/agent/FormCard.tsx` — single/multi choice 渲染
- `app/(dashboard)/projects/[id]/proposal/page.tsx` — AI 按钮
- `app/(dashboard)/projects/[id]/diagnosis/page.tsx` — AI 按钮
- `app/(dashboard)/projects/[id]/delivery/page.tsx` — AI 按钮

---

## 部署信息

### 后端
- **服务器**: HK Docker (cb-network)
- **容器**: org-diagnosis-api
- **端口**: 8003:8000
- **域名**: https://org-diagnosis.3strategy.cc (via nginx)
- **镜像**: org-diagnosis-api:latest (b36001c)
- **数据库**: ArangoDB (demo mode, 8 logic nodes + 3 benchmarks)

### 前端
- **平台**: Vercel
- **域名**: https://org-diagnosis.3strategy.cc
- **API**: NEXT_PUBLIC_API_URL=https://org-diagnosis.3strategy.cc

### Seed 数据
```
Logic Nodes: 8 (company_overview → implementation_roadmap)
Benchmarks: 3
  - 通用组织诊断 (8 nodes)
  - 战略规划 (5 nodes)
  - 项目建议书 (5 nodes) [NEW]
```

---

## 验证清单

- [x] TypeScript 编译通过（零错误，排除已有测试文件）
- [x] Python 语法检查通过
- [x] 后端容器健康 (/health → 200)
- [x] Benchmarks API 返回 3 个模板
- [x] /sessions/from-project 端点注册
- [x] 数据库 seed 成功
- [x] Git push 到 main，Vercel 自动部署
