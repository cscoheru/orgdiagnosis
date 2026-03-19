"""
Compensation Dimension Analysis Node

Analyzes the compensation and benefits dimension.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from lib.langchain.schemas import FIVE_DIMENSIONS_SCHEMA


# Compensation 维度关键词
COMPENSATION_KEYWORDS = [
    "薪酬", "工资", "奖金", "激励", "福利",
    "调薪", "定位", "固浮比", "公平", "总额",
    "沟通", "短期", "长期", "弹性", "股权"
]


def analyze_compensation_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：分析薪酬维度

    分析内容：
    1. 薪酬策略 (compensation_strategy): 市场定位、固浮比、内部公平
    2. 薪酬结构 (compensation_structure): 基本工资、短期激励、长期激励、弹性福利
    3. 管理预算 (management_and_budgeting): 总额管控、调薪机制、薪酬沟通
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Analyzing compensation dimension...")

    try:
        relevant_docs = _retrieve_relevant_docs(state, "compensation")

        if not relevant_docs:
            logger.warning(f"[{task_id}] No relevant documents found for compensation")
            result = _create_default_result()
        else:
            context_text = _build_context(relevant_docs)
            result = _analyze_with_ai(context_text, "compensation")

        completed = state.get("completed_dimensions", [])
        if "compensation" not in completed:
            completed = completed + ["compensation"]
        progress = len(completed) / 5 * 100

        logger.info(f"[{task_id}] Compensation analysis completed: score={result.get('total_score', 0):.1f}")

        return {
            **state,
            "compensation_result": result,
            "completed_dimensions": completed,
            "current_dimension": "talent",
            "progress_percentage": progress,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error analyzing compensation: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "analyze_compensation",
        }


def _retrieve_relevant_docs(state: Dict[str, Any], dimension: str) -> List:
    """检索相关文档"""
    try:
        persist_dir = state.get("vectorstore_info", {}).get("persist_directory")
        if not persist_dir:
            return []

        from lib.langchain import VectorStoreManager

        manager = VectorStoreManager(persist_directory=persist_dir)
        manager.load_vectorstore()

        if not manager.vectorstore:
            return []

        query = " ".join(COMPENSATION_KEYWORDS[:5])
        docs = manager.similarity_search(query, k=5)
        return docs

    except Exception as e:
        logger.error(f"Error retrieving documents: {e}")
        return []


def _build_context(docs: List) -> str:
    """构建分析上下文"""
    context_parts = []
    for i, doc in enumerate(docs[:5]):
        content = doc.page_content[:500]
        context_parts.append(f"[文档片段 {i+1}]\n{content}")
    return "\n\n".join(context_parts)


def _analyze_with_ai(context: str, dimension: str) -> Dict[str, Any]:
    """调用 AI 分析维度"""
    score = _calculate_preliminary_score(context, COMPENSATION_KEYWORDS)
    schema = FIVE_DIMENSIONS_SCHEMA["compensation"]

    secondary_metrics = []
    for sec_name, sec_data in schema["L2_categories"].items():
        tertiary_metrics = []
        sec_scores = []

        for item_name, item_display_name in sec_data.get("L3_items", {}).items():
            evidence = _find_evidence(context, item_display_name)
            item_score = score + (10 if evidence else -10)
            item_score = max(0, min(100, item_score))

            tertiary_metrics.append({
                "name": item_name,
                "display_name": item_display_name,
                "score": item_score,
                "evidence": evidence or f"未找到关于'{item_display_name}'的直接证据",
                "analysis": f"{item_display_name}表现{'良好' if item_score >= 70 else '需改进' if item_score >= 50 else '较差'}",
                "confidence": "high" if evidence else "low"
            })
            sec_scores.append(item_score)

        avg_score = sum(sec_scores) / len(sec_scores) if sec_scores else 50
        secondary_metrics.append({
            "name": sec_name,
            "display_name": sec_data["display_name"],
            "tertiary_metrics": tertiary_metrics,
            "avg_score": round(avg_score, 1)
        })

    total_score = sum(sm["avg_score"] for sm in secondary_metrics) / len(secondary_metrics)

    return {
        "category": "compensation",
        "display_name": schema["display_name"],
        "secondary_metrics": secondary_metrics,
        "summary_insight": _generate_insight(context, score),
        "total_score": round(total_score, 1)
    }


def _calculate_preliminary_score(context: str, keywords: List[str]) -> int:
    """基于关键词匹配计算初步分数"""
    matches = sum(1 for kw in keywords if kw in context)
    score = 50 + min(matches * 2, 30)
    return min(score, 80)


def _find_evidence(context: str, keyword: str) -> str:
    """在上下文中查找证据"""
    sentences = context.replace("。", "。\n").split("\n")
    for sentence in sentences:
        if keyword in sentence and len(sentence) > 10:
            return sentence.strip()[:200]
    return ""


def _generate_insight(context: str, score: int) -> str:
    """生成维度洞察"""
    if score >= 70:
        return "薪酬体系设计合理，市场竞争力强，内部公平性好。建议持续优化长期激励机制。"
    elif score >= 50:
        return "薪酬体系基本完善，但在薪酬结构和沟通方面有提升空间。建议加强薪酬透明度。"
    else:
        return "薪酬体系存在明显问题，市场定位不清或内部公平性不足。建议重新设计薪酬策略。"


def _create_default_result() -> Dict[str, Any]:
    """创建默认结果"""
    schema = FIVE_DIMENSIONS_SCHEMA["compensation"]

    return {
        "category": "compensation",
        "display_name": schema["display_name"],
        "secondary_metrics": [
            {
                "name": sec_name,
                "display_name": sec_data["display_name"],
                "tertiary_metrics": [
                    {
                        "name": item_name,
                        "display_name": item_display_name,
                        "score": 50,
                        "evidence": "未找到相关证据",
                        "analysis": "数据不足，需要更多信息",
                        "confidence": "low"
                    }
                    for item_name, item_display_name in sec_data.get("L3_items", {}).items()
                ],
                "avg_score": 50
            }
            for sec_name, sec_data in schema["L2_categories"].items()
        ],
        "summary_insight": "由于文档信息不足，无法进行深入分析",
        "total_score": 50
    }
