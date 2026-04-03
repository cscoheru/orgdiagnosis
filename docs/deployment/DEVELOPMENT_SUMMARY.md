# 项目开发总结 — ConsultingOS 内核整合

> 生成时间: 2026-03-27
> 项目: org-diagnosis 五维诊断系统
> 范围: Phase 1-5 全部完成

---

## 一、项目概述

将独立开发的 **ConsultingOS 无头内核** (fisheros) 整合到 **org-diagnosis** 五维诊断系统中，实现:

1. **元数据驱动的数据管理** — 16 个咨询领域元模型，动态字段校验
2. **LangGraph 工作流编排** — 5 领域并行分析 + 跨领域综合
3. **图谱可视化** — 基于 ReactFlow 的交互式关系图谱
4. **渐进式前端改造** — 内核管理界面，不破坏现有功能

---

## 二、技术架构

### 后端架构 (FastAPI)

```
backend/
├── app/
│   ├── kernel/                    # 内核核心 (从 fisheros 导入)
│   │   ├── database.py            # 双模式数据库 (ArangoDB / InMemory)
│   │   ├── mock_database.py       # 开发用内存数据库
│   │   └── config.py              # 内核配置
│   ├── models/kernel/             # 内核 Pydantic 模型
│   │   ├── meta_model.py          # 元模型 + ENUM/REFERENCE/MONEY/TEXT 类型
│   │   ├── relation.py            # 关系模型
│   │   └── report.py              # 报告模型
│   ├── repositories/              # Repository 层 (AQL 查询)
│   │   ├── meta_repo.py
│   │   ├── object_repo.py
│   │   └── relation_repo.py
│   ├── services/kernel/           # Service 层 (业务逻辑 + 校验)
│   │   ├── meta_service.py
│   │   ├── object_service.py
│   │   ├── relation_service.py
│   │   └── report_service.py
│   └── api/v1/kernel.py           # 内核 REST API (统一路由)
├── lib/
│   ├── workflow/                  # LangGraph 工作流框架
│   │   ├── base_state.py          # 基础状态定义
│   │   ├── kernel_bridge.py       # LangGraph ↔ 内核桥接
│   │   ├── node_registry.py       # 节点自动发现
│   │   └── orchestrated_diagnosis.py  # 编排式诊断工作流 v2
│   ├── domain/                    # 五大领域模块
│   │   ├── base.py                # BaseDomainModule ABC
│   │   ├── strategy/              # 战略领域 (3元模型, 1节点)
│   │   ├── organization/          # 组织领域 (3元模型, 1节点)
│   │   ├── performance/           # 绩效领域 (3元模型, 1节点)
│   │   ├── compensation/          # 薪酬领域 (3元模型, 1节点)
│   │   └── talent/                # 人才领域 (3元模型, 1节点)
│   ├── langgraph/workflow.py      # 诊断工作流 (已改造, 内核集成)
│   └── report_workflow/nodes.py   # 报告工作流 (已改造, 内核数据引用)
└── scripts/
    └── seed_meta_models.py        # 16 个元模型种子脚本
```

### 前端架构 (Next.js 16 + React 19)

```
org-diagnosis/
├── lib/api/
│   └── kernel-client.ts           # TypeScript 类型安全的内核 API 客户端
├── components/kernel/
│   ├── MetaModelForm.tsx          # 元数据驱动动态表单
│   ├── ObjectBrowser.tsx          # 对象列表/卡片浏览
│   ├── ObjectDetail.tsx           # 对象属性详情 (类型感知渲染)
│   └── GraphViewer.tsx            # ReactFlow 图谱可视化
├── app/(dashboard)/kernel/
│   ├── page.tsx                   # 内核仪表盘 (元模型列表 + 统计)
│   ├── [modelKey]/page.tsx        # 元模型对象浏览器 (列表+详情+创建+图谱)
│   └── graph/page.tsx             # 交互式图谱查看器
└── 已增强页面:
    ├── result/[id]/page.tsx       # + 内核数据图谱展示
    └── projects/page.tsx          # + 内核管理入口链接
```

---

## 三、核心技术决策

### 1. 双数据库并行

| 数据库 | 用途 | 数据特征 |
|--------|------|---------|
| **ArangoDB** (内核) | 元模型、对象、关系、图谱 | 结构化、图遍历、强校验 |
| **Supabase/PostgreSQL** (业务) | 用户、项目、任务、会话 | 事务性、关系型、认证集成 |

