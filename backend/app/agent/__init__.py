"""
AI 顾问 Agent 模块

Consulting OS 2.0 — 主动型咨询 Agent
将系统从"存储与排版工具"升级为"主动引导的咨询顾问智能体"。

子模块:
  - models: Pydantic 请求/响应模型
  - blueprint_service: 逻辑骨架解析器 (M1)
  - state: LangGraph 状态定义 (M2)
  - workflow: LangGraph 工作流 (M2)
  - nodes: 工作流节点实现 (M2)
  - api: FastAPI 路由 (M1-M4)
"""
