# LangChain + LangGraph 架构升级方案

> 日期: 2026-03-18
> 状态: 规划中

## 背景

当前系统在处理 50 个维度的组织诊断时面临以下问题：

| 问题 | 影响 | 根本原因 |
|------|------|---------|
| **AI 分析超时** | 418 错误，用户体验差 | 一次性分析 50 个维度，Token 消耗巨大 |
| **逻辑漂移/幻觉** | 评分不准确 | AI 缺乏上下文约束，没有证据支撑 |
| **无法断点续传** | 网络中断需重头开始 | 同步架构，无状态持久化 |
| **Token 浪费** | 成本高 | 全文喂给 AI，未做智能检索 |

## 解决方案：LangChain 三剑客架构

```
┌─────────────────────────────────────────────────────────────┐
│                    LangChain 生态架构                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              LangGraph (大脑逻辑层)                   │   │
│  │  • 状态机管理 50 个维度分析流程                        │   │
│  │  • Checkpointer 断点续传                              │   │
│  │  • 条件分支：数据不足 → 返回检索                       │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────┴─────────────────────────────┐   │
│  │              LangChain (工具箱层)                     │   │
│  │  • Document Loaders (PDF/Word 解析)                  │   │
│  │  • Text Splitters (语义分片)                         │   │
│  │  • Vector Stores (ChromaDB 检索)                     │   │
│  │  • Output Parsers (Pydantic 强制输出)                │   │
│  └───────────────────────┬─────────────────────────────┘   │
│                          │                                  │
│  ┌───────────────────────┴─────────────────────────────┐   │
│  │              LangSmith (可选监控层)                   │   │
│  │  • 追踪每个维度的推理过程                              │   │
│  │  • 调试 AI 决策路径                                   │   │
│  │  • 开发期必用，生产期可选                              │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 三剑客分工

| 组件 | 角色 | 解决的问题 |
|------|------|-----------|
| **LangChain** | 工具箱 | 文档解析、语义分片、向量检索、Pydantic 强制输出 |
| **LangGraph** | 大脑逻辑 | 50 维度状态机、断点续传、条件分支 |
| **LangSmith** | 监控 (可选) | 追踪推理过程、调试 AI 决策路径 |

## 核心数据模型 (Pydantic Schema)

```python
from pydantic import BaseModel, Field
from typing import List

class TertiaryDimension(BaseModel):
    """三级维度：最细颗粒度的评分"""
    name: str = Field(..., description="三级维度名称")
    score: int = Field(..., ge=0, le=100, description="0-100的评分")
    evidence: str = Field(..., description="从原文中摘录的支撑性证据")
    analysis: str = Field(..., description="简短的诊断意见")
    confidence: str = Field(default="medium", description="置信度: high/medium/low")

class SecondaryDimension(BaseModel):
    """二级维度：汇总三级维度的结果"""
    name: str
    tertiary_metrics: List[TertiaryDimension]
    avg_score: float = Field(..., description="该二级维度的平均分")

class PrimaryDimension(BaseModel):
    """一级维度：管理咨询的五大核心维度之一"""
    category: str = Field(..., description="战略/组织/绩效/薪酬/人才")
    secondary_metrics: List[SecondaryDimension]
    summary_insight: str = Field(..., description="综合管理建议")

class ConsultationDiagnosticReport(BaseModel):
    """最终完整的诊断报告结构"""
    task_id: str
    report_name: str
    dimensions: List[PrimaryDimension]
    total_score: float
```

## LangGraph 状态机工作流

```
┌─────────────────────────────────────────────────────────────┐
│                    诊断工作流状态机                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│   │ 文档加载  │────▶│ 语义分片  │────▶│ 向量存储  │           │
│   └──────────┘     └──────────┘     └──────────┘           │
│                                          │                  │
│                                          ▼                  │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐           │
│   │ 汇总报告  │◀────│ 人才维度  │◀────│ 薪酬维度  │           │
│   └──────────┘     └──────────┘     └──────────┘           │
│        │                ▲                ▲                  │
│        │                │                │                  │
│        │          ┌──────────┐     ┌──────────┐            │
│        │          │ 绩效维度  │◀────│ 组织维度  │            │
│        │          └──────────┘     └──────────┘            │
│        │                ▲                ▲                  │
│        │                │                │                  │
│        │          ┌──────────┐           │                  │
│        └─────────▶│ 战略维度  │───────────┘                  │
│                    └──────────┘                              │
│                         │                                    │
│                         ▼                                    │
│                  ┌──────────┐                               │
│                  │ 数据不足? │──Yes──▶ 返回检索相关文档      │
│                  └──────────┘                               │
│                         │ No                                │
│                         ▼                                    │
│                  继续下一维度                                 │
│                                                             │
│   ★ Checkpointer: 每完成一个维度自动保存进度                 │
│   ★ 断点续传: 网络中断后从最后一个完成的维度继续              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 技术选型

