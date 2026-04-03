# Consulting OS 2.0 — AI 顾问 Agent 部署总结

> 更新日期: 2026-04-02
> 模块: AI 顾问 Agent (LangGraph 工作流 + Server-Driven UI + PPTX 生成)
> Commit: `4ffa70f` feat(agent): add AI consulting agent with LangGraph workflow

---

## 一、概述

将系统从"存储与排版工具"升级为"主动引导的咨询 Agent"。系统根据标杆报告的逻辑骨架，主动判断缺什么数据，动态生成交互表单引导用户补充，最终蒸馏为结构化 Project_Spec 并生成专业 PPTX。

### 核心变化

| 之前 | 之后 |
|------|------|
| 用户手动填表 → 刷新查看 | Agent 主动引导 → 动态表单 → 自动推进 |
| 静态 PPT 模板 | 智能布局 PPTXRendererV2 (38种布局自动匹配) |
| 数据散落各处 | 全部存入 ArangoDB 知识图谱 |
| 无上下文记忆 | AutoDream 记忆蒸馏 (每8轮压缩) |

---

## 二、系统架构

### 2.1 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 工作流引擎 | LangGraph StateGraph | Human-in-the-loop, interrupt_after |
| 状态管理 | ConsultingState TypedDict | Annotated[list, operator.add] append-only messages |
| AI 引擎 | DashScope (通义千问) | 引导话术 + 数据蒸馏 |
| 知识图谱 | ArangoDB (production) | sys_objects + sys_relations |
| PPTX 渲染 | PPTXRendererV2 | 智能布局选择器 (38 layouts, 5 themes) |
| 前端 | Next.js + 动态 FormCard | Server-Driven UI 协议 |
| 部署 | HK Docker + Vercel + Nginx | org-diagnosis.3strategy.cc |

### 2.2 状态机流转

```
init → PLAN → INTERACT → (user input) → collect → PLAN → ... → EXECUTE → COMPLETED
                ↑                                    ↓
                └──────── (蒸馏触发) ←── DISTILL ←──┘
```

- **PLAN**: 对比 blueprint vs collected_data，判断缺失字段
- **INTERACT**: AI 生成引导话术 + 动态表单 UI 组件
- **COLLECT**: 合并用户数据到 collected_data
- **DISTILL**: 每8轮触发，压缩对话历史为结构化 Project_Spec
- **EXECUTE**: 蒸馏 → 存入 ArangoDB → 生成 PPTX

### 2.3 Server-Driven UI 协议

后端返回 JSON，前端动态渲染：

```json
{
  "message": "为了分析贵公司的竞争态势...",
  "ui_components": [
    {"type": "input", "key": "competitor_name", "label": "主要竞争对手", "required": true},
    {"type": "select", "key": "market_position", "label": "市场地位", "options": [...]},
    {"type": "textarea", "key": "core_advantage", "label": "核心竞争优势"}
  ],
  "context": {"current_node": "SWOT分析", "progress": 0.35}
}
```

支持的组件类型: `input`, `textarea`, `select`, `number`

---

## 三、模块清单

### 3.1 后端新增文件 (`backend/app/agent/`)

| 文件 | 说明 | 行数 |
|------|------|------|
| `state.py` | ConsultingState TypedDict + AgentMode 枚举 | 57 |
| `workflow.py` | LangGraph 工作流封装 (ConsultingAgentWorkflow) | 269 |
| `nodes.py` | 6个工作流节点 + 辅助函数 | 630 |
| `blueprint_service.py` | 逻辑骨架解析器 (依赖树/缺失字段/进度) | 314 |
| `api.py` | FastAPI 路由 (Blueprint + Session + Download) | 443 |
| `models.py` | Pydantic 请求/响应模型 | 132 |
| `seed_blueprints.py` | 8个通用逻辑节点 + 2个通用标杆模板 | 343 |
| `seed_real_benchmarks.py` | 15个领域节点 + 6个真实标杆模板 | 574 |

