# 咨询 OS — 6 个 Claude Code 设计模式详细实施计划

> 基于 Claude Code 泄漏源码（51.9 万行 TypeScript）设计思想借鉴
> 创建日期: 2026-04-03
> 更新日期: 2026-04-03（对齐三层架构）
> 项目路径: `/Users/kjonekong/Documents/org-diagnosis`

## 咨询 OS 三层架构

```
┌─────────────────────────────────────────────────────────┐
│  上层: 应用层 (Agent + API + Frontend)                     │
│  LangGraph StateGraph, FastAPI routes, Next.js UI         │
│  backend/app/agent/, backend/app/api/, app/               │
├─────────────────────────────────────────────────────────┤
│  中层: 工作流引擎 (WorkflowEngine + Tool Registry)        │
│  配置驱动工作流, 步骤注册表, Hook 拦截                    │
│  backend/lib/workflow_engine/, backend/app/tools/         │
├─────────────────────────────────────────────────────────┤
│  底层: 元模型内核 (MetaModel + ArangoDB)                  │
│  元模型定义, 对象实例, 关系图, 类型校验                    │
│  backend/app/kernel/, backend/app/repositories/          │
│  backend/app/services/kernel/                            │
└─────────────────────────────────────────────────────────┘
```

### 关键约束

1. **底层是 ArangoDB 图数据库**，不是关系型数据库。所有数据操作通过 `ObjectRepository` → ArangoDB AQL，不是 SQL
2. **元模型是类型系统**。`MetaModel` 定义 schema（`FieldTypeEnum`），`ObjectService` 做类型校验（ENUM/REFERENCE 等）。新增数据类型应通过**创建元模型**实现，不是硬编码
3. **LangGraph 是中层编排**。Agent 节点（init/planner/interact/collect/distill/executor）是 LangGraph StateGraph 的节点函数。新增模式必须兼容 LangGraph 的 `Annotated[list, operator.add]` 状态合并语义
4. **Demo/Production 双模式**。底层通过 `kernel_settings.is_demo_mode` 切换 InMemory/ArangoDB。新增的持久化功能必须同时兼容两种模式
5. **两层工作流并存**。`workflow_engine/`（配置驱动，用于项目交付）和 `agent/`（LangGraph，用于 AI 咨询）是两套独立系统。新模式应优先服务于 agent/ 层，但设计上不应排斥 workflow_engine/ 层

## 当前架构快照

```
backend/app/
├── agent/
│   ├── state.py          # ConsultingState TypedDict (58行)
│   ├── nodes.py          # 6个节点函数: init/planner/interact/collect/distill/executor (631行)
│   ├── workflow.py       # ConsultingAgentWorkflow (292行)
│   ├── api.py            # FastAPI 路由 (576行)
│   ├── blueprint_service.py
│   └── models.py
├── services/
│   ├── ai_client.py      # AIClient — DashScope/DeepSeek (209行)
│   └── kernel/
├── config.py             # Settings — 环境变量 (66行)
├── middleware/
│   └── auth.py
└── kernel/
    └── database.py

backend/lib/workflow_engine/
├── registry.py           # @register_step 装饰器 (45行)
├── step.py               # BaseStepHandler 抽象基类 (60行)
├── engine.py             # WorkflowEngine — 配置驱动 (465行)
├── workflow_config.py    # 三类工作流配置 (91行)
└── steps/                # 10个步骤处理器
```

---

## 模式 1: 工具注册表 (Tool Registry) — P0

### 目标
将 `nodes.py` 中硬编码的 AI 调用（`ai_client.chat()`）替换为可扩展的工具注册表。Agent 节点通过 ToolRegistry 发现和调用工具，而非直接调用 AI 客户端。

### 架构对齐
- **Tool Registry 属于中层**（workflow_engine 同级），是 LangGraph 节点和底层 ArangoDB 之间的抽象层
- **不引入新的持久化**。工具是运行时注册的，不需要存入 ArangoDB。工具的元数据（name/description/category）通过代码定义，不是元模型
- **复用现有注册模式**。`workflow_engine/registry.py` 的 `@register_step` 装饰器模式可以直接复用
- **兼容 LangGraph 状态合并**。工具调用结果是 `dict`，通过 LangGraph 的 partial state update 机制合并到 `ConsultingState`

### 借鉴来源
- Claude Code `src/Tool.ts`: `buildTool()` — schema-driven 工具定义
- Claude Code `src/tools/` (45 子目录): 每个工具独立目录，自描述（name + description + inputSchema）

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/tools/__init__.py` | 10 | 导出 ToolRegistry 单例 |
| 新建 | `backend/app/tools/base.py` | 80 | BaseConsultingTool 抽象基类 |
| 新建 | `backend/app/tools/registry.py` | 120 | ToolRegistry — 注册/发现/调用 |
| 新建 | `backend/app/tools/schemas.py` | 50 | ToolContext, ToolResult, ToolDef |
| 新建 | `backend/app/tools/builtin/__init__.py` | 10 | 导出内置工具 |
| 新建 | `backend/app/tools/builtin/guidance_generator.py` | 60 | 从 interact_node 抽取的引导话术生成 |
| 新建 | `backend/app/tools/builtin/data_distiller.py` | 60 | 从 distill_node 抽取的蒸馏工具 |
| 新建 | `backend/app/tools/builtin/report_generator.py` | 80 | 从 executor_node 抽取的 PPTX 生成 |
| 修改 | `backend/app/agent/nodes.py` | -50 → +20 | interact_node/distill_node/executor_node 改为调用 ToolRegistry |

### 核心代码设计

```python
# backend/app/tools/base.py
from abc import ABC, abstractmethod
from typing import Any
from pydantic import BaseModel

