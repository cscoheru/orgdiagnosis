# 咨询 OS 借鉴 Claude Code 设计思想 — 实施计划

## Context

用户的 **org-diagnosis**（组织诊断咨询 OS）是一个 LangGraph + FastAPI + Next.js 全栈系统，当前 Agent 工作流是**线性状态机**（init→plan→interact→collect→distill→execute），存在以下可改进点：

- 无工具注册表 — AI 能力硬编码在 nodes.py 中
- 无 Hook 系统 — 工作流事件无法被外部拦截/增强
- 无插件架构 — 新咨询类型需要改核心代码
- 实时性差 — 轮询而非 SSE 流式推送
- 单 Agent — 无多角色协作能力
- 无权限分级 — 缺少多租户场景下的数据隔离
- 无上下文分层 — 缺少项目级/全局级指令加载机制

通过学习 Claude Code 泄漏源码（51.9 万行 TypeScript）的设计哲学（非复制代码），将 12 个高价值模式适配到咨询 OS 现有技术栈。

> 2026-04-03 更新：补充 AutoDream 记忆巩固、四类记忆体系、Feature Flag 系统、Forked Agent 模式 4 个新发现模式。

---

## 一、完整设计模式清单

从 Claude Code 源码中识别出以下可借鉴模式，按与咨询 OS 的契合度排序：

| # | 模式 | 来源 | 契合度 | 优先级 |
|---|------|------|--------|--------|
| 1 | 工具注册表 | `src/Tool.ts` + `src/tools/` (45 子目录) | ★★★★★ | P0 |
| 2 | Hook 拦截系统 | `src/hooks/` (87 文件) | ★★★★★ | P0 |
| 3 | **AutoDream 记忆巩固** | `src/services/autoDream/` (4 文件) | ★★★★★ | P1 |
| 4 | **四类记忆体系** | `src/memdir/memoryTypes.ts` + `memdir.ts` | ★★★★★ | P1 |
| 5 | SSE 流式推送 | `src/QueryEngine.ts` (46KB) + query loop | ★★★★☆ | P1 |
| 6 | 分层会话压缩 | `src/services/compact/` autoCompact | ★★★★☆ | P1 |
| 7 | 分层上下文加载 | `src/utils/claudemd.ts` CLAUDE.md 优先级链 | ★★★★☆ | P1 |
| 8 | **Feature Flag 系统** | 30+ feature flags 分布全代码库 | ★★★★☆ | P1 |
| 9 | 多 Agent 协作 | `src/coordinator/` + Agent tool | ★★★★☆ | P2 |
| 10 | **Forked Agent 后台执行** | `src/utils/forkedAgent.ts` + autoDream | ★★★★☆ | P2 |
| 11 | 分级权限系统 | `src/types/permissions.ts` 多源规则合并 | ★★★☆☆ | P2 |
| 12 | 插件架构 | `src/plugins/` 三层加载 + 生命周期 | ★★★☆☆ | P2 |

---

## 二、P0: 工具注册表（Tool Registry）

### 借鉴来源
Claude Code 的 `src/Tool.ts`（29KB）— `buildTool()` 模式，每个工具是独立目录，schema 用 Zod 定义，有 `isReadOnly()` 权限标记。

**关键设计思想**：
- 工具是 **自描述的**（name + description + inputSchema），LLM 根据描述自动选择工具
- 工具有 **可选方法**（`buildTool()` 提供 default 实现），降低实现门槛
- 工具有 **权限标记**（isReadOnly），执行前自动检查

### 为什么重要
当前 `nodes.py` 的 AI 调用是硬编码的（`interact_node` 直接调用 `ai_client.chat()`）。咨询 OS 未来需要的能力越来越多（数据分析、行业对标、财务建模、政策解读等），每加一个能力就要改 nodes.py，不可持续。

### 如何适配
在现有 `backend/lib/workflow_engine/registry.py` 基础上，扩展为 **咨询工具注册表**：

