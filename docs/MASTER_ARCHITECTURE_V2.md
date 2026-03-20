# DeepConsult Copilot 技术规约与实施指南

> 版本: v2.0
> 更新时间: 2026-03-20
> 状态: 待实施

---

## 1. 项目愿景

构建一个从 **"五维组织诊断"** 到 **"结构化项目建议书自动生成"** 的全栈系统。

### 核心能力
- **结构化需求录入**: 客户背景、痛点、目标、阶段规划
- **智能知识检索**: LlamaIndex 检索历史咨询报告
- **Human-in-the-loop**: 人工干预大纲和内容
- **高保真 PPTX 导出**: 基于模板的专业咨询报告

### 输出报告结构 (四部分固定模板)
1. **项目需求的理解**: 需求背景、关键需求、客户目标
2. **项目方法与整体框架**: 方法论、MDS模型
3. **项目实施步骤**: 按 MDS 分阶段实施计划
4. **项目计划、团队与报价**: 甘特图、团队、报价

---

## 2. 核心架构拓扑

```
┌─────────────────────────────────────────────────────────────────────┐
│                         系统架构                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    前端 (Next.js + React)                    │   │
│  │  • 需求录入表单 (ClientRequirement)                          │   │
│  │  • 大纲编辑器 (拖拽/增删)                                     │   │
│  │  • 单页编辑器 (观点/素材/配图)                                │   │
│  │  • 进度追踪 (WebSocket/轮询)                                  │   │
│  └───────────────────────────┬─────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    后端 (FastAPI + Python)                   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  LangGraph 工作流                                            │   │
│  │  ├── 大纲生成节点 → ⏸ interrupt (人工审核)                   │   │
│  │  ├── 内容填充节点 → ⏸ interrupt (人工审核)                   │   │
│  │  └── PPTX渲染节点                                            │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  LlamaIndex 知识库                                           │   │
│  │  ├── 文档解析 (PDF/DOCX/PPTX)                                │   │
│  │  ├── 向量索引 (ChromaDB)                                     │   │
│  │  └── 语义检索 (元数据过滤)                                   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  PPTX 渲染引擎 (python-pptx)                                 │   │
│  │  ├── 模板加载 (report_template.pptx)                         │   │
│  │  ├── 占位符填充                                              │   │
│  │  └── 图表生成                                                │   │
│  └───────────────────────────┬─────────────────────────────────┘   │
│                              │                                      │
│                              ▼                                      │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    存储                                      │   │
│  │  • PostgreSQL (需求/报告元数据)                               │   │
│  │  • ChromaDB (向量索引)                                       │   │
│  │  • SQLite Checkpointer (工作流状态)                          │   │
│  │  • 本地文件系统 (历史报告/模板)                               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. 输入源设计

### 3.1 主要输入: ClientRequirement (必填)

```python
class ClientRequirement(BaseModel):
    """客户需求结构化输入 - 项目建议书核心数据"""

    # === 基本信息 ===
    client_name: str                      # 客户名称
    industry: IndustryType                # 行业类型
    industry_background: str              # 客户行业背景描述 (≥50字)

    # === 公司介绍 ===
    company_intro: str                    # 公司简介 (≥50字)
    company_scale: Optional[str]          # 公司规模
    annual_revenue: Optional[str]         # 年营收规模

    # === 核心痛点 ===
    core_pain_points: List[str]           # 核心痛点列表 (1-10个)
    pain_severity: Optional[str]          # 痛点严重程度

    # === 项目目标 ===
    project_goals: List[str]              # 项目目标列表
    success_criteria: Optional[List[str]] # 成功标准

    # === 阶段规划 ===
    phase_planning: List[ProjectPhase]    # 项目阶段规划
    total_duration_weeks: Optional[int]   # 总周期(周)

    # === 主要工作任务 ===
    main_tasks: List[str]                 # 主要工作任务清单

    # === 阶段交付成果 ===
    deliverables: List[str]               # 各阶段交付物

    # === 项目计划甘特图 ===
    gantt_chart_data: Optional[List[GanttTask]]  # 甘特图数据