class ToolContext(BaseModel):
    """工具执行上下文"""
    session_id: str
    benchmark_id: str
    project_goal: str
    collected_data: dict[str, Any]
    messages: list[dict]
    blueprint: dict
    # 可选
    project_id: str | None = None

class ToolResult(BaseModel):
    """工具执行结果"""
    success: bool = True
    data: dict[str, Any] = {}
    error: str | None = None
    # 用于追加到 messages
    message: dict | None = None
    # 用于追加到 metadata
    metadata: dict[str, Any] | None = None

class BaseConsultingTool(ABC):
    """咨询工具抽象基类 — 借鉴 Claude Code Tool.ts 的 buildTool 模式"""

    name: str                          # "guidance_generator"
    description: str                   # 供 LLM/节点选择工具时参考
    category: str = "analysis"         # analysis | generation | external
    input_schema: dict = {}            # JSON Schema（可选，用于校验）

    @abstractmethod
    async def execute(self, ctx: ToolContext) -> ToolResult:
        """执行工具，返回结果"""
        ...

    def is_read_only(self) -> bool:
        return True

    def get_cost_estimate(self) -> int:
        """预估 token 消耗（用于成本追踪 hook）"""
        return 0
```

```python
# backend/app/tools/registry.py
from typing import Dict, Type
from .base import BaseConsultingTool, ToolContext, ToolResult

_tool_registry: Dict[str, Type[BaseConsultingTool]] = {}

def register_tool(cls: Type[BaseConsultingTool]) -> Type[BaseConsultingTool]:
    """工具注册装饰器 — 复用 workflow_engine/registry.py 的模式"""
    instance = cls()
    _tool_registry[instance.name] = cls
    return cls

def get_tool(name: str) -> BaseConsultingTool:
    """获取工具实例"""
    cls = _tool_registry.get(name)
    if not cls:
        raise ValueError(f"未注册的工具: {name}. 已注册: {list(_tool_registry.keys())}")
    return cls()

def list_tools(category: str | None = None) -> list[dict]:
    """列出已注册工具"""
    tools = []
    for name, cls in _tool_registry.items():
        inst = cls()
        if category and inst.category != category:
            continue
        tools.append({"name": name, "description": inst.description, "category": inst.category})
    return tools

async def call_tool(name: str, ctx: ToolContext) -> ToolResult:
    """调用工具（hook 拦截点在此注入）"""
    tool = get_tool(name)
    return await tool.execute(ctx)
```

### nodes.py 改动示例

```python
# 修改前 (interact_node 第170-181行)
ai_client = _get_ai_client()
if ai_client.is_configured():
    guidance = await ai_client.chat(system_prompt, user_prompt, ...)

# 修改后
from app.tools.registry import call_tool
result = await call_tool("guidance_generator", ToolContext(
    session_id=state["session_id"],
    benchmark_id=state["benchmark_id"],
    project_goal=state["project_goal"],
    collected_data=state.get("collected_data", {}),
    messages=state.get("messages", []),
    blueprint=state.get("blueprint", {}),
    # 额外上下文
    missing_fields=missing,
    current_node_display=current_node_display,
))
```

### 验证
1. 启动后端，调用 `GET /agent/tools` 列出所有已注册工具
2. 创建 Agent 会话，验证 interact_node 通过 ToolRegistry 调用 guidance_generator
3. 注册一个 mock 工具，验证它出现在工具列表中并可被调用

---

## 模式 2: Hook 拦截系统 — P0

### 目标
在工作流节点执行前后插入可配置的拦截器。用于成本追踪、数据验证、合规检查等横切关注点。

### 架构对齐
- **Hook 系统横跨中层和上层**。它不修改数据存储（底层 ArangoDB），只在 LangGraph 节点执行链中注入逻辑
- **集成点是 `workflow.py` 的 `ConsultingAgentWorkflow`**，不是 LangGraph 框架本身。在 `start()` 和 `submit_data()` 方法中调用 hook，不影响 LangGraph 的状态机语义
- **Hook 执行结果不持久化到 ArangoDB**。审计日志等如果需要持久化，由 hook 内部通过 `ObjectService` 写入 sys_objects（复用底层）
- **与 Tool Registry 的关系**：Hook 拦截工具调用（BEFORE_TOOL/AFTER_TOOL），但不改变工具注册表本身的结构

### 借鉴来源
- Claude Code `src/hooks/` (87 文件): PreToolUse/PostToolUse 拦截器
- 关键设计：优先级排序、短路执行、可修改数据

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/hooks/__init__.py` | 10 | 导出 HookRegistry |
| 新建 | `backend/app/hooks/base.py` | 60 | HookPoint 枚举、BaseHook、HookResult |
| 新建 | `backend/app/hooks/registry.py` | 100 | HookRegistry — 注册/排序/执行 |
| 新建 | `backend/app/hooks/builtin/__init__.py` | 10 | 导出内置 hook |
| 新建 | `backend/app/hooks/builtin/cost_tracker.py` | 50 | 记录每次 AI 调用的 token 消耗 |
| 新建 | `backend/app/hooks/builtin/data_validator.py` | 50 | 验证用户提交数据的完整性 |
| 新建 | `backend/app/hooks/builtin/audit_logger.py` | 40 | 记录关键操作审计日志 |
| 修改 | `backend/app/agent/workflow.py` | +15 | 在节点执行前后调用 hook |
| 修改 | `backend/app/tools/registry.py` | +10 | 工具调用前后的 hook 集成 |

### 核心代码设计