### LangChain 组件

| 组件 | 选择 | 说明 |
|------|------|------|
| **Document Loader** | `PyMuPDFLoader` / `UnstructuredFileLoader` | PDF/Word 文档解析 |
| **Text Splitter** | `MarkdownHeaderTextSplitter` | 按 Markdown 标题层级切分，保持语义完整性 |
| **Embeddings** | `OpenAIEmbeddings` 或 `BGE-M3` (本地) | 向量化模型 |
| **Vector Store** | `ChromaDB` | 本地持久化，免费 |
| **Output Parser** | `PydanticOutputParser` | 强制 JSON 输出格式 |

### LangGraph 组件

| 组件 | 选择 | 说明 |
|------|------|------|
| **State** | `TypedDict` | 存储 50 个维度评分 + 原始文档 |
| **Nodes** | 5 个维度分析函数 | 战略/组织/绩效/薪酬/人才 |
| **Checkpointer** | `SqliteSaver` | 断点续传持久化 |
| **Edges** | 条件边 | 数据不足时返回检索 |

## 实施路径

### Phase 1: 基础设施 (1-2 天)

```bash
# 安装依赖
pip install langchain langgraph chromadb langchain-openai langchain-community
pip install pymupdf unstructured  # 文档解析
```

**目录结构：**

```
backend/
├── lib/
│   ├── langchain/
│   │   ├── __init__.py
│   │   ├── processor.py      # 文档处理管道
│   │   ├── vectorstore.py    # ChromaDB 封装
│   │   └── schemas.py        # Pydantic 模型
│   └── langgraph/
│       ├── __init__.py
│       ├── state.py          # DiagnosticState 定义
│       ├── workflow.py       # 状态机工作流
│       └── nodes/
│           ├── __init__.py
│           ├── strategy.py   # 战略维度分析
│           ├── structure.py  # 组织维度分析
│           ├── performance.py # 绩效维度分析
│           ├── compensation.py # 薪酬维度分析
│           └── talent.py     # 人才维度分析
```

### Phase 2: 文档处理管道 (2-3 天)

**核心类：`DocumentProcessor`**

```python
from langchain_community.document_loaders import PyMuPDFLoader, UnstructuredFileLoader
from langchain_text_splitters import MarkdownHeaderTextSplitter
from langchain_openai import OpenAIEmbeddings
from langchain_community.vectorstores import Chroma

class DocumentProcessor:
    def __init__(self, persist_dir: str = "./chroma_db"):
        self.embeddings = OpenAIEmbeddings()
        self.persist_dir = persist_dir
        self.vectorstore = None

    def load_document(self, file_path: str) -> List[Document]:
        """加载文档（支持 PDF/Word）"""
        if file_path.endswith('.pdf'):
            loader = PyMuPDFLoader(file_path)
        else:
            loader = UnstructuredFileLoader(file_path)
        return loader.load()

    def split_by_headers(self, documents: List[Document]) -> List[Document]:
        """按 Markdown 标题层级切分"""
        splitter = MarkdownHeaderTextSplitter(
            headers_to_split_on=[("#", "h1"), ("##", "h2"), ("###", "h3")]
        )
        return splitter.split_documents(documents)

    def build_vectorstore(self, documents: List[Document]):
        """构建向量存储"""
        self.vectorstore = Chroma.from_documents(
            documents,
            self.embeddings,
            persist_directory=self.persist_dir
        )
        return self.vectorstore

    def retrieve(self, query: str, k: int = 5) -> List[Document]:
        """检索相关文档片段"""
        return self.vectorstore.similarity_search(query, k=k)
```

### Phase 3: LangGraph 工作流 (3-4 天)

**状态定义：**

```python
from typing import TypedDict, List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

class DiagnosticState(TypedDict):
    """诊断工作流状态"""
    task_id: str
    raw_text: str
    documents: List[Any]  # 分片后的文档
    vectorstore: Any      # ChromaDB 实例

    # 五维结果
    strategy_result: Optional[Dict]
    structure_result: Optional[Dict]
    performance_result: Optional[Dict]
    compensation_result: Optional[Dict]
    talent_result: Optional[Dict]

    # 进度追踪
    current_dimension: str
    completed_dimensions: List[str]
    error: Optional[str]
```

**工作流定义：**