```

### 3.2 辅助输入: FiveDDiagnosis (可选)

```python
class FiveDDiagnosis(BaseModel):
    """五维诊断结果 (可选输入)"""

    # 五维得分
    strategy_score: float      # 战略得分
    structure_score: float     # 组织得分
    performance_score: float   # 绩效得分
    compensation_score: float  # 薪酬得分
    talent_score: float        # 人才得分
    overall_score: float       # 总分

    # 各维度详情
    dimensions: Dict[str, DimensionDetail]  # 各维度L2/L3指标

    # 诊断证据
    evidence: List[EvidenceItem]  # 原文证据
```

---

## 4. 输出报告结构

### 4.1 四部分固定结构

```
┌─────────────────────────────────────────────────────────────────────┐
│                    项目建议书报告结构                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 封面                                                         │   │
│  │  • 客户名称、项目名称、日期                                   │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 第一部分：项目需求的理解                                       │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  1.1 需求背景 (背景分析、行业趋势、客户现状)                    │   │
│  │  1.2 关键需求 (痛点识别、核心诉求、优先级)                      │   │
│  │  1.3 客户目标 (预期成果、成功标准、时间期望)                    │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 第二部分：项目方法与整体框架                                   │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  2.1 方法论 (咨询方法论介绍)                                  │   │
│  │  2.2 MDS 模型 (五维诊断模型)                                  │   │
│  │  2.3 解决方案框架 (整体思路)                                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 第三部分：项目实施步骤                                         │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  3.1 阶段一：诊断与洞察                                       │   │
│  │  3.2 阶段二：方案设计                                         │   │
│  │  3.3 阶段三：落地实施                                         │   │
│  │  3.4 阶段四：固化复盘                                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 第四部分：项目计划、团队与报价                                 │   │
│  ├─────────────────────────────────────────────────────────────┤   │
│  │  4.1 项目计划 (甘特图、里程碑)                                │   │
│  │  4.2 团队配置 (角色分工)                                      │   │
│  │  4.3 项目报价 (费用明细)                                      │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │ 附录 (可选)                                                   │   │
│  │  • 公司介绍、案例参考、术语表                                 │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 MDS 五维模型

| 维度 | 名称 | 描述 | 关键指标 |
|------|------|------|---------|
| **Strategy** | 战略 | 做正确的事 | 市场洞察、战略意图、业务设计 |
| **Structure** | 组织 | 搭好班子 | 组织架构、权责分配、协同流程 |
| **Performance** | 绩效 | 明确指挥棒 | 目标设定、考核反馈、结果应用 |
| **Compensation** | 薪酬 | 提供核心动力 | 薪酬策略、结构设计、总额管控 |
| **Talent** | 人才 | 打造人才供应链 | 人才盘点、招聘配置、培养发展 |

---

## 5. API 端点设计

### 5.1 需求管理 API

```
GET  /api/requirement/template
  - 功能: 获取需求录入模板
  - 输出: ClientRequirementTemplate

POST /api/requirement/validate
  - 功能: 验证客户需求输入
  - 输入: ClientRequirement (表单数据)
  - 输出: {valid: bool, errors: [], normalized_data}

POST /api/requirement/save
  - 功能: 保存客户需求
  - 输入: ClientRequirement
  - 输出: {requirement_id: str}

GET  /api/requirement/{requirement_id}
  - 功能: 获取已保存的需求
  - 输出: ClientRequirement
```

### 5.2 报告生成 API

