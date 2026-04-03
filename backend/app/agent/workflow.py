"""
Consulting Agent — LangGraph 工作流

将节点组装为 StateGraph，定义状态流转和中断点。

状态机流转:
    init → PLAN → INTERACT → (user input) → collect → PLAN → ... → EXECUTE → COMPLETED
                    ↑                                    ↓
                    └──────── (蒸馏触发) ←── DISTILL ←──┘

Human-in-the-loop: interrupt_before=["interact_node"]
恢复: ainvoke(None, config)  (None = 从中断点继续)
"""
from __future__ import annotations

import logging
from typing import Any

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from langgraph.checkpoint.sqlite.aio import AsyncSqliteSaver

from loguru import logger

from app.agent.state import AgentMode, ConsultingState
from app.agent.nodes import (
    init_node,
    planner_node,
    interact_node,
    collect_node,
    distill_node,
    executor_node,
)


def _route_by_mode(state: ConsultingState) -> str:
    """根据 mode 决定下一个节点"""
    mode = state.get("mode", AgentMode.FAILED)
    mapping = {
        AgentMode.PLAN: "planner",
        AgentMode.INTERACT: "interact",
        AgentMode.EXECUTE: "executor",
        AgentMode.DISTILL: "distill",
        AgentMode.COMPLETED: END,
        AgentMode.FAILED: END,
    }
    return mapping.get(mode, END)


