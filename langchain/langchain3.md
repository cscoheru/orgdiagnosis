太好了，那我们就从**核心数据结构（Schema）**开始，这是整个诊断工具的“地基”。

由于你有 50 多个三级维度，如果一次性让 AI 填满，Token 消耗和逻辑漂移会非常严重。我建议将模型拆解为**“分层定义”**，这能让 Claude Code 在写代码时实现**模块化并行分析**。

以下是为你准备的 **Pydantic 数据模型建议**，你可以直接给 Claude Code 参考：

---

### 1. 定义核心数据模型 (Schema)

Python

```
from pydantic import BaseModel, Field
from typing import List, Optional

class TertiaryDimension(BaseModel):
    """三级维度：最细颗粒度的评分"""
    name: str = Field(..., description="三级维度名称")
    score: int = Field(..., ge=0, le=100, description="0-100的评分")
    evidence: str = Field(..., description="从原文中摘录的支撑性证据/原文")
    analysis: str = Field(..., description="简短的诊断意见")

class SecondaryDimension(BaseModel):
    """二级维度：汇总三级维度的结果"""
    name: str
    tertiary_metrics: List[TertiaryDimension]
    avg_score: float = Field(..., description="该二级维度的平均分")

class PrimaryDimension(BaseModel):
    """一级维度：管理咨询的五大核心维度之一"""
    category: str = Field(..., description="例如：战略、人力、流程等")
    secondary_metrics: List[SecondaryDimension]
    summary_insight: str = Field(..., description="针对该大类的综合管理建议")

class ConsultationDiagnosticReport(BaseModel):
    """最终完整的诊断报告结构，直接对应 Recharts 仪表盘"""
    task_id: str
    report_name: str
    dimensions: List[PrimaryDimension]
    total_score: float
```

---

### 2. 为什么这样写对你解决报错最有帮助？

1. **分批填充 (Batching)：** 你可以命令 Claude Code 写一个循环，**每次只让 AI 分析一个 `PrimaryDimension`**。
    
    - **优点：** 每次 API 请求的 Token 很少，不会超时。
        
    - **容错：** 如果“人力资源”维度分析失败，不会影响已经完成的“战略维度”数据。
        
2. **强制证据 (Evidence-Based)：** 要求 AI 必须返回 `evidence` 字段。这能解决咨询工具最怕的“幻觉”问题——AI 必须在文档里找到依据才能打分。
    
3. **直接适配 Recharts：** 这种嵌套的 JSON 结构，前端 React 拿到后，只需要简单的 `.map()` 就能转换成 Recharts 需要的数组格式。
    

---

### 3. 下一步建议：给 Claude Code 的追加指令

当 Claude Code 开始写代码时，你可以提醒他：

> “请使用 `asyncio.gather` 并发处理这 5 个一级维度的分析任务，但每个任务内部要限制并发数，防止触发 OpenAI 的 Rate Limit（频率限制）。”

---

**你需要我帮你把这 50 个具体的维度名称梳理进这个 Python 模型中，还是你打算让 Claude Code 直接读取你现有的维度列表文件？**