```
POST /api/report/generate-outline
  - 输入: {requirement_id: str, five_d_diagnosis?: Dict}
  - 输出: {task_id: str, status: "processing"}
  - 动作: LlamaIndex检索 + AI生成四部分大纲
  - 状态: pending → outline_ready → [等待人工确认]

GET  /api/report/outline/{task_id}
  - 输出: ReportOutline (四部分大纲)

POST /api/report/confirm-outline
  - 输入: {task_id: str, modified_outline: ReportOutline}
  - 输出: {task_id: str, status: "slides_generating"}
  - 动作: 恢复工作流，进入内容生成

GET  /api/report/status/{task_id}
  - 输出: {status, progress_percentage, current_step}

POST /api/report/generate-slides
  - 输入: {task_id: str}
  - 输出: {task_id: str, status: "processing"}
  - 状态: generating → slides_ready → [等待人工确认]

GET  /api/report/slides/{task_id}
  - 输出: ReportDraft (分页或流式)

POST /api/report/confirm-slides
  - 输入: {task_id: str, modified_slides: ReportDraft}
  - 输出: {task_id: str, status: "ready_for_export"}

POST /api/report/export-pptx
  - 输入: {task_id: str}
  - 输出: .pptx 文件流
```

---

## 6. Human-in-the-loop 工作流

### 6.1 工作流状态机

```python
class WorkflowState(Enum):
    """工作流状态"""
    PENDING = "pending"                    # 等待开始
    GENERATING_OUTLINE = "generating_outline"  # 生成大纲中
    OUTLINE_READY = "outline_ready"        # 大纲待审核 ⏸
    GENERATING_SLIDES = "generating_slides"    # 生成内容中
    SLIDES_READY = "slides_ready"          # 内容待审核 ⏸
    READY_FOR_EXPORT = "ready_for_export"  # 准备导出
    EXPORTING = "exporting"                # 导出中
    COMPLETED = "completed"                # 完成
    FAILED = "failed"                      # 失败
```

### 6.2 中断点设计

| 中断点 | 触发条件 | 用户操作 | 恢复条件 |
|--------|---------|---------|---------|
| `outline_ready` | 大纲生成完成 | 查看/修改大纲 | 调用 confirm-outline |
| `slides_ready` | 内容生成完成 | 查看/修改内容 | 调用 confirm-slides |

---

## 7. PPTX 渲染规范

### 7.1 模板设计要求

PPT 母版 (`templates/report_template.pptx`) 必须包含以下 Layout:

| Layout ID | 名称 | 用途 |
|-----------|------|------|
| 0 | title_slide | 封面 |
| 1 | section_divider | 章节分隔页 |
| 2 | bullet_points | 要点列表 |
| 3 | two_columns | 双列对比 |
| 4 | swot_matrix | SWOT矩阵 |
| 5 | process_flow | 流程图 |
| 6 | five_dimensions_radar | 五维雷达图 |
| 7 | gantt_chart | 甘特图 |
| 8 | team_table | 团队表格 |
| 9 | pricing_table | 报价表格 |

### 7.2 占位符命名规范

```
# 文本占位符
title_placeholder      # 标题
subtitle_placeholder   # 副标题
content_placeholder_1  # 内容1
content_placeholder_2  # 内容2
...

# 图片占位符
image_placeholder_1    # 配图1
image_placeholder_2    # 配图2

# 图表占位符
chart_placeholder_1    # 图表1
```

---

## 8. 严禁行为 (Strict Prohibitions)

| 编号 | 禁止行为 | 正确做法 |
|------|---------|---------|
| 1 | 一次性生成整份报告 | Slide-by-Slide 颗粒度生成 |
| 2 | 代码中硬编码坐标 | 通过占位符 name/idx 定位 |
| 3 | AI 编造素材 | 必须标注 `[需要人工补充]` |
| 4 | 跳过 Pydantic 验证 | 所有 API 数据必须先验证 |
| 5 | 使用 MemorySaver | 必须使用 SQLite Checkpointer |
| 6 | 偏离四部分报告结构 | 严格按照 Part1-Part4 生成 |

---