```python
# backend/app/hooks/base.py
from enum import Enum
from typing import Any
from pydantic import BaseModel

class HookPoint(str, Enum):
    """Hook 拦截点"""
    BEFORE_NODE = "before_node"         # 任意节点执行前
    AFTER_NODE = "after_node"           # 任意节点执行后
    BEFORE_TOOL = "before_tool"         # 工具调用前
    AFTER_TOOL = "after_tool"           # 工具调用后
    ON_ERROR = "on_error"               # 节点执行出错时
    ON_SESSION_START = "on_session_start"
    ON_SESSION_END = "on_session_end"

class HookContext(BaseModel):
    """Hook 上下文"""
    hook_point: HookPoint
    node_name: str = ""
    tool_name: str = ""
    session_id: str = ""
    project_id: str = ""
    data: dict[str, Any] = {}           # 可读写的上下文数据

class HookResult(BaseModel):
    """Hook 执行结果"""
    continue: bool = True               # False = 阻断后续执行
    override_data: dict[str, Any] = {}   # 可选：替换上下文数据
    message: str = ""                   # 可选：附加消息（如警告）
```

```python
# backend/app/hooks/registry.py
from typing import Dict, List, Type
from .base import HookPoint, HookContext, HookResult, BaseHook

_hook_registry: Dict[HookPoint, List[dict]] = {
    point: [] for point in HookPoint
}

def register_hook(point: HookPoint, priority: int = 100):
    """Hook 注册装饰器"""
    def decorator(cls):
        _hook_registry[point].append({"cls": cls, "priority": priority})
        _hook_registry[point].sort(key=lambda x: x["priority"])
        return cls
    return decorator

async def run_hooks(point: HookPoint, ctx: HookContext) -> HookResult:
    """按优先级顺序执行所有 hook，任一返回 continue=False 则短路"""
    for entry in _hook_registry.get(point, []):
        hook = entry["cls"]()
        result = await hook.execute(ctx)
        if not result.continue:
            return result
        if result.override_data:
            ctx.data.update(result.override_data)
    return HookResult(continue=True)
```

### workflow.py 集成点

在 `ConsultingAgentWorkflow.start()` 和 `submit_data()` 的前后添加 hook 调用：

```python
# 在 create_agent_session (api.py 第147行) 中
await run_hooks(HookPoint.ON_SESSION_START, HookContext(
    session_id=session_key, project_id=data.project_id,
    data={"benchmark_id": data.benchmark_id, "project_goal": data.project_goal},
))
```

### 内置 Hook 示例

```python
# backend/app/hooks/builtin/cost_tracker.py
@register_hook(HookPoint.AFTER_TOOL, priority=10)
class CostTrackerHook(BaseHook):
    """记录工具调用的 token 消耗"""
    async def execute(self, ctx: HookContext) -> HookResult:
        tool_name = ctx.tool_name
        cost = ctx.data.get("token_usage", {})
        # 写入数据库或日志
        logger.info(f"[cost_tracker] {tool_name}: input={cost.get('input_tokens',0)} output={cost.get('output_tokens',0)}")
        return HookResult(continue=True)
```

### 验证
1. 注册 `audit_logger` hook，创建会话时检查日志中有审计记录
2. 注册 `data_validator` hook，提交空数据时验证被拦截（返回警告而非报错）
3. 验证 hook 优先级：低优先级 hook 在高优先级之后执行

---

## 模式 3: AutoDream 记忆巩固引擎 — P1

### 目标
在咨询会话结束后，后台自动从近期会话中提炼知识，持久化到项目知识库。借鉴 Claude Code 的三级门控 + 四阶段巩固模式。

### 架构对齐
- **知识持久化走底层 ArangoDB**，不是文件系统。Claude Code 用文件系统（`MEMORY.md`），但咨询 OS 应该用已有的 ArangoDB 基础设施
- **需要新建元模型**。为知识条目创建 `Knowledge_Entry` 元模型（含 type/memory_type/project_id 等字段），通过 `ObjectService` 创建/查询，享受底层类型校验
- **会话历史来源**：LangGraph 的 checkpoint 中存储了 messages（`AsyncSqliteSaver` 或 `MemorySaver`）。巩固服务从 checkpoint 读取近期会话的 messages
- **巩固结果写入 ArangoDB**：创建 `Knowledge_Entry` 对象实例，类型校验自动生效
- **文件锁改为数据库锁**：Claude Code 用文件 mtime 做锁，但咨询 OS 应该在 ArangoDB 中存储 `Consolidation_State` 对象（记录 last_consolidated_at），利用 ArangoDB 的事务保证原子性

### 与 Claude Code 的关键差异

| 方面 | Claude Code | 咨询 OS 适配 |
|------|------------|-------------|
| 存储后端 | 文件系统 (MEMORY.md) | ArangoDB (Knowledge_Entry 元模型) |
| 锁机制 | 文件 mtime | ArangoDB 对象 (Consolidation_State) |
| 索引 | MEMORY.md 手动维护 | AQL 查询按 project_id/type 过滤 |
| 触发方式 | REPL stopHooks | API 会话完成时 asyncio.create_task |

