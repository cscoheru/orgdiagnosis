"""
Report Generation Workflow

LangGraph workflow for Human-in-the-loop consulting report generation.
Supports interruption at outline and slides review stages.
"""

import uuid
from typing import Optional, Dict, Any
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
    generate_outline_node,
    confirm_outline_node,
    generate_slides_node,
    confirm_slides_node,
    export_pptx_node,
)


class ReportWorkflowManager:
    """
    报告生成工作流管理器

    使用 LangGraph 实现带有人工审核断点的报告生成流程。
    """

    def __init__(self):
        """初始化工作流管理器"""
        self.workflow = self._create_workflow()
        self.memory_saver = MemorySaver()
        # 使用 interrupt_before 在确认节点前暂停
        self.app = self.workflow.compile(
            checkpointer=self.memory_saver,
            interrupt_before=["confirm_outline", "confirm_slides"]  # ⭐ 关键：在这些节点前中断
        )

        # 任务状态存储 (生产环境应使用数据库)
        self._tasks: Dict[str, ReportState] = {}

        logger.info("ReportWorkflowManager initialized with interrupt points")

    def _create_workflow(self) -> StateGraph:
        """创建工作流图"""
        workflow = StateGraph(ReportState)

        # 添加节点
        workflow.add_node("generate_outline", generate_outline_node)
        workflow.add_node("confirm_outline", confirm_outline_node)
        workflow.add_node("generate_slides", generate_slides_node)
        workflow.add_node("confirm_slides", confirm_slides_node)
        workflow.add_node("export_pptx", export_pptx_node)

        # 定义入口
        workflow.set_entry_point("generate_outline")

        # 定义边 - 线性流程
        workflow.add_edge("generate_outline", "confirm_outline")
        workflow.add_edge("confirm_outline", "generate_slides")
        workflow.add_edge("generate_slides", "confirm_slides")
        workflow.add_edge("confirm_slides", "export_pptx")
        workflow.add_edge("export_pptx", END)

        return workflow

    def start_task(
        self,
        requirement: Dict[str, Any],
        five_d_diagnosis: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        启动新的报告生成任务

        工作流会在 confirm_outline 节点前暂停（因为 interrupt_before=["confirm_outline"]）
        """
        task_id = str(uuid.uuid4())

        # 创建初始状态
        initial_state = create_initial_state(
            task_id=task_id,
            requirement=requirement,
            five_d_diagnosis=five_d_diagnosis
        )

        # 存储任务状态
        self._tasks[task_id] = initial_state

        # 运行工作流 - 会在 confirm_outline 前暂停
        result = self.app.invoke(
            initial_state,
            config={"configurable": {"thread_id": task_id}}
        )

        # 更新存储的状态
        self._tasks[task_id] = result

        logger.info(f"Task {task_id} started, status: {result['status']}")

        return task_id

    def get_task_status(self, task_id: str) -> Optional[ReportState]:
        """获取任务状态"""
        return self._tasks.get(task_id)

    def get_outline(self, task_id: str) -> Optional[Dict[str, Any]]:
        """获取生成的大纲"""
        task = self._tasks.get(task_id)
        if task and task.get("outline"):
            return task["outline"]
        return None

    def confirm_outline(
        self,
        task_id: str,
        modified_outline: Optional[Dict[str, Any]] = None
    ) -> bool:
        """
        确认大纲并继续生成内容

        从中断点恢复，执行 confirm_outline -> generate_slides -> 在 confirm_slides 前暂停
        """
        task = self._tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.OUTLINE_READY.value:
            logger.error(f"Task {task_id} not in OUTLINE_READY status: {task['status']}")
            return False

        # 如果有修改后的大纲，更新状态
        if modified_outline:
            task = update_state(task, outline=modified_outline)

        # 继续工作流 - 从 confirm_outline 执行到 generate_slides，然后在 confirm_slides 前暂停
        result = self.app.invoke(
            task,
            config={"configurable": {"thread_id": task_id}}
        )

        self._tasks[task_id] = result

        logger.info(f"Task {task_id} outline confirmed, new status: {result['status']}")

        return True

    def get_slides(self, task_id: str) -> Optional[list]:
        """获取生成的内容"""
        task = self._tasks.get(task_id)
        if task and task.get("slides"):
            return task["slides"]
        return None

    def confirm_slides(
        self,
        task_id: str,
        modified_slides: Optional[list] = None
    ) -> bool:
        """
        确认内容并导出 PPTX

        从中断点恢复，执行 confirm_slides -> export_pptx -> END
        """
        task = self._tasks.get(task_id)
        if not task:
            logger.error(f"Task {task_id} not found")
            return False

        if task["status"] != WorkflowStatus.SLIDES_READY.value:
            logger.error(f"Task {task_id} not in SLIDES_READY status: {task['status']}")
            return False

        # 如果有修改后的内容，更新状态
        if modified_slides:
            task = update_state(task, slides=modified_slides)

        # 继续工作流 - 执行到结束
        result = self.app.invoke(
            task,
            config={"configurable": {"thread_id": task_id}}
        )

        self._tasks[task_id] = result

        logger.info(f"Task {task_id} slides confirmed, new status: {result['status']}")

        return True

    def list_tasks(self) -> list:
        """列出所有任务"""
        return [
            {
                "task_id": task_id,
                "status": task["status"],
                "created_at": task["created_at"],
                "progress": task["progress_percentage"],
            }
            for task_id, task in self._tasks.items()
        ]

    def cancel_task(self, task_id: str) -> bool:
        """取消任务"""
        task = self._tasks.get(task_id)
        if not task:
            return False

        self._tasks[task_id] = update_state(
            task,
            status=WorkflowStatus.CANCELLED
        )

        logger.info(f"Task {task_id} cancelled")
        return True


# 全局工作流管理器实例
_workflow_manager: Optional[ReportWorkflowManager] = None


def get_workflow_manager() -> ReportWorkflowManager:
    """获取全局工作流管理器实例"""
    global _workflow_manager
    if _workflow_manager is None:
        _workflow_manager = ReportWorkflowManager()
    return _workflow_manager