```python
from langgraph.checkpoint.sqlite import SqliteSaver

def create_diagnostic_workflow():
    """创建诊断工作流"""
    workflow = StateGraph(DiagnosticState)

    # 添加节点
    workflow.add_node("load_documents", load_documents_node)
    workflow.add_node("split_documents", split_documents_node)
    workflow.add_node("build_vectorstore", build_vectorstore_node)
    workflow.add_node("analyze_strategy", analyze_strategy_node)
    workflow.add_node("analyze_structure", analyze_structure_node)
    workflow.add_node("analyze_performance", analyze_performance_node)
    workflow.add_node("analyze_compensation", analyze_compensation_node)
    workflow.add_node("analyze_talent", analyze_talent_node)
    workflow.add_node("generate_report", generate_report_node)

    # 定义边
    workflow.set_entry_point("load_documents")
    workflow.add_edge("load_documents", "split_documents")
    workflow.add_edge("split_documents", "build_vectorstore")
    workflow.add_edge("build_vectorstore", "analyze_strategy")
    workflow.add_edge("analyze_strategy", "analyze_structure")
    workflow.add_edge("analyze_structure", "analyze_performance")
    workflow.add_edge("analyze_performance", "analyze_compensation")
    workflow.add_edge("analyze_compensation", "analyze_talent")
    workflow.add_edge("analyze_talent", "generate_report")
    workflow.add_edge("generate_report", END)

    # 配置 Checkpointer
    checkpointer = SqliteSaver.from_conn_string("checkpoints.db")

    return workflow.compile(checkpointer=checkpointer)
```

### Phase 4: API 集成 (1-2 天)

**修改 `/api/analyze` 为异步任务：**

```python
from fastapi import BackgroundTasks
import uuid

# 任务状态存储
task_status: Dict[str, Dict] = {}

async def run_diagnosis_task(task_id: str, file_path: str):
    """后台诊断任务"""
    try:
        task_status[task_id]["status"] = "processing"

        workflow = create_diagnostic_workflow()
        result = await workflow.ainvoke({
            "task_id": task_id,
            "raw_text": "",
            "documents": [],
            "vectorstore": None,
            "current_dimension": "",
            "completed_dimensions": [],
        })

        task_status[task_id] = {
            "status": "completed",
            "result": result
        }
    except Exception as e:
        task_status[task_id] = {
            "status": "failed",
            "error": str(e)
        }

@app.post("/api/analyze")
async def analyze_document(
    file: UploadFile,
    background_tasks: BackgroundTasks
):
    task_id = str(uuid.uuid4())
    task_status[task_id] = {"status": "pending"}

    # 保存文件
    file_path = f"/tmp/{task_id}_{file.filename}"
    with open(file_path, "wb") as f:
        f.write(await file.read())

    # 启动后台任务
    background_tasks.add_task(run_diagnosis_task, task_id, file_path)

    return {"task_id": task_id, "status": "pending"}

@app.get("/api/status/{task_id}")
async def get_task_status(task_id: str):
    return task_status.get(task_id, {"status": "not_found"})
```

## 成本优化策略

| 策略 | 效果 | 实现方式 |
|------|------|---------|
| **本地 Embedding** | 向量化成本 = 0 | 使用 `BGE-M3` + Ollama |
| **ChromaDB 本地存储** | 向量库成本 = 0 | `persist_directory` 参数 |
| **关键词预过滤** | Token 消耗 -60% | Regex 匹配相关片段 |
| **分维度并发** | 总时间 -50% | `asyncio.gather` |
| **LangChain 免费** | 框架成本 = 0 | MIT 开源协议 |

## 关键文件清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `backend/lib/langchain/__init__.py` | 新建 | 模块初始化 |
| `backend/lib/langchain/processor.py` | 新建 | 文档处理管道 |
| `backend/lib/langchain/vectorstore.py` | 新建 | ChromaDB 封装 |
| `backend/lib/langchain/schemas.py` | 新建 | Pydantic 模型定义 |
| `backend/lib/langgraph/__init__.py` | 新建 | 模块初始化 |
| `backend/lib/langgraph/state.py` | 新建 | DiagnosticState 定义 |
| `backend/lib/langgraph/workflow.py` | 新建 | 状态机工作流 |
| `backend/lib/langgraph/nodes/*.py` | 新建 | 5 个维度分析节点 |
| `backend/app/api/diagnosis.py` | 修改 | 集成 LangGraph |
| `backend/requirements.txt` | 修改 | 添加 LangChain 依赖 |

## 验证方式

1. **文档处理测试**
   - 上传 PDF 文件
   - 验证分片结果保留语义完整性
   - 检查 ChromaDB 向量存储

2. **检索测试**
   - 查询 "财务" 返回相关片段
   - 验证相似度排序正确

3. **断点续传测试**
   - 中断分析过程
   - 刷新页面后从断点继续
   - 检查 checkpoints.db 状态

4. **端到端测试**
   - 完整 50 维度分析
   - 验证 JSON 输出符合 Schema
   - 检查 evidence 字段有原文支撑

## 参考资源

- [LangChain 官方文档](https://python.langchain.com/)
- [LangGraph 官方文档](https://langchain-ai.github.io/langgraph/)
- [ChromaDB 文档](https://docs.trychroma.com/)
- [Pydantic 文档](https://docs.pydantic.dev/)