### 借鉴来源
- Claude Code `src/services/autoDream/autoDream.ts`: 三级门控（时间→会话数→锁）
- Claude Code `src/services/autoDream/consolidationPrompt.ts`: 四阶段 prompt 模板
- Claude Code `src/services/autoDream/consolidationLock.ts`: 文件锁即时间戳

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/services/dream/__init__.py` | 10 | 导出 |
| 新建 | `backend/app/services/dream/config.py` | 30 | DreamConfig — 门控参数 |
| 新建 | `backend/app/services/dream/dream_service.py` | 150 | 核心服务 — 三级门控 + 触发 |
| 新建 | `backend/app/services/dream/consolidation.py` | 120 | 四阶段巩固逻辑（写入 ArangoDB） |
| 新建 | `backend/app/services/dream/consolidation_lock.py` | 60 | ArangoDB 对象锁（非文件锁） |
| 新建 | `backend/app/services/dream/prompts.py` | 80 | 巩固 prompt 模板 |
| 新建 | `backend/app/agent/seed_blueprints.py` | +40 | 添加 Knowledge_Entry + Consolidation_State 元模型定义 |
| 修改 | `backend/app/agent/api.py` | +5 | 会话完成时触发巩固检查 |

### 核心代码设计

```python
# backend/app/services/dream/dream_service.py
class DreamService:
    """后台记忆巩固服务"""

    def __init__(self, db: Any):
        self._db = db
        self._obj_svc = ObjectService(db)
        self.config = DreamConfig(
            min_hours=24,
            min_sessions=3,     # 咨询场景会话数较少，降低门槛
            scan_interval_ms=600000,
        )

    async def check_and_consolidate(self, project_id: str) -> bool:
        """检查是否需要巩固，需要则执行"""
        # Gate 1: 时间门控 — 从 Consolidation_State 对象读取
        state = self._obj_svc.get_consolidation_state(project_id)
        last_at = state.get("last_consolidated_at", 0) if state else 0
        hours_since = (Date.now() - last_at).total_seconds() / 3600
        if hours_since < self.config.min_hours:
            return False

        # Gate 2: 会话数门控 — 从 LangGraph checkpoint 统计
        recent_sessions = await self._count_sessions_since(project_id, last_at)
        if recent_sessions < self.config.min_sessions:
            return False

        # Gate 3: 锁门控 — 用 ArangoDB 对象替代文件锁
        acquired = await self._try_acquire_lock(project_id)
        if not acquired:
            return False  # 被其他进程/请求持有

        try:
            await self._consolidate(project_id, recent_sessions)
            # 更新 Consolidation_State
            self._obj_svc.update_consolidation_state(project_id, Date.now())
            return True
        except Exception as e:
            await self._release_lock(project_id)
            logger.error(f"[dream] 巩固失败: {e}")
            return False

    async def _try_acquire_lock(self, project_id: str) -> bool:
        """尝试获取巩固锁 — ArangoDB 对象级锁"""
        # 在 Consolidation_State 对象中设置 locked=true + locked_at
        # 如果已锁定且未过期(1小时)，返回 False
        ...

    async def _consolidate(self, project_id: str, session_ids: list[str]):
        """四阶段巩固 — 结果写入 ArangoDB"""
        # Phase 1: 读取已有知识 (AQL 查询 Knowledge_Entry)
        # Phase 2: 从 LangGraph checkpoint 读取近期会话
        # Phase 3: AI 整合知识 → 创建 Knowledge_Entry 对象 (通过 ObjectService)
        # Phase 4: 标记过期知识 (更新 Knowledge_Entry.expires_at)
        ...
```

```python
# backend/app/services/dream/prompts.py
def build_consolidation_prompt(
    knowledge_dir: str,
    recent_session_summaries: list[str],
) -> str:
    """构建巩固 prompt — 借鉴 Claude Code consolidationPrompt.ts 的四阶段"""
    return f"""# 知识巩固

你是咨询知识管理助手。回顾近期的咨询会话，将重要知识整合到知识库中。

知识库目录: `{knowledge_dir}`

## Phase 1 — 定向
- 读取知识库中的 KNOWLEDGE.md 索引，了解已有知识

## Phase 2 — 收集
从以下近期会话摘要中提取值得保存的知识：
{chr(10).join(f"- {s}" for s in recent_session_summaries)}

## Phase 3 — 整合
将新知识合并到现有文件（不创建重复）。重点关注：
- 客户行业特征和方法论洞察
- 有效的/无效的分析方法
- 项目中的关键决策和原因

## Phase 4 — 修剪
更新 KNOWLEDGE.md 索引，删除过期知识。
"""
```

### 触发时机
在 `api.py` 的 `resume_agent_session` 中，当 `mode == "completed"` 时异步触发：

```python
# api.py 第444行之后
if mode == "completed":
    # 异步触发记忆巩固（不阻塞响应）
    asyncio.create_task(dream_service.check_and_consolidate(data.project_id or ""))
```

### 验证
1. 手动调用 `POST /agent/dream/consolidate?project_id=xxx`，验证知识文件被创建
2. 完成 3 个以上会话后，验证自动巩固触发
3. 重复触发时验证锁机制生效（第二次返回 False）

---

## 模式 4: 四类记忆体系 — P1

### 目标
为咨询 OS 定义结构化的知识分类，借鉴 Claude Code 的 user/feedback/project/reference 四类记忆。

### 架构对齐
- **四类记忆通过元模型的 ENUM 字段实现**。在 `Knowledge_Entry` 元模型中，`memory_type` 字段类型为 `ENUM`，枚举值为 `client/methodology/project/reference`。这样底层 `ObjectService` 会自动校验类型合法性
- **利用 ArangoDB 的图遍历能力**。Claude Code 用文件系统 + grep 搜索记忆。咨询 OS 可以用 ArangoDB AQL 做更高效的查询（如按 project_id + memory_type 过滤，或通过关系边查找关联知识）
- **不需要 MEMORY.md 索引文件**。Claude Code 的索引文件是文件系统的妥协方案。咨询 OS 直接用 AQL 查询 + ArangoDB 索引，性能更好
- **知识条目之间的关联用 sys_relations 实现**。比如一条 METHODOLOGY 记忆可以 REFERENCE 关联到一条 PROJECT 记忆（"这个方法论在哪个项目中验证的"）

### 元模型定义

```python
# 通过 seed_blueprints.py 或 API 创建
Knowledge_Entry 元模型:
  fields:
    - project_id: REFERENCE → Project (关联项目)
    - session_id: STRING (来源会话)
    - memory_type: ENUM [client, methodology, project, reference]
    - title: STRING (简短标题)
    - content: TEXT (知识内容，支持 Markdown)
    - tags: ARRAY (标签，用于分类检索)
    - source_type: ENUM [agent, manual, dream] (来源：人工/Agent/AutoDream)
    - confidence: FLOAT (0-1，Dream 生成的内容置信度较低)
    - expires_at: DATETIME (可选，知识过期时间)
