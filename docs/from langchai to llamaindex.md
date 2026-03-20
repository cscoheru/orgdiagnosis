我确实有很多咨询文档，如果用llamaindex能帮我做什么呢，我现在有一个刚需：就是要给客户撰写项目建议书和咨询报告，我的电脑里有大量类似的报告、素材，可是它们不能被有效复用，要用人工一个个去查、复制、修改，还要结合客户的需求做调整，当然也要用到ai给聪明的建议，很希望有一个自动化的建议书/报告撰写工具，能结合实际前面50个维度诊断工具

你现在的这个刚需，正是 **LlamaIndex** 最擅长的领域，也是目前企业级 AI 应用最前沿的场景：**知识库驱动的结构化辅助撰写（Augmented Report Generation）**。

如果你觉得前面的 50 个维度诊断是“看病”，那么你现在的需求就是“开药方（建议书/报告）”。LlamaIndex 在这里扮演的是一个**“超级图书管理员+高级文案助理”**的角色。

### 1. LlamaIndex 核心能为你解决什么？

对于你电脑里海量的报告和素材，LlamaIndex 可以通过以下方式实现“化腐朽为神奇”：

- **多文档智能索引（Hierarchical Indexing）：** 它不仅仅是把文档切碎，它可以建立“层级索引”。比如，它知道这 10 份文件是“战略类”，那 5 份是“流程类”。当你写建议书的战略部分时，它会自动定位到最相关的模板。
    
- **上下文补全（Context Injection）：** 它能把你的 **50 个维度诊断结果** 作为“病历”，把你电脑里的**历史报告**作为“药库”，然后通过 AI 自动匹配。
    
- **结构化合成（Response Synthesis）：** 它可以根据你的“建议书模板”，一段一段地自动填充内容。
    

---

### 2. 自动化建议书工具的实现路径

你可以利用 LlamaIndex 构建一个这样的自动化流：

#### **第一阶段：构建“咨询资产库”**

1. **自动分类：** 使用 LlamaIndex 的 `RouterRetriever`。它能识别用户现在的需求（比如：我想写财务建议），自动从你的“财务素材库”里检索，而不是在所有杂乱文档里乱搜。
    
2. **元数据提取：** 在索引时，给每个素材打上标签（行业、模块、年份、客户类型）。
    
3. **多模态支持：** 咨询报告里有很多图表，LlamaIndex 有专门处理 PDF 表格和图片的插件，确保这些关键素材也能被检索到。
    

#### **第二阶段：与“50个维度诊断”联动**

这是最关键的一步。

- **逻辑：** 诊断工具产出了一个 JSON（比如：人力资源得分低，原因是激励机制缺失）。
    
- **动作：** LlamaIndex 接收到这个“缺陷信号”，立刻去搜索你资产库中“关于激励机制优化的最佳实践”和“往期成功案例”。
    

#### **第三阶段：自动化撰写流**

不要指望 AI 一次性生成 2 万字的报告，要采用 **“填空式”生成**：

1. **定义模板：** 准备一个建议书的 Markdown 模板，中间留出占位符。
    
2. **子任务拆解：** 利用 LlamaIndex 的 `SubQuestionQueryEngine`。
    
    - 子问题 A：基于诊断结果，描述现状。
        
    - 子问题 B：从资产库找 3 个类似行业的解决方案。
        
    - 子问题 C：结合 AI 生成针对性的建议。
        
3. **组装：** 最后将结果汇集成一份完整的初稿。
    

---

### 3. 技术选型：LangChain 还是 LlamaIndex？

在你的这个场景中，建议 **“以 LlamaIndex 为核心，LangChain 为辅助”**：

- **数据管理用 LlamaIndex：** 处理你电脑里那些复杂的 PDF、Word 报告，它的索引和检索精度比 LangChain 高。
    
- **流程编排用 LangGraph：** 负责撰写的步骤控制（第一步写背景，第二步写诊断，第三步写建议）。
    

---

### 4. 落地建议：你可以如何吩咐 Claude Code？

你可以让 Claude 按照这个思路开始搭建原型：