## 9. 开发阶段 (Roadmap)

### Phase 1: LlamaIndex 知识库构建 (2-3天)

**目标**: 建立历史咨询报告的向量化检索能力

**关键文件**:
```
backend/
├── lib/
│   └── llamaindex/
│       ├── __init__.py
│       ├── document_processor.py  # 文档加载和解析
│       ├── indexer.py             # 索引构建
│       ├── retriever.py           # 检索器封装
│       └── schemas.py             # LlamaIndex 相关模型
├── data/
│   └── historical_reports/        # 历史报告存放目录
│       ├── strategy/              # 战略类报告
│       ├── hr/                    # 人力资源类
│       ├── finance/               # 财务类
│       └── operations/            # 运营类
```

**实现步骤**:
1. 安装依赖: `pip install llama-index llama-index-embeddings-dashscope`
2. 实现 `ConsultingDocumentProcessor` (支持 PDF/DOCX/PPTX)
3. 实现 `ConsultingKnowledgeIndexer` (使用 Qwen3-VL-Embedding)
4. 实现 `ConsultingKnowledgeRetriever` (支持按五维维度检索)
5. 持久化到 ChromaDB

**验收标准**:
- [ ] 能解析 PDF/DOCX/PPTX 并建立索引
- [ ] 检索 "绩效考核" 返回相关历史报告片段
- [ ] 索引持久化到磁盘

---

### Phase 2: LangGraph 交互式工作流 (3-4天)

**目标**: 实现带人工干预的异步任务流

**关键文件**:
```
backend/
├── schemas/
│   ├── requirement.py     # ClientRequirement 模型
│   ├── report.py          # ReportDraft 模型
│   └── report_template.py # 报告模板常量
├── lib/
│   └── langgraph/
│       ├── report_state.py    # ReportState 定义
│       ├── report_workflow.py # 工作流编排
│       └── nodes/
│           ├── outline_gen.py    # 大纲生成节点
│           ├── slide_gen.py      # 内容生成节点
│           ├── human_review.py   # 人工审核节点
│           └── pptx_render.py    # PPTX渲染节点
├── api/
│   ├── requirement.py     # 需求 API
│   └── report.py          # 报告 API
```

**实现步骤**:
1. 定义 Pydantic 模型 (`ClientRequirement`, `ReportDraft`)
2. 实现 LangGraph 工作流 (包含 interrupt 断点)
3. 实现 SQLite Checkpointer 持久化
4. 实现 API 端点

**验收标准**:
- [ ] POST /api/requirement/validate 正确验证结构化需求
- [ ] POST /api/report/generate-outline 返回四部分大纲
- [ ] 工作流在 outline_ready 状态暂停
- [ ] POST /api/report/confirm-outline 后工作流恢复

---

### Phase 3: PPTX 渲染引擎 (2-3天)

**目标**: 基于模板的高保真 PPT 生成

**关键文件**:
```
backend/
├── services/
│   └── pptx_renderer.py   # PPTX 渲染逻辑
├── templates/
│   └── report_template.pptx  # PPT 母版模板
```

**实现步骤**:
1. 制作 PPT 母版 (包含10种Layout)
2. 实现 `PPTXRenderer` 类
3. 实现占位符填充逻辑
4. 实现图表生成 (雷达图、甘特图)

**验收标准**:
- [ ] 生成的 PPTX 可在 PowerPoint 中打开编辑
- [ ] PPTX 包含四部分结构，每部分有章节分隔页
- [ ] 雷达图数据可双击修改
- [ ] 配图占位符可手动替换

---

### Phase 4: 前端交互界面 (3-4天)

**目标**: 实现 Gamma 风格的协同编辑体验

