"""
编排式诊断工作流 (v2)

五大领域并行分析 + 跨领域综合。

与旧版 lib/langgraph/workflow.py (线性流) 的关系:
- 旧版保留兼容，新版作为 v2 替代
- 新版通过 KernelBridge 读写内核，实现领域间数据共享

工作流:
  input → parse_input → parallel_domain_analysis → cross_domain_synthesis → report_assembly → END

  parallel_domain_analysis (5 个领域节点并行):
    strategy_node ─┐
    structure_node ─┤
    performance_node ─┤
    compensation_node ─┤
    talent_node ──────┘
"""

from __future__ import annotations

import asyncio
from typing import Any, Dict, List, Optional
from datetime import datetime

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from loguru import logger

from lib.workflow.base_state import (
    WorkflowState,
    create_workflow_state,
    set_domain_result,
    track_kernel_object,
)
from lib.workflow.kernel_bridge import KernelBridge


# ──────────────────────────────────────────────
# 扩展状态：编排式诊断
# ──────────────────────────────────────────────

class OrchestratedState(WorkflowState, total=False):
    """编排式诊断工作流状态 (继承基础 WorkflowState)

    额外字段:
        raw_text: 输入文本
        documents: 文档列表
        completed_domains: 已完成的领域列表
        cross_domain_insights: 跨领域综合分析结果
        final_report: 最终报告
    """
    raw_text: str
    documents: List[Dict[str, Any]]
    completed_domains: List[str]
    cross_domain_insights: Optional[Dict[str, Any]]
    final_report: Optional[Dict[str, Any]]


# ──────────────────────────────────────────────
# 节点实现
# ──────────────────────────────────────────────

def parse_input_node(state: OrchestratedState) -> OrchestratedState:
    """节点：解析输入

    将 raw_text 分片为 documents，初始化状态。
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Parsing input...")

    raw_text = state.get("raw_text", "")

    # 简单分片：按段落切分
    documents = []
    if raw_text:
        chunks = [p.strip() for p in raw_text.split("\n\n") if p.strip()]
        for i, chunk in enumerate(chunks):
            documents.append({"content": chunk, "metadata": {"chunk_index": i}})

    logger.info(f"[{task_id}] Parsed {len(documents)} document chunks")

    return {
        **state,
        "documents": documents,
        "status": "running",
        "progress": 0.1,
        "updated_at": datetime.now().isoformat(),
    }


async def _run_domain_node(
    state: OrchestratedState,
    domain_key: str,
    node_func,
) -> Dict[str, Any]:
    """在 executor 中运行单个领域节点"""
    try:
        result = await node_func(state)
        logger.info(f"[{state.get('task_id')}] Domain {domain_key} completed")
        return {"success": True, "domain": domain_key, "result": result}
    except Exception as e:
        logger.error(f"[{state.get('task_id')}] Domain {domain_key} failed: {e}")
        return {"success": False, "domain": domain_key, "error": str(e)}


def parallel_domain_analysis_node(state: OrchestratedState) -> OrchestratedState:
    """节点：并行领域分析

    通过 node_registry 获取所有已注册的领域节点，
    并行执行，合并结果到 state。
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Starting parallel domain analysis...")

    from lib.workflow.node_registry import get_all_domains, get_available_nodes

    # 获取所有已注册节点，按领域分组
    available = get_available_nodes()
    domains = get_all_domains()

    if not domains:
        logger.warning(f"[{task_id}] No domains registered, skipping analysis")
        return {**state, "completed_domains": [], "progress": 0.5}

    # 为每个领域取第一个节点 (每个领域当前只有 1 个分析节点)
    domain_nodes = {}
    for domain in domains:
        domain_funcs = {
            name: entry["func"]
            for name, entry in available.items()
            if entry["domain"] == domain
        }
        if domain_funcs:
            # 取第一个节点 (analyze_xxx)
            first_node = next(iter(domain_funcs.values()))
            domain_nodes[domain] = first_node

    logger.info(f"[{task_id}] Running {len(domain_nodes)} domains in parallel: {list(domain_nodes.keys())}")

    # 并行执行所有领域节点
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        # 已在事件循环中，用 ThreadPoolExecutor
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as pool:
            futures = [
                pool.submit(asyncio.run, _run_domain_node(state, domain, func))
                for domain, func in domain_nodes.items()
            ]
            results = [f.result(timeout=120) for f in futures]
    else:
        # 无运行中的循环，创建并设置新循环
        new_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(new_loop)
        try:
            results = new_loop.run_until_complete(
                asyncio.gather(
                    *[_run_domain_node(state, domain, func) for domain, func in domain_nodes.items()]
                )
            )
        finally:
            new_loop.close()
            asyncio.set_event_loop(None)

    # 合并结果
    completed = []
    merged_results = dict(state.get("results") or {})
    all_kernel_objects = list(
        (state.get("kernel_context") or {}).get("objects_created", [])
    )

    for r in results:
        domain = r["domain"]
        completed.append(domain)
        if r["success"] and r.get("result"):
            node_result = r["result"]
            # 合并 results
            if isinstance(node_result, dict) and "results" in node_result:
                merged_results.update(node_result["results"])
            # 追踪 kernel objects
            ctx = (node_result.get("kernel_context") or {})
            for obj_id in ctx.get("objects_created", []):
                if obj_id not in all_kernel_objects:
                    all_kernel_objects.append(obj_id)

    total = len(domains)
    progress = 0.3 + (0.5 * len(completed) / total) if total > 0 else 0.5

    logger.info(f"[{task_id}] Completed {len(completed)}/{total} domains")

    return {
        **state,
        "completed_domains": completed,
        "results": merged_results,
        "kernel_context": {
            "objects_created": all_kernel_objects,
            "relations_created": (state.get("kernel_context") or {}).get("relations_created", []),
            "meta_models_used": (state.get("kernel_context") or {}).get("meta_models_used", []),
        },
        "progress": progress,
        "updated_at": datetime.now().isoformat(),
    }


