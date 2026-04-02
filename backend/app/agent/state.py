"""
Consulting Agent — LangGraph 状态定义

定义 Agent 会话的完整状态结构，供 LangGraph StateGraph 使用。
"""
from enum import Enum
from typing import Any, TypedDict, Annotated
import operator


class AgentMode(str, Enum):
    """Agent 工作模式"""
    PLAN = "plan"             # 规划：分析缺什么数据
    INTERACT = "interact"     # 交互：等待用户补充
    EXECUTE = "execute"       # 执行：数据齐备，生成报告
    DISTILL = "distill"       # 蒸馏：压缩对话记忆
    COMPLETED = "completed"
    FAILED = "failed"


class ConsultingState(TypedDict):
    """Agent 会话状态（LangGraph StateGraph 使用）"""

    # ─── 任务标识 ───
    session_id: str                       # Agent_Session _key
    benchmark_id: str                     # 使用的 Benchmark _key
    project_id: str                       # 关联的 Project _key (可选)
    mode: AgentMode                       # 当前工作模式

    # ─── 用户输入 ───
    project_goal: str                     # 用户初始目标描述

    # ─── Blueprint (里程碑1产出) ───
    blueprint: dict                       # 逻辑依赖树 (get_dependency_tree 返回值)
    execution_order: list[str]            # 节点执行顺序 (node_key 列表)
    current_node_index: int               # 当前处理到的节点索引

    # ─── 数据收集 ───
    collected_data: dict[str, Any]        # 已收集的所有数据 (node_type → data)
    missing_fields: list[dict]            # 当前缺失字段列表
    interaction_count: int                # 交互轮次计数

    # ─── 蒸馏 ───
    distilled_spec: dict | None           # Project_Spec (蒸馏后的结构化数据)

    # ─── 产出 ───
    pptx_path: str | None                 # 生成的 PPTX 文件路径

    # ─── 进度 ───
    progress: float                       # 0.0 ~ 1.0
    error_message: str | None

    # ─── 对话历史 (append-only) ───
    messages: Annotated[list[dict], operator.add]

    # ─── 临时字段 (工作流内部使用) ───
    __user_data__: dict[str, Any]           # 用户提交的原始数据 (collect_node 读取后清空)