**关键文件**:
```
frontend/
├── app/
│   └── (dashboard)/
│       ├── requirement/
│       │   └── page.tsx       # 需求录入页面
│       └── report/
│           ├── page.tsx       # 报告生成入口
│           ├── outline-editor.tsx  # 大纲编辑器
│           └── slide-editor.tsx     # 单页编辑器
├── lib/
│   └── report-api.ts          # 报告 API 客户端
├── components/
│   ├── requirement-form.tsx   # 需求表单组件
│   └── report-preview.tsx     # 报告预览组件
```

**实现步骤**:
1. 实现需求录入表单 (基于 ClientRequirement 模板)
2. 实现大纲编辑器 (可拖拽/增删)
3. 实现单页编辑器 (观点/素材/配图)
4. 实现进度追踪 (轮询或 WebSocket)

**验收标准**:
- [ ] 需求录入表单支持所有 ClientRequirement 字段
- [ ] 大纲可拖拽排序 (四部分内部排序)
- [ ] 单页内容修改后实时更新
- [ ] 素材来源可追溯

---

## 10. 关键文件清单

### 需要新建:
| 文件路径 | 说明 | Phase |
|---------|------|-------|
| `backend/lib/llamaindex/` | LlamaIndex 模块 | 1 |
| `backend/schemas/requirement.py` | 客户需求 Pydantic 模型 | 2 |
| `backend/schemas/report.py` | 报告相关 Pydantic 模型 | 2 |
| `backend/schemas/report_template.py` | 报告模板常量 | 2 |
| `backend/lib/langgraph/report_state.py` | 报告工作流状态 | 2 |
| `backend/lib/langgraph/report_workflow.py` | 报告工作流编排 | 2 |
| `backend/api/requirement.py` | 客户需求 API 端点 | 2 |
| `backend/api/report.py` | 报告 API 端点 | 2 |
| `backend/services/pptx_renderer.py` | PPTX 渲染服务 | 3 |
| `backend/templates/report_template.pptx` | PPT 母版模板 | 3 |
| `backend/data/historical_reports/` | 历史报告目录 | 1 |
| `frontend/app/(dashboard)/requirement/` | 客户需求录入页面 | 4 |
| `frontend/app/(dashboard)/report/` | 报告生成页面 | 4 |

### 需要修改:
| 文件路径 | 修改内容 |
|---------|---------|
| `backend/requirements.txt` | 添加新依赖 |
| `backend/app/main.py` | 注册新路由 |
| `backend/lib/langgraph/workflow.py` | 集成 interrupt 机制 |

---

## 11. 依赖清单

```txt
# requirements.txt 新增

# LlamaIndex
llama-index>=0.10.0
llama-index-readers-file>=0.1.0
llama-index-vector-stores-chroma>=0.1.0
llama-index-embeddings-dashscope>=0.1.0

# PPTX 生成
python-pptx>=0.6.23

# 工作流持久化
langgraph-checkpoint-sqlite>=1.0.0

# 现有依赖 (保持)
fastapi>=0.109.0
uvicorn>=0.27.0
pydantic>=2.6.0
langgraph>=0.2.0
chromadb>=0.5.0
```

---

## 12. 执行建议

1. **按 Phase 顺序执行**，每完成一个阶段进行验收测试
2. **先实现后端 API**，用 Postman 测试通过后再开发前端
3. **准备测试数据**: 准备 5-10 份历史咨询报告放入 `data/historical_reports/`
4. **准备 PPT 模板**: 在 PowerPoint 中制作包含10种 Layout 的母版

---

## 附录: Claude Code 初始指令

```
请仔细阅读 docs/MASTER_ARCHITECTURE_V2.md，理解整个咨询工厂的架构。

现在，请按照 Phase 1 开始实施：
1. 创建 backend/lib/llamaindex/ 目录结构
2. 安装必要的依赖
3. 实现 LlamaIndex 文档处理器和索引构建器

注意：
- 使用 Qwen3-VL-Embedding (DashScope API)
- 支持 PDF/DOCX/PPTX 格式
- 持久化到 ChromaDB
```