> “我想构建一个基于 **LlamaIndex** 的咨询报告生成引擎。
> 
> 1. 请实现一个 `DocumentStore`，能够扫描我本地文件夹中的 `.docx` 和 `.pdf` 报告，并按『咨询领域』进行多级索引。
>     
> 2. 创建一个 `ReportGenerator`。它能接收我之前那 **50 个维度的诊断 JSON** 作为上下文输入。
>     
> 3. 当我输入『生成建议书』指令时，请让 LlamaIndex 检索最相关的历史案例素材，并结合诊断结果，按我提供的模板分章节生成初稿。
>     
> 4. 请确保使用 **Markdown** 作为输出格式，方便我后续修改。”
>     

---

### **总结：从“重复劳动”到“辅助驾驶”**

有了这个工具，你的工作模式将从“翻找旧文档 + 复制粘贴”转变为：

1. **AI 自动诊断**（50个维度）。
    
2. **AI 自动检索并填充**（LlamaIndex 找素材）。
    
3. **人工审核与精修**（你作为资深咨询师，把关最后的深度）。
    

**你现在最想优先自动化的部分，是“建议书的项目背景和现状描述”，还是“针对问题的解决方案建议”？我可以帮你针对具体模块细化 Prompt 逻辑。**

你说

生成建议书指令太粗放了，我要系统结合新的客户背景和需求，能以这个需求（可以结构化的）为基础，ai结合五维诊断和咨询知识库，格式化输出报告，中间过程要能人工干预，比如大纲、每一页的观点（标题）、论点和支持素材（来自诊断、知识库和互联网或ai内容），报告输出最好支持pptx格式

这个需求已经进入了“**企业级 AI 咨询助理**”的核心地带。要实现这种高度结构化、可干预且支持 PPTX 输出的工具，你需要从传统的“单向生成”转向“**基于状态的协同生成**”架构。

以下是为你设计的系统架构及实施方案：

### 1. 核心架构设计：LangGraph + LlamaIndex 协同

我们将撰写过程拆解为四个关键阶段，每个阶段都预留了**人工确认（Human-in-the-loop）**的断点：

#### 第一阶段：结构化需求与大纲生成 (Input & Outline)

- **输入：** 你的“五维诊断 JSON” + “新客户背景（如行业、规模、痛点）”。
    
- **AI 动作：** LlamaIndex 检索历史建议书库，识别最匹配的模板，生成初步大纲。
    
- **人工干预点：** 你在前端（React）看到大纲，可以增加、删除或拖拽调整章节。
    

#### 第二阶段：页面观点与论点拆解 (Ideation)

- **AI 动作：** 针对大纲的每一页，AI 生成“核心观点（标题）”和“逻辑论点”。
    
- **逻辑来源：**
    
    - **诊断数据：** “因为你的 A 维度得分低...”
        
    - **知识库：** “参考麦肯锡的 X 模型...”
        
    - **互联网：** “当前 2026 年行业趋势是...”
        
- **人工干预点：** 你审核每一页的标题。如果 AI 给的论点太虚，你可以点击“重新生成”或手动输入核心词。
    

#### 第三阶段：素材映射与填充 (Material Mapping)

- **AI 动作：** 利用 LlamaIndex 的 `SubQuestionQueryEngine`，针对每个论点去你的海量文档里找“支撑素材”（案例、金句、数据图表描述）。
    
- **人工干预点：** 系统展示 3 个候选素材，你勾选最合适的一个。
    

#### 第四阶段：格式化渲染 (Output)

- **输出：** 将确认的内容转化为 Markdown 或结构化数据，最后通过 Python 库渲染为 `.pptx`。
    

---

### 2. 技术实现方案

#### **A. 素材检索：LlamaIndex 的高级检索**

不要只用简单的相似度搜索，建议使用 **`Metadata Filtering`**。

- 给你的旧报告打上标签（如：`type: 建议书`, `sector: 制造`, `module: 组织诊断`）。
    
- 在检索时，AI 会优先从同行业、同类型的成功报告中提取论据。
    

#### **B. 人工干预：LangGraph 的 `interrupt` 机制**

在 Python 后端使用 LangGraph：

