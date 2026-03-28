"""
薪酬领域 LangGraph 节点

async def analyze_compensation_node(state) -> dict

流程: 查询内核已有数据 → 构建上下文 → 调用 AI 分析 → 写回内核 → 返回状态更新
"""

from __future__ import annotations

from typing import Any, Dict

from loguru import logger

from lib.workflow.base_state import set_domain_result, track_kernel_object
from lib.workflow.kernel_bridge import KernelBridge

from lib.domain.compensation.prompts import (
    COMPENSATION_SYSTEM_PROMPT,
    COMPENSATION_DIMENSION_PROMPT,
)

# 薪酬领域管理的元模型
COMPENSATION_META_MODELS = [
    "Salary_Band",
    "Pay_Component",
    "Market_Benchmark",
]


async def analyze_compensation_node(state: dict[str, Any]) -> dict[str, Any]:
    """薪酬领域分析节点

    执行流程:
    1. 通过 KernelBridge 查询内核中已有的薪酬数据 (Salary_Band, Pay_Component, Market_Benchmark)
    2. 将内核数据与文档内容拼接为 AI 上下文
    3. 调用 AI 进行薪酬维度诊断分析
    4. 将 AI 提取的结构化对象写回内核
    5. 通过 set_domain_result / track_kernel_object 更新工作流状态

    Args:
        state: LangGraph 工作流状态

    Returns:
        状态更新字典 (会合并到全局 state)
    """
    task_id = state.get("task_id", "unknown")

    logger.info(f"[{task_id}] 薪酬领域分析节点启动")

    try:
        # ── Step 1: 查询内核已有薪酬数据 ──
        bridge = KernelBridge()
        kernel_context_parts: list[str] = []

        for model_key in COMPENSATION_META_MODELS:
            try:
                objects = await bridge.get_objects_by_model(model_key, limit=20)
                if objects:
                    kernel_context_parts.append(f"  [{model_key}]: {len(objects)} 个对象")
                    for obj in objects[:5]:  # 最多展示 5 个对象
                        props = obj.get("properties", {})
                        # 取第一个字段作为显示名称
                        name_field = "band_code" if model_key == "Salary_Band" else \
                                     "component_name" if model_key == "Pay_Component" else \
                                     "benchmark_name"
                        name = props.get(name_field, obj.get("_key", "?"))
                        kernel_context_parts.append(f"    - {name}: {props}")
            except Exception as e:
                logger.warning(f"[{task_id}] 查询 {model_key} 失败: {e}")

        # ── Step 2: 构建 AI 上下文 ──
        # 从 state 中提取文档内容
        documents = state.get("documents", [])
        doc_context = "\n\n".join(
            doc.get("content", "")[:500] for doc in documents[:3]
        )

        # 拼接内核已有数据
        if kernel_context_parts:
            doc_context += (
                f"\n\n--- 已有内核数据 (薪酬维度) ---\n"
                + "\n".join(kernel_context_parts)
            )
            logger.info(
                f"[{task_id}] 薪酬分析上下文已补充内核数据 "
                f"({len(kernel_context_parts)} 条)"
            )

        # 填充 prompt 模板
        user_prompt = COMPENSATION_DIMENSION_PROMPT.format(context=doc_context)

        # ── Step 3: 调用 AI 分析 ──
        from app.services.ai_client import ai_client

        if not ai_client.is_configured():
            logger.warning(f"[{task_id}] AI 未配置，薪酬维度使用模拟数据")
            result = _get_mock_result()
        else:
            result = await ai_client.chat_json(
                COMPENSATION_SYSTEM_PROMPT,
                user_prompt,
                timeout=60,
            )
            # 确保返回格式完整
            result.setdefault("category", "compensation")
            result.setdefault("total_score", 50.0)
            result.setdefault("summary_insight", "")
            result.setdefault("secondary_metrics", [])
            result.setdefault("extracted_objects", [])

        logger.info(
            f"[{task_id}] 薪酬 AI 分析完成: "
            f"score={result['total_score']}, "
            f"objects={len(result.get('extracted_objects', []))}"
        )

        # ── Step 4: 将提取的结构化对象写回内核 ──
        extracted = result.get("extracted_objects", [])
        created_ids: list[str] = []

        for obj_data in extracted:
            model_key = obj_data.pop("_model", None)
            if not model_key or model_key not in COMPENSATION_META_MODELS:
                logger.warning(
                    f"[{task_id}] 跳过无效对象 (缺少 _model 或模型不匹配): {obj_data}"
                )
                continue

            properties = {k: v for k, v in obj_data.items() if not k.startswith("_")}

            try:
                created = await bridge.create_object(model_key, properties)
                obj_id = created.get("_id") or created.get("_key", "")
                if obj_id:
                    created_ids.append(obj_id)
                    logger.info(
                        f"[{task_id}] 已创建内核对象: {model_key}/{obj_id}"
                    )
            except Exception as e:
                logger.warning(
                    f"[{task_id}] 创建 {model_key} 对象失败: {e}"
                )
                continue

        # ── Step 5: 更新工作流状态 ──
        # 记录领域分析结果
        updated = set_domain_result(state, "compensation", result)

        # 追踪创建的内核对象
        for obj_id in created_ids:
            updated = track_kernel_object(updated, obj_id)

        logger.info(
            f"[{task_id}] 薪酬领域分析节点完成, "
            f"创建内核对象: {len(created_ids)}"
        )

        return updated

    except Exception as e:
        logger.error(f"[{task_id}] 薪酬领域分析节点异常: {e}")
        # 返回错误状态，不中断整个工作流
        return set_domain_result(state, "compensation", {
            "category": "compensation",
            "total_score": 0,
            "summary_insight": f"分析失败: {str(e)}",
            "secondary_metrics": [],
            "extracted_objects": [],
            "error": str(e),
        })


def _get_mock_result() -> Dict[str, Any]:
    """AI 未配置时返回模拟数据"""
    return {
        "category": "compensation",
        "total_score": 50.0,
        "summary_insight": "AI 未配置，薪酬维度使用模拟数据",
        "secondary_metrics": [
            {
                "name": "薪酬带宽合理性",
                "score": 50,
                "detail": "模拟数据，需配置 AI 后重新分析",
            },
            {
                "name": "市场竞争力",
                "score": 50,
                "detail": "模拟数据，需配置 AI 后重新分析",
            },
        ],
        "extracted_objects": [],
    }