### 3.2 前端新增文件

| 文件 | 说明 |
|------|------|
| `app/(dashboard)/agent/page.tsx` | Agent 主页面 (标杆选择 → 聊天界面) |
| `components/agent/AgentChat.tsx` | 聊天容器 (自动滚动 + 交互注入) |
| `components/agent/ChatMessage.tsx` | 消息组件 (AI/用户/系统) |
| `components/agent/FormCard.tsx` | 动态表单渲染器 (核心组件) |
| `components/agent/ProgressBar.tsx` | Blueprint 进度条 |
| `lib/agent-api.ts` | Agent API 客户端 (TypeScript) |

### 3.3 修改文件

| 文件 | 变更 |
|------|------|
| `backend/app/main.py` | Demo 模式自动 seed Agent blueprints |
| `backend/app/api/router.py` | 注册 agent router |
| `backend/scripts/seed_meta_models.py` | 新增 Logic_Node, Benchmark, Agent_Session, Project_Spec, Collected_Data 元模型 |
| `app/(dashboard)/DashboardShell.tsx` | 导航新增 "AI 顾问" |

---

## 四、API 端点

### Blueprint API (M1)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/agent/blueprint/logic-nodes` | 创建逻辑节点 |
| GET | `/api/v1/agent/blueprint/logic-nodes` | 列表逻辑节点 |
| POST | `/api/v1/agent/blueprint/benchmarks` | 创建标杆模板 |
| GET | `/api/v1/agent/blueprint/benchmarks` | 列表标杆模板 |
| GET | `/api/v1/agent/blueprint/benchmarks/{id}/tree` | 获取逻辑依赖树 |
| POST | `/api/v1/agent/blueprint/benchmarks/{id}/missing` | 获取缺失数据字段 |

### Session API (M2)
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/agent/sessions` | 创建并启动 Agent 会话 |
| GET | `/api/v1/agent/sessions` | 列表会话 |
| GET | `/api/v1/agent/sessions/{id}` | 获取会话状态 + UI 指令 |
| POST | `/api/v1/agent/sessions/{id}/resume` | 提交数据并恢复工作流 |
| GET | `/api/v1/agent/sessions/{id}/messages` | 获取对话历史 |
| DELETE | `/api/v1/agent/sessions/{id}` | 删除会话 |

### Execution API (M4)
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/agent/sessions/{id}/spec` | 查看 Project_Spec |
| GET | `/api/v1/agent/sessions/{id}/download` | 下载 PPTX 报告 |

---

## 五、数据模型

### ArangoDB 元模型

| model_key | 说明 | 关键字段 |
|-----------|------|----------|
| `Logic_Node` | 逻辑分析节点 | node_type, display_name, required_data_schema, dependencies |
| `Benchmark` | 标杆报告模板 | title, industry, consulting_type, node_order |
| `Agent_Session` | Agent 会话 | session_id, benchmark_id, status, progress |
| `Project_Spec` | 蒸馏后的规格书 | title, spec_data, distilled_at |
| `Collected_Data` | 收集的原始数据 | session_id, node_types, data |

### 关系类型 (sys_relations)

| relation_type | 方向 | 说明 |
|---------------|------|------|
| `benchmark_contains_node` | Benchmark → Logic_Node | 标杆包含哪些节点 |
| `logic_node_depends_on` | Logic_Node → Logic_Node | 逻辑依赖 |
| `session_uses_benchmark` | Agent_Session → Benchmark | 会话使用的模板 |

---

## 六、种子数据

### 通用逻辑节点 (8个)

| 节点 | 依赖 | 说明 |
|------|------|------|
| company_overview | — | 企业概况 |
| industry_analysis | company_overview | 行业分析 |
| SWOT | company_overview, industry_analysis | SWOT分析 |
| organizational_structure | company_overview | 组织结构评估 |
| talent_assessment | company_overview, organizational_structure | 人才梯队评估 |
| performance_diagnosis | organizational_structure | 绩效诊断 |
| strategic_recommendations | SWOT, performance_diagnosis | 战略建议 |
| implementation_roadmap | strategic_recommendations | 实施路线图 |