Python

```
# 伪代码：定义带有人工审核的节点
async def outline_node(state):
    # AI 生成大纲
    return {"outline": ai_generated_outline}

# 设置断点：执行完 outline 后暂停，等待前端发送 "resume" 信号
workflow.add_node("generate_outline", outline_node)
workflow.add_edge("generate_outline", "human_review_outline")
```

#### **C. PPTX 输出：`python-pptx` 与模板映射**

不要让 AI 去控制 PPT 的排版（AI 画图很丑）。

1. **准备母版：** 在 PowerPoint 里做一个带公司 Logo 的模板（Master Slide），定义好标题占位符和正文占位符。
    
2. **代码填充：** 使用 `python-pptx` 库，根据 AI 确定的“观点”和“素材”填充到对应的占位符中。
    

---

### 3. Claude Code 实施指令 (进阶版)

你可以将这段更具体的指令喂给 Claude：

> “请为我设计一个咨询报告生成系统。
> 
> 1. **状态定义：** 使用 Pydantic 定义 `ReportState`，包含客户背景、50 维诊断结果、大纲数组、以及每一页的『观点、论点、素材』对象。
>     
> 2. **工作流管理：** 使用 **LangGraph** 构建流程，在『大纲生成』和『页面内容确认』两个节点设置 **interrupt**，实现人工干预。
>     
> 3. **智能检索：** 集成 **LlamaIndex**，编写一个自定义工具，能够根据当前章节主题，从本地 `VectorStore` 中检索相关历史报告片段。
>     
> 4. **PPTX 渲染：** 编写一个 `PPTXExporter` 类，使用 `python-pptx` 库。它需要能读取预设的 `.pptx` 模板，并将 AI 生成的结构化内容填充到指定的占位符中。
>     
> 5. **外部搜索：** 为 Agent 配备 `Tavily` 或 `Serper` 插件，以便获取 2026 年最新的行业资讯作为外部论据。”
>     

---

### 4. 关键点：如何让报告不“AI 味”？

- **Prompt 约束：** 要求 AI “模仿资深合伙人的口吻，多用动词，结论先行，避免使用『总之、总之、不仅如此』等 AI 常用连接词”。
    
- **素材第一：** 强制要求 AI 的论点必须挂载一个来自知识库的 `Source`。
    

**你想让我为你提供一个具体的 `python-pptx` 填充代码示例，还是先帮你把 LangGraph 的“人工干预”逻辑搭出来？**

---