```

### 借鉴来源
- Claude Code `src/memdir/memoryTypes.ts`: 精确定义 4 种记忆的 when_to_save/how_to_use/body_structure
- Claude Code `src/memdir/memdir.ts`: MEMORY.md 索引管理（200行/25KB限制）

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/services/memory/__init__.py` | 10 | 导出 |
| 新建 | `backend/app/services/memory/types.py` | 80 | MemoryType 枚举 + 类型规则定义 |
| 新建 | `backend/app/services/memory/memory_service.py` | 150 | CRUD 操作 + 索引管理 |
| 新建 | `backend/app/services/memory/index_manager.py` | 80 | AQL 查询 + 索引（替代文件索引） |
| 新建 | `backend/app/api/memory.py` | 80 | 知识库 API 端点 |
| 修改 | `backend/app/agent/nodes.py` | +10 | executor_node 完成时触发记忆保存 |
| 修改 | `backend/app/services/dream/prompts.py` | - | 使用四类分类的 prompt |

### 核心代码设计

```python
# backend/app/services/memory/types.py
class MemoryType(str, Enum):
    CLIENT = "client"              # 客户画像、偏好、行业
    METHODOLOGY = "methodology"    # 方法论反馈（有效/无效的做法）
    PROJECT = "project"            # 项目进度、决策、约束
    REFERENCE = "reference"        # 外部资源指针

# 每种类型的保存规则
MEMORY_RULES = {
    MemoryType.CLIENT: {
        "when_to_save": "了解客户行业、规模、组织架构、历史合作情况时",
        "how_to_use": "定制引导话术和分析深度",
        "body_structure": "客户属性 + 行业特征 + 偏好",
    },
    MemoryType.METHODOLOGY: {
        "when_to_save": "分析方法被验证有效或无效时",
        "how_to_use": "选择分析方法和工具时的参考",
        "body_structure": "方法描述 + **Why:** 有效/无效的原因 + **How to apply:** 适用场景",
    },
    MemoryType.PROJECT: {
        "when_to_save": "项目中的关键决策、约束、截止日期",
        "how_to_use": "理解项目上下文，协调多项目",
        "body_structure": "事实 + **Why:** 动机 + **How to apply:** 影响范围",
    },
    MemoryType.REFERENCE: {
        "when_to_save": "发现有用的外部资源（报告、政策、数据源）",
        "how_to_use": "需要查找外部信息时",
        "body_structure": "资源名称 + 位置 + 用途",
    },
}

# 不保存的内容（借鉴 Claude Code 的排除规则）
MEMORY_EXCLUSIONS = [
    "可从代码或数据库推导的信息",
    "临时性数据（当前会话的上下文）",
    "已有文档明确记录的内容",
]
```

### 知识库 API

```
GET    /agent/memory/list?project_id=xxx    — 列出项目知识
GET    /agent/memory/index?project_id=xxx    — 获取知识索引
POST   /agent/memory/save                     — 保存知识条目
DELETE /agent/memory/{memory_id}              — 删除知识条目
```

### 验证
1. 通过 seed_blueprints 创建 `Knowledge_Entry` 元模型（含 `memory_type: ENUM` 字段）
2. 保存一条 METHODOLOGY 类型的知识，验证 `ObjectService` 自动校验枚举值
3. 保存 10+ 条知识后，通过 AQL 查询 `project_id + memory_type` 过滤，验证检索效率
4. 创建一条 REFERENCE 类型知识，通过 `sys_relations` 关联到 PROJECT 类型知识，验证图遍历

---

## 模式 5: Feature Flag 系统 — P1

### 目标
为咨询 OS 添加功能开关系统，支持按项目/客户控制可用功能。为后续所有新功能提供灰度发布能力。

### 架构对齐
- **Feature Flag 配置存储在哪里？** 两个选择：
  - **方案 A（推荐）: 存入 ArangoDB**。创建 `Project_Settings` 元模型，flag 配置作为对象的 properties。复用底层 ObjectService 的 CRUD + 类型校验
  - **方案 B: 环境变量 + 项目级 JSON 文件**。简单但不持久化，不适合多租户
- **推荐方案 A**，因为：
  - 与现有元模型体系一致（新增一个元模型即可）
  - `ObjectService` 自动提供类型校验
  - 天然支持按 project_id 查询
  - demo/production 双模式自动兼容
- **不改变 LangGraph 的执行路径**。Flag 检查发生在 API 层（`api.py`）和工具注册时（`registry.py`），不影响 LangGraph 内部的状态机流转
- **优先级链**：Project_Settings (ArangoDB) → 环境变量 → 硬编码默认值

### 元模型定义

```python
# Project_Settings 元模型
Project_Settings 元模型:
  fields:
    - project_id: REFERENCE → Project (关联项目)
    - flags: OBJECT (JSON 对象，key=flag名, value=bool)
    - updated_at: DATETIME
```

### 借鉴来源
- Claude Code 30+ feature flags: `feature('FLAG_NAME')` 编译时排除
- Claude Code GrowthBook 集成: 远程配置覆盖本地默认值
- Claude Code 用户设置优先: settings.json 覆盖远程默认

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/services/feature_flags.py` | 120 | FeatureFlags 类 |
| 修改 | `backend/app/config.py` | +15 | 加载 feature flag 配置 |
| 修改 | `backend/app/tools/registry.py` | +5 | 按 flag 条件注册工具 |
| 修改 | `backend/app/hooks/registry.py` | +3 | 按 flag 条件注册 hook |
| 新建 | `backend/app/api/feature_flags.py` | 40 | 管理 API |

### 核心代码设计

```python
# backend/app/services/feature_flags.py
from pathlib import Path
import json