```
backend/app/tools/
├── __init__.py
├── registry.py          # ToolRegistry 单例
├── base.py              # BaseConsultingTool 抽象基类
├── schemas.py           # Pydantic 模型
└── builtin/             # 内置工具
    ├── data_analysis.py
    ├── industry_benchmark.py
    ├── policy_interpreter.py
    ├── financial_modeling.py
    └── report_generator.py
```

### 关键设计
```python
class BaseConsultingTool(ABC):
    name: str                    # "industry_benchmark"
    description: str             # 供 LLM 选择工具时参考
    input_schema: dict           # JSON Schema 格式
    output_schema: dict
    required_permissions: list   # ["data_read", "report_write"]
    category: str                # "analysis" | "generation" | "external"

    async def execute(self, context: ToolContext) -> ToolResult: ...

    # 可选覆盖（借鉴 Claude Code 的 optional methods 模式）
    def is_read_only(self) -> bool: return False
    def get_cost_estimate(self) -> int: return 0  # 预估 token 消耗
```

### 需要修改的文件
- **新建**: `backend/app/tools/registry.py`, `backend/app/tools/base.py`, `backend/app/tools/schemas.py`
- **重构**: `backend/app/agent/nodes.py` — interact_node 和 executor_node 改为通过 ToolRegistry 调度
- **扩展**: `backend/lib/workflow_engine/registry.py` — 复用装饰器模式，升级为 schema-driven

### 与 Claude Code 的区别
Claude Code 的工具是给 **AI agent 自己调用的**（文件读写、Shell 等）。咨询 OS 的工具是给 **咨询工作流中的 AI 节点调用的**（行业分析、财务建模等），consumer 不同，注册表模式通用。

---

## 三、P0: Hook 拦截系统

### 借鉴来源
Claude Code 的 `src/hooks/`（87 文件）— PreToolUse / PostToolUse 拦截器。

**关键设计思想**：
- Hook 有 **优先级排序**（priority），决定执行顺序
- Hook 可以 **短路执行**（return false 阻止后续 hook 和工具执行）
- Hook 可以 **修改数据**（override tool input/output）
- Hook 来源分级：user settings > project settings > local settings

### 为什么重要
咨询场景天然需要质量关卡：合规审查、成本追踪、数据验证、通知集成。当前这些逻辑散落在各个 node 里，无法统一管理。

### 如何适配
```python
class HookPoint(str, Enum):
    BEFORE_INTERACT = "before_interact"
    AFTER_COLLECT = "after_collect"
    BEFORE_EXECUTE = "before_execute"
    AFTER_EXECUTE = "after_execute"
    ON_ERROR = "on_error"
    ON_DISTILL = "on_distill"
    BEFORE_TOOL_USE = "before_tool_use"      # 通用工具拦截
    AFTER_TOOL_USE = "after_tool_use"        # 通用工具拦截

class BaseHook(ABC):
    name: str
    hook_point: HookPoint
    priority: int = 100

    async def execute(self, context: HookContext) -> HookResult:
        # HookResult(continue=True) 放行
        # HookResult(continue=False, override_data=...) 拦截并替换
```

### 需要修改的文件
- **新建**: `backend/app/hooks/registry.py`, `backend/app/hooks/base.py`
- **新建**: `backend/app/hooks/builtin/` — compliance_check.py, cost_tracker.py, data_validator.py
- **修改**: `backend/app/agent/workflow.py` — 在节点执行前后插入 hook 调用点
- **修改**: `backend/app/agent/nodes.py` — 移除内联验证逻辑，委托给 hook

---

## 四、P1: SSE 流式推送

### 借鉴来源
Claude Code 的 `src/query.ts`（68KB）query loop — 用 generator 函数（`async function* queryLoop`）实现流式输出，每一轮工具执行的结果实时推送给前端。

**关键设计思想**：
- 主循环是 **async generator**，每次 yield 一个事件片段
- 事件类型包括：text_delta（文本增量）、tool_start、tool_result、error
- 前端用 **ReadableStream** 消费，实现打字机效果

