"""
Strategy Dimension Analysis Node

Analyzes the strategic dimension of the organization.
"""

from typing import Dict, Any, List
from datetime import datetime
from loguru import logger

from lib.langchain.schemas import FIVE_DIMENSIONS_SCHEMA


# Strategy 维度关键词
STRATEGY_KEYWORDS = [
    "战略", "规划", "目标", "愿景", "使命",
    "市场", "竞争", "业务", "增长", "业绩",
    "机会", "创新", "执行", "关键任务", "经营分析"
]


def analyze_strategy_node(state: Dict[str, Any]) -> Dict[str, Any]:
    """
    节点：分析战略维度

    分析内容：
    1. 业务现状 (business_status): 业绩差距、机会差距
    2. 战略规划 (strategic_planning): 市场洞察、战略意图、创新焦点、业务设计
    3. 战略执行 (strategy_execution): 关键任务、组织支撑、人才准备、企业文化
    4. 战略评估 (strategy_evaluation): 经营分析、执行评价、战略迭代
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Analyzing strategy dimension...")

    try:
        # 检索相关文档
        relevant_docs = _retrieve_relevant_docs(state, "strategy")

        if not relevant_docs:
            logger.warning(f"[{task_id}] No relevant documents found for strategy")
            result = _create_default_result()
        else:
            # 构建上下文
            context_text = _build_context(relevant_docs)
            # 调用 AI 分析
            result = _analyze_with_ai(context_text, "strategy")

        # 计算进度
        completed = state.get("completed_dimensions", [])
        if "strategy" not in completed:
            completed = completed + ["strategy"]
        progress = len(completed) / 5 * 100

        logger.info(f"[{task_id}] Strategy analysis completed: score={result.get('total_score', 0):.1f}")

        return {
            **state,
            "strategy_result": result,
            "completed_dimensions": completed,
            "current_dimension": "structure",
            "progress_percentage": progress,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] Error analyzing strategy: {e}")
        return {
            **state,
            "status": "failed",
            "error": str(e),
            "error_step": "analyze_strategy",
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

        # 使用关键词检索
        query = " ".join(STRATEGY_KEYWORDS[:5])
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
    """
    调用 AI 分析维度

    TODO: 集成实际的 AI 服务 (DeepSeek/GLM)
    当前返回基于关键词的初步分析
    """
    # 基于上下文关键词计算初步分数
    score = _calculate_preliminary_score(context, STRATEGY_KEYWORDS)

    schema = FIVE_DIMENSIONS_SCHEMA["strategy"]

    secondary_metrics = []
    for sec_name, sec_data in schema["L2_categories"].items():
        tertiary_metrics = []
        sec_scores = []

        for item_name, item_display_name in sec_data.get("L3_items", {}).items():
            # 查找相关证据
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
        "category": "strategy",
        "display_name": schema["display_name"],
        "secondary_metrics": secondary_metrics,
        "summary_insight": _generate_insight(context, score),
        "total_score": round(total_score, 1)
    }


def _calculate_preliminary_score(context: str, keywords: List[str]) -> int:
    """基于关键词匹配计算初步分数"""
    matches = sum(1 for kw in keywords if kw in context)
    # 基础分 50，每个关键词 +2，上限 80
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
        return "战略规划清晰，市场洞察深入，执行力强。建议持续优化战略迭代机制。"
    elif score >= 50:
        return "战略规划基本合理，但在战略执行和评估方面有提升空间。建议加强关键任务跟踪。"
    else:
        return "战略规划存在明显不足，目标不清晰或执行不到位。建议重新审视战略方向。"


def _create_default_result() -> Dict[str, Any]:
    """创建默认结果（当没有足够证据时）"""
    schema = FIVE_DIMENSIONS_SCHEMA["strategy"]

    return {
        "category": "strategy",
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