class FeatureFlags:
    """功能开关管理 — 借鉴 Claude Code 的三层优先级"""

    def __init__(self):
        self._defaults = self._load_defaults()
        self._project_overrides: dict[str, dict[str, bool]] = {}

    def _load_defaults(self) -> dict[str, bool]:
        """加载默认 flag 配置"""
        return {
            # 已实现的功能
            "agent_session": True,          # Agent 会话系统
            "blueprint_management": True,   # Blueprint 管理
            "pptx_generation": True,        # PPTX 报告生成

            # P0 新功能
            "tool_registry": False,         # 工具注册表（上线后改 True）
            "hook_system": False,           # Hook 系统

            # P1 新功能
            "memory_system": False,         # 记忆体系
            "dream_consolidation": False,   # AutoDream
            "background_tasks": False,      # 后台任务

            # 按功能模块控制
            "five_dimensions": True,        # 五维诊断
            "workshop_tools": True,         # 工作坊工具
            "knowledge_base": True,         # 知识库
        }

    def is_enabled(self, flag: str, project_id: str | None = None) -> bool:
        """
        检查功能是否启用。

        优先级（高→低）：
        1. 项目级覆盖 (数据库 project.settings)
        2. 环境变量 (FEATURE_<FLAG>=true/false)
        3. 硬编码默认值
        """
        # 1. 项目级
        if project_id:
            project_flags = self._project_overrides.get(project_id, {})
            if flag in project_flags:
                return project_flags[flag]

        # 2. 环境变量
        env_val = os.getenv(f"FEATURE_{flag.upper()}", "").lower()
        if env_val in ("true", "false"):
            return env_val == "true"

        # 3. 默认值
        return self._defaults.get(flag, False)

    def set_project_override(self, project_id: str, flag: str, enabled: bool):
        """设置项目级功能覆盖"""
        if project_id not in self._project_overrides:
            self._project_overrides[project_id] = {}
        self._project_overrides[project_id][flag] = enabled

# 全局单例
feature_flags = FeatureFlags()
```

### 使用方式

```python
# 在工具注册时
if feature_flags.is_enabled("tool_registry"):
    from app.tools.builtin.guidance_generator import GuidanceGeneratorTool
    register_tool(GuidanceGeneratorTool)

# 在 API 中按条件暴露端点
@router.get("/memory/list")
async def list_memory():
    if not feature_flags.is_enabled("memory_system"):
        raise HTTPException(404, "记忆系统未启用")
    ...
```

### 验证
1. 默认状态下 `memory_system` 返回 False
2. 设置环境变量 `FEATURE_MEMORY_SYSTEM=true` 后返回 True
3. 通过 API 设置项目级覆盖，验证该项目返回 True 而其他项目返回 False

---

## 模式 6: Forked Agent 后台执行 — P2

### 目标
将耗时操作（报告生成、数据导出、知识巩固）作为后台任务执行，前端可查询进度。

### 架构对齐
- **任务状态存储在哪里？** 与 Feature Flag 同理，推荐存入 ArangoDB：
  - 创建 `Background_Task` 元模型（status/task_type/project_id/result/error/progress）
  - 通过 `ObjectService` CRUD，享受类型校验
  - demo 模式下 InMemoryDatabase 自动兼容
- **不需要真正的进程 fork**。Claude Code 的 forked agent 是因为 TypeScript 单线程需要子进程。Python 有 `asyncio.create_task`，在同一进程内异步执行即可
- **进度追踪**：任务对象存储在 ArangoDB 中，前端轮询 `GET /agent/tasks/{task_id}` 获取状态。不依赖 WebSocket（当前前端是轮询模式）
- **与 LangGraph 的关系**：后台任务不是 LangGraph 的一部分。它是一个独立的 `asyncio.Task`，完成后通过 `ObjectService` 将结果写入 ArangoDB

### 元模型定义

```python
# Background_Task 元模型
Background_Task 元模型:
  fields:
    - task_type: ENUM [report_generation, data_export, dream_consolidation]
    - project_id: REFERENCE → Project (可选)
    - session_id: STRING (来源会话，可选)
    - status: ENUM [pending, running, completed, failed, cancelled]
    - progress: FLOAT (0.0-1.0)
    - result: OBJECT (任务结果 JSON)
    - error: TEXT (错误信息)
    - created_at: DATETIME
    - started_at: DATETIME (可选)
    - completed_at: DATETIME (可选)
```

### 借鉴来源
- Claude Code `src/utils/forkedAgent.ts`: 独立子进程执行，不阻塞主交互
- Claude Code `src/tasks/`: 任务注册表，UI 可见任务状态

### 文件清单

| 操作 | 文件路径 | 预估行数 | 说明 |
|------|----------|----------|------|
| 新建 | `backend/app/services/task_manager.py` | 150 | TaskManager — 任务生命周期 |
| 新建 | `backend/app/api/tasks.py` | 60 | 任务查询 API |
| 修改 | `backend/app/agent/nodes.py` | +15 | executor_node 改为后台执行 |
| 修改 | `backend/app/agent/api.py` | +10 | 返回 task_id 而非同步等待 |

### 核心代码设计

```python
# backend/app/services/task_manager.py
import asyncio
from datetime import datetime
from enum import Enum
from typing import Any, Callable, Awaitable
from dataclasses import dataclass, field

