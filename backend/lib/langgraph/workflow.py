"""
LangGraph Workflow for Five-Dimensional Diagnosis

This module defines the state machine workflow for processing diagnostic reports.
"""

import asyncio
import os
from typing import Dict, Any, Optional, List
from datetime import datetime
from loguru import logger

# LangGraph imports
from langgraph.graph import StateGraph, END

# Import MemorySaver for in-memory checkpoint (simpler, no persistence)
from langgraph.checkpoint.memory import MemorySaver

# Local imports
from .state import (
    DiagnosticState,
    WorkflowStatus,
    mark_dimension_complete,
    mark_error,
    update_progress,
)


def load_documents_node(state: DiagnosticState) -> DiagnosticState:
    """
    节点：加载文档

    从原始文本或文件加载并分片文档
    """
    from lib.langchain import DocumentProcessor

    logger.info(f"[{state['task_id']}] Loading documents...")

    try:
        processor = DocumentProcessor()

        if state.get("raw_text"):
            documents = processor.process(text=state["raw_text"])
        elif state.get("file_path"):
            documents = processor.process(file_path=state["file_path"])
        else:
            return mark_error(state, "No input text or file provided", "load_documents")

        logger.info(f"[{state['task_id']}] Loaded {len(documents)} document chunks")

        return {
            **state,
            "documents": [{"content": doc.page_content, "metadata": doc.metadata} for doc in documents],
            "status": WorkflowStatus.PROCESSING.value,
        }

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error loading documents: {e}")
        return mark_error(state, str(e), "load_documents")


def build_vectorstore_node(state: DiagnosticState) -> DiagnosticState:
    """
    节点：构建向量存储（简化版，跳过 ChromaDB）

    文档已存储在 state 中，    """
    logger.info(f"[{state['task_id']}] Skipping vectorstore build (using in-memory documents)")

    # 直接使用内存中的文档，不创建向量存储
    documents = state.get("documents", [])

    return {
        **state,
        "vectorstore_info": {
            "persist_directory": None,
            "document_count": len(documents),
        },
    }


def analyze_dimension_node(state: DiagnosticState, dimension: str) -> DiagnosticState:
    """
    通用节点：分析指定维度

    使用 RAG 检索相关文档，调用 AI 分析
    """
    logger.info(f"[{state['task_id']}] Analyzing dimension: {dimension}")

    try:
        # 简化版：直接使用内存中的文档
        documents = state.get("documents", [])

        # 构建上下文 (取前3个文档)
        context = "\n\n".join([doc.get("content", "")[:500] for doc in documents[:3]])

        # 调用 AI 分析 (这里需要集成实际的 AI 服务)
        # TODO: 集成 DeepSeek/GLM API
        result = _analyze_with_ai(state["task_id"], dimension, context)

        # 标记完成
        completed = state.get("completed_dimensions", []) + [dimension]
        progress = len(completed) / 5 * 100

        logger.info(f"[{state['task_id']}] Completed dimension: {dimension}")

        return {
            **state,
            f"{dimension}_result": result,
            "completed_dimensions": completed,
            "current_dimension": dimension,
            "progress_percentage": progress,
        }

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error analyzing {dimension}: {e}")
        return mark_error(state, str(e), f"analyze_{dimension}")


def _analyze_with_ai(task_id: str, dimension: str, context: str) -> Dict[str, Any]:
    """
    内部方法：调用 AI 分析维度

    TODO: 集成实际的 AI 服务 (DeepSeek/GLM)
    """
    # 临时返回 mock 数据
    from lib.langchain import FIVE_DIMENSIONS_SCHEMA, create_empty_report

    report = create_empty_report(task_id)
    dim_data = report.dimensions[0]  # 临时

    # 返回维度结果
    return {
        "category": dimension,
        "total_score": 50.0,
        "summary_insight": f"基于文档分析，{dimension}维度需要改进",
        "secondary_metrics": []
    }


def analyze_strategy_node(state: DiagnosticState) -> DiagnosticState:
    """节点：分析战略维度"""
    return analyze_dimension_node(state, "strategy")


def analyze_structure_node(state: DiagnosticState) -> DiagnosticState:
    """节点：分析组织维度"""
    return analyze_dimension_node(state, "structure")


def analyze_performance_node(state: DiagnosticState) -> DiagnosticState:
    """节点：分析绩效维度"""
    return analyze_dimension_node(state, "performance")


def analyze_compensation_node(state: DiagnosticState) -> DiagnosticState:
    """节点：分析薪酬维度"""
    return analyze_dimension_node(state, "compensation")


def analyze_talent_node(state: DiagnosticState) -> DiagnosticState:
    """节点：分析人才维度"""
    return analyze_dimension_node(state, "talent")


def generate_report_node(state: DiagnosticState) -> DiagnosticState:
    """
    节点：生成最终报告

    汇总所有维度结果，生成完整报告
    """
    from lib.langchain import ConsultationDiagnosticReport, FIVE_DIMENSIONS_SCHEMA

    logger.info(f"[{state['task_id']}] Generating final report...")

    try:
        # 收集所有维度结果
        dimensions = []
        total_score = 0.0

        for dim_name in ["strategy", "structure", "performance", "compensation", "talent"]:
            dim_result = state.get(f"{dim_name}_result")
            if dim_result:
                dimensions.append(dim_result)
                total_score += dim_result.get("total_score", 0)

        overall_score = total_score / len(dimensions) if dimensions else 0

        final_report = {
            "task_id": state["task_id"],
            "status": WorkflowStatus.COMPLETED.value,
            "overall_score": round(overall_score, 1),
            "dimensions": dimensions,
            "completed_at": datetime.now().isoformat(),
            "progress_percentage": 100.0,
        }

        logger.info(f"[{state['task_id']}] Report generated: overall_score={overall_score:.1f}")

        return {
            **state,
            **final_report,
            "final_report": final_report,
        }

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating report: {e}")
        return mark_error(state, str(e), "generate_report")


