


这是一个极为激动人心且切中咨询行业“最大痛点”的升级！

你正在从一个**“诊断工具（SaaS）”**跨越到**“咨询师的超级副驾（Copilot Workspace）”**。你的需求非常清晰：**打通历史资产、实现人机协同（Human-in-the-loop）、最终输出 Gamma 级别的可交付 PPTX。**

为了将你现有的“五维诊断系统”（附件2）和“异步大模型架构”（附件1）完美融合到这个新需求中，我们需要对系统进行一次**架构级的升维**。

---

### 一、 核心痛点拆解与技术解法

#### 1. LlamaIndex 到底能帮你做什么？（盘活你的历史报告）
*   **痛点**：你有几百份过去写好的优秀 PPT、行业分析、建议书，现在都躺在硬盘里睡大觉。
*   **LlamaIndex 的魔法**：它是一个极其强大的“数据连接器”。
    *   它可以直接读取你的 `.pptx`, `.docx`, `.pdf` 文件。
    *   它可以做到**“层级检索”**：比如当你需要写“绩效考核优化方案”时，LlamaIndex 可以精准地从你 2024 年做过的某份 PPT 中，把那张**“KPI 分解漏斗图”及配套文字**直接抽出来喂给 AI。
    *   **结论**：LlamaIndex 是你的“超级资料管理员”，它替代了你现在“Ctrl+F 搜索硬盘文件夹 -> 复制 -> 粘贴”的体力活。

#### 2. 人机协同（Human-in-the-loop）：如何避免 AI “脱缰”？
*   **痛点**：直接让 AI 生成一份 50 页的报告，结果一定是一堆没用的废话，且无法修改。
*   **解法**：利用 **LangGraph 的“状态中断 (Breakpoint)”机制**。
    *   我们将生成过程分为三步：**生成大纲 -> 生成单页草稿 -> 渲染 PPT**。
    *   每完成一步，后端暂停（Pause），将控制权交还给前端（你）。你在前端修改了大纲标题后，点击“继续”，AI 才会拿着你修改后的大纲去写具体的每一页。

#### 3. PPTX 输出与 Gamma 级视觉体验
*   **痛点**：AI 生成文字容易，生成精美的 PPT 模型和排版极难。
*   **解法**：**模板驱动 (Template-Driven) + python-pptx**。
    *   **不要指望 AI 用代码去画精美的图形**。正确的做法是：你预先制作一个包含各种版式（如：金字塔模型、三列对比图、SWOT 矩阵）的**母版 PPTX (Template)**。
    *   AI 的任务是：判断当前页面适合哪种版式（比如它输出 `layout_type: "pyramid"`），然后生成对应的文字。
    *   后端的 `python-pptx` 库负责把 AI 生成的文字“填”到你那个精美的母版里。

---

### 二、 终极 Claude Code 实施指令 (Copilot 架构)

请将以下内容保存为 **`MASTER_ARCHITECTURE_V2.md`**。这个指令已经将你的**五维诊断结果**作为输入源，整合了 **LlamaIndex**、**LangGraph 交互式工作流** 和 **PPTX 引擎**。

在终端中告诉 Claude Code：“请仔细阅读 `MASTER_ARCHITECTURE_V2.md`，这覆盖了我们之前的五维诊断系统，并引入了全新的报告生成器。请按照 Phase 1 开始实施。”

--- 👇 复制以下内容 👇 ---

# Project Context: DeepConsult Copilot & PPTX Generator
在已有的“五维组织诊断工具”基础上，我们要构建一个**“咨询建议书与报告智能协同生成系统 (Human-in-the-loop Copilot)”**。
系统将结合：1. 客户的 5D 诊断结果；2. 客户背景需求；3. 利用 **LlamaIndex** 检索的历史咨询文档库，生成具备高专业度、Gamma 级别排版逻辑的 `.pptx` 报告。

## 1. Tech Stack Additions (新增技术栈)
- **Document Indexing**: **LlamaIndex** (用于解析本地历史 PPTX/DOCX 报告，构建私有咨询知识图谱)。
- **Report Generation**: **python-pptx** (用于基于预设母版模板，将结构化 JSON 渲染为原生可编辑的 PPTX 文件)。
- **Workflow State**: **LangGraph Checkpointer** (用于实现前端暂停、人工修改大纲后继续生成的 Human-in-the-loop 机制)。

## 2. Core Copilot Workflow (人机协同三步走机制)

### 步骤 A：上下文聚合与大纲生成 (Outline Generation)
- **Input**: 客户基础信息 + 五维诊断 JSON 结果 + 客户特定需求文本。
- **AI Action**: 调用大模型生成一份 PPT 大纲（包含页数、每页标题、核心目的）。
- **Human Action**: 前端渲染一个“可拖拽/可编辑的大纲树”。用户可以修改标题、增删页面。点击“确认大纲”。

### 步骤 B：基于 LlamaIndex 的单页内容填充 (Content Drafting)
- **Input**: 用户确认后的大纲。
- **AI Action**: 针对大纲的**每一页**：
  1. 通过 LlamaIndex 在历史资料库中检索相似项目的框架或素材。
  2. 生成单页的强结构化数据（论点、论据、推荐配图要求）。
  3. **布局推荐**：AI 必须从预设的模型库中推荐一个版式（如 `layout: "smartart_process"`, `layout: "matrix_2x2"`）。
