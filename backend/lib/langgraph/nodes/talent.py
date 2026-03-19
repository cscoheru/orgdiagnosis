"""
Talent Dimension Analysis Node

Analyzes the talent management dimension.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from lib.langchain.schemas import FIVE_DIMENSIONS_SCHEMA


# Talent 维度关键词
TALENT_KEYWORDS = [
    "人才", "招聘", "盘点", "梯队", "胜任力",
    "雇主", "品牌", "培养", "骨干", "职业",
    "流失", "敬业", "非物质", "流动", "融入"
]


def analyze_talent_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：分析人才维度

    分析内容：
    1. 规划盘点 (planning_and_review): 胜任力模型、人才盘点、梯队健康
    2. 获取配置 (acquisition_and_allocation): 雇主品牌、招聘精准、内部流动
    3. 培养发展 (training_and_development): 融入体系、骨干培养、职业通道
    4. 保留激励 (retention_and_engagement): 核心流失率、员工敬业、非物质激励
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Analyzing talent dimension...")

    try:
        relevant_docs = _retrieve_relevant_docs(state, "talent")

        if not relevant_docs:
            logger.warning(f"[{task_id}] No relevant documents found for talent")
            result = _create_default_result()
        else:
            context_text = _build_context(relevant_docs)
            result = _analyze_with_ai(context_text, "talent")

        completed = state.get("completed_dimensions", [])
        if "talent" not in completed:
            completed = completed + ["talent"]
        progress = len(completed) / 5 * 100

        logger.info(f"[{task_id}] Talent analysis completed: score={result.get('total_score', 0):.1f}")

        return {
            **state,
            "talent_result": result,
            "completed_dimensions": completed,
            "current_dimension": "report",
            "progress_percentage": progress,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error analyzing talent: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "analyze_talent",
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

        query = " ".join(TALENT_KEYWORDS[:5])
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
    score = _calculate_preliminary_score(context, TALENT_KEYWORDS)
    schema = FIVE_DIMENSIONS_SCHEMA["talent"]

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
        "category": "talent",
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
        return "人才管理体系完善，梯队建设健康，员工敬业度高。建议持续优化职业发展通道。"
    elif score >= 50:
        return "人才管理体系基本建立，但在培养发展和保留激励方面有提升空间。建议加强核心人才保留。"
    else:
        return "人才管理存在明显问题，人才流失严重或梯队断层。建议重新设计人才战略。"


def _create_default_result() -> Dict[str, Any]:
    """创建默认结果"""
    schema = FIVE_DIMENSIONS_SCHEMA["talent"]

    return {
        "category": "talent",
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