### 为什么重要
当前前端通过轮询获取状态（`pollUntilComplete`），AI 生成引导话术时用户看到空白等待，体验差。

### 如何适配
- **后端**: FastAPI `StreamingResponse` + SSE event 格式
- **前端**: `fetch` + `ReadableStream` 消费流式数据

### 需要修改的文件
- **新建**: `backend/app/agent/stream.py` — SSE 事件格式化
- **修改**: `backend/app/agent/api.py` — 添加 SSE 端点
- **修改**: `lib/agent-api.ts` — 改用流式 API
- **修改**: `app/(dashboard)/agent/` — 添加流式 UI 组件

---

## 五、P1: 分层会话压缩

### 借鉴来源
Claude Code 的 `src/services/compact/autoCompact.ts` — 基于 token 预算自动触发压缩：
```typescript
const autocompactThreshold = effectiveContextWindow - AUTOCOMPACT_BUFFER_TOKENS
```

**关键设计思想**：
- **Token 预算制**：根据模型上下文窗口大小动态计算压缩阈值
- **自动 + 手动**：既可自动触发，也允许用户手动 `/compact`
- **压缩是安全的**：压缩失败时 fallback 到原始数据，不会丢信息

### 为什么重要
当前 `distill_node` 固定每 8 轮触发一次，策略粗糙。长咨询项目（可能 30+ 轮交互）需要更智能的压缩。

### 如何适配
在现有 `distill_node` 基础上增强：
1. **Token 感知压缩**: 基于 collected_data 体积 + messages 数量动态触发
2. **分层蒸馏**:
   - L1: 字段级去重（纯逻辑，不调 AI）
   - L2: 节点级摘要（AI 压缩单个 node_type）
   - L3: 全局蒸馏（当前已有，压缩为 Project_Spec）
3. **增量蒸馏**: 只蒸馏新增数据

### 需要修改的文件
- **修改**: `backend/app/agent/nodes.py` — distill_node() 重构
- **新建**: `backend/app/agent/compaction.py` — 分层蒸馏策略
- **修改**: `backend/app/agent/workflow.py` — _route_by_mode 添加压缩触发条件

---

## 六、P1: 分层上下文加载（Context Hierarchy）

### 借鉴来源
Claude Code 的 `src/utils/claudemd.ts` — **四级指令加载优先级链**：
1. **系统级** (`/etc/claude-code/CLAUDE.md`) — 全局管理员配置
2. **用户级** (`~/.claude/CLAUDE.md`) — 个人偏好
3. **项目级** (`CLAUDE.md`, `.claude/rules/*.md`) — 项目特定规则
4. **本地级** (`CLAUDE.local.md`) — 不提交到 git 的个人项目规则

还支持 `@include` 指令引用其他文件。

### 为什么重要
咨询 OS 缺少类似机制。不同客户/行业/项目有不同的咨询方法论和合规要求，目前无法在不改代码的情况下注入领域知识。

### 如何适配
为咨询 OS 设计 **四层指令系统**：
1. **系统级** (`backend/data/global_rules.md`) — 平台级合规规则（如数据安全政策）
2. **行业级** (`backend/data/industries/{industry}.md`) — 行业特定方法论（如金融、医疗）
3. **项目级** (数据库 `project.instructions`) — 项目特定的咨询框架
4. **会话级** (API 请求参数) — 单次会话的临时指令

这些指令在 `init_node` 中加载，注入到 system prompt 中。

### 需要修改的文件
- **新建**: `backend/app/agent/context_loader.py` — 四层上下文加载器
- **修改**: `backend/app/agent/nodes.py` — init_node 加载上下文链
- **新建**: `backend/data/industries/` — 行业指令模板

---

## 七、P2: 多 Agent 协作（Multi-Agent）

### 借鉴来源
Claude Code 的 `src/coordinator/coordinatorMode.ts` — 主 Agent 通过 Agent tool 派生子 Agent，子 Agent 通过 `<task-notification>` XML 汇报结果。

