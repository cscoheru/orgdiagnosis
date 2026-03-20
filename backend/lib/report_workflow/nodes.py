"""
Report Generation Workflow Nodes

Individual node implementations for the LangGraph workflow.
Each node performs a specific step in the report generation process.
"""

from typing import Dict, Any
from loguru import logger

from .state import (
    ReportState,
    WorkflowStatus,
    update_state,
    mark_error,
    get_progress_for_status,
)


def generate_outline_node(state: ReportState) -> ReportState:
    """
    节点：生成报告大纲

    根据客户需求和五维诊断结果，生成四部分报告大纲。
    """
    logger.info(f"[{state['task_id']}] Generating outline...")

    try:
        from schemas import (
            ClientRequirement,
            ReportOutline,
            REPORT_STRUCTURE,
        )
        from lib.llamaindex import ConsultingKnowledgeRetriever

        # 解析需求
        requirement = ClientRequirement(**state["requirement"])

        # 检索相关历史素材
        evidence = []
        try:
            from lib.llamaindex import ConsultingKnowledgeIndexer
            indexer = ConsultingKnowledgeIndexer()
            index = indexer.load_index()

            if index:
                retriever = ConsultingKnowledgeRetriever(index, similarity_top_k=5)

                # 按痛点检索
                for pain_point in requirement.core_pain_points[:3]:
                    nodes = retriever.retrieve(pain_point)
                    for node in nodes[:2]:
                        evidence.append({
                            "query": pain_point,
                            "content": node.node.get_content()[:500],
                            "source": node.node.metadata.get("file_name", "unknown"),
                            "score": node.score,
                        })
        except Exception as e:
            logger.warning(f"Failed to retrieve evidence: {e}")

        # 生成大纲结构
        outline_data = {
            "report_id": state["task_id"],
            "client_name": requirement.client_name,
            "part1_outline": {
                "title": "项目需求的理解",
                "subsections": [
                    {"id": "1.1", "title": "需求背景", "key_points": [
                        f"{requirement.industry.value}行业背景分析",
                        "客户现状与挑战"
                    ]},
                    {"id": "1.2", "title": "关键需求", "key_points": requirement.core_pain_points[:3]},
                    {"id": "1.3", "title": "客户目标", "key_points": requirement.project_goals[:3]},
                ]
            },
            "part2_outline": {
                "title": "项目方法与整体框架",
                "subsections": [
                    {"id": "2.1", "title": "方法论", "key_points": [
                        "咨询方法论介绍",
                        "项目实施路径"
                    ]},
                    {"id": "2.2", "title": "MDS模型", "key_points": [
                        "五维诊断模型介绍",
                        "各维度关键指标"
                    ]},
                    {"id": "2.3", "title": "解决方案框架", "key_points": [
                        "整体解决思路",
                        "关键成功因素"
                    ]},
                ]
            },
            "part3_outline": {
                "title": "项目实施步骤",
                "subsections": [
                    {
                        "id": f"3.{i+1}",
                        "title": phase.phase_name,
                        "key_points": phase.key_activities[:3],
                        "deliverables": phase.deliverables[:2]
                    }
                    for i, phase in enumerate(requirement.phase_planning)
                ]
            },
            "part4_outline": {
                "title": "项目计划、团队与报价",
                "subsections": [
                    {"id": "4.1", "title": "项目计划", "key_points": [
                        f"总周期: {requirement.total_duration_weeks or '待定'}周",
                        "关键里程碑"
                    ]},
                    {"id": "4.2", "title": "团队配置", "key_points": [
                        "项目经理",
                        "高级顾问",
                        "分析师"
                    ]},
                    {"id": "4.3", "title": "项目报价", "key_points": [
                        "费用明细",
                        "付款条件"
                    ]},
                ]
            },
            "estimated_slides": 15 + len(requirement.phase_planning) * 2,
        }

        # 计算进度
        progress = get_progress_for_status(WorkflowStatus.OUTLINE_READY)

        logger.info(f"[{state['task_id']}] Outline generated: {outline_data['estimated_slides']} slides estimated")

        return update_state(
            state,
            status=WorkflowStatus.OUTLINE_READY,
            outline=outline_data,
            retrieved_evidence=evidence,
            progress_percentage=progress,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating outline: {e}")
        return mark_error(state, str(e), "generate_outline")


def human_review_outline_node(state: ReportState) -> ReportState:
    """
    节点：人工审核大纲

    这是一个中断点，等待用户确认或修改大纲。
    在 LangGraph 中使用 interrupt() 实现。
    """
    # 此节点只是状态标记，实际中断在 workflow 中处理
    return state


def confirm_outline_node(state: ReportState) -> ReportState:
    """
    节点：确认大纲

    用户确认或修改大纲后，进入内容生成阶段。
    """
    logger.info(f"[{state['task_id']}] Outline confirmed by user")

    from datetime import datetime
    return update_state(
        state,
        status=WorkflowStatus.GENERATING_SLIDES,
        outline_confirmed=True,
        outline_confirmed_at=datetime.now().isoformat(),
        progress_percentage=35.0,  # 开始生成内容
    )


def generate_slides_node(state: ReportState) -> ReportState:
    """
    节点：生成报告内容

    根据大纲逐页生成内容，结合 LlamaIndex 检索的历史素材。
    """
    logger.info(f"[{state['task_id']}] Generating slides...")

    try:
        from schemas import SlideDraft, ReportSection, REPORT_STRUCTURE
        from datetime import datetime

        outline = state.get("outline", {})
        slides = []
        completed_sections = []

        # Part 1: 项目需求的理解
        part1_slides = _generate_section_slides(
            state["task_id"],
            "part1",
            outline.get("part1_outline", {}),
            state.get("requirement", {}),
            state.get("retrieved_evidence", [])
        )
        slides.extend(part1_slides)
        completed_sections.append("part1")

        # Part 2: 项目方法与整体框架
        part2_slides = _generate_section_slides(
            state["task_id"],
            "part2",
            outline.get("part2_outline", {}),
            state.get("requirement", {}),
            state.get("retrieved_evidence", [])
        )
        slides.extend(part2_slides)
        completed_sections.append("part2")

        # Part 3: 项目实施步骤
        part3_slides = _generate_section_slides(
            state["task_id"],
            "part3",
            outline.get("part3_outline", {}),
            state.get("requirement", {}),
            state.get("retrieved_evidence", [])
        )
        slides.extend(part3_slides)
        completed_sections.append("part3")

        # Part 4: 项目计划、团队与报价
        part4_slides = _generate_section_slides(
            state["task_id"],
            "part4",
            outline.get("part4_outline", {}),
            state.get("requirement", {}),
            state.get("retrieved_evidence", [])
        )
        slides.extend(part4_slides)
        completed_sections.append("part4")

        logger.info(f"[{state['task_id']}] Generated {len(slides)} slides")

        return update_state(
            state,
            status=WorkflowStatus.SLIDES_READY,
            slides=slides,
            completed_sections=completed_sections,
            progress_percentage=80.0,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating slides: {e}")
        return mark_error(state, str(e), "generate_slides")


def _generate_section_slides(
    task_id: str,
    section: str,
    section_outline: Dict[str, Any],
    requirement: Dict[str, Any],
    evidence: list
) -> list:
    """生成单个章节的幻灯片"""
    slides = []

    section_titles = {
        "part1": "项目需求的理解",
        "part2": "项目方法与整体框架",
        "part3": "项目实施步骤",
        "part4": "项目计划、团队与报价",
    }

    # 添加章节分隔页
    slides.append({
        "slide_id": f"{task_id}_{section}_divider",
        "section": section,
        "subsection": section_titles.get(section, ""),
        "layout": "section_divider",
        "visual_strategy": "text",
        "title": section_titles.get(section, ""),
        "key_message": "",
        "bullets": [],
        "source_ref": "",
    })

    # 为每个子章节生成内容页
    for i, subsection in enumerate(section_outline.get("subsections", [])):
        slide_id = f"{task_id}_{section}_{i+1}"

        # 查找相关证据
        related_evidence = ""
        for ev in evidence:
            if any(kw in ev.get("query", "") for kw in subsection.get("key_points", [])):
                related_evidence = ev.get("content", "")[:200]
                break

        slide = {
            "slide_id": slide_id,
            "section": section,
            "subsection": f"{subsection.get('id', '')} {subsection.get('title', '')}",
            "layout": "bullet_points",
            "visual_strategy": "text",
            "title": subsection.get("title", ""),
            "key_message": subsection.get("title", ""),
            "bullets": subsection.get("key_points", [])[:4],
            "retrieved_evidence": related_evidence if related_evidence else None,
            "source_ref": "历史项目经验" if related_evidence else "AI生成",
        }
        slides.append(slide)

    return slides


def human_review_slides_node(state: ReportState) -> ReportState:
    """
    节点：人工审核内容

    这是一个中断点，等待用户确认或修改内容。
    """
    return state


def confirm_slides_node(state: ReportState) -> ReportState:
    """
    节点：确认内容

    用户确认或修改内容后，进入导出阶段。
    """
    logger.info(f"[{state['task_id']}] Slides confirmed")

    from datetime import datetime
    return update_state(
        state,
        status=WorkflowStatus.READY_FOR_EXPORT,
        slides_confirmed=True,
        slides_confirmed_at=datetime.now().isoformat(),
        progress_percentage=90.0,
    )


def export_pptx_node(state: ReportState) -> ReportState:
    """
    节点：导出 PPTX

    使用 python-pptx 将确认的内容渲染为 PPT 文件。
    """
    logger.info(f"[{state['task_id']}] Exporting PPTX...")

    try:
        # TODO: 实现实际的 PPTX 导出
        # 这里先返回一个模拟路径
        pptx_path = f"/tmp/{state['task_id']}_report.pptx"

        from datetime import datetime
        return update_state(
            state,
            status=WorkflowStatus.COMPLETED,
            pptx_path=pptx_path,
            exported_at=datetime.now().isoformat(),
            progress_percentage=100.0,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error exporting PPTX: {e}")
        return mark_error(state, str(e), "export_pptx")