def create_diagnostic_workflow():
    """
    创建诊断工作流

    Returns:
        编译后的 StateGraph
    """
    workflow = StateGraph(DiagnosticState)

    # 添加节点
    workflow.add_node("load_documents", load_documents_node)
    workflow.add_node("build_vectorstore", build_vectorstore_node)
    workflow.add_node("analyze_strategy", analyze_strategy_node)
    workflow.add_node("analyze_structure", analyze_structure_node)
    workflow.add_node("analyze_performance", analyze_performance_node)
    workflow.add_node("analyze_compensation", analyze_compensation_node)
    workflow.add_node("analyze_talent", analyze_talent_node)
    workflow.add_node("generate_report", generate_report_node)

    # 定义入口
    workflow.set_entry_point("load_documents")

    # 定义边
    workflow.add_edge("load_documents", "build_vectorstore")
    workflow.add_edge("build_vectorstore", "analyze_strategy")
    workflow.add_edge("analyze_strategy", "analyze_structure")
    workflow.add_edge("analyze_structure", "analyze_performance")
    workflow.add_edge("analyze_performance", "analyze_compensation")
    workflow.add_edge("analyze_compensation", "analyze_talent")
    workflow.add_edge("analyze_talent", "generate_report")
    workflow.add_edge("generate_report", END)

    return workflow


async def run_diagnosis(
    task_id: str,
    raw_text: str,
    checkpointer_path: str = "./checkpoints.db",
    config: Optional[Dict[str, Any]] = None
) -> DiagnosticState:
    """
    运行诊断工作流

    Args:
        task_id: 任务 ID
        raw_text: 原始文本
        checkpointer_path: 检查点文件路径 (unused with MemorySaver)
        config: 可选配置

    Returns:
        最终状态
    """
    workflow = create_diagnostic_workflow()

    # 初始状态
    initial_state: DiagnosticState = {
        "task_id": task_id,
        "status": WorkflowStatus.PENDING.value,
        "raw_text": raw_text,
        "documents": [],
        "completed_dimensions": [],
        "progress_percentage": 0.0,
    }

    # 使用 MemorySaver (内存中检查点，适用于单次运行)
    checkpointer = MemorySaver()
    app = workflow.compile(checkpointer=checkpointer)

    # 运行工作流
    result = await app.ainvoke(initial_state, config=config or {"configurable": {"thread_id": task_id}})

    return result


def resume_diagnosis(
    task_id: str,
    checkpointer_path: str = "./checkpoints.db"
) -> Optional[DiagnosticState]:
    """
    从检查点恢复诊断

    注意: MemorySaver 不支持持久化，此函数目前返回 None。
    如需断点续传功能，请使用 SqliteSaver 或其他持久化检查点。

    Args:
        task_id: 任务 ID
        checkpointer_path: 检查点文件路径 (unused with MemorySaver)

    Returns:
        恢复后的状态 (目前返回 None)
    """
    # MemorySaver 不支持持久化，无法恢复
    # TODO: 如需断点续传，实现基于数据库的状态持久化
    return None


class DiagnosisWorkflowManager:
    """
    诊断工作流管理器

    提供工作流的创建、运行、恢复、状态查询等功能
    """

    def __init__(self, checkpointer_path: str = "./checkpoints.db"):
        self.checkpointer_path = checkpointer_path
        self._task_status: Dict[str, Dict[str, Any]] = {}

    async def start_diagnosis(
        self,
        task_id: str,
        raw_text: str,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        启动诊断任务

        Args:
            task_id: 任务 ID
            raw_text: 原始文本
            config: 可选配置

        Returns:
            任务 ID
        """
        self._task_status[task_id] = {
            "status": "processing",
            "started_at": datetime.now().isoformat()
        }

        # 异步运行
        asyncio.create_task(self._run_workflow(task_id, raw_text, config))

        return task_id

    async def _run_workflow(
        self,
        task_id: str,
        raw_text: str,
        config: Optional[Dict[str, Any]] = None
    ):
        """内部：运行工作流"""
        try:
            result = await run_diagnosis(
                task_id,
                raw_text,
                self.checkpointer_path,
                config
            )
            self._task_status[task_id] = {
                "status": "completed",
                "result": result,
                "completed_at": datetime.now().isoformat()
            }
        except Exception as e:
            self._task_status[task_id] = {
                "status": "failed",
                "error": str(e),
                "failed_at": datetime.now().isoformat()
            }

    def get_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态"""
        return self._task_status.get(task_id)

    def get_result(self, task_id: str) -> Optional[DiagnosticState]:
        """获取任务结果"""
        status = self._task_status.get(task_id)
        if status and status.get("status") == "completed":
            return status.get("result")
        return None


# 全局工作流管理器实例
workflow_manager = DiagnosisWorkflowManager()