**关键设计思想**：
- **Coordinator 模式**: 主 Agent 不直接干活，只负责任务分解和结果汇总
- **子 Agent 隔离**: 每个 Agent 有独立的 context、tools、MCP servers
- **异步通知**: 子 Agent 完成后通过 task-notification 回报，主 Agent 不需要阻塞等待
- **Worktree 隔离**: 文件系统级别的隔离，子 Agent 的文件操作不影响主环境

### 为什么重要
组织诊断涉及 5 个专业维度（战略、组织、绩效、薪酬、人才），当前单 Agent 串行处理所有维度，引入多 Agent 可以：
- 并行分析（战略+组织同时进行）
- 专业化（每个 Agent 有独立的 system prompt 和工具集）
- 可扩展（新增维度只需新增子 Agent）

### 如何适配
利用 LangGraph 原生子图能力：
```python
main_workflow = StateGraph(MainState)
main_workflow.add_node("coordinator", coordinator_node)
main_workflow.add_node("strategy_agent", strategy_subgraph)  # 子图
main_workflow.add_node("org_agent", org_subgraph)            # 子图
main_workflow.add_node("synthesizer", synthesizer_node)
# coordinator 根据 blueprint 依赖树决定并行/串行调度
```

### 需要修改的文件
- **新建**: `backend/app/agent/agents/` — strategy.py, org.py, performance.py, compensation.py, talent.py
- **新建**: `backend/app/agent/coordinator.py` — 多 Agent 调度器
- **重构**: `backend/app/agent/workflow.py` — 从单图改为主图+子图
- **修改**: `backend/lib/langgraph/workflow.py` — 五维诊断工作流改为子图

---

## 八、P2: 分级权限系统

### 借鉴来源
Claude Code 的 `src/types/permissions.ts` — 多源权限规则合并：
- 规则来源：userSettings > projectSettings > localSettings > policySettings > cliArg
- 规则行为：allow / deny / ask
- 规则粒度：toolName + ruleContent（可选内容过滤器）

### 为什么重要
咨询 OS 有多租户需求（不同客户组织的数据隔离），当前缺少系统化的权限控制。

### 如何适配
```python
class PermissionLevel(str, Enum):
    READ_ONLY = "read_only"           # 只能查看报告
    DATA_COLLECT = "data_collect"     # 可以填写数据
    ANALYSIS = "analysis"             # 可以触发分析
    ADMIN = "admin"                   # 可以修改 blueprint、管理项目
```

### 需要修改的文件
- **新建**: `backend/app/permissions/registry.py`
- **修改**: `backend/app/agent/workflow.py` — 执行前检查权限
- **修改**: `backend/app/middleware/auth.py` — 集成权限检查

---

## 九、P2: 插件架构

### 借鉴来源
Claude Code 的 `src/plugins/` — 三层加载机制：
1. **Builtin**: 核心功能，随发布包一起
2. **Bundled**: 官方插件，但可单独启用/禁用
3. **External**: 第三方插件，通过目录发现

插件生命周期：`init()` → `register_tools()` → `register_hooks()` → `shutdown()`

### 为什么重要
不同行业的咨询方法论差异大（金融咨询 vs 医疗咨询 vs 制造业咨询），插件化可以让行业方案独立开发和部署。

### 如何适配
```
backend/app/plugins/
├── registry.py          # PluginManager
├── base.py              # BasePlugin 抽象基类
├── builtin/             # 内置插件
└── discovery.py         # 插件发现（从指定目录扫描）
```

### 需要修改的文件
- **新建**: `backend/app/plugins/` 整个目录
- **修改**: `backend/app/agent/workflow.py` — 初始化时加载插件

---

## 十、P1: AutoDream 记忆巩固引擎（最高价值发现）

### 借鉴来源
Claude Code 的 `src/services/autoDream/`（4 个文件）— 后台 forked agent 自动将近期会话学习整合为持久化记忆。