def cross_domain_synthesis_node(state: OrchestratedState) -> OrchestratedState:
    """节点：跨领域综合分析

    从内核图谱中发现跨领域洞察。
    例: "薪酬低于市场水平的岗位, 员工胜任力得分也偏低"
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Starting cross-domain synthesis...")

    try:
        bridge = KernelBridge()

        # 获取所有已创建的对象
        all_objects = []
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = None

        if loop and loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, bridge.list_all_objects(limit=100))
                all_objects = future.result(timeout=15)
        else:
            new_loop = asyncio.new_event_loop()
            asyncio.set_event_loop(new_loop)
            try:
                all_objects = new_loop.run_until_complete(
                    bridge.list_all_objects(limit=100)
                )
            finally:
                new_loop.close()
                asyncio.set_event_loop(None)

        if not all_objects:
            logger.info(f"[{task_id}] No kernel objects for cross-domain analysis")
            insights = {
                "summary": "暂无足够数据支持跨领域分析",
                "patterns": [],
                "recommendations": [],
            }
        else:
            # 按 model_key 分组统计
            model_counts: Dict[str, int] = {}
            for obj in all_objects:
                model_key = obj.get("model_key", "unknown")
                model_counts[model_key] = model_counts.get(model_key, 0) + 1

            # 构建跨领域洞察
            patterns = []
            recommendations = []

            # 简单跨领域模式检测
            has_compensation = model_counts.get("Salary_Band", 0) > 0
            has_talent = model_counts.get("Employee", 0) > 0
            has_performance = model_counts.get("Performance_Metric", 0) > 0
            has_organization = model_counts.get("Org_Unit", 0) > 0
            has_strategy = model_counts.get("Strategic_Goal", 0) > 0

            if has_compensation and has_talent:
                patterns.append("薪酬与人才联动: 薪酬水平和人才结构存在关联")
                recommendations.append("建议将薪酬竞争力分析与人才保留策略联动优化")

            if has_performance and has_organization:
                patterns.append("绩效与组织联动: 组织架构影响绩效体系设计")
                recommendations.append("建议根据组织层级差异化设计绩效指标")

            if has_strategy and has_organization:
                patterns.append("战略与组织联动: 战略目标需要组织架构支撑")
                recommendations.append("建议评估组织能力是否匹配战略目标")

            if has_compensation and has_performance:
                patterns.append("薪酬与绩效联动: 绩效结果应反映在薪酬分配中")
                recommendations.append("建议加强绩效结果与薪酬调整的关联度")

            insights = {
                "summary": f"基于 {len(all_objects)} 个内核对象的跨领域分析，发现 {len(patterns)} 个联动模式",
                "patterns": patterns,
                "recommendations": recommendations,
                "objects_analyzed": len(all_objects),
                "models_analyzed": list(model_counts.keys()),
            }

        logger.info(f"[{task_id}] Cross-domain synthesis: {len(insights['patterns'])} patterns found")

        return {
            **state,
            "cross_domain_insights": insights,
            "progress": 0.9,
            "updated_at": datetime.now().isoformat(),
        }

    except Exception as e:
        logger.error(f"[{task_id}] Cross-domain synthesis failed: {e}")
        return {
            **state,
            "cross_domain_insights": {
                "summary": f"跨领域分析失败: {str(e)}",
                "patterns": [],
                "recommendations": [],
            },
            "progress": 0.9,
            "updated_at": datetime.now().isoformat(),
        }


def report_assembly_node(state: OrchestratedState) -> OrchestratedState:
    """节点：组装最终报告

    汇总各领域结果 + 跨领域洞察，生成最终报告。
    """
    task_id = state.get("task_id", "unknown")
    logger.info(f"[{task_id}] Assembling final report...")

    results = state.get("results", {})
    completed = state.get("completed_domains", [])
    cross_domain = state.get("cross_domain_insights", {})

    # 计算整体评分 (如果有各领域评分)
    total_score = 0.0
    score_count = 0
    for domain, result in results.items():
        if isinstance(result, dict) and "total_score" in result:
            total_score += result["total_score"]
            score_count += 1

    overall_score = round(total_score / score_count, 1) if score_count > 0 else None

    final_report = {
        "task_id": task_id,
        "status": "completed",
        "overall_score": overall_score,
        "domains_analyzed": completed,
        "domain_results": results,
        "cross_domain_insights": cross_domain,
        "kernel_objects_count": len(
            (state.get("kernel_context") or {}).get("objects_created", [])
        ),
        "completed_at": datetime.now().isoformat(),
    }

    logger.info(f"[{task_id}] Report assembled: {len(completed)} domains, score={overall_score}")

    return {
        **state,
        "final_report": final_report,
        "status": "completed",
        "progress": 1.0,
        "updated_at": datetime.now().isoformat(),
    }


# ──────────────────────────────────────────────
# 工作流构建
# ──────────────────────────────────────────────

def create_orchestrated_workflow() -> StateGraph:
    """创建编排式诊断工作流

    Returns:
        编译后的 StateGraph

    流程:
        parse_input → parallel_domain_analysis → cross_domain_synthesis → report_assembly → END
    """
    workflow = StateGraph(OrchestratedState)

    workflow.add_node("parse_input", parse_input_node)
    workflow.add_node("parallel_domain_analysis", parallel_domain_analysis_node)
    workflow.add_node("cross_domain_synthesis", cross_domain_synthesis_node)
    workflow.add_node("report_assembly", report_assembly_node)

    workflow.set_entry_point("parse_input")
    workflow.add_edge("parse_input", "parallel_domain_analysis")
    workflow.add_edge("parallel_domain_analysis", "cross_domain_synthesis")
    workflow.add_edge("cross_domain_synthesis", "report_assembly")
    workflow.add_edge("report_assembly", END)

    return workflow


async def run_orchestrated_diagnosis(
    task_id: str,
    raw_text: str,
) -> Dict[str, Any]:
    """运行编排式诊断工作流

    Args:
        task_id: 任务 ID
        raw_text: 原始文本

    Returns:
        最终状态 (包含 final_report)
    """
    # 导入并注册所有领域模块
    from lib.domain.strategy import StrategyModule
    from lib.domain.organization import OrganizationModule
    from lib.domain.performance import PerformanceModule
    from lib.domain.compensation import CompensationModule
    from lib.domain.talent import TalentModule

    for module_cls in [StrategyModule, OrganizationModule, PerformanceModule, CompensationModule, TalentModule]:
        module_cls().register_nodes()

    workflow = create_orchestrated_workflow()
    checkpointer = MemorySaver()
    app = workflow.compile(checkpointer=checkpointer)

    initial_state = create_workflow_state(task_id, raw_text=raw_text)

    result = await app.ainvoke(
        initial_state,
        config={
            "configurable": {"thread_id": task_id},
            "run_name": f"五维诊断-{task_id}",
            "tags": ["diagnosis", "orchestrated", "five-dimension"],
            "metadata": {"task_id": task_id, "domain_count": 5},
        },
    )

    return result