class TaskStatus(str, Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

@dataclass
class BackgroundTask:
    task_id: str
    task_type: str                    # "report_generation" | "data_export" | "dream_consolidation"
    project_id: str | None
    status: TaskStatus = TaskStatus.PENDING
    progress: float = 0.0
    result: dict[str, Any] = field(default_factory=dict)
    error: str | None = None
    created_at: str = field(default_factory=lambda: datetime.utcnow().isoformat())
    started_at: str | None = None
    completed_at: str | None = None

class TaskManager:
    """后台任务管理器"""
    _tasks: dict[str, BackgroundTask] = {}

    async def spawn(
        self,
        task_type: str,
        coro: Callable[..., Awaitable[dict]],
        project_id: str | None = None,
    ) -> str:
        """启动后台任务"""
        task_id = str(uuid.uuid4())[:8]
        task = BackgroundTask(task_id=task_id, task_type=task_type, project_id=project_id)
        self._tasks[task_id] = task

        async def _run():
            task.status = TaskStatus.RUNNING
            task.started_at = datetime.utcnow().isoformat()
            try:
                result = await coro()
                task.result = result
                task.status = TaskStatus.COMPLETED
            except Exception as e:
                task.error = str(e)
                task.status = TaskStatus.FAILED
            finally:
                task.completed_at = datetime.utcnow().isoformat()

        asyncio.create_task(_run())
        return task_id

    def get_status(self, task_id: str) -> BackgroundTask | None:
        return self._tasks.get(task_id)

    def list_tasks(self, project_id: str | None = None) -> list[BackgroundTask]:
        tasks = list(self._tasks.values())
        if project_id:
            tasks = [t for t in tasks if t.project_id == project_id]
        return sorted(tasks, key=lambda t: t.created_at, reverse=True)

    def cancel(self, task_id: str) -> bool:
        task = self._tasks.get(task_id)
        if task and task.status in (TaskStatus.PENDING, TaskStatus.RUNNING):
            task.status = TaskStatus.CANCELLED
            return True
        return False

# 全局单例
task_manager = TaskManager()
```

### executor_node 改造

```python
# 修改前 (executor_node 同步执行 PPTX 生成)
pptx_path = await _generate_pptx(state["session_id"], distilled, collected)

# 修改后 (后台执行)
task_id = await task_manager.spawn(
    task_type="report_generation",
    coro=_generate_pptx(state["session_id"], distilled, collected),
    project_id=state.get("project_id"),
)
# 返回 task_id 而非等待结果
return {
    "mode": AgentMode.COMPLETED,
    "task_id": task_id,
    "message": "报告正在后台生成中，可通过任务 API 查询进度",
}
```

### 任务 API

```
GET    /agent/tasks                           — 列出任务
GET    /agent/tasks/{task_id}                 — 查询任务状态
POST   /agent/tasks/{task_id}/cancel          — 取消任务
```

### 验证
1. 触发报告生成，返回 task_id 而非阻塞
2. 查询任务状态，验证从 PENDING → RUNNING → COMPLETED
3. 取消一个 RUNNING 任务，验证状态变为 CANCELLED

---

## 实施依赖图

```
Feature Flags (模式5)
    ↓ 所有新功能都通过 flag 控制
Tool Registry (模式1)
    ↓ Hook 需要拦截工具调用
Hook System (模式2)
    ↓ Memory System 需要 hook 触发保存
Memory System (模式4) + AutoDream (模式3)
    ↓ Dream 使用后台任务执行
Background Tasks (模式6)
```

**建议实施顺序**：

| 步骤 | 模式 | 预估工作量 | 前置依赖 |
|------|------|-----------|----------|
| 1 | Feature Flags | 0.5 天 | 无 |
| 2 | Tool Registry | 1.5 天 | Feature Flags |
| 3 | Hook System | 1 天 | Feature Flags |
| 4 | Memory System (四类记忆) | 1.5 天 | Hook System |
| 5 | AutoDream | 1.5 天 | Memory System |
| 6 | Background Tasks | 1 天 | 无 |

**总计**: 约 7 天

---

## 新建文件总览

```
backend/app/
├── tools/                          # 模式1: 工具注册表 (中层)
│   ├── __init__.py
│   ├── base.py                     # BaseConsultingTool
│   ├── registry.py                 # ToolRegistry (复用 workflow_engine/registry.py 模式)
│   ├── schemas.py                  # ToolContext, ToolResult
│   └── builtin/
│       ├── __init__.py
│       ├── guidance_generator.py    # 从 interact_node 抽取
│       ├── data_distiller.py        # 从 distill_node 抽取
│       └── report_generator.py     # 从 executor_node 抽取
├── hooks/                          # 模式2: Hook 系统 (横跨上/中层)
│   ├── __init__.py
│   ├── base.py                     # HookPoint, HookResult
│   ├── registry.py                 # HookRegistry
│   └── builtin/
│       ├── __init__.py
│       ├── cost_tracker.py
│       ├── data_validator.py
│       └── audit_logger.py          # 可通过 ObjectService 写入 ArangoDB
├── services/
│   ├── feature_flags.py            # 模式5: Feature Flags
│   ├── dream/                      # 模式3: AutoDream (上→底层)
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── dream_service.py         # 三级门控 + 触发
│   │   ├── consolidation.py        # 四阶段巩固 → 写入 ArangoDB
│   │   ├── consolidation_lock.py    # ArangoDB 对象锁
│   │   └── prompts.py
│   ├── memory/                     # 模式4: 四类记忆 (上→底层)
│   │   ├── __init__.py
│   │   ├── types.py                 # MemoryType 枚举 + 保存规则
│   │   ├── memory_service.py       # 通过 ObjectService 操作 ArangoDB
│   │   └── index_manager.py        # AQL 查询 (替代文件索引)
│   └── task_manager.py             # 模式6: 后台任务 (中层)
├── api/
│   ├── memory.py                   # 记忆 API (Knowledge_Entry CRUD)
│   ├── tasks.py                    # 任务 API (Background_Task CRUD)
│   └── feature_flags.py            # Flag 管理 API
└── agent/
    └── seed_blueprints.py          # +新增元模型定义 (Knowledge_Entry, Consolidation_State, Project_Settings, Background_Task)
```

### 新增元模型 (写入 ArangoDB 底层)

```
Knowledge_Entry       — 知识条目 (client/methodology/project/reference 四类)
Consolidation_State   — 巩固状态锁 (last_consolidated_at, project_id)
Project_Settings      — 项目功能开关 (flags JSON, project_id REFERENCE)
Background_Task      — 后台任务 (status/progress/result/error)
```

**新建文件**: 22 个
**修改文件**: 7 个
**新增元模型**: 4 个
**预估新增代码**: ~1,500 行

---

## 部署方式

### 现有基础设施

```
Vercel (hkg1)                    前端 Next.js — git push 自动部署
    ↓ HTTPS
Nginx (HK 103.59.103.85:443)     反向代理 + SSL
    ↓
Docker 容器 (bridge 网络)         所有后端服务
    ├── org-diagnosis-api :8000   FastAPI (Python 3.11 slim)
    ├── arangodb          :8529   图数据库 (sys_meta_models, sys_objects, sys_relations)
    ├── minio             :9000   文件存储 (PPTX, 导出文件)
    └── redis             :6379   缓存 (可选)
Supabase (云端)                   用户认证 + 项目管理
```

> 详细架构参见 `docs/deployment/DEPLOYMENT_V2.md`

### 关键事实

- **部署方式**: `deploy.sh` — rsync 后端代码到 HK → docker build → docker run
- **数据库**: ArangoDB 在 HK Docker 中运行，API 容器通过 `bridge` 网络直接访问容器名 `arangodb:8529`
- **元模型种子**: 通过 `seed_blueprints.py` 创建，代码部署后需要手动或自动执行
- **Demo 模式**: `KERNEL_MODE=demo` 时使用 InMemoryDatabase，不依赖 ArangoDB
- **无需新增基础设施**: 6 个模式全部复用现有 ArangoDB + Docker + MinIO，不需要新服务器或新容器

### 新增元模型的 ArangoDB 初始化

4 个新元模型（Knowledge_Entry, Consolidation_State, Project_Settings, Background_Task）需要在 ArangoDB 中注册。执行方式：

```bash
# 1. 代码部署后，进入 API 容器
ssh hk-jump "docker exec -it org-diagnosis-api bash"

# 2. 执行元模型种子脚本
python -c "
from app.agent.seed_blueprints import seed_all_meta_models
from app.kernel.database import get_db
db = next(get_db())
seed_all_meta_models(db)
print('Meta models seeded successfully')
"
```

或在代码中添加启动时自动检测并种子（推荐，避免手动操作）：

```python
# backend/app/agent/seed_blueprints.py 末尾
def ensure_meta_models(db):
    """启动时检查并创建缺失的元模型"""
    required = ["Knowledge_Entry", "Consolidation_State", "Project_Settings", "Background_Task"]
    for name in required:
        existing = db.query("FOR doc IN sys_meta_models FILTER doc.model_key == @key RETURN doc", bind_vars={"key": name})
        if not existing:
            # 创建元模型
            ...
```

### 新增环境变量

6 个模式不需要新的环境变量。Feature Flag 默认值硬编码在 `feature_flags.py` 中，需要时通过环境变量 `FEATURE_<NAME>=true/false` 覆盖：

```bash
# .env 文件中添加（可选，控制新功能灰度）
FEATURE_TOOL_REGISTRY=true
FEATURE_HOOK_SYSTEM=true
FEATURE_MEMORY_SYSTEM=false      # 记忆系统暂不开放
FEATURE_DREAM_CONSOLIDATION=false
FEATURE_BACKGROUND_TASKS=false
```

### 部署流程

6 个模式分 3 批部署，每批独立可用：

```
批次 1: Feature Flags + Tool Registry + Hook System (P0)
  1. git push → Vercel 自动部署前端（如有前端改动）
  2. ./deploy.sh → HK 后端部署
  3. ssh hk-jump "docker exec -it org-diagnosis-api python -c 'from app.agent.seed_blueprints import ensure_meta_models; ...'"
  4. 验证: curl https://org-diagnosis.3strategy.cc/api/health
  5. 验证: 创建 Agent 会话，确认 interact_node 通过 ToolRegistry 调用

批次 2: Memory System + AutoDream (P1)
  1. 重复上述 deploy 流程
  2. 种子 Knowledge_Entry + Consolidation_State 元模型
  3. 验证: GET /agent/memory/list 返回空列表（而非 404）
  4. 验证: 完成 3+ 会话后，检查 AutoDream 是否触发

批次 3: Background Tasks (P2)
  1. 重复 deploy 流程
  2. 种子 Background_Task 元模型
  3. 验证: 报告生成返回 task_id，GET /agent/tasks/{id} 可查询进度
```

### 各模式与部署组件的关系

| 模式 | ArangoDB | MinIO | Redis | 新容器 | 新端口 |
|------|----------|-------|-------|--------|--------|
| Feature Flags | 项目级配置 (可选) | - | - | - | - |
| Tool Registry | - | - | - | - | - |
| Hook System | 审计日志 (可选) | - | - | - | - |
| Memory System | Knowledge_Entry | - | 缓存查询 | - | - |
| AutoDream | Consolidation_State + Knowledge_Entry | - | - | - | - |
| Background Tasks | Background_Task | PPTX 存储 | - | - | - |

**结论**: 不需要新增容器、新端口或新服务器。所有数据通过现有 ArangoDB 存储，文件通过现有 MinIO 存储。

### Demo 模式兼容

在 `KERNEL_MODE=demo` 时：
- InMemoryDatabase 自动处理所有元模型操作（无 ArangoDB 依赖）
- TaskManager 使用内存字典存储任务状态（进程重启丢失，demo 模式可接受）
- DreamService 的文件锁改为内存锁（`threading.Lock`），不依赖 ArangoDB 原子性
- 所有 6 个模式在 demo 模式下功能完整，只是数据不持久化