**关键设计思想**：
- **三级门控**（从便宜到昂贵快速短路）：Time gate(1次stat) → Session gate(扫描目录) → Lock gate(文件锁+PID检测)
- **四阶段巩固**：Orient(读索引) → Gather(提取新信号) → Consolidate(合并到现有记忆) → Prune(更新索引+删除过期)
- **Forked Agent 模式**：巩固任务作为独立子进程运行，不阻塞主交互
- **工具约束**：巩固 agent 只能使用只读工具（ls, grep, cat），防止意外修改
- **文件锁即时间戳**：lock file 的 mtime 就是 lastConsolidatedAt，零额外存储

### 为什么重要
这是整个泄漏源码中**设计最精巧的模块**。咨询 OS 的核心价值在于**知识积累**——每次咨询都应该让系统更聪明，而不是每次从零开始。

### 如何适配
```python
class DreamConfig:
    min_hours: int = 24        # 距上次巩固的最小间隔
    min_sessions: int = 5      # 需要积累的最小会话数
    scan_interval_ms: int = 600000  # 扫描节流（10分钟）

class ConsultingDreamService:
    """后台记忆巩固服务"""

    async def should_trigger(self) -> bool:
        # 三级门控：时间 → 会话数 → 锁

    async def consolidate(self, project_id: str):
        # 四阶段：定向 → 收集 → 巩固 → 修剪
        # 启动一个 forked LangGraph agent 执行巩固
```

### 巩固的 Prompt 设计（借鉴 consolidationPrompt.ts）
```
Phase 1 — Orient: 读取项目知识索引，了解已有积累
Phase 2 — Gather: 从近期会话中提取新信息（行业洞察、方法论、客户反馈）
Phase 3 — Consolidate: 合并到现有知识文件（不创建重复）
Phase 4 — Prune: 更新索引，删除矛盾/过期的知识
```

### 需要修改的文件
- **新建**: `backend/app/services/dream/` — config.py, dream_service.py, consolidation_lock.py
- **新建**: `backend/app/services/dream/consolidation_prompt.py` — 四阶段 prompt 模板
- **修改**: `backend/app/agent/workflow.py` — 会话结束时触发巩固检查
- **新建**: `backend/data/knowledge/` — 项目知识库目录结构

---

## 十一、P1: 四类记忆体系

### 借鉴来源
Claude Code 的 `src/memdir/memoryTypes.ts` — 精确定义了 4 种记忆类型，每种有明确的 when_to_save / how_to_use / body_structure 规则。

**关键设计思想**：
- **显式保存门控**：即使用户要求保存，也拒绝保存可从代码/git 推导的信息
- **漂移检测**：使用记忆前必须验证当前状态——"The memory says X exists is not the same as X exists now"
- **索引限制**：MEMORY.md 200行/25KB，每行≤150字符——是索引不是内容
- **frontmatter 格式**：每个记忆文件有 name + description + type 元数据

### 为什么重要
咨询 OS 需要区分不同类型的知识：
- **客户画像**（类似 user）：客户行业、规模、偏好、历史合作情况
- **方法论反馈**（类似 feedback）：哪些分析方法有效/无效
- **项目进度**（类似 project）：当前咨询项目的状态和决策
- **外部参考**（类似 reference）：行业报告、政策文件、对标数据的存放位置

### 如何适配
```python
class MemoryType(str, Enum):
    CLIENT = "client"          # 客户画像、偏好、角色
    METHODOLOGY = "methodology"  # 咨询方法论反馈（有效/无效的做法）
    PROJECT = "project"        # 项目进度、决策、约束
    REFERENCE = "reference"    # 外部资源指针（报告、政策、数据源）

# 每个记忆文件格式：
# ---
# name: 金融行业薪酬对标方法论
# description: 2026年金融客户项目中验证的薪酬分析框架
# type: methodology
# ---
# 规则/事实...
# **Why:** 金融行业薪酬结构特殊（递延奖金占比高）
# **How to apply:** 分析金融客户时优先使用此框架
```

### 需要修改的文件
- **新建**: `backend/app/services/memory/` — types.py, registry.py, memory_service.py
- **新建**: `backend/data/knowledge/templates/` — 记忆模板文件
- **修改**: `backend/app/agent/nodes.py` — interact_node 和 executor_node 中触发记忆保存