- **Human Action**: 前端渲染“单页编辑器”。用户可以看到 AI 检索引用的历史来源（evidence），可以手动修改文字，或者更换 AI 推荐的模型版式。点击“生成 PPT”。

### 步骤 C：PPTX 渲染引擎 (Render & Export)
- **Input**: 最终确认的所有页面 JSON 数据。
- **Backend Action**: 使用 `python-pptx` 加载 `template.pptx`，根据每页的 `layout` 字段匹配对应的 Slide Master，将文字和占位图填入，返回文件下载流。

## 3. Pydantic Schemas (核心数据契约 - 严禁偏离)
**必须在 `backend/schemas/report.py` 中严格实现以下模型，确保全链路结构化：**

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Literal

# 预设的版式库（对应 PPT 母版中的 Layout）
LayoutType = Literal[
    "title_slide", 
    "bullet_points", 
    "two_columns", 
    "funnel_model", 
    "swot_matrix", 
    "process_flow", 
    "five_dimensions_radar"
]

class SlideDraft(BaseModel):
    """单页 PPT 的内容草稿"""
    slide_id: str
    layout: LayoutType = Field(..., description="AI 推荐的最适合展现此内容的 PPT 版式")
    title: str = Field(..., description="页面主标题，如'薪酬体系现状与痛点'")
    key_message: str = Field(..., description="页面顶部的核心观点 (Action Title)")
    bullets: List[str] = Field(..., description="核心论点或数据支撑，不超过 5 条")
    retrieved_evidence: Optional[str] = Field(None, description="从 LlamaIndex 检索到的历史项目参考素材原文")
    image_prompt: Optional[str] = Field(None, description="推荐配图的提示词或占位说明")

class ReportDraft(BaseModel):
    """整个报告的草稿"""
    report_id: str
    client_name: str
    slides: List[SlideDraft]
```

## 4. LangGraph API Design (交互式 API 设计)
后端的 FastAPI 必须支持这种“分步中断”机制。请实现以下路由：

1. `POST /api/report/generate-outline`: 接收诊断数据，返回大纲 JSON。
2. `POST /api/report/generate-slides`: 接收用户修改后的大纲，结合 LlamaIndex 检索，返回 `ReportDraft` JSON。
3. `POST /api/report/export-pptx`: 接收最终审核过的 `ReportDraft`，调用 `python-pptx` 生成文件并返回下载。

## 5. Development Phases (开发步骤)

### Phase 1: LlamaIndex 资产库构建 (The Knowledge Engine)
- 配置 LlamaIndex 读取一个本地目录（如 `data/historical_reports/`）。
- 重点：需要使用针对 PPT 优化的 Loader（如 `LlamaParse` 或 `PptxReader`），保留历史报告中的层级和逻辑。
- 建立向量索引并持久化。

### Phase 2: LangGraph & Pydantic 核心流 (The Copilot Brain)
- 根据上述定义，实现大纲生成和单页草稿生成的逻辑。
- 在单页生成节点中，必须注入 LlamaIndex 的 `query_engine`，要求 AI 结合检索到的历史知识和传入的“五维诊断数据”进行创作。

### Phase 3: PPTX 渲染引擎 (The Visual Generator)
- 编写 `services/pptx_renderer.py`。
- 逻辑要求：加载一个空白的但包含了多种版式（Layouts）的 PPTX 模板。根据 JSON 中的 `layout` 字段，动态选择版式并填充 `title` 和 `bullets`。

### Phase 4: 前端交互台 (The Workspace UI)
- 在 Next.js 中实现一个类似 Notion / Gamma 的分栏编辑器。
- 左侧显示大纲树，中间是单页内容的表单编辑，右侧显示 LlamaIndex 找出的“参考素材（Reference）”。

--- 👆 复制到此结束 👆 ---

### 💡 项目经理的“避坑”指南（务必阅读）

1.  **关于 PPTX 中的“模型”（SmartArt 等）**：
    *   **千万不要**让 Python 代码去从零画图表（画出来的极丑且容易报错）。
    *   **正确做法**：你自己打开 PowerPoint，新建一个文件，在**“幻灯片母版”**里，建好几个版式：一个是三列对比，一个是漏斗图，一个是五维雷达图。并在里面放好**“文本占位符”**。
    *   通过 `python-pptx`，我们只需要告诉代码：“这页用第 3 个版式，把标题填到占位符 A，把要点填到占位符 B。” 这样出来的 PPT 就是绝对专业且可编辑的！
2.  **关于 LlamaIndex 的准备**：
    *   把你过去写得最好的 10-20 份无机密信息的咨询报告（PPT或PDF），建一个文件夹放进去。LlamaIndex 会把它们变成你这个系统最核心的**“数字咨询师大脑”**。
3.  **UI 交互体验（Gamma 体验）**：
    *   在前端部分，你现在的精力不需要放在“怎么让页面直接渲染得像 PPT 一样好看”，而是做一个**“高效的表单编辑器”**。重点是让你可以方便地修改 AI 生成的 `Key Message`（核心观点），因为这才是咨询报告的灵魂。排版交给后端的 PPTX 引擎去套模板。

这个重构计划直接瞄准了**“知识复用”**和**“自动化交付”**两个高客单价 B 端服务的命门。你可以开始将这段指令发给 Claude Code，我们先从 **Phase 1 的 LlamaIndex 知识库构建** 开始打地基！