"""
Report Generation Workflow

LangGraph workflow for Human-in-the-loop consulting report generation.
Supports interruption at outline and slides review stages.

Updated: 2026-03-21
- Added multi-level expansion workflow (modules → page_titles → slides)
- Added SQLite-based persistent storage for task states
- Tasks now survive server restarts
- Converted to async for AI service integration
"""

import uuid
import asyncio
from typing import Optional, Dict, Any, List
from loguru import logger

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from .state import (
    ReportState,
    WorkflowStatus,
    create_initial_state,
    update_state,
)
from .nodes import (
    # Multi-level expansion nodes (now async)
    generate_modules_node,
    confirm_modules_node,
    generate_page_titles_node,
    confirm_page_titles_node,
    # Legacy nodes
    generate_outline_node,
    confirm_outline_node,
    generate_slides_node,
    confirm_slides_node,
    export_pptx_node,
)

# Import persistent task store
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from lib.storage.task_store import get_task_store


class ReportWorkflowManager:
    """
    报告生成工作流管理器

    使用 LangGraph 实现带有人工审核断点的报告生成流程。

    支持两种模式:
    - 传统模式 (use_multi_level=False): outline_ready → slides_ready → completed
    - 多层扩展模式 (use_multi_level=True): modules_ready → page_titles_ready → slides_ready

    多层扩展工作流状态机:
    ┌──────────┐     ┌─────────────────┐     ┌──────────────┐
    │  pending │ ──▶ │ generating_     │ ──▶ │ modules_     │
    │          │     │ modules         │     │ ready        │
    └──────────┘     └─────────────────┘     └──────┬───────┘
                                                    │
                             ⏸️ 用户审核/编辑模块      │ 确认
                                                    ▼
    ┌──────────┐     ┌─────────────────┐     ┌──────────────┐
    │ page_    │ ◀── │ generating_     │ ◀── │ confirm_     │
    │ titles   │     │ page_titles     │     │ modules      │
    │ ready    │     └─────────────────┘     └──────────────┘
    └────┬─────┘
         │ ⏸️ 用户审核/编辑页面标题
         │ 确认
         ▼
    ┌─────────────────┐     ┌──────────────┐
    │ generating_     │ ──▶ │ slides_      │
    │ slides          │     │ ready        │
    └─────────────────┘     └──────┬───────┘
                                   │
             ⏸️ 用户审核/编辑内容     │ 确认
                                   ▼
    ┌──────────┐     ┌─────────────────┐
    │ completed│ ◀── │ export_pptx     │
    └──────────┘     └─────────────────┘
    """

    def __init__(self, use_multi_level: bool = True):
        """
        初始化工作流管理器

        Args:
            use_multi_level: 是否使用多层扩展流程 (默认 True)
        """
        self.use_multi_level = use_multi_level
        self.workflow = self._create_workflow()
        self.memory_saver = MemorySaver()

        # 根据模式设置中断点
        if use_multi_level:
            interrupt_points = [
                "confirm_modules",
                "confirm_page_titles",
                "confirm_slides"
            ]
        else:
            interrupt_points = ["confirm_outline", "confirm_slides"]

        self.app = self.workflow.compile(
            checkpointer=self.memory_saver,
            interrupt_before=interrupt_points
        )

        # 持久化任务存储
        self.task_store = get_task_store()

        logger.info(f"ReportWorkflowManager initialized (multi_level={use_multi_level}) with interrupt points: {interrupt_points}")

    def _create_workflow(self) -> StateGraph:
        """创建工作流图"""
        workflow = StateGraph(ReportState)

        if self.use_multi_level:
            # 多层扩展工作流
            workflow.add_node("generate_modules", generate_modules_node)
            workflow.add_node("confirm_modules", confirm_modules_node)
            workflow.add_node("generate_page_titles", generate_page_titles_node)
            workflow.add_node("confirm_page_titles", confirm_page_titles_node)
            workflow.add_node("generate_slides", generate_slides_node)
            workflow.add_node("confirm_slides", confirm_slides_node)
            workflow.add_node("export_pptx", export_pptx_node)

            # 定义入口
            workflow.set_entry_point("generate_modules")

            # 定义边 - 多层扩展流程
            workflow.add_edge("generate_modules", "confirm_modules")
            workflow.add_edge("confirm_modules", "generate_page_titles")
            workflow.add_edge("generate_page_titles", "confirm_page_titles")
            workflow.add_edge("confirm_page_titles", "generate_slides")
            workflow.add_edge("generate_slides", "confirm_slides")
            workflow.add_edge("confirm_slides", "export_pptx")
            workflow.add_edge("export_pptx", END)

        else:
            # 传统工作流 (向后兼容)
            workflow.add_node("generate_outline", generate_outline_node)
            workflow.add_node("confirm_outline", confirm_outline_node)
            workflow.add_node("generate_slides", generate_slides_node)
            workflow.add_node("confirm_slides", confirm_slides_node)
            workflow.add_node("export_pptx", export_pptx_node)

            workflow.set_entry_point("generate_outline")

            workflow.add_edge("generate_outline", "confirm_outline")
            workflow.add_edge("confirm_outline", "generate_slides")
            workflow.add_edge("generate_slides", "confirm_slides")
            workflow.add_edge("confirm_slides", "export_pptx")
            workflow.add_edge("export_pptx", END)

        return workflow

    async def start_task(
        self,
        requirement: Dict[str, Any],
        five_d_diagnosis: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        启动新的报告生成任务 (async)

        工作流流程:
        1. 启动任务并生成大纲
        2. 在 confirm_outline 前暂停 (interrupt_before)
        3. 返回 task_id，等待用户确认大纲

        Args:
            requirement: ClientRequirement 字典
            five_d_diagnosis: 五维诊断结果 (可选)

        Returns:
            task_id: 任务唯一标识
        """
        task_id = str(uuid.uuid4())

        # 创建初始状态
        initial_state = create_initial_state(
            task_id=task_id,
            requirement=requirement,
            five_d_diagnosis=five_d_diagnosis
        )

        # 持久化存储初始状态
        self.task_store.create_task(task_id, initial_state)

        try:
            # 运行工作流 - 使用 ainvoke 因为节点是 async
            # 注意：ainvoke 会执行到中断点后返回
            result = await self.app.ainvoke(
                initial_state,
                config={
                    "configurable": {"thread_id": task_id},
                    "run_name": f"报告生成-{task_id[:8]}",
                    "tags": ["report", "generation", "multi-level"],
                    "metadata": {"task_id": task_id},
                }
            )

            # 更新存储的状态 (此时应该是 MODULES_READY 状态)
            self.task_store.update_task(task_id, result)

            logger.info(f"Task {task_id} started and paused at review, status: {result.get('status')}")

            return task_id

        except Exception as e:
            logger.error(f"Task {task_id} failed to start: {e}")
            error_state = update_state(
                initial_state,
                status=WorkflowStatus.FAILED,
                error_message=str(e),
                error_step="start_task"
            )
            self.task_store.update_task(task_id, error_state)
            raise

    def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取任务状态 (从持久化存储)"""
        return self.task_store.get_state(task_id)

    def get_outline(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取生成的大纲"""
        task = self.task_store.get_state(task_id)
        if task and task.get("outline"):
            return task["outline"]
        return None

    async def confirm_outline(
        self,
        task_id: str,
        modified_outline: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        确认大纲并继续生成内容 (async)

        工作流流程:
        1. 从中断点恢复
        2. 如果有修改后的大纲，更新状态
        3. 执行 confirm_outline -> generate_slides
        4. 在 confirm_slides 前暂停 (interrupt_before)
        5. 等待用户确认内容

        Args:
            task_id: 任务ID
            modified_outline: 用户修改后的大纲 (可选)

        Returns:
            bool: 是否成功
        """
        task = self.task_store.get_state(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.OUTLINE_READY.value:
            logger.error(f"Task {task_id} not in OUTLINE_READY status: {task['status']}")
            return False

        # 如果有修改后的大纲，更新状态到 checkpointer
        if modified_outline:
            # 使用 LangGraph 的 update_state 来更新 checkpoint 中的大纲
            self.app.update_state(
                config={"configurable": {"thread_id": task_id}},
                values={"outline": modified_outline}
            )

        try:
            # 继续工作流 - 使用 ainvoke
            result = await self.app.ainvoke(
                None,  # ⭐ 关键：传入 None 表示从 checkpoint 恢复
                config={"configurable": {"thread_id": task_id}}
            )

            # 持久化更新
            self.task_store.update_task(task_id, result)

            logger.info(f"Task {task_id} outline confirmed, new status: {result['status']}")

            return True

        except Exception as e:
            logger.error(f"Task {task_id} failed during outline confirmation: {e}")
            error_state = update_state(task, status=WorkflowStatus.FAILED, error_message=str(e))
            self.task_store.update_task(task_id, error_state)
            return False

    def get_slides(self, task_id: str) -> Optional[list]:
        """获取生成的内容"""
        task = self.task_store.get_state(task_id)
        if task and task.get("slides"):
            return task["slides"]
        return None

    async def confirm_slides(
        self,
        task_id: str,
        modified_slides: Optional[list] = None
    ) -> bool:
        """
        确认内容并导出 PPTX (async)

        工作流流程:
        1. 从中断点恢复
        2. 如果有修改后的内容，更新状态
        3. 执行 confirm_slides -> export_pptx -> END

        Args:
            task_id: 任务ID
            modified_slides: 用户修改后的内容 (可选)

        Returns:
            bool: 是否成功
        """
        task = self.task_store.get_state(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.SLIDES_READY.value:
            logger.error(f"Task {task_id} not in SLIDES_READY status: {task['status']}")
            return False

        # 如果有修改后的内容，更新状态到 checkpointer
        if modified_slides:
            self.app.update_state(
                config={"configurable": {"thread_id": task_id}},
                values={"slides": modified_slides}
            )

        try:
            # 继续工作流 - 使用 ainvoke
            result = await self.app.ainvoke(
                None,  # ⭐ 关键：传入 None 表示从 checkpoint 恢复
                config={"configurable": {"thread_id": task_id}}
            )

            # 持久化更新
            self.task_store.update_task(task_id, result)

            logger.info(f"Task {task_id} slides confirmed, new status: {result['status']}")

            return True

        except Exception as e:
            logger.error(f"Task {task_id} failed during slides confirmation: {e}")
            error_state = update_state(task, status=WorkflowStatus.FAILED, error_message=str(e))
            self.task_store.update_task(task_id, error_state)
            return False

    def list_tasks(self) -> list:
        """列出所有任务"""
        tasks = self.task_store.list_tasks(limit=100)
        return [
            {
                "task_id": task["task_id"],
                "status": task["status"],
                "created_at": task.get("created_at"),
                "updated_at": task.get("updated_at"),
            }
            for task in tasks
        ]

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self.task_store.get_state(task_id)
        if not task:
            return False

        cancelled_state = update_state(
            task,
            status=WorkflowStatus.CANCELLED
        )
        self.task_store.update_task(task_id, cancelled_state)

        logger.info(f"Task {task_id} cancelled")
        return True

    # ============================================================
    # Multi-Level Expansion Methods
    # ============================================================

    def get_modules(self, task_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取生成的模块列表"""
        task = self.task_store.get_state(task_id)
        if task and task.get("modules"):
            return task["modules"]
        return None

    async def confirm_modules(
        self,
        task_id: str,
        modified_modules: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        确认模块并继续生成页面标题 (Multi-Level Expansion Step 1, async)

        Args:
            task_id: 任务ID
            modified_modules: 用户修改后的模块列表 (可选)

        Returns:
            bool: 是否成功
        """
        task = self.task_store.get_state(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.MODULES_READY.value:
            logger.error(f"Task {task_id} not in MODULES_READY status: {task['status']}")
            return False

        if modified_modules:
            self.app.update_state(
                config={"configurable": {"thread_id": task_id}},
                values={"modules": modified_modules}
            )

        try:
            result = await self.app.ainvoke(
                None,
                config={"configurable": {"thread_id": task_id}}
            )
            self.task_store.update_task(task_id, result)
            logger.info(f"Task {task_id} modules confirmed, new status: {result['status']}")
            return True

        except Exception as e:
            logger.error(f"Task {task_id} failed during modules confirmation: {e}")
            error_state = update_state(task, status=WorkflowStatus.FAILED, error_message=str(e))
            self.task_store.update_task(task_id, error_state)
            return False

    def get_page_titles(self, task_id: str) -> Optional[List[Dict[str, Any]]]:
        """获取生成的页面标题列表"""
        task = self.task_store.get_state(task_id)
        if task and task.get("page_titles"):
            return task["page_titles"]
        return None

    async def confirm_page_titles(
        self,
        task_id: str,
        modified_page_titles: Optional[List[Dict[str, Any]]] = None
    ) -> bool:
        """
        确认页面标题并继续生成内容 (Multi-Level Expansion Step 2, async)

        Args:
            task_id: 任务ID
            modified_page_titles: 用户修改后的页面标题列表 (可选)

        Returns:
            bool: 是否成功
        """
        task = self.task_store.get_state(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.PAGE_TITLES_READY.value:
            logger.error(f"Task {task_id} not in PAGE_TITLES_READY status: {task['status']}")
            return False

        if modified_page_titles:
            self.app.update_state(
                config={"configurable": {"thread_id": task_id}},
                values={"page_titles": modified_page_titles}
            )

        try:
            result = await self.app.ainvoke(
                None,
                config={"configurable": {"thread_id": task_id}}
            )
            self.task_store.update_task(task_id, result)
            logger.info(f"Task {task_id} page titles confirmed, new status: {result['status']}")
            return True

        except Exception as e:
            logger.error(f"Task {task_id} failed during page titles confirmation: {e}")
            error_state = update_state(task, status=WorkflowStatus.FAILED, error_message=str(e))
            self.task_store.update_task(task_id, error_state)
            return False


# 全局工作流管理器实例
_workflow_manager: Optional[ReportWorkflowManager] = None


def get_workflow_manager(use_multi_level: bool = True) -> ReportWorkflowManager:
    """
    获取全局工作流管理器实例

    Args:
        use_multi_level: 是否使用多层扩展流程 (默认 True)

    多层扩展工作流:
    - Step 1: modules_ready - 用户审核核心模块
    - Step 2: page_titles_ready - 用户审核页面标题
    - Step 3: slides_ready - 用户审核幻灯片内容
    """
    global _workflow_manager
    if _workflow_manager is None:
        _workflow_manager = ReportWorkflowManager(use_multi_level=use_multi_level)
    return _workflow_manager