---

## 十二、P1: Feature Flag 系统

### 借鉴来源
Claude Code 使用 30+ feature flags 控制功能开关，通过 `feature('FLAG_NAME')` 宏在构建时决定是否包含功能。

**关键设计思想**：
- **编译时排除**：未启用的功能不会进入 bundle（不是运行时 if）
- **远程配置覆盖**：GrowthBook 平台远程控制 flag 默认值
- **用户设置优先**：本地 settings.json 可以覆盖远程默认值
- **防御性验证**：远程返回值可能是错误类型，逐字段校验

### 为什么重要
咨询 OS 有多租户需求——不同客户/行业需要不同的功能集：
- 金融客户启用「薪酬对标」模块，制造业客户不需要
- 试用客户限制高级分析功能
- 内部测试新功能时可以先对特定客户灰度开放

### 如何适配
```python
# 简化版 feature flag（不需要编译时排除，用运行时检查即可）
class FeatureFlags:
    _flags: dict[str, bool] = {}
    _overrides: dict[str, bool] = {}  # 用户/项目级覆盖

    def is_enabled(self, flag: str, project_id: str | None = None) -> bool:
        # 优先级：项目覆盖 > 用户设置 > 远程默认 > 硬编码默认
        ...

# 使用方式
if feature_flags.is_enabled("salary_benchmark", project_id):
    tools.register(SalaryBenchmarkTool())
```

### 需要修改的文件
- **新建**: `backend/app/services/feature_flags.py`
- **修改**: `backend/app/config.py` — 加载 feature flag 配置
- **修改**: `backend/app/tools/registry.py` — 按 flag 条件注册工具
- **修改**: `backend/app/agent/workflow.py` — 按项目配置加载功能

---

## 十三、P2: Forked Agent 后台执行

### 借鉴来源
Claude Code 的 `src/utils/forkedAgent.ts` — 将耗时任务作为独立子 agent 在后台执行，主交互不受阻塞。

**关键设计思想**：
- **任务注册表**：后台任务在 UI 中可见（TaskList），用户可以查看进度或取消
- **进度监控**：通过 `onMessage` 回调实时追踪 agent 的输出
- **AbortController**：支持用户取消后台任务
- **资源隔离**：forked agent 有独立的 MCP servers 和工具权限

### 为什么重要
咨询 OS 有多个耗时操作：报告生成、数据导出、批量分析。当前是同步阻塞的，用户体验差。

### 如何适配
```python
class BackgroundTaskManager:
    _tasks: dict[str, BackgroundTask] = {}

    async def spawn(self, task_type: str, params: dict) -> str:
        """启动后台任务，返回 task_id"""

    async def get_status(self, task_id: str) -> TaskStatus:
        """获取任务状态和进度"""

    async def cancel(self, task_id: str):
        """取消正在运行的任务"""
```

### 需要修改的文件
- **新建**: `backend/app/services/task_manager.py`
- **修改**: `backend/app/agent/nodes.py` — executor_node 改为后台执行
- **新建**: `backend/app/api/tasks.py` — 任务状态查询 API
- **修改**: `lib/agent-api.ts` — 前端轮询任务进度

---

## 实施顺序

```
Phase 1 (P0): Tool Registry + Hook System
  ↓  Tool Registry 是 Hook 的前置（Hook 需要拦截工具调用）
  ↓  两者可以并行开发，最后在 workflow.py 中集成

Phase 2 (P1): SSE Streaming + Compaction + Context Hierarchy + Memory System + Feature Flags
  ↓  SSE 依赖 Tool Registry（流式推送工具执行结果）
  ↓  AutoDream + 四类记忆体系 依赖 Hook（记忆保存/加载需要 hook 拦截）
  ↓  Feature Flags 独立，但建议与 Tool Registry 同期完成（工具按 flag 条件注册）
  ↓  Compaction 和 Context Hierarchy 独立，可并行

Phase 3 (P2): Multi-Agent + Forked Agent + Permissions + Plugins
  ↓  Multi-Agent 依赖 Tool Registry + Hook
  ↓  Forked Agent 依赖 TaskManager（后台任务管理）
  ↓  Permissions 独立
  ↓  Plugins 依赖 Tool Registry + Hook + Feature Flags
```

