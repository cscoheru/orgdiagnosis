这是一个非常专业的**管理咨询 AI 化**工程方案。为了让 Claude Code（或类似的 AI 编码助手）能够精准执行这个复杂的异步 + 结构化架构，你需要给它一个具备**架构拓扑、数据 Schema 和执行逻辑**的深度指令。

你可以直接复制以下指令发送给 Claude Code：

---

## 🛠 Claude Code 实施指令

### **Project Context**

我正在开发一个管理咨询诊断工具。目前遇到了大文件分析导致的 **HTTP 超时 (404/418)** 以及 **AI 映射维度过多 (50+ 三级维度)** 导致的逻辑混乱。我们需要将目前的同步架构重构为**基于 FastAPI BackgroundTasks 的异步任务流**，并引入 **RAG 预处理**。

### **Task Requirements**

#### **1. 架构重构 (FastAPI Backend)**

- **异步化：** 修改 `/analyze` 接口。接收文件后，立即生成一个 `task_id` 并存入状态字典/数据库，返回 `{"task_id": "...", "status": "pending"}`。
    
- **后台任务：** 使用 `BackgroundTasks` 调用分析函数。分析过程需实时更新全局状态（或 Redis），供前端通过 `GET /status/{task_id}` 轮询。
    
- **结构化输出：** 使用 `pydantic` 定义 `DiagnosticResult` 模型，包含 5 个一级维度，下层嵌套 20 个二级和 50 个三级维度。强制 AI 使用 **OpenAI Structured Outputs (json_mode)**。
    

#### **2. 数据预处理流水线 (Data Pipeline)**

请实现一个 `DocumentProcessor` 类，包含以下逻辑：

- **Cleaning:** 使用 `PyMuPDF` 或 `Unstructured` 提取文本，识别并保留 Markdown 标题层级。
    
- **Chunking:** 采用 **Semantic Chunking**。优先按 Markdown 标题切分，确保管理咨询的逻辑块（如“组织架构分析”）不被截断。
    
- **Local Filtering:** 在调用大模型前，先用关键词匹配（Regex）初步筛选出与特定维度相关的文本片段，减少 Token 浪费。
    

#### **3. 诊断映射策略 (AI Logic)**

- **分片扫描：** 不要一次性把全文本丢给 AI。请实现一个**循环映射机制**：
    
    1. 针对每一个“一级维度”，从向量池/文本块中检索相关内容。
        
    2. 调用 LLM 填充该维度下的三级指标分数及 `evidence`（原文证据）。
        
    3. 最后汇总生成完整的 JSON 仪表盘数据。
        

#### **4. 前端对接建议 (React + Recharts)**

- 请生成一个 React Hook `useDiagnosticTask`，支持：
    
    - 上传文件后自动开始轮询 `/status/{task_id}`。
        
    - 根据进度百分比更新 `recharts` 仪表盘的加载状态。
        

---

### **Constraints**

- **No Hallucinations:** 必须在 Pydantic 模型中要求 AI 返回 `evidence` 字段，摘录原文。
    
- **Error Handling:** 处理分析中途模型崩溃的情况，确保任务状态能更新为 `failed` 而不是挂死。
    
- **Performance:** 尽量使用并发（`asyncio.gather`）来同时分析不同的维度。
    

---

## 💡 给你的额外建议

在 Claude Code 执行时，你可以让他先从 **定义 Pydantic Schema** 开始。因为你的诊断工具核心是那 **50 个维度**，只有数据结构稳住了，后续的 AI 映射才不会乱。