**理由**: 内核数据本质是图结构 (对象+关系)，ArangoDB 原生图遍历优势明显。业务数据是传统 CRUD，PostgreSQL 更成熟。

### 2. 内存数据库开发模式

```python
# KERNEL_MODE=demo (默认) — 无需安装 ArangoDB
InMemoryDatabase 实现了与 ArangoDB 完全相同的接口:
  - create_collection(), insert(), get(), update(), delete()
  - AQL 查询兼容 (简化版)
  - 图遍历兼容
```

**理由**: 开发时零依赖启动，部署时切换环境变量即可。

### 3. KernelBridge 进程内调用

```python
class KernelBridge:
    """LangGraph 节点通过此桥接与内核交互"""
    async def create_object(model_key, properties) → dict:
        return await loop.run_in_executor(None, sync_service.create_object, ...)
```

**理由**: LangGraph 节点和内核在同一进程，HTTP 调用有网络开销。`run_in_executor` 将同步内核调用包装为 async。

### 4. 领域模块插件化

```python
class BaseDomainModule(ABC):
    @abstractmethod
    def get_analysis_nodes(self) → Dict[str, Callable]: ...

# 注册装饰器
@node_registry.register("strategy", "analyze_strategy")
async def analyze_strategy_node(state): ...
```

**理由**: 新增领域只需创建 `lib/domain/new_domain/`，无需修改编排器代码。

---

## 四、开发过程中解决的关键问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| DIMENSION_OBJECT_SCHEMAS 字段名不匹配 | Schema 用 `name` 但元模型用 `goal_name` | 读取 seed 脚本更新所有字段名 |
| `asyncio.run()` 在 Python 3.12+ 报错 | 已弃用，需要显式事件循环 | `new_event_loop()` + `set_event_loop()` + `loop.run_until_complete()` |
| React 19 `useState` 回调语法错误 | `useState(() => {}, [deps])` 无效 | 改用 `useEffect(() => {}, [deps])` |
| TypeScript `tree.children` 不可迭代 | `Record<string, unknown>` 无 `[Symbol.iterator]` | `Array.isArray(tree.children) ? tree.children : []` |
| ReactFlow MiniMap `nodeColor` 类型错误 | `n.style?.background` 可能为 `number` | 包装 `String()` 强制转换 |

---

## 五、代码统计

| 模块 | 新增文件数 | 新增代码行数 (约) |
|------|-----------|-----------------|
| 后端 - 内核核心 | 12 | ~1,200 |
| 后端 - 工作流框架 | 5 | ~600 |
| 后端 - 领域模块 | 21 | ~1,500 |
| 后端 - 种子脚本 | 1 | ~400 |
| 后端 - 测试 | 2 | ~600 |
| 前端 - API 客户端 | 1 | ~200 |
| 前端 - 组件 | 4 | ~500 |
| 前端 - 页面 | 5 | ~400 |
| 部署配置 | 2 | ~30 |
| **合计** | **53** | **~5,430** |

---

## 六、新增/增强的字段类型

| 类型 | 用途 | 校验规则 |
|------|------|---------|
| `ENUM` | 限定可选值 (绩效等级 A/B/C/D) | 值必须在 `enum_options` 列表中 |
| `REFERENCE` | 引用其他元模型对象 | 目标对象必须存在 |
| `TEXT` | 长文本 (分析结论) | 无特殊校验 |
| `MONEY` | 金额 (薪酬、预算) | 本质 float，前端渲染带货币符号 |

---

## 七、已知的限制与后续方向

| 限制 | 说明 | 后续方向 |
|------|------|---------|
| 内核零单元测试 | 仅有 E2E 集成测试 | 补充 pytest 单元测试 |
| 图谱布局简单 | 使用极坐标布局 | 引入 dagre/elkjs 自动布局 |
| 内存数据库无持久化 | demo 模式重启丢失数据 | 可选 SQLite 持久化层 |
| 领域模块 AI 节点未端到端验证 | 需要 AI API key 才能完整测试 | Mock AI 响应的集成测试 |
| 报告模板未集成 | fisheros PPTX 模板已复制但未接入 | Phase 6 接入模板渲染 |
