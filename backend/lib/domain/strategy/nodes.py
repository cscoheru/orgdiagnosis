"""
战略领域 LangGraph 分析节点

通过 KernelBridge 与内核交互，完成战略维度的数据提取与分析：
1. 查询内核已有的战略相关对象
2. 结合文档内容调用 AI 分析
3. 将提取的结构化对象写回内核
"""

from __future__ import annotations

import asyncio
import concurrent.futures
from datetime import datetime
from typing import Any, Dict, List

from loguru import logger

from .prompts import STRATEGY_SYSTEM_PROMPT, STRATEGY_DIMENSION_PROMPT


def _format_kernel_objects(objects: List[Dict[str, Any]], model_key: str) -> str:
    """将内核对象列表格式化为可读文本

    Args:
        objects: 内核对象列表
        model_key: 元模型 key

    Returns:
        格式化的文本
    """
    lines = [f"  [{model_key}]: {len(objects)} 个对象"]
    for obj in objects[:5]:
        props = obj.get("properties", {})
        name = props.get("goal_name") or props.get("initiative_name") or props.get("industry") or obj.get("_key", "?")
        lines.append(f"    - {name}: {props}")
    return "\n".join(lines)


async def _analyze_with_ai(context: str, task_id: str) -> Dict[str, Any]:
    """调用 AI 进行战略维度分析

    使用统一 AI 客户端，返回包含诊断评分和结构化对象的结果。

    Args:
        context: 组装好的分析上下文 (文档 + 已有内核数据)
        task_id: 任务 ID (日志用)

    Returns:
        AI 分析结果字典，包含 category, total_score, summary_insight,
        secondary_metrics, extracted_objects
    """
    from app.services.ai_client import ai_client

    # AI 未配置时返回默认结果
    if not ai_client.is_configured():
        logger.warning(f"[{task_id}] AI 未配置，战略维度使用默认数据")
        return {
            "category": "strategy",
            "total_score": 50.0,
            "summary_insight": "AI 未配置，战略维度使用默认评估数据",
            "secondary_metrics": [],
            "extracted_objects": [],
        }

    system_prompt = STRATEGY_SYSTEM_PROMPT
    user_prompt = f"{STRATEGY_DIMENSION_PROMPT}\n\n以下是需要分析的文本内容：\n\n{context}"

    try:
        result = await ai_client.chat_json(
            system_prompt,
            user_prompt,
            timeout=60,
        )

        # 确保返回格式完整
        result.setdefault("category", "strategy")
        result.setdefault("total_score", 50.0)
        result.setdefault("summary_insight", "")
        result.setdefault("secondary_metrics", [])
        result.setdefault("extracted_objects", [])

        logger.info(
            f"[{task_id}] 战略维度 AI 分析完成: "
            f"score={result['total_score']}, "
            f"objects={len(result.get('extracted_objects', []))}"
        )
        return result

    except Exception as e:
        logger.error(f"[{task_id}] 战略维度 AI 分析失败: {e}")
        return {
            "category": "strategy",
            "total_score": 50.0,
            "summary_insight": f"分析失败: {str(e)}",
            "secondary_metrics": [],
            "extracted_objects": [],
        }


def _run_async(coro) -> Any:
    """在已有事件循环中安全运行异步协程

    当当前线程已有运行中的事件循环时，使用 ThreadPoolExecutor 隔离；
    否则直接 asyncio.run()。

    Args:
        coro: 异步协程对象

    Returns:
        协程执行结果
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        with concurrent.futures.ThreadPoolExecutor() as pool:
            future = pool.submit(asyncio.run, coro)
            return future.result(timeout=90)
    else:
        return asyncio.run(coro)


async def analyze_strategy_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """战略维度分析节点

    LangGraph 节点，执行战略领域的完整分析流程：
    1. 从 state 中获取文档内容
    2. 通过 KernelBridge 查询内核已有的战略对象
    3. 组装上下文并调用 AI 分析
    4. 将 AI 提取的结构化对象写回内核
    5. 更新 state 中的分析结果和内核追踪信息

    Args:
        state: LangGraph 工作流状态

    Returns:
        更新后的工作流状态 (包含 strategy_result 和 kernel_context)
    """
    from lib.workflow.kernel_bridge import KernelBridge
    from lib.workflow.base_state import set_domain_result, track_kernel_object

    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] 开始战略维度分析...")

    bridge = KernelBridge()

    # ── Step 1: 查询内核已有的战略数据 ──
    existing_goals = await bridge.get_objects_by_model("Strategic_Goal", limit=20)
    existing_initiatives = await bridge.get_objects_by_model("Strategic_Initiative", limit=20)
    existing_market = await bridge.get_objects_by_model("Market_Context", limit=20)

    # ── Step 2: 构建分析上下文 ──
    documents = state.get("documents", [])
    context = "\n".join([d.get("content", "")[:500] for d in documents[:3]])

    # 追加已有内核数据作为补充上下文
    if existing_goals:
        context += "\n\n已有战略目标数据:\n" + _format_kernel_objects(existing_goals, "Strategic_Goal")
    if existing_initiatives:
        context += "\n\n已有战略举措数据:\n" + _format_kernel_objects(existing_initiatives, "Strategic_Initiative")
    if existing_market:
        context += "\n\n已有市场环境数据:\n" + _format_kernel_objects(existing_market, "Market_Context")

    logger.info(
        f"[{task_id}] 战略上下文构建完成: "
        f"docs={len(documents)}, "
        f"existing_goals={len(existing_goals)}, "
        f"existing_initiatives={len(existing_initiatives)}, "
        f"existing_market={len(existing_market)}"
    )

    # ── Step 3: 调用 AI 分析 ──
    result = await _analyze_with_ai(context, task_id)

    # ── Step 4: 将提取的对象写回内核 ──
    created_ids: List[str] = []
    for obj in result.get("extracted_objects", []):
        model_key = obj.pop("_model", None)
        if not model_key:
            logger.warning(f"[{task_id}] 跳过缺少 _model 字段的对象: {obj}")
            continue

        # 过滤掉内部字段，只保留业务属性
        properties = {k: v for k, v in obj.items() if not k.startswith("_")}

        try:
            created = await bridge.create_object(model_key, properties)
            obj_id = created.get("_id") or created.get("_key", "")
            if obj_id:
                created_ids.append(obj_id)
                logger.info(f"[{task_id}] 创建内核对象: {model_key}/{obj_id}")
        except Exception as e:
            logger.warning(f"[{task_id}] 创建 {model_key} 对象失败: {e}")
            continue

    # ── Step 5: 更新工作流状态 ──
    result["kernel_objects"] = created_ids
    state = set_domain_result(state, "strategy", result)

    # 追踪创建的内核对象
    for oid in created_ids:
        state = track_kernel_object(state, oid)

    logger.info(
        f"[{task_id}] 战略维度分析完成: "
        f"score={result.get('total_score', 0)}, "
        f"kernel_objects={len(created_ids)}"
    )

    return state