### 领域逻辑节点 (15个)

外部环境分析、竞争格局分析、客户分析、波士顿矩阵、战略优先级排序、关键举措设计、里程碑路线图、能力素质模型、学习地图设计、培养项目设计、培训落地保障、绩效体系设计、绩效管理流程、绩效评价标准、考核结果应用

### 标杆报告模板 (7个)

| 模板 | 节点数 | 咨询类型 |
|------|--------|----------|
| 通用组织诊断 | 8 | 组织诊断 |
| 战略规划 | 5 | 战略规划 |
| 十四五战略规划调研诊断与规划报告 | 4 | 战略规划 |
| 企业战略分析及规划 | 6 | 战略规划 |
| 领导力素质模型构建 | 1 | 人才管理 |
| 学习地图与培养项目设计 | 4 | 人才培训 |
| 绩效管理体系设计 | 4 | 绩效改进 |

---

## 七、部署架构

```
用户浏览器
    ↓ HTTPS
Nginx (HK: 80/443)
    ├─ /api/*  → org-diagnosis-api:8000 (Docker, cb-network)
    └─ /*      → Vercel (orgdiagnosis.vercel.app)

org-diagnosis-api (Python 3.11, FastAPI)
    ├─ ArangoDB: arangodb:8529 (cb-network, org_diagnosis DB)
    ├─ DashScope API: 通义千问 (AI 引导话术 + 蒸馏)
    └─ MinIO: 172.18.0.5:9000 (文件存储)

Vercel (Next.js, regions: hkg1)
    ├─ NEXT_PUBLIC_API_URL: https://org-diagnosis.3strategy.cc
    └─ Supabase: 认证 + 用户数据
```

### HK 服务器容器

| 容器 | 端口 | 网络 | 说明 |
|------|------|------|------|
| org-diagnosis-api | 127.0.0.1:8000 | cb-network | 后端 API |
| arangodb | 8529 | cb-network, bridge | 知识图谱 |
| nginx-gateway | 80, 443 | cb-network, docker_public | 反向代理 |

### 环境变量 (后端 .env)

```env
KERNEL_MODE=production
ARANGO_HOST=arangodb
ARANGO_PORT=8529
ARANGO_USER=root
ARANGO_PASSWORD=***
ARANGO_DATABASE=org_diagnosis
AI_PROVIDER=dashscope
DASHSCOPE_API_KEY=***
CORS_ORIGINS=https://org-diagnosis.3strategy.cc,...
```

---

## 八、测试结果

### 8.1 开发环境测试 (7项全部通过)

| 测试 | 内容 | 结果 |
|------|------|------|
| T1 | API 错误处理 & 边界情况 | 11/11 通过 |
| T2 | 7 个标杆报告模板 | 7/7 通过 |
| T3 | 蒸馏触发逻辑 (第8轮) | 确认触发 |
| T4 | 多会话隔离 | 7/7 通过 |
| T5 | 前端构建 + 类型检查 | 编译通过 |
| T6 | ArangoDB 持久化 | Collected_Data + Project_Spec 已存储 |
| T7 | PPTX 内容质量 | 11张幻灯片, 41KB, 8个分析模块, 智能布局 |

### 8.2 生产环境 E2E 测试

```
1. Health: OK
2. Benchmarks: 7 templates loaded from ArangoDB
3. Dependency Tree: 8 nodes with correct execution order
4. Create Session: mode=interact, AI guidance generated
5. Resume R1-R5: 5 rounds of data submission
   R1: progress=0.12 (企业概况)
   R2: progress=0.38 (行业分析 + 组织结构)
   R3: progress=0.75 (SWOT + 人才 + 绩效)
   R4: progress=0.88 (战略建议)
   R5: progress=1.0 → COMPLETED
6. PPTX Download: 41.1 KB, 11 slides
7. Project Spec: 8 analysis modules
8. Messages: 13 messages
9. Delete: 204 No Content
```