---

## 验证方式

### P0 验证
1. 注册一个自定义工具（如 `mock_analysis_tool`），验证 interact_node 能通过 ToolRegistry 调用
2. 注册一个 `cost_tracker` hook，验证每次 AI 调用后 token 消耗被记录
3. 注册一个 `data_validator` hook，验证不合规数据被拦截（continue=False）

### P1 验证
1. 启动 Agent 会话，验证前端通过 SSE 实时接收 AI 引导话术（逐字显示）
2. 模拟长对话（>8 轮），验证分层蒸馏正确触发且数据无丢失
3. 创建不同行业项目，验证行业级指令正确加载到 system prompt
4. 完成 5+ 次咨询会话后，验证 AutoDream 自动触发并生成知识索引
5. 验证四类记忆正确分类保存（client/methodology/project/reference）
6. 验证 Feature Flag 按项目正确控制功能开关

### P2 验证
1. 创建五维诊断会话，验证 coordinator 正确调度 5 个子 Agent
2. 验证报告生成作为后台任务执行，前端可查看进度
3. 用低权限账号尝试管理操作，验证被拒绝
4. 开发一个行业插件包，验证 discovery 能自动发现并加载

---

## 关键参考文件

### Claude Code 泄漏源码（学习用，在 `/Users/kjonekong/Downloads/claude-code-leaked-study/`）
- `src/Tool.ts` — 工具注册表核心（buildTool 模式）
- `src/tools/` — 45 个工具实现（独立目录 + schema 定义）
- `src/hooks/` — 87 个 hook 实现（优先级 + 短路 + 数据修改）
- `src/query.ts` — Agent 主循环（async generator + 流式事件）
- `src/QueryEngine.ts` — 查询引擎架构
- `src/coordinator/coordinatorMode.ts` — 多 Agent 协调器
- `src/services/compact/autoCompact.ts` — Token 预算压缩
- `src/services/autoDream/autoDream.ts` — **记忆巩固引擎**（三级门控 + 四阶段巩固）
- `src/services/autoDream/consolidationPrompt.ts` — **巩固 prompt 模板**
- `src/services/autoDream/consolidationLock.ts` — **文件锁即时间戳**模式
- `src/memdir/memoryTypes.ts` — **四类记忆体系**定义（user/feedback/project/reference）
- `src/memdir/memdir.ts` — **记忆目录管理**（索引限制 200行/25KB）
- `src/utils/claudemd.ts` — 四级上下文加载
- `src/types/permissions.ts` — 多源权限规则
- `src/plugins/` — 三层插件架构 + 生命周期
- `src/utils/forkedAgent.ts` — Forked Agent 后台执行
- `src/state/store.ts` — 不可变 store + listener 模式
- `src/bridge/` — 多环境桥接（WebSocket 通信）
- `src/commands.ts` — 30+ feature flags 定义（PROACTIVE/KAIROS/VOICE_MODE 等）

### org-diagnosis 现有代码（在 `/Users/kjonekong/Documents/org-diagnosis/`）
- `backend/app/agent/workflow.py` — LangGraph 工作流（所有改动的集成点）
- `backend/app/agent/nodes.py` — 6 个节点函数（需重构为工具调用模式）
- `backend/app/agent/state.py` — AgentState 定义
- `backend/lib/workflow_engine/registry.py` — 现有步骤注册表（可复用装饰器模式）
- `backend/lib/workflow_engine/engine.py` — 现有工作流引擎（可复用 session 管理）
- `backend/app/services/ai_client.py` — AI 客户端抽象（多 provider）
- `backend/app/agent/blueprint_service.py` — Blueprint 服务（依赖树 + 字段管理）
- `lib/agent-api.ts` — 前端 API 客户端
