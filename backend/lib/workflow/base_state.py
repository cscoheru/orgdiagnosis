"""
所有工作流共享的基础状态。

LangGraph StateGraph 的 state schema。
各领域节点通过键名合并更新，不会互相覆盖。

设计原则:
- kernel_context: 存储内核对象引用 (_id 列表)，不存完整对象
- results: 按领域模块键 (strategy/organization/...) 存储分析结果
- status/progress: 供前端轮询任务状态
"""

from datetime import datetime
from typing import TypedDict, Any


class WorkflowState(TypedDict, total=False):
    """LangGraph 工作流共享状态

    Attributes:
        task_id: 任务唯一标识 (UUID)
        status: 任务状态 — pending / running / completed / failed
        progress: 整体进度 0.0 ~ 1.0
        error: 错误信息 (None 表示无错误)
        kernel_context: 内核数据引用，存储创建的对象 _id 列表等元信息
        results: 各领域模块的分析结果，按 domain_key 索引
        created_at: 任务创建时间 (ISO 8601)
        updated_at: 最后更新时间 (ISO 8601)
    """

    task_id: str
    status: str
    progress: float
    error: str | None
    kernel_context: dict
    results: dict
    created_at: str
    updated_at: str


def create_workflow_state(task_id: str, **extra: Any) -> dict[str, Any]:
    """创建工作流状态的工厂函数

    Args:
        task_id: 任务唯一标识
        **extra: 额外的状态字段

    Returns:
        初始化的工作流状态字典
    """
    now = datetime.now().isoformat()
    return {
        "task_id": task_id,
        "status": "pending",
        "progress": 0.0,
        "error": None,
        "kernel_context": {
            "objects_created": [],
            "relations_created": [],
            "meta_models_used": [],
        },
        "results": {},
        "created_at": now,
        "updated_at": now,
        **extra,
    }


def track_kernel_object(state: dict[str, Any], obj_id: str) -> dict[str, Any]:
    """记录工作流创建的内核对象

    在 kernel_context.objects_created 中追加 obj_id。
    """
    ctx = dict(state.get("kernel_context") or {
        "objects_created": [],
        "relations_created": [],
        "meta_models_used": [],
    })
    if obj_id not in ctx["objects_created"]:
        ctx["objects_created"].append(obj_id)
    return {**state, "kernel_context": ctx}


def track_kernel_relation(state: dict[str, Any], relation_id: str) -> dict[str, Any]:
    """记录工作流创建的内核关系"""
    ctx = dict(state.get("kernel_context") or {
        "objects_created": [],
        "relations_created": [],
        "meta_models_used": [],
    })
    if relation_id not in ctx["relations_created"]:
        ctx["relations_created"].append(relation_id)
    return {**state, "kernel_context": ctx}


def set_domain_result(state: dict[str, Any], domain: str, result: Any) -> dict[str, Any]:
    """设置指定领域的分析结果"""
    results = dict(state.get("results") or {})
    results[domain] = result
    return {**state, "results": results}