---

## 九、PPTX 智能布局

PPTXRendererV2 的 IntelligentSelector 为每张幻灯片自动选择最佳布局：

| 幻灯片 | 选择布局 | 选择依据 |
|--------|----------|----------|
| 企业概况 | PROCESS_05_H | sequential 关系, 5个元素 |
| 行业分析 | TABLE_COMPARE_01 | contrast 关系 |
| 组织结构评估 | PYRAMID_01 | hierarchical 关系 |
| SWOT 分析 | MATRIX_2x2_01 | matrix 关系 (四象限) |
| 绩效诊断 | TABLE_COMPARE_01 | text 类型 |
| 战略建议 | KEY_INSIGHT_01 | causal 关系 |

---

## 十、部署操作手册

### 更新后端代码

```bash
# 1. 本地同步代码到 HK
rsync -avz --exclude='venv/' --exclude='__pycache__/' --exclude='.env' \
  backend/ hk-jump:/opt/org-diagnosis/backend/

# 2. 在 HK 重建 Docker 镜像
ssh hk-jump "cd /opt/org-diagnosis/backend && docker build -t org-diagnosis-api:latest ."

# 3. 重启容器
ssh hk-jump "docker stop org-diagnosis-api && docker rm org-diagnosis-api && \
  docker run -d --name org-diagnosis-api --restart unless-stopped \
  --network cb-network -p 127.0.0.1:8000:8000 \
  -v /opt/org-diagnosis/backend/.env:/app/.env \
  -v /opt/org-diagnosis/data:/app/data \
  org-diagnosis-api:latest"

# 4. 验证
curl -s https://org-diagnosis.3strategy.cc/api/health
```

### 首次部署 / 重置种子数据

```bash
ssh hk-jump "docker exec org-diagnosis-api python -c \"
from scripts.seed_meta_models import seed_all_meta_models
seed_all_meta_models()
from app.agent.seed_blueprints import seed_all
seed_all()
from app.agent.seed_real_benchmarks import seed_domain_nodes, seed_real_benchmarks
from app.agent.blueprint_service import BlueprintService
from app.kernel.database import get_db
svc = BlueprintService(get_db())
node_id_map = seed_domain_nodes(svc)
seed_real_benchmarks(svc, node_id_map)
\""
```

### 更新前端

```bash
# git push 到 main 分支即可，Vercel 自动部署
git add . && git commit -m "feat: ..." && git push origin main
```

---

## 十一、已知限制与后续优化

1. **PPTX 布局有限**：当前测试数据为简单文本，真实咨询数据（含图表、矩阵）需要扩展 slides 格式
2. **文件上传未接入**：FormCard 支持 file 类型但前端未实现上传逻辑
3. **SSE 流式输出**：计划中但未实现，当前 AI 引导话术为同步生成
4. **蒸馏时机**：当前每8轮触发，可根据实际交互体验调整
5. **项目级集成**：Agent Session 支持绑定 project_id，但项目详情页入口尚未实现
6. **PPTX 下载链接**：当前通过 API 直接下载，前端下载按钮需配合

---

## 十二、关键设计决策

1. **复用 sys_objects**：所有 Agent 实例存入 sys_objects 而非新建集合，ObjectService/RelationService 零修改
2. **interrupt_after 而非 interrupt_before**：interact_node 需要执行才能生成 UI 组件
3. **全量替换 ObjectUpdate**：update_object 是全量属性替换，必须包含所有 required 字段
4. **Collected_Data 模型**：收集数据统一存为一个 Collected_Data 对象，而非每个 node_type 一个
5. **Auto-distill in executor**：executor_node 会检查是否已蒸馏，未蒸馏则自动执行
6. **Docker DNS**：ARANGO_HOST 使用容器名 `arangodb` 而非 IP，确保跨网络可解析