class ConsultingAgentWorkflow:
    """
    咨询 Agent 工作流管理器。

    封装 LangGraph 的 compile/invoke/update_state/resume 操作，
    提供给 API 层调用的简洁接口。
    """

    def __init__(self, checkpoint_dir: str | None = None):
        self._checkpoint_dir = checkpoint_dir
        self._graph = None
        self._checkpointer = None

    def _build_graph(self):
        """构建并编译 StateGraph"""
        if self._graph is not None:
            return

        workflow = StateGraph(ConsultingState)

        # 添加节点
        workflow.add_node("init", init_node)
        workflow.add_node("planner", planner_node)
        workflow.add_node("interact", interact_node)
        workflow.add_node("collect", collect_node)
        workflow.add_node("distill", distill_node)
        workflow.add_node("executor", executor_node)

        # 入口 → init
        workflow.set_entry_point("init")

        # init → 根据 mode 路由
        workflow.add_conditional_edges("init", _route_by_mode)

        # planner → 根据 mode 路由
        workflow.add_conditional_edges("planner", _route_by_mode)

        # interact → collect (interact 之后总是收集数据)
        workflow.add_edge("interact", "collect")

        # collect → 根据 mode 路由
        workflow.add_conditional_edges("collect", _route_by_mode)

        # distill → 根据 mode 路由
        workflow.add_conditional_edges("distill", _route_by_mode)

        # executor → END
        workflow.add_edge("executor", END)

        # 编译
        self._checkpointer = self._create_checkpointer()
        self._graph = workflow.compile(
            checkpointer=self._checkpointer,
            interrupt_after=["interact"],
        )
        logger.info("ConsultingAgentWorkflow compiled (interrupt_after=['interact'])")

    def _create_checkpointer(self):
        """创建 checkpoint 持久化后端"""
        from app.kernel.config import kernel_settings

        if kernel_settings.is_demo_mode or not self._checkpoint_dir:
            return MemorySaver()
        else:
            import os
            os.makedirs(self._checkpoint_dir, exist_ok=True)
            return AsyncSqliteSaver.from_conn_string(
                f"file:{self._checkpoint_dir}/agent_checkpoints.db"
            )

    @property
    def graph(self):
        self._build_graph()
        return self._graph

    def _make_config(self, session_id: str) -> dict:
        """构建 LangGraph config (thread_id = session_id)"""
        return {"configurable": {"thread_id": f"agent-{session_id}"}}

    # ─── 公开接口 ───

    async def start(
        self,
        session_id: str,
        benchmark_id: str,
        project_goal: str,
        project_id: str | None = None,
    ) -> dict:
        """
        启动 Agent 会话。

        1. 注入初始状态
        2. 运行 init → planner → (可能中断在 interact)
        3. 返回当前状态快照
        """
        return await self.start_with_seed(
            session_id=session_id,
            benchmark_id=benchmark_id,
            project_goal=project_goal,
            seed_data={},
            project_id=project_id,
        )

    async def start_with_seed(
        self,
        session_id: str,
        benchmark_id: str,
        project_goal: str,
        seed_data: dict[str, Any],
        project_id: str | None = None,
    ) -> dict:
        """
        启动 Agent 会话，预填充已收集的数据。

        与 start() 相同，但 collected_data 预填充。
        planner_node 会自动跳过已满足的节点。
        """
        initial_state = {
            "session_id": session_id,
            "benchmark_id": benchmark_id,
            "project_id": project_id or "",
            "project_goal": project_goal,
            "mode": AgentMode.PLAN,
            "messages": [],
            "collected_data": seed_data,
            "missing_fields": [],
            "interaction_count": 0,
            "progress": 0.0,
            "current_node_index": 0,
            "execution_order": [],
            "blueprint": {},
            "distilled_spec": None,
            "pptx_path": None,
            "error_message": None,
            "__user_data__": {},
        }

        config = self._make_config(session_id)
        result = await self.graph.ainvoke(initial_state, config)
        return result

    async def get_state(self, session_id: str) -> dict | None:
        """获取当前会话状态快照"""
        config = self._make_config(session_id)
        state = await self.graph.aget_state(config)
        if state and state.values:
            return dict(state.values)
        return None

    async def submit_data(self, session_id: str, user_data: dict[str, Any]) -> dict:
        """
        提交用户数据并恢复工作流。

        1. update_state 注入用户数据
        2. ainvoke(None) 从中断点恢复
        3. 返回更新后的状态
        """
        config = self._make_config(session_id)

        # 注入用户数据
        await self.graph.aupdate_state(
            config,
            values={"__user_data__": user_data},
        )

        # 从中断点恢复 (None = 不传新输入，从中断处继续)
        result = await self.graph.ainvoke(None, config)
        return result

    async def get_history(self, session_id: str) -> list[dict]:
        """获取对话历史"""
        state = await self.get_state(session_id)
        if state:
            return state.get("messages", [])
        return []

    def get_missing_ui(self, state: dict) -> dict:
        """
        从当前状态提取 Server-Driven UI 指令。

        供 API 层调用，返回 InteractionResponse 格式。
        """
        messages = state.get("messages", [])
        missing = state.get("missing_fields", [])
        blueprint = state.get("blueprint", {})

        # 从最后一条 assistant 消息中提取 UI 组件
        ui_components = []
        guidance_message = ""

        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                guidance_message = msg.get("content", "")
                metadata = msg.get("metadata", {})
                ui_components = metadata.get("ui_components", [])
                break

        # fallback: 如果 assistant 消息没有 metadata，从 missing_fields 构建
        if not ui_components and missing:
            for field in missing:
                comp = {
                    "type": field.get("field_type", "input"),
                    "key": field.get("field_key", ""),
                    "label": field.get("field_label", ""),
                    "required": field.get("required", False),
                }
                if field.get("field_options"):
                    comp["options"] = field["field_options"]
                ui_components.append(comp)

        # 构建 context
        context = {
            "current_node": missing[0].get("node_display_name", "") if missing else "",
            "progress": state.get("progress", 0.0),
            "benchmark_title": blueprint.get("title", ""),
            "interaction_count": state.get("interaction_count", 0),
            "mode": state.get("mode", ""),
        }

        return {
            "message": guidance_message,
            "ui_components": ui_components,
            "context": context,
        }


# ─── 全局单例 ───

_workflow_instance: ConsultingAgentWorkflow | None = None


def get_agent_workflow() -> ConsultingAgentWorkflow:
    """获取全局 Agent 工作流单例"""
    global _workflow_instance
    if _workflow_instance is None:
        checkpoint_dir = None
        import os
        env_dir = os.getenv("AGENT_CHECKPOINT_DIR", "")
        if env_dir:
            checkpoint_dir = env_dir
        _workflow_instance = ConsultingAgentWorkflow(checkpoint_dir=checkpoint_dir)
    return _workflow_instance