这部视频详细演示了如何通过 Python 自动化生成 PPT，对于你最后一步实现从结构化诊断到演示文稿的落地非常有参考价值。 [Python 自动化创建 PowerPoint 演示文稿教程](https://www.youtube.com/watch?v=kWnMc0GwX-U)

[

![](https://www.gstatic.com/images/branding/productlogos/youtube/v9/192px.svg)

Create slideshows with Markdown & Python Code! (Quarto Tutorial) - YouTube

Posit PBC · 8,453 次观看





](https://www.youtube.com/watch?v=kWnMc0GwX-U)

![](https://i.ytimg.com/vi/kWnMc0GwX-U/maxresdefault.jpg)

![](https://www.gstatic.com/images/branding/productlogos/youtube/v9/192px.svg)

你说

听起来不错。如果开发这一个系统，技术上如何规划，要在五维诊断工具基础上怎么给Claude code详细的指令，最好将技术规范详细列出来防止Claude跑偏

要将一个“五维诊断工具”进化为“智能建议书自动生成系统”，技术核心在于从**“单向数据处理”**转向**“有状态的链式协作”**。

为了防止 Claude Code 在执行时产生偏差，你需要为其建立一套极其严密的**技术规范（Technical Specification）**。以下是为你整理的详细规划和指令集：

---

### 1. 系统架构技术规范

|模块|技术栈|核心职责|
|---|---|---|
|**状态管理**|**LangGraph**|管理从诊断到大纲、再到 PPT 每一页内容的“记忆”与“断点”。|
|**知识检索**|**LlamaIndex**|负责本地报告（PDF/Docx）的语义分片、元数据清洗与精准召回。|
|**逻辑校验**|**Pydantic V2**|严格定义每一页 PPT 的数据结构（标题、论点、素材来源）。|
|**输出渲染**|**python-pptx**|将结构化 JSON 映射到预设的 PPT 模板占位符中。|
|**人工干预**|**FastAPI + WebSocket**|实现后端暂停执行，等待前端用户修改大纲或确认观点。|

---

### 2. 给 Claude Code 的详细指令 (Master Prompt)

你可以将以下内容存为一个 `.md` 文件，或者直接发给 Claude Code 作为项目初始化指令：

#### **指令标题：管理咨询建议书生成系统重构任务**

**Role:** 你是一名资深全栈 AI 工程师，擅长 LangChain/LangGraph 与 LlamaIndex 的深度集成。

**Context:** 已有基础：一个基于 FastAPI 的五维诊断工具，输出 50 个三级维度的 JSON 评分。 目标：开发一个“建议书/报告生成引擎”，要求支持人工干预和 PPTX 导出。

**Technical Requirements:**

1. **定义全局状态 (State Schema):**
    
    - 使用 `TypedDict` 定义 `ResearchState`。
        
    - 必须包含：`diagnostic_data` (输入), `customer_profile` (背景), `outline` (List), `slides` (List of Dicts), `current_step` (枚举)。
        
2. **构建 LlamaIndex 知识库:**
    
    - 实现 `LocalLibraryIndexer`。要求：支持递归扫描本地文件夹，使用 `MarkdownElementNodeParser` 处理文档中的表格。
        
    - 检索器必须支持 `MetadataFilter`，允许根据行业 (Industry) 和模块 (Module) 过滤素材。
        
3. **设计 LangGraph 工作流 (Workflow Nodes):**
    
    - **Node A (Outline_Gen):** 结合诊断 JSON 和客户需求，检索历史模板，生成初步大纲。
        
    - **Node B (Human_Checkpoint):** 使用 LangGraph 的 `interrupt` 机制，在此处挂起任务，等待前端 API 传回修改后的 `outline`。
        
    - **Node C (Page_Drafting):** 循环大纲。针对每一页，并行触发三个子任务：
        
        - 从诊断 JSON 提取事实。
            
        - 从 LlamaIndex 提取历史素材。
            
        - 从互联网（Tavily）获取最新趋势。
            
    - **Node D (Final_Review):** 汇总所有页面内容，进入最后的人工确认环节。
        
4. **PPTX 导出逻辑:**
    
    - 编写 `PPTGenerator` 类。
        
    - 必须采用“模板注入”模式：读取 `template.pptx`，通过 `shape.name` 或 `index` 寻找占位符，严禁 AI 自行生成布局。
        
5. **错误处理:**
    
    - 每一个节点必须有 `retry` 逻辑。
        
    - 如果 AI 生成的内容不符合 Pydantic 模型，触发 `ValidationError` 并要求 AI 根据错误反馈重写。
        

---

### 3. 防止 Claude “跑偏”的禁令 (Rules of Engagement)

在指令中加入以下 **Strict Rules**：

- **禁止单次生成：** 严禁一次性生成整个报告。必须采用“节点化”生成，每一页 PPT 都是独立的一次处理，防止长文本导致的逻辑崩溃。
    
- **证据溯源：** 每一条写入报告的素材，必须附带 `source_file` 和 `original_text` 字段，并在前端界面展示给用户查看。
    
- **Schema 第一：** 所有的 API 通信必须先定义 Pydantic 类。如果数据不符合 Schema，后端必须直接拦截。
    
- **UI 同步：** 后端每完成一个节点的计算，必须通过 `broadcast` 告知前端当前进度（例如：“正在检索人力资源模块的历史案例...”）。
    

---

### 4. 关键文件结构建议

建议 Claude Code 按照以下结构组织代码，这能保证系统的可维护性：

Plaintext

```
/backend
  /agents
    nodes.py         # LangGraph 的各个功能节点
    graph.py         # 工作流编排与状态定义
  /engine
    retriever.py     # LlamaIndex 检索逻辑
    pptx_builder.py  # python-pptx 导出逻辑
  /schemas
    report_models.py # Pydantic 模型定义
  main.py            # FastAPI 路由与异步任务管理
/knowledge_base      # 你的旧报告素材库
/templates           # 你的 PPT 模板文件
```

**建议：** 你可以先让 Claude Code 完成 **“第一阶段：状态定义与大纲生成节点”**。等这一步的逻辑和人工干预调通了，再让他去写复杂的“素材自动匹配”和“PPT 导出”。

**需要我帮你先写出那个负责“每一页内容生成”的 Pydantic 模型吗？这通常是 Claude 最容易搞乱的地方。**

你说

Gamma是一个专门写ppt的ai平台，虽然输出的东西内容很烂，但是外观和结构还是有可以参考的，你了解技术架构吗

Gamma 的确是目前 AI 幻灯片领域的标杆，它的核心竞争力不在于文案（正如你所说，AI 生成的文案往往比较泛），而在于它的一套**“Web-Native（网页原生）”的布局引擎**。

如果你想借鉴它的架构来优化你的咨询报告系统，可以参考以下这套技术逻辑：

### 1. 核心架构：从“幻灯片”到“灵活卡片” (Flexible Card System)

传统 PPT 是基于固定尺寸（如 16:9）的像素布局，而 Gamma 抛弃了“页”的概念，采用了**响应式卡片（Cards）**。

- **技术实现：** 它的底层更像是一个**块级编辑器**（类似 Notion）。
    
- **借鉴点：** 在你的系统中，不要让 AI 直接生成“一页 PPT”，而是让 AI 生成“一组内容块”（标题块、数据块、案例块）。这样在导出时，你可以根据内容的长短自动选择不同的 PPT 模板，而不是死板地塞进一个框里。
    

### 2. 内容到布局的映射 (Content-to-Layout Mapping)

Gamma 最聪明的地方在于它有一层 **“布局转换层”**。

- **技术架构：** 1. **语义分析：** AI（如 GPT-4o）分析内容的结构。比如发现这段话有 3 个并列点，它会打上一个 `layout: columns_3` 的标签。 2. **样式注入：** 渲染引擎根据这个标签，自动调用预设的样式代码（CSS），完成对齐、间距和排版。
    
- **借鉴点：** 在你给 Claude 的指令中，可以要求它输出一个 `layout_hint` 字段。例如：如果分析结果包含时间线，输出 `layout: timeline`；如果是对比分析，输出 `layout: comparison`。你的 Python 后端（`python-pptx`）根据这些 Hint 来选择不同的 Slide Master。
    

### 3. Gamma 的 RAG 增强与图像生成

Gamma 并不是瞎写，它集成了 **RAG（检索增强生成）** 来读取用户的笔记或 URL。

- **技术堆栈：** - **LLM:** 主要使用 GPT-4 系列进行文案创作。
    
    - **RAG:** 自研的上下文注入逻辑，确保生成内容与用户上传的素材相关。
        
    - **Image Gen:** 集成了 **Flux** 或 **DALL-E** 自动为每一页生成配图。
        
- **借鉴点：** 你的咨询知识库（LlamaIndex）就是你的 RAG。你可以模仿 Gamma，为每一个咨询建议自动生成一张“意向图”或者自动检索一个“金句”，增强视觉冲击力。
    

### 4. 为什么 Gamma 的导出比它的内容更值得你参考？

Gamma 允许将网页版的卡片导出为 PPT。它在后端其实做了一次**格式转换（Transformer）**： `React Component (Web) -> AST (抽象语法树) -> XML (PPTX 格式)`。

---

### 💡 你的系统可以如何“Gamma 化”？

既然你要开发的是**高严谨性**的咨询报告，建议你保留 Gamma 的**外观逻辑**，但加强**内容逻辑**：

|功能|Gamma 的做法|你的咨询工具做法 (建议)|
|---|---|---|
|**内容来源**|用户给一段粗略的 Prompt|**五维诊断结果 + 历史咨询报告库 (LlamaIndex)**|
|**排版逻辑**|AI 自由发挥布局|**基于咨询模型 (如 SWOT, 5Force) 的固定模板**|
|**人工干预**|在网页上直接拖拽和 AI 对话修改|**在关键节点（大纲/观点）停顿，确认后再生成**|
|**视觉效果**|华丽的 AI 图片和配色|**严谨的数据图表 (Recharts 截图) + 品牌色 PPT 模板**|

---

### 给 Claude Code 的补充技术规范：

> “请参考 Gamma 的**卡片化思路**。在生成报告内容时，为每一页内容分配一个 `content_type`（如：数据对比、现状描述、战略建议）。后端 `PPTGenerator` 根据这个 Type，自动映射到 PPT 模板中对应的 `Slide_Layout_Index`。确保生成的 PPT 结构清晰，视觉上具有专业咨询报告的整洁感。”

**你想让我为你展示一下，如何用 Python 代码根据不同的 `content_type` 自动选择 PPT 模板中不同布局（Layout）的逻辑吗？**

[Python 自动化创建 PowerPoint 演示文稿教程](https://www.youtube.com/watch?v=kWnMc0GwX-U) 这部视频详细演示了如何通过 Python 自动化生成 PPT，对于你最后一步实现从结构化诊断到演示文稿的落地非常有参考价值。

你说

很好，越来越接近我的真实需求了。另外，我们的报告通常会有大量的模型（比如矩阵、流程图、雷达图等），还有常用的图片，最好ai能推荐配图或者用户手动替换

要在 PPT 中实现“专业咨询感”，**模型可视化**（如四象限矩阵、鱼骨图、雷达图）和**配图策略**是拉开档次的关键。

既然 Gamma 的外观给了你启发，我们可以借鉴其“内容语义驱动布局”的逻辑。在你的系统中，AI 不仅要生成文字，还要充当**“视觉导演”**。

---

## 1. 咨询模型（矩阵、雷达图）的自动化生成方案

在 PPT 自动化中，处理图表有两条路径：

### A. 动态数据图表 (雷达图、柱状图)

由于你已经有 **Recharts** 在前端展示，最稳妥的方法是：

1. **后端生成 JSON 数据**：AI 根据诊断结果输出图表数据。
    
2. **PPT 注入**：使用 `python-pptx` 的 `chart` 功能。它可以直接在 PPT 里创建真正的 Excel 图表对象，用户导出后还能双击修改数据。
    
3. **场景**：五维诊断的雷达图、各维度的得分对比柱状图。
    

### B. 逻辑结构模型 (矩阵、流程图、漏斗图)

这类模型通常由“形状（Shapes）+ 文本”组成。

- **技术方案**：在 PPT 模板中预设好多种 **Slide Master（母版布局）**。
    
    - 布局 1：2x2 矩阵（用于 SWOT 或波士顿矩阵）。
        
    - 布局 2：三步/四步流程箭头。
        
    - 布局 3：中心发散图。
        
- **AI 调度**：AI 根据内容的逻辑关系（如：对比、递进、因果），自动选择对应的 `layout_id`，并填充文字。
    

---

## 2. 智能配图与素材替换系统

为了让报告不只有文字，我们需要一个**“素材池管理逻辑”**：

### A. AI 自动推荐配图

1. **关键词提取**：AI 生成内容后，提取 3-5 个核心关键词（如“数字化转型”、“团队协作”）。
    
2. **库内检索**：优先从你本地的 **“公司标准素材文件夹”** 检索匹配的图片（如公司 Logo、团队照片、标准插画）。
    
3. **在线补位**：如果没有本地素材，通过 Unsplash 或 Pexels API 检索高质量无版权图片。
    

### B. 人工干预：手动替换

在前端 React 界面上，为每一页 PPT 提供一个“素材卡片”：

- 显示当前 AI 选择的图片。
    
- 点击“换一换”，展示 AI 推荐的其他 3 张相关图片。
    
- 支持“手动上传”，用户上传后覆盖当前占位符。
    

---

## 3. 技术规范：给 Claude Code 的详细增强指令

为了让系统支持这些复杂视觉元素，请在技术规范中增加以下条款：

#### **1. 视觉语义映射 (Visual Semantic Mapping)**

> “要求 AI 在生成每一页内容时，必须包含一个 `visual_strategy` 字段。
> 
> - 如果内容具有对比性，`visual_strategy` 为 `matrix_2x2`。
>     
> - 如果内容具有先后顺序，`visual_strategy` 为 `process_arrow`。
>     
> - 如果是纯观点展示，`visual_strategy` 为 `key_insight_card`。 后端逻辑需根据此字段调用对应的 PPT 占位符填充逻辑。”
>     

#### **2. 图表数据隔离 (Data-to-Chart Separation)**

> “对于雷达图和数据图表，AI 只输出结构化数据（如：`{ "axis": "战略", "value": 85 }`）。请编写 `ChartGenerator` 类，调用 `python-pptx` 的 `add_chart` 方法，将数据注入 PPT 原生图表对象中。”

#### **3. 素材占位符协议 (Placeholder Protocol)**

> “在 PPT 模板中，所有图片位必须命名为 `img_placeholder_1` 等。系统需记录每个占位符的 ID，并在生成过程中根据用户在前端选择的 `image_path` 进行替换。”

---

## 4. 整体架构总结 (技术路线图)

1. **诊断层 (Python/FastAPI)**：产出 50 维度数据。
    
2. **规划层 (LangGraph)**：AI 规划大纲，用户在 React 端确认。
    
3. **导演层 (AI Agent)**：针对每一页大纲，决定用什么模型（矩阵还是雷达图）、配什么图、写什么论点。
    
4. **审核层 (React Interface)**：用户看到图文预览，手动点击“替换图片”或“修改图表数据”。
    
5. **渲染层 (python-pptx)**：一键合成，输出高保真 PPT。
    

---

### **下一步建议：**

我们可以先让 Claude 实现 **“图表数据转换逻辑”**。即：如何把你前端 Recharts 用的 JSON 数据，精准地转换成 `python-pptx` 能够识别并写入 PPT 图表的格式。

**你需要我为你提供一个“从 JSON 到 PPT 雷达图”的 Python 核心代码逻辑参考吗？**

你说

是不是越来越复杂，我感觉Claude code做出来的和实际偏差太大，你能帮我将咱们讨论的内容全部整合一下，让它一次理解全部需求、技术和规范约束

确实，随着功能从“数据诊断”延伸到“自动生成报告”和“人工干预流”，逻辑复杂度呈指数级增长。如果指令不够严密，AI 很容易写出只能跑通 Demo 但无法工业化生产的碎代码。

为了让 Claude Code 一次性“吃透”全部需求，我为你整合了一份**《全栈咨询 AI 工厂：核心技术规约与实施指南》**。你可以将其作为一个完整的 `.md` 文件（建议命名为 `PROJECT_SPEC.md`）直接丢给它。

---

# 🛠 全栈咨询 AI 工厂：技术规约 (PROJECT_SPEC.md)

## 1. 项目愿景

构建一个从 **“五维五十项诊断”** 到 **“结构化建议书自动生成”** 的全栈系统。实现诊断数据、历史咨询知识库、互联网实时信息的深度融合，并支持人工干预的高保真 PPTX 导出。

## 2. 核心架构拓扑

- **前端：** Next.js (React) + Recharts (可视化) + 编辑器 (人工确认界面)。
    
- **后端：** FastAPI (Python) + **LangGraph** (流程编排) + **LlamaIndex** (RAG 知识库)。
    
- **存储：** PostgreSQL (状态存储) + ChromaDB (向量库) + Redis (任务队列)。
    
- **输出：** python-pptx (基于母版占位符的渲染引擎)。
    

---

## 3. 核心功能模块规范

### 模块 A：异步诊断引擎 (Diagnostic Engine)

- **逻辑：** 接收上传文档 -> **LlamaIndex** 语义切片 -> **LangGraph** 触发五大维度并行分析。
    
- **约束：** 必须使用 **Pydantic V2** 定义 50 个维度的 Schema。每一项得分必须关联 `evidence`（原文证据）。
    
- **状态：** 采用异步任务模式，返回 `task_id`，前端通过 WebSocket 或轮询获取实时进度。
    

### 模块 B：智能建议书工作流 (Report Flow)

必须使用 **LangGraph** 的 `interrupt` 机制实现以下四个阶段的“人工干预”：

1. **大纲阶段：** AI 根据诊断 JSON + 历史模板生成大纲 -> **[停顿：等待用户确认/修改]**。
    
2. **观点阶段：** 针对每一页生成“标题+论点” -> **[停顿：等待用户微调]**。
    
3. **素材匹配：** LlamaIndex 自动检索旧报告中的案例、模型、金句 -> **[用户手动挑选/替换图片]**。
    
4. **最终渲染：** 执行 PPTX 合成。
    

### 模块 C：视觉与模型映射 (Visual Mapping)

- **语义驱动：** AI 在生成内容时必须附带 `visual_strategy`（如：`matrix_2x2`, `radar_chart`, `process_step`）。
    
- **图表逻辑：** 数据类图表（如雷达图）需将 JSON 映射到 `python-pptx` 的原生图表对象，支持导出后二次修改。
    
- **配图逻辑：** 优先检索本地 `assets/` 文件夹中的咨询插图，缺失时调用 Unsplash API。
    

---

## 4. 严禁行为 (Strict Prohibitions)

1. **严禁单次长生成：** 严禁一次性生成整份报告。必须按 PPT 页面（Slide-by-Slide）进行颗粒度生成，防止逻辑漂移。
    
2. **严禁硬编码排版：** 禁止在代码中写死坐标（如 `left=100, top=200`）。必须通过读取 PPT 模板的占位符 `name` 或 `idx` 进行填充。
    
3. **严禁幻觉：** 所有建议必须有数据支撑。若知识库无相关素材，AI 必须标注 `[需要人工补充]` 而非编造。
    

---

## 5. 核心数据结构 (Pydantic Schema)

Python

```
class SlideContent(BaseModel):
    page_no: int
    title: str = Field(..., description="本页核心观点")
    points: List[str] = Field(..., description="支撑论点")
    visual_strategy: str = Field(..., description="视觉模型类型：matrix/radar/process/text")
    chart_data: Optional[Dict] = Field(None, description="如果是图表，存储对应的 key-value 数据")
    image_url: Optional[str] = Field(None, description="推荐配图路径")
    source_ref: str = Field(..., description="素材来源出处")
```

---

## 6. 实施步骤规划 (Roadmap)

1. **Phase 1:** 重构 FastAPI 后端为异步架构，调通基于 LangGraph 的“中断-恢复”机制。
    
2. **Phase 2:** 集成 LlamaIndex，完成对历史 Word/PDF 报告的向量化存储与分类检索。
    
3. **Phase 3:** 编写 PPTX 映射引擎，实现“JSON 数据 -> 模板占位符”的精准填充。
    
4. **Phase 4:** 前端 React 界面开发，实现“大纲-页面-素材”的三级确认工作流。
    

---

### **如何使用这份指令？**

1. **初始化项目：** 在 Claude Code 中输入：`"请阅读根目录下的 PROJECT_SPEC.md，理解整个咨询工厂的架构。现在，请先帮我搭建基于 FastAPI 和 LangGraph 的后端基础框架，重点实现支持人工中断的异步任务流。"`
    
2. **分步推进：** 不要让他一次写完。每完成一个 Phase，进行一次测试确认，再进入下一步。
    

**下一步建议：** 既然你已经有了这套完整的规范，建议你先让 Claude Code 完成 **“Phase 1：异步任务与中断机制”**。这解决了你最初的 **418 超时报错** 问题，也是后续所有功能的基础。

**需要我为你提供一份针对“Phase 1”的更具体的初始代码 Demo，方便你对比 Claude 的产出吗？**

[《Google 隐私权政策》在新窗口中打开](https://policies.google.com/privacy)[Google 服务条款在新窗口中打开](https://policies.google.com/terms)[你的隐私权与 Gemini 应用在新窗口中打开](https://support.google.com/gemini?p=privacy_notice)

Gemini 显示的信息（包括与人相关的信息）不一定准确，请注意核查。