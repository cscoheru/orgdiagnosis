"""
Report Generation Workflow Nodes

Individual node implementations for the LangGraph workflow.
Each node performs a specific step in the report generation process.

Updated: 2026-03-21
- Added multi-level expansion nodes (modules, page_titles, page_content)
- Integrated semantic routing for layout auto-selection
- Added AI-powered content generation
"""

from typing import Dict, Any, List
from loguru import logger
from datetime import datetime
import asyncio

from .state import (
    ReportState,
    WorkflowStatus,
    update_state,
    mark_error,
    get_progress_for_status,
)
from .ai_service import report_ai_service


# ============================================================
# Multi-Level Expansion Step 1: Module Generation
# ============================================================

async def generate_modules_node(state: ReportState) -> ReportState:
    """
    节点：生成核心模块 (Multi-Level Expansion Step 1)

    根据客户需求和五维诊断结果，使用AI生成5-8个核心模块。
    每个模块对应一个诊断维度或业务领域。

    状态转换：PENDING → GENERATING_MODULES → MODULES_READY
    """
    logger.info(f"[{state['task_id']}] Generating modules with AI...")

    try:
        from schemas import ClientRequirement

        requirement = ClientRequirement(**state["requirement"])

        # 使用AI生成核心模块（直接await，LangGraph支持async节点）
        modules = await _generate_modules_with_ai(requirement, state.get("five_d_diagnosis"))

        progress = get_progress_for_status(WorkflowStatus.MODULES_READY)

        logger.info(f"[{state['task_id']}] AI generated {len(modules)} modules")

        return update_state(
            state,
            status=WorkflowStatus.MODULES_READY,
            modules=modules,
            progress_percentage=progress,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating modules: {e}")
        return mark_error(state, str(e), "generate_modules")


async def _generate_modules_with_ai(requirement, five_d_diagnosis: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """使用AI生成核心模块列表"""
    try:
        modules = await report_ai_service.generate_modules(
            client_name=requirement.client_name,
            industry=str(requirement.industry.value) if hasattr(requirement.industry, 'value') else str(requirement.industry),
            pain_points=requirement.core_pain_points,
            goals=requirement.project_goals,
            five_d_diagnosis=five_d_diagnosis
        )
        return modules
    except Exception as e:
        logger.warning(f"AI module generation failed: {e}, using fallback")
        return _generate_modules_fallback(requirement, five_d_diagnosis)


def _generate_modules_fallback(requirement, five_d_diagnosis: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """生成核心模块列表（fallback，无API时使用）"""
    modules = []

    # 模块 1: 项目需求理解 (必需)
    modules.append({
        "module_id": "module_1",
        "module_name": "需求理解",
        "module_title": "项目需求的理解",
        "diagnosis_dimension": None,
        "description": f"分析{requirement.client_name}的背景、核心痛点和项目目标",
        "estimated_pages": 5,
        "priority": 1
    })

    # 模块 2: 方法论与框架 (必需)
    modules.append({
        "module_id": "module_2",
        "module_name": "方法框架",
        "module_title": "项目方法与整体框架",
        "diagnosis_dimension": None,
        "description": "介绍咨询方法论和MDS五维诊断模型",
        "estimated_pages": 4,
        "priority": 2
    })

    # 模块 3-7: 根据痛点生成诊断模块
    dimension_map = {
        "战略": "strategy",
        "组织": "structure",
        "绩效": "performance",
        "薪酬": "compensation",
        "人才": "talent",
    }

    # 根据核心痛点推断相关维度
    pain_points_text = " ".join(requirement.core_pain_points)
    for keyword, dimension in dimension_map.items():
        if keyword in pain_points_text or (five_d_diagnosis and dimension in five_d_diagnosis):
            modules.append({
                "module_id": f"module_{len(modules) + 1}",
                "module_name": f"{keyword}诊断",
                "module_title": f"{keyword}维度诊断与建议",
                "diagnosis_dimension": dimension,
                "description": f"针对{keyword}维度的深入诊断和改进建议",
                "estimated_pages": 3,
                "priority": 3
            })

    # 模块: 项目实施步骤 (必需)
    modules.append({
        "module_id": f"module_{len(modules) + 1}",
        "module_name": "实施步骤",
        "module_title": "项目实施步骤",
        "diagnosis_dimension": None,
        "description": "详细的项目实施计划和时间安排",
        "estimated_pages": 4,
        "priority": 4
    })

    # 模块: 项目计划、团队与报价 (必需)
    modules.append({
        "module_id": f"module_{len(modules) + 1}",
        "module_name": "计划报价",
        "module_title": "项目计划、团队与报价",
        "diagnosis_dimension": None,
        "description": "项目团队配置、时间计划和费用报价",
        "estimated_pages": 3,
        "priority": 5
    })

    return modules


def _generate_modules(requirement, five_d_diagnosis: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """生成核心模块列表"""
    modules = []

    # 模块 1: 项目需求理解 (必需)
    modules.append({
        "module_id": "module_1",
        "module_name": "需求理解",
        "module_title": "项目需求的理解",
        "diagnosis_dimension": None,
        "description": f"分析{requirement.client_name}的背景、核心痛点和项目目标",
        "estimated_pages": 5,
        "priority": 1
    })

    # 模块 2: 方法论与框架 (必需)
    modules.append({
        "module_id": "module_2",
        "module_name": "方法框架",
        "module_title": "项目方法与整体框架",
        "diagnosis_dimension": None,
        "description": "介绍咨询方法论和MDS五维诊断模型",
        "estimated_pages": 4,
        "priority": 2
    })

    # 模块 3-7: 根据痛点生成诊断模块
    dimension_map = {
        "战略": "strategy",
        "组织": "structure",
        "绩效": "performance",
        "薪酬": "compensation",
        "人才": "talent",
    }

    # 根据核心痛点推断相关维度
    pain_points_text = " ".join(requirement.core_pain_points)
    for keyword, dimension in dimension_map.items():
        if keyword in pain_points_text or (five_d_diagnosis and dimension in five_d_diagnosis):
            modules.append({
                "module_id": f"module_{len(modules) + 1}",
                "module_name": f"{keyword}诊断",
                "module_title": f"{keyword}维度诊断与建议",
                "diagnosis_dimension": dimension,
                "description": f"针对{keyword}维度的深入诊断和改进建议",
                "estimated_pages": 3,
                "priority": 3
            })

    # 模块: 项目实施步骤 (必需)
    modules.append({
        "module_id": f"module_{len(modules) + 1}",
        "module_name": "实施步骤",
        "module_title": "项目实施步骤",
        "diagnosis_dimension": None,
        "description": "详细的项目实施计划和时间安排",
        "estimated_pages": 4,
        "priority": 4
    })

    # 模块: 项目计划、团队与报价 (必需)
    modules.append({
        "module_id": f"module_{len(modules) + 1}",
        "module_name": "计划报价",
        "module_title": "项目计划、团队与报价",
        "diagnosis_dimension": None,
        "description": "项目团队配置、时间计划和费用报价",
        "estimated_pages": 3,
        "priority": 5
    })

    return modules


def confirm_modules_node(state: ReportState) -> ReportState:
    """
    节点：确认模块 (Multi-Level Expansion Step 1)

    用户确认或修改模块后，标记模块已确认。
    """
    logger.info(f"[{state['task_id']}] Executing confirm_modules node")

    return update_state(
        state,
        modules_confirmed=True,
        modules_confirmed_at=datetime.now().isoformat(),
        progress_percentage=18.0,
    )


# ============================================================
# Multi-Level Expansion Step 2: Page Title Generation
# ============================================================

async def generate_page_titles_node(state: ReportState) -> ReportState:
    """
    节点：生成页面标题 (Multi-Level Expansion Step 2)

    根据确认的模块，使用AI为每个模块生成2-4个页面标题。
    每个页面标题包含核心论点方向和建议布局。

    状态转换：MODULES_READY → GENERATING_PAGE_TITLES → PAGE_TITLES_READY
    """
    logger.info(f"[{state['task_id']}] Generating page titles with AI...")

    try:
        modules = state.get("modules", [])
        if not modules:
            logger.warning(f"[{state['task_id']}] No modules found, skipping page titles generation")
            return update_state(
                state,
                status=WorkflowStatus.PAGE_TITLES_READY,
                page_titles=[],
                progress_percentage=25.0,
            )

        # 使用AI为每个模块生成页面标题（直接await）
        page_titles = await _generate_page_titles_with_ai(
            modules,
            state.get("requirement", {}),
            state.get("five_d_diagnosis")
        )

        progress = get_progress_for_status(WorkflowStatus.PAGE_TITLES_READY)

        logger.info(f"[{state['task_id']}] AI generated {len(page_titles)} page titles")

        return update_state(
            state,
            status=WorkflowStatus.PAGE_TITLES_READY,
            page_titles=page_titles,
            progress_percentage=progress,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating page titles: {e}")
        return mark_error(state, str(e), "generate_page_titles")


async def _generate_page_titles_with_ai(
    modules: List[Dict[str, Any]],
    requirement: Dict[str, Any],
    five_d_diagnosis: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """使用AI为所有模块生成页面标题 - 并行执行"""
    client_name = requirement.get("client_name", "客户")
    industry = str(requirement.get("industry", "通用"))
    pain_points = requirement.get("core_pain_points", [])

    async def generate_for_module(module):
        """为单个模块生成页面标题"""
        try:
            return await report_ai_service.generate_page_titles(
                module=module,
                client_name=client_name,
                industry=industry,
                pain_points=pain_points,
                five_d_diagnosis=five_d_diagnosis
            )
        except Exception as e:
            logger.warning(f"AI page title generation failed for module {module.get('module_id')}: {e}, using fallback")
            return _generate_page_titles_fallback(module, requirement, five_d_diagnosis)

    # 并行执行所有模块的页面标题生成
    logger.info(f"[Parallel] Generating page titles for {len(modules)} modules in parallel...")
    results = await asyncio.gather(*[generate_for_module(m) for m in modules])

    # 合并结果
    all_page_titles = []
    for page_titles in results:
        all_page_titles.extend(page_titles)

    return all_page_titles


def _generate_page_titles_fallback(
    module: Dict[str, Any],
    requirement: Dict[str, Any],
    five_d_diagnosis: Dict[str, Any] = None
) -> List[Dict[str, Any]]:
    """为单个模块生成页面标题（fallback，无API时使用）"""
    page_titles = []
    module_id = module["module_id"]
    module_name = module["module_name"]
    dimension = module.get("diagnosis_dimension")

    if module_name == "需求理解":
        # 模块 1: 项目需求理解
        page_titles.extend([
            {
                "page_id": f"{module_id}_page_1",
                "module_id": module_id,
                "page_title": "行业背景分析",
                "key_direction": f"分析{requirement.get('industry', '客户')}行业的发展趋势和挑战",
                "suggested_layout": "bullet_points",
                "estimated_elements": 4
            },
            {
                "page_id": f"{module_id}_page_2",
                "module_id": module_id,
                "page_title": f"{requirement.get('client_name', '客户')}现状分析",
                "key_direction": "通过诊断访谈识别客户当前的核心问题",
                "suggested_layout": "bullet_points",
                "estimated_elements": 4
            },
            {
                "page_id": f"{module_id}_page_3",
                "module_id": module_id,
                "page_title": "核心痛点分析",
                "key_direction": "系统梳理客户最迫切需要解决的问题",
                "suggested_layout": "bullet_points",
                "estimated_elements": len(requirement.get("core_pain_points", [])) or 3
            },
            {
                "page_id": f"{module_id}_page_4",
                "module_id": module_id,
                "page_title": "项目目标设定",
                "key_direction": "设定清晰可衡量的项目目标",
                "suggested_layout": "bullet_points",
                "estimated_elements": len(requirement.get("project_goals", [])) or 3
            },
        ])

    elif module_name == "方法框架":
        # 模块 2: 方法论与框架
        page_titles.extend([
            {
                "page_id": f"{module_id}_page_1",
                "module_id": module_id,
                "page_title": "咨询方法论",
                "key_direction": "介绍系统性诊断方法和实施路径",
                "suggested_layout": "bullet_points",
                "estimated_elements": 4
            },
            {
                "page_id": f"{module_id}_page_2",
                "module_id": module_id,
                "page_title": "MDS五维诊断模型",
                "key_direction": "从五个维度全面诊断组织效能",
                "suggested_layout": "five_dimensions_radar",
                "estimated_elements": 5
            },
            {
                "page_id": f"{module_id}_page_3",
                "module_id": module_id,
                "page_title": "解决方案框架",
                "key_direction": "基于诊断结果设计针对性解决方案",
                "suggested_layout": "bullet_points",
                "estimated_elements": 3
            },
        ])

    elif "诊断" in module_name:
        # 诊断维度模块
        page_titles.extend([
            {
                "page_id": f"{module_id}_page_1",
                "module_id": module_id,
                "page_title": f"{module_name}现状",
                "key_direction": f"分析{module_name.replace('诊断', '')}维度的当前状态",
                "suggested_layout": "bullet_points",
                "estimated_elements": 4
            },
            {
                "page_id": f"{module_id}_page_2",
                "module_id": module_id,
                "page_title": f"{module_name}问题",
                "key_direction": f"识别{module_name.replace('诊断', '')}维度存在的核心问题",
                "suggested_layout": "bullet_points",
                "estimated_elements": 3
            },
            {
                "page_id": f"{module_id}_page_3",
                "module_id": module_id,
                "page_title": f"{module_name}建议",
                "key_direction": f"提出{module_name.replace('诊断', '')}维度的改进建议",
                "suggested_layout": "bullet_points",
                "estimated_elements": 4
            },
        ])

    elif module_name == "实施步骤":
        # 模块: 项目实施步骤
        phases = requirement.get("phase_planning", [])
        for i, phase in enumerate(phases[:4]):
            page_titles.append({
                "page_id": f"{module_id}_page_{i+1}",
                "module_id": module_id,
                "page_title": phase.get("phase_name", f"阶段{i+1}"),
                "key_direction": f"阶段{i+1}的核心活动和交付物",
                "suggested_layout": "bullet_points",
                "estimated_elements": len(phase.get("key_activities", [])) or 3
            })

    elif module_name == "计划报价":
        # 模块: 项目计划、团队与报价
        page_titles.extend([
            {
                "page_id": f"{module_id}_page_1",
                "module_id": module_id,
                "page_title": "项目整体计划",
                "key_direction": f"项目总周期约{requirement.get('total_duration_weeks', '待定')}周",
                "suggested_layout": "gantt_chart",
                "estimated_elements": 6
            },
            {
                "page_id": f"{module_id}_page_2",
                "module_id": module_id,
                "page_title": "项目团队配置",
                "key_direction": "配置资深顾问团队确保项目高质量交付",
                "suggested_layout": "team_table",
                "estimated_elements": 4
            },
            {
                "page_id": f"{module_id}_page_3",
                "module_id": module_id,
                "page_title": "项目报价",
                "key_direction": "提供透明合理的报价方案",
                "suggested_layout": "pricing_table",
                "estimated_elements": 5
            },
        ])

    return page_titles


def confirm_page_titles_node(state: ReportState) -> ReportState:
    """
    节点：确认页面标题 (Multi-Level Expansion Step 2)

    用户确认或修改页面标题后，标记已确认。
    """
    logger.info(f"[{state['task_id']}] Executing confirm_page_titles node")

    return update_state(
        state,
        page_titles_confirmed=True,
        page_titles_confirmed_at=datetime.now().isoformat(),
        progress_percentage=28.0,
    )


# ============================================================
# Multi-Level Expansion Step 3: Page Content Generation
# ============================================================


def generate_outline_node(state: ReportState) -> ReportState:
    """
    节点：生成报告大纲

    根据客户需求和五维诊断结果，生成四部分报告大纲。
    大纲包含多层次结构：章节 → 子章节 → 幻灯片级别
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

        # 生成大纲结构 - 包含幻灯片级别详情
        outline_data = {
            "report_id": state["task_id"],
            "client_name": requirement.client_name,
            "part1_outline": _generate_part1_outline(requirement),
            "part2_outline": _generate_part2_outline(requirement),
            "part3_outline": _generate_part3_outline(requirement),
            "part4_outline": _generate_part4_outline(requirement),
        }

        # 计算总幻灯片数
        total_slides = 1  # 封面
        for part_key in ["part1_outline", "part2_outline", "part3_outline", "part4_outline"]:
            part = outline_data[part_key]
            total_slides += 1  # 章节分隔页
            for subsection in part.get("subsections", []):
                total_slides += len(subsection.get("slides", [1]))  # 每个子章节的幻灯片数

        outline_data["estimated_slides"] = total_slides

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


def _generate_part1_outline(requirement) -> Dict[str, Any]:
    """生成第一部分：项目需求的理解 - 带幻灯片级别详情"""
    return {
        "title": "项目需求的理解",
        "subsections": [
            {
                "id": "1.1",
                "title": "需求背景",
                "key_points": [
                    f"{requirement.industry.value}行业背景分析",
                    "客户现状与挑战"
                ],
                "slides": [
                    {
                        "slide_id": "1.1.1",
                        "title": f"{requirement.industry.value}行业发展趋势",
                        "key_message": f"{requirement.industry.value}行业正处于转型期，面临多重挑战与机遇",
                        "layout": "bullet_points"
                    },
                    {
                        "slide_id": "1.1.2",
                        "title": f"{requirement.client_name}现状分析",
                        "key_message": "基于诊断访谈，识别出客户当前的核心挑战",
                        "layout": "bullet_points"
                    }
                ]
            },
            {
                "id": "1.2",
                "title": "关键需求",
                "key_points": requirement.core_pain_points[:3],
                "slides": [
                    {
                        "slide_id": "1.2.1",
                        "title": "核心痛点分析",
                        "key_message": "通过系统性诊断，识别出客户最迫切需要解决的问题",
                        "layout": "bullet_points"
                    },
                    {
                        "slide_id": "1.2.2",
                        "title": "痛点影响分析",
                        "key_message": "这些痛点对客户业务产生的具体影响",
                        "layout": "bullet_points"
                    }
                ]
            },
            {
                "id": "1.3",
                "title": "客户目标",
                "key_points": requirement.project_goals[:3],
                "slides": [
                    {
                        "slide_id": "1.3.1",
                        "title": "项目目标设定",
                        "key_message": "基于客户需求，设定清晰可衡量的项目目标",
                        "layout": "bullet_points"
                    }
                ]
            },
        ]
    }


def _generate_part2_outline(requirement) -> Dict[str, Any]:
    """生成第二部分：项目方法与整体框架"""
    return {
        "title": "项目方法与整体框架",
        "subsections": [
            {
                "id": "2.1",
                "title": "方法论",
                "key_points": ["咨询方法论介绍", "项目实施路径"],
                "slides": [
                    {
                        "slide_id": "2.1.1",
                        "title": "咨询方法论",
                        "key_message": "采用系统性诊断方法，确保问题识别的全面性和准确性",
                        "layout": "bullet_points"
                    },
                    {
                        "slide_id": "2.1.2",
                        "title": "项目实施路径",
                        "key_message": "从诊断到落地，四阶段闭环实施",
                        "layout": "process_flow"
                    }
                ]
            },
            {
                "id": "2.2",
                "title": "MDS模型",
                "key_points": ["五维诊断模型介绍", "各维度关键指标"],
                "slides": [
                    {
                        "slide_id": "2.2.1",
                        "title": "MDS五维诊断模型",
                        "key_message": "从战略、组织、绩效、薪酬、人才五个维度系统性诊断组织效能",
                        "layout": "five_dimensions_radar"
                    },
                    {
                        "slide_id": "2.2.2",
                        "title": "各维度关键指标",
                        "key_message": "每个维度对应的具体评估指标和诊断方法",
                        "layout": "bullet_points"
                    }
                ]
            },
            {
                "id": "2.3",
                "title": "解决方案框架",
                "key_points": ["整体解决思路", "关键成功因素"],
                "slides": [
                    {
                        "slide_id": "2.3.1",
                        "title": "解决方案整体框架",
                        "key_message": "基于诊断结果，设计针对性的解决方案框架",
                        "layout": "bullet_points"
                    }
                ]
            },
        ]
    }


def _generate_part3_outline(requirement) -> Dict[str, Any]:
    """生成第三部分：项目实施步骤"""
    subsections = []

    for i, phase in enumerate(requirement.phase_planning):
        slides = []
        for j, activity in enumerate(phase.key_activities[:3]):
            slides.append({
                "slide_id": f"3.{i+1}.{j+1}",
                "title": activity,
                "key_message": f"{phase.phase_name}阶段的核心活动",
                "layout": "bullet_points"
            })

        # 添加交付物幻灯片
        if phase.deliverables:
            slides.append({
                "slide_id": f"3.{i+1}.{len(slides)+1}",
                "title": f"{phase.phase_name}交付物",
                "key_message": "本阶段将交付以下关键成果",
                "layout": "bullet_points"
            })

        subsections.append({
            "id": f"3.{i+1}",
            "title": phase.phase_name,
            "key_points": phase.key_activities[:3],
            "deliverables": phase.deliverables[:2],
            "slides": slides if slides else [{"slide_id": f"3.{i+1}.1", "title": phase.phase_name, "key_message": "", "layout": "bullet_points"}]
        })

    return {
        "title": "项目实施步骤",
        "subsections": subsections
    }


def _generate_part4_outline(requirement) -> Dict[str, Any]:
    """生成第四部分：项目计划、团队与报价"""
    return {
        "title": "项目计划、团队与报价",
        "subsections": [
            {
                "id": "4.1",
                "title": "项目计划",
                "key_points": [
                    f"总周期: {requirement.total_duration_weeks or '待定'}周",
                    "关键里程碑"
                ],
                "slides": [
                    {
                        "slide_id": "4.1.1",
                        "title": "项目整体计划",
                        "key_message": f"项目总周期 {requirement.total_duration_weeks or '待定'} 周，分阶段推进",
                        "layout": "gantt_chart"
                    }
                ]
            },
            {
                "id": "4.2",
                "title": "团队配置",
                "key_points": ["项目经理", "高级顾问", "分析师"],
                "slides": [
                    {
                        "slide_id": "4.2.1",
                        "title": "项目团队配置",
                        "key_message": "配置经验丰富的顾问团队，确保项目高质量交付",
                        "layout": "team_table"
                    }
                ]
            },
            {
                "id": "4.3",
                "title": "项目报价",
                "key_points": ["费用明细", "付款条件"],
                "slides": [
                    {
                        "slide_id": "4.3.1",
                        "title": "项目报价",
                        "key_message": "基于工作量和团队能力，提供有竞争力的报价",
                        "layout": "pricing_table"
                    }
                ]
            },
        ]
    }


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

    此节点作为用户确认大纲的标记点。
    实际执行时会直接进入 generate_slides_node。

    注意：由于 interrupt_before=["confirm_outline"]，工作流会在此节点前暂停，
    等待用户调用 confirm_outline() 后才会执行此节点。
    """
    logger.info(f"[{state['task_id']}] Executing confirm_outline node")

    from datetime import datetime

    # 标记大纲已确认，准备生成内容
    return update_state(
        state,
        outline_confirmed=True,
        outline_confirmed_at=datetime.now().isoformat(),
        progress_percentage=35.0,
        # 注意：不改变 status，让 generate_slides_node 来设置
    )


async def generate_slides_node(state: ReportState) -> ReportState:
    """
    节点：生成报告内容

    支持两种模式：
    - 多层扩展模式：使用 page_titles 生成幻灯片
    - 传统模式：使用 outline 生成幻灯片

    状态转换：GENERATING_SLIDES → SLIDES_READY
    """
    logger.info(f"[{state['task_id']}] Starting slide generation...")

    try:
        from schemas import SlideDraft, ReportSection, REPORT_STRUCTURE

        # 首先更新状态为 GENERATING_SLIDES
        state = update_state(
            state,
            status=WorkflowStatus.GENERATING_SLIDES,
            progress_percentage=40.0,
        )

        slides = []
        completed_sections = []

        # Check if using multi-level expansion (page_titles exists)
        page_titles = state.get("page_titles", [])

        if page_titles:
            # Multi-level expansion mode: generate slides from page_titles
            logger.info(f"[{state['task_id']}] Using multi-level expansion with {len(page_titles)} page titles")
            slides = await _generate_slides_from_page_titles_async(
                state["task_id"],
                page_titles,
                state.get("modules", []),
                state.get("requirement", {}),
                state.get("retrieved_evidence", [])
            )
            completed_sections = list(set(pt.get("module_id", "unknown") for pt in page_titles))

        else:
            # Legacy mode: generate slides from outline
            logger.info(f"[{state['task_id']}] Using legacy outline mode")
            outline = state.get("outline", {})

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

        logger.info(f"[{state['task_id']}] Generated {len(slides)} slides, ready for review")

        return update_state(
            state,
            status=WorkflowStatus.SLIDES_READY,  # ⭐ 关键：生成完成后设置为 SLIDES_READY
            slides=slides,
            completed_sections=completed_sections,
            progress_percentage=80.0,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error generating slides: {e}")
        return mark_error(state, str(e), "generate_slides")


def _generate_slides_from_page_titles(
    task_id: str,
    page_titles: List[Dict[str, Any]],
    modules: List[Dict[str, Any]],
    requirement: Dict[str, Any],
    evidence: list
) -> list:
    """
    从 page_titles 生成幻灯片 (Multi-Level Expansion Step 3)
    使用AI生成每个幻灯片的内容
    """
    # 使用异步函数生成所有幻灯片
    return asyncio.run(_generate_slides_from_page_titles_async(
        task_id, page_titles, modules, requirement, evidence
    ))


async def _generate_slides_from_page_titles_async(
    task_id: str,
    page_titles: List[Dict[str, Any]],
    modules: List[Dict[str, Any]],
    requirement: Dict[str, Any],
    evidence: list
) -> list:
    """
    异步生成幻灯片内容 - 并行执行
    """
    # Build module lookup
    module_map = {m["module_id"]: m for m in modules}

    client_name = requirement.get("client_name", "客户")
    industry = str(requirement.get("industry", "通用"))
    pain_points = requirement.get("core_pain_points", [])

    # 获取知识库上下文（共享）
    knowledge_context = ""
    if evidence:
        for ev in evidence[:2]:
            if ev.get("content"):
                knowledge_context += ev["content"][:500] + "\n\n"

    async def generate_single_slide(page_title, module_id, module):
        """为单个页面生成幻灯片内容"""
        page_id = page_title.get("page_id", f"page_0")
        page_title_text = page_title.get("page_title", "")
        key_direction = page_title.get("key_direction", "")
        suggested_layout = page_title.get("suggested_layout", "bullet_points")

        try:
            # 使用AI生成内容
            ai_content = await report_ai_service.generate_slide_content(
                page_title=page_title_text,
                key_direction=key_direction,
                client_name=client_name,
                industry=industry,
                pain_points=pain_points,
                knowledge_context=knowledge_context
            )

            title = ai_content.get("title", page_title_text)
            key_message = ai_content.get("key_message", key_direction)
            bullets = ai_content.get("bullets", [])

        except Exception as e:
            logger.warning(f"AI slide content generation failed for {page_id}: {e}, using fallback")
            # Fallback to mock content
            title = page_title_text
            key_message = key_direction
            bullets = _generate_bullets_from_direction(
                key_direction, requirement, evidence, 3
            )

        return {
            "slide_id": f"{task_id}_{page_id}",
            "module_id": module_id,
            "page_id": page_id,
            "section": module_id,
            "subsection": module.get("module_title", page_title_text),
            "layout": suggested_layout,
            "visual_strategy": "text",
            "title": title,
            "key_message": key_message,
            "bullets": bullets,
            "retrieved_evidence": knowledge_context[:500] if knowledge_context else None,
            "source_ref": "AI生成",
        }

    # 准备任务列表
    tasks = []
    module_dividers = {}  # Track which modules need dividers
    current_module_id = None

    for page_title in page_titles:
        module_id = page_title.get("module_id", "")
        module = module_map.get(module_id, {})

        # 记录需要添加divider的模块
        if module_id != current_module_id and module:
            module_dividers[module_id] = {
                "slide_id": f"{task_id}_{module_id}_divider",
                "section": module_id,
                "subsection": module.get("module_title", ""),
                "layout": "section_divider",
                "visual_strategy": "text",
                "title": module.get("module_title", ""),
                "key_message": "",
                "bullets": [],
                "source_ref": "",
            }
            current_module_id = module_id

        # 添加幻灯片生成任务
        tasks.append(generate_single_slide(page_title, module_id, module))

    # 并行执行所有幻灯片生成
    logger.info(f"[Parallel] Generating {len(tasks)} slides in parallel...")
    slides_content = await asyncio.gather(*tasks)

    # 组装最终结果，插入divider
    slides = []
    seen_modules = set()

    for i, page_title in enumerate(page_titles):
        module_id = page_title.get("module_id", "")

        # 如果是新模块，先添加divider
        if module_id not in seen_modules and module_id in module_dividers:
            slides.append(module_dividers[module_id])
            seen_modules.add(module_id)

        # 添加幻灯片内容
        slides.append(slides_content[i])

    return slides


def _generate_bullets_from_direction(
    key_direction: str,
    requirement: Dict[str, Any],
    evidence: list,
    estimated_count: int
) -> List[str]:
    """根据核心方向生成支撑论点"""
    bullets = []

    client_name = requirement.get("client_name", "客户")
    industry = requirement.get("industry", "")
    pain_points = requirement.get("core_pain_points", [])
    goals = requirement.get("project_goals", [])

    # Generate contextual bullets based on direction keywords
    if "行业" in key_direction or "背景" in key_direction:
        bullets = [
            f"{industry}行业正处于快速发展与转型期",
            f"市场竞争加剧，企业面临多重挑战",
            f"数字化转型成为行业共识",
            f"客户对服务质量和效率要求不断提高"
        ]
    elif "现状" in key_direction or "分析" in key_direction:
        bullets = [
            f"{client_name}当前组织架构已具规模",
            f"核心业务稳定，但内部协作效率有待提升",
            f"人才梯队建设需要加强",
            f"绩效激励体系需要优化完善"
        ]
    elif "痛点" in key_direction or "问题" in key_direction:
        bullets = pain_points[:estimated_count] if pain_points else [
            "组织效率有待提升",
            "跨部门协作需要加强",
            "人才激励机制需要优化"
        ]
    elif "目标" in key_direction:
        bullets = goals[:estimated_count] if goals else [
            "提升组织整体效能",
            "建立高效协作机制",
            "实现可持续发展"
        ]
    elif "方法" in key_direction or "模型" in key_direction:
        bullets = [
            "采用系统性诊断方法论",
            "结合定量分析与定性访谈",
            "借鉴行业最佳实践",
            "确保方案的针对性和可落地性"
        ]
    elif "实施" in key_direction or "阶段" in key_direction:
        bullets = [
            "分阶段推进，确保稳步落地",
            "每个阶段设置明确里程碑",
            "及时复盘调整，确保效果达成"
        ]
    elif "团队" in key_direction or "配置" in key_direction:
        bullets = [
            "项目经理：统筹项目整体进度",
            "高级顾问：负责方案设计与指导",
            "分析师：负责数据收集与分析"
        ]
    elif "报价" in key_direction or "费用" in key_direction:
        bullets = [
            "诊断阶段费用",
            "方案设计阶段费用",
            "落地实施阶段费用",
            "培训与辅导费用"
        ]
    else:
        # Default bullets based on estimated count
        bullets = [f"要点 {i+1}" for i in range(min(estimated_count, 4))]

    return bullets[:estimated_count]


def _generate_key_message_from_direction(
    page_title: str,
    key_direction: str,
    requirement: Dict[str, Any]
) -> str:
    """根据页面标题和方向生成核心观点"""
    client_name = requirement.get("client_name", "客户")

    if "行业" in page_title:
        return f"{requirement.get('industry', '')}行业正处于变革期，{client_name}面临核心挑战需要系统性解决"
    elif "现状" in page_title:
        return f"通过诊断分析，{client_name}当前状态清晰呈现，为后续改进奠定基础"
    elif "痛点" in page_title:
        return f"识别到{client_name}的核心痛点，需要针对性解决方案"
    elif "目标" in page_title:
        return f"项目目标是帮助{client_name}实现组织能力提升与业务增长"
    elif "方法" in page_title:
        return "采用MDS五维诊断方法论，系统分析组织现状与改进方向"
    elif "实施" in page_title:
        return "按阶段推进项目实施，确保每个环节落实到位"
    elif "团队" in page_title:
        return "配置资深顾问团队，确保项目高质量交付"
    elif "报价" in page_title:
        return "提供透明合理的报价方案，匹配项目价值"

    return key_direction if key_direction else page_title


def _generate_section_slides(
    task_id: str,
    section: str,
    section_outline: Dict[str, Any],
    requirement: Dict[str, Any],
    evidence: list
) -> list:
    """
    生成单个章节的幻灯片

    根据章节类型和需求数据，生成有意义的 key_message 和详细的支撑论点。
    如果大纲中包含 slides 数组，则使用详细的幻灯片级别数据。
    """
    slides = []

    section_titles = {
        "part1": "项目需求的理解",
        "part2": "项目方法与整体框架",
        "part3": "项目实施步骤",
        "part4": "项目计划、团队与报价",
    }

    logger.info(f"[{task_id}] Generating slides for {section}, outline subsections: {len(section_outline.get('subsections', []))}")

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
        subsection_id = subsection.get("id", "")
        subsection_title = subsection.get("title", "")
        key_points = subsection.get("key_points", [])

        # 检查是否有详细的幻灯片级别数据
        outline_slides = subsection.get("slides", [])
        logger.info(f"[{task_id}] Subsection {subsection_id}: {len(outline_slides)} slides in outline")

        if outline_slides:
            # 使用大纲中的幻灯片级别数据
            for j, outline_slide in enumerate(outline_slides):
                slide_id = f"{task_id}_{outline_slide.get('slide_id', f'{section}_{i+1}_{j+1}')}"

                # 生成详细支撑论点
                bullets = _generate_detailed_bullets(
                    section, subsection_id, key_points, requirement, evidence
                )

                # 查找相关证据
                related_evidence = ""
                evidence_source = ""
                for ev in evidence:
                    query = ev.get("query", "")
                    if any(kw in query for kw in key_points):
                        related_evidence = ev.get("content", "")[:300]
                        evidence_source = ev.get("source", "历史项目")
                        break

                slide = {
                    "slide_id": slide_id,
                    "section": section,
                    "subsection": f"{subsection_id} {subsection_title}",
                    "layout": outline_slide.get("layout", "bullet_points"),
                    "visual_strategy": "text",
                    "title": outline_slide.get("title", subsection_title),
                    "key_message": outline_slide.get("key_message", ""),
                    "bullets": bullets,
                    "retrieved_evidence": related_evidence if related_evidence else None,
                    "source_ref": evidence_source if related_evidence else "AI生成",
                }
                slides.append(slide)
        else:
            # 使用传统方式生成单个幻灯片
            slide_id = f"{task_id}_{section}_{i+1}"

            # 生成核心观点 (key_message)
            key_message = _generate_key_message(
                section, subsection_id, subsection_title, key_points, requirement
            )

            # 生成详细支撑论点 (bullets)
            bullets = _generate_detailed_bullets(
                section, subsection_id, key_points, requirement, evidence
            )

            # 查找相关证据
            related_evidence = ""
            evidence_source = ""
            for ev in evidence:
                query = ev.get("query", "")
                if any(kw in query for kw in key_points):
                    related_evidence = ev.get("content", "")[:300]
                    evidence_source = ev.get("source", "历史项目")
                    break

            # 推荐布局类型
            layout = _recommend_layout(section, subsection_id, key_points)

            slide = {
                "slide_id": slide_id,
                "section": section,
                "subsection": f"{subsection_id} {subsection_title}",
                "layout": layout,
                "visual_strategy": "text",
                "title": subsection_title,
                "key_message": key_message,
                "bullets": bullets,
                "retrieved_evidence": related_evidence if related_evidence else None,
                "source_ref": evidence_source if related_evidence else "AI生成",
            }
            slides.append(slide)

    logger.info(f"[{task_id}] Generated {len(slides)} slides for section {section}")
    return slides


def _generate_key_message(
    section: str,
    subsection_id: str,
    subsection_title: str,
    key_points: list,
    requirement: Dict[str, Any]
) -> str:
    """
    根据章节和上下文生成核心观点

    key_message 是每页幻灯片的核心论点，应该是一个完整的陈述句。
    """
    client_name = requirement.get("client_name", "客户")
    industry = requirement.get("industry", "通用")
    pain_points = requirement.get("core_pain_points", [])
    goals = requirement.get("project_goals", [])

    # 根据不同章节生成不同的 key_message
    if section == "part1":
        if subsection_id == "1.1":
            return f"{industry}行业正处于快速变革期，{client_name}面临核心挑战需要系统性解决"
        elif subsection_id == "1.2":
            if pain_points:
                return f"通过诊断分析，{client_name}的核心痛点集中在：{pain_points[0] if pain_points else '组织效能'}"
            return f"识别到{client_name}的关键需求，需要针对性解决方案"
        elif subsection_id == "1.3":
            if goals:
                return f"项目目标是：{goals[0]}"
            return f"帮助{client_name}实现组织能力提升与业务增长"

    elif section == "part2":
        if subsection_id == "2.1":
            return "采用MDS五维诊断方法论，系统分析组织现状与改进方向"
        elif subsection_id == "2.2":
            return "MDS模型从战略、组织、绩效、薪酬、人才五个维度进行全面诊断"
        elif subsection_id == "2.3":
            return "基于诊断结果，设计针对性的解决方案框架"

    elif section == "part3":
        # 实施步骤的 key_message 基于阶段名称
        if key_points:
            return f"本阶段核心任务：{key_points[0]}"
        return "按阶段推进项目实施，确保每个环节落实到位"

    elif section == "part4":
        if subsection_id == "4.1":
            weeks = requirement.get("total_duration_weeks", "待定")
            return f"项目总周期约{weeks}周，分阶段交付关键成果"
        elif subsection_id == "4.2":
            return "配置资深顾问团队，确保项目高质量交付"
        elif subsection_id == "4.3":
            return "提供透明合理的报价方案，匹配项目价值"

    # 默认：使用标题作为 key_message
    return subsection_title


def _generate_detailed_bullets(
    section: str,
    subsection_id: str,
    key_points: list,
    requirement: Dict[str, Any],
    evidence: list
) -> list:
    """
    生成详细的支撑论点

    将简单的 key_points 扩展为有逻辑支撑的论点。
    """
    bullets = []

    # 基础论点
    for i, point in enumerate(key_points[:4]):
        # 尝试添加支撑论据
        support = _find_supporting_evidence(point, evidence)
        if support:
            bullets.append(f"{point}：{support}")
        else:
            # 添加通用的支撑逻辑
            bullet = _enhance_bullet(section, subsection_id, i, point, requirement)
            bullets.append(bullet)

    # 确保至少有 2 个论点
    if len(bullets) < 2:
        bullets.append("详细内容将在项目启动后进一步明确")

    return bullets[:5]  # 最多 5 条


def _find_supporting_evidence(point: str, evidence: list) -> str:
    """从检索到的证据中查找支撑内容"""
    for ev in evidence:
        query = ev.get("query", "")
        content = ev.get("content", "")
        if point in query or query in point:
            # 提取关键句子
            sentences = content.split("。")
            for sentence in sentences:
                if len(sentence) > 20 and len(sentence) < 100:
                    return sentence[:80]
    return ""


def _enhance_bullet(
    section: str,
    subsection_id: str,
    index: int,
    point: str,
    requirement: Dict[str, Any]
) -> str:
    """增强单个论点，添加上下文"""
    client_name = requirement.get("client_name", "客户")
    industry = requirement.get("industry", "通用")

    # Part 1: 需求理解
    if section == "part1":
        if subsection_id == "1.1":
            enhancements = [
                f"{industry}行业整体发展趋势与挑战",
                f"{client_name}当前面临的核心问题",
                "与行业标杆企业的差距分析"
            ]
            return enhancements[index] if index < len(enhancements) else point
        elif subsection_id == "1.2":
            return f"• {point}：通过诊断访谈和数据分析识别"
        elif subsection_id == "1.3":
            return f"• {point}：这是项目的核心价值导向"

    # Part 2: 方法框架
    elif section == "part2":
        if subsection_id == "2.1":
            method_enhancements = [
                "• 系统性诊断方法，确保问题识别的全面性",
                "• 结合定量分析与定性访谈，提高结论可靠性",
                "• 借鉴行业最佳实践，提供针对性建议"
            ]
            return method_enhancements[index] if index < len(method_enhancements) else point
        elif subsection_id == "2.2":
            return f"• {point}：MDS五维模型的核心维度"
        elif subsection_id == "2.3":
            return f"• {point}：解决方案的设计原则"

    # Part 3: 实施步骤
    elif section == "part3":
        phases = requirement.get("phase_planning", [])
        if phases:
            deliverables = phases[0].get("deliverables", []) if phases else []
            if deliverables and index < len(deliverables):
                return f"• 交付物：{deliverables[index]}"
        return f"• {point}"

    # Part 4: 计划团队报价
    elif section == "part4":
        return f"• {point}"

    return f"• {point}"


def _recommend_layout(section: str, subsection_id: str, key_points: list) -> str:
    """推荐幻灯片布局类型"""
    # 根据内容特点推荐布局
    if subsection_id in ["2.2", "3.1"]:
        return "five_dimensions_radar" if "五维" in str(key_points) else "bullet_points"
    elif subsection_id == "4.1":
        return "gantt_chart"
    elif subsection_id == "4.2":
        return "team_table"
    elif subsection_id == "4.3":
        return "pricing_table"
    elif len(key_points) >= 4:
        return "two_columns"

    return "bullet_points"


def human_review_slides_node(state: ReportState) -> ReportState:
    """
    节点：人工审核内容

    这是一个中断点，等待用户确认或修改内容。
    """
    return state


def confirm_slides_node(state: ReportState) -> ReportState:
    """
    节点：确认内容

    此节点作为用户确认内容的标记点。
    实际执行时会直接进入 export_pptx_node。

    注意：由于 interrupt_before=["confirm_slides"]，工作流会在此节点前暂停，
    等待用户调用 confirm_slides() 后才会执行此节点。
    """
    logger.info(f"[{state['task_id']}] Executing confirm_slides node")

    from datetime import datetime

    # 标记内容已确认，准备导出
    return update_state(
        state,
        slides_confirmed=True,
        slides_confirmed_at=datetime.now().isoformat(),
        progress_percentage=90.0,
        # 注意：不改变 status，让 export_pptx_node 来设置
    )


def export_pptx_node(state: ReportState) -> ReportState:
    """
    节点：导出 PPTX

    使用 python-pptx 将确认的内容渲染为 PPT 文件。

    状态转换：READY_FOR_EXPORT → EXPORTING → COMPLETED
    """
    logger.info(f"[{state['task_id']}] Starting PPTX export...")

    try:
        from datetime import datetime
        from pathlib import Path
        import sys

        # 添加 backend 目录到 Python 路径
        backend_dir = Path(__file__).parent.parent.parent
        if str(backend_dir) not in sys.path:
            sys.path.insert(0, str(backend_dir))

        from services.pptx_renderer import create_presentation

        # 首先更新状态为 EXPORTING
        state = update_state(
            state,
            status=WorkflowStatus.EXPORTING,
            progress_percentage=95.0,
        )

        # 获取幻灯片数据
        slides = state.get("slides", [])
        requirement = state.get("requirement", {})
        client_name = requirement.get("client_name", "客户")

        # 确定输出目录
        backend_dir = Path(__file__).parent.parent.parent
        output_dir = backend_dir / "output" / "pptx"
        output_dir.mkdir(parents=True, exist_ok=True)

        # 调用 PPTX 渲染服务
        pptx_path = create_presentation(
            slides=slides,
            report_id=state["task_id"],
            client_name=client_name,
            output_dir=str(output_dir)
        )

        logger.info(f"[{state['task_id']}] PPTX exported to: {pptx_path}")

        return update_state(
            state,
            status=WorkflowStatus.COMPLETED,  # ⭐ 关键：导出完成设置为 COMPLETED
            pptx_path=pptx_path,
            exported_at=datetime.now().isoformat(),
            progress_percentage=100.0,
        )

    except Exception as e:
        logger.error(f"[{state['task_id']}] Error exporting PPTX: {e}")
        return mark_error(state, str(e), "export_pptx")
