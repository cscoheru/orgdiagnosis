"""
配置驱动的工作流引擎

核心类 WorkflowEngine 管理工作流会话的完整生命周期:
- start_workflow: 创建会话，初始化第一个步骤
- get_step: 获取当前步骤状态
- advance_step: 推进到下一步（可选附带人工编辑数据）
- get_state: 获取完整工作流状态
"""
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from .workflow_config import get_workflow_config, WorkflowConfig, StepConfig
from .registry import get_step_handler, list_registered_steps
from .step import StepResult


class WorkflowSession:
    """工作流会话 (内存存储，可后续替换为 Redis/DB)"""

    def __init__(
        self,
        session_id: str,
        project_id: str,
        workflow_type: str,
        config: WorkflowConfig,
    ):
        self.session_id = session_id
        self.project_id = project_id
        self.workflow_type = workflow_type
        self.config = config
        self.current_step_id: str = config.initial_step
        self.created_at: str = datetime.utcnow().isoformat()
        self.updated_at: str = self.created_at
        self.status: str = "active"  # active / paused / completed
        # 每个步骤的输出数据
        self.step_data: Dict[str, Dict[str, Any]] = {}
        # 每个步骤的状态
        self.step_status: Dict[str, str] = {}

    def to_dict(self) -> Dict[str, Any]:
        """序列化为字典"""
        return {
            "session_id": self.session_id,
            "project_id": self.project_id,
            "workflow_type": self.workflow_type,
            "workflow_name": self.config.name,
            "status": self.status,
            "current_step_id": self.current_step_id,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "steps": [
                {
                    "id": step.id,
                    "name": step.name,
                    "type": step.type,
                    "status": self.step_status.get(step.id, "pending"),
                    "is_manual": step.is_manual,
                    "depends_on": step.depends_on,
                }
                for step in self.config.steps
            ],
        }


class WorkflowEngine:
    """配置驱动的工作流引擎"""

    def __init__(self):
        # session_id -> WorkflowSession
        self._sessions: Dict[str, WorkflowSession] = {}

    def _get_or_create_session(
        self,
        session_id: Optional[str],
        project_id: str,
        workflow_type: str,
    ) -> WorkflowSession:
        """获取已有会话或创建新会话"""
        if session_id and session_id in self._sessions:
            return self._sessions[session_id]
        config = get_workflow_config(workflow_type)
        sid = session_id or str(uuid.uuid4())
        session = WorkflowSession(
            session_id=sid,
            project_id=project_id,
            workflow_type=workflow_type,
            config=config,
        )
        self._sessions[sid] = session
        return session

    def _persist_session(self, session: WorkflowSession):
        """将 session 数据持久化到数据库（静默失败）"""
        try:
            from lib.projects.store import project_store
            project_store.save_workflow_data(
                project_id=session.project_id,
                session_id=session.session_id,
                workflow_data={
                    "step_data": session.step_data,
                    "step_status": session.step_status,
                    "current_step_id": session.current_step_id,
                    "status": session.status,
                    "workflow_type": session.workflow_type,
                },
            )
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Session persist failed: {e}")

    def _restore_session(self, session_id: str, project_id: str) -> bool:
        """从数据库恢复 session，成功返回 True"""
        try:
            from lib.projects.store import project_store
            data = project_store.get_workflow_data(project_id)
            if not data:
                return False

            # Check if session_id matches
            saved_sid = data.pop('_session_id', None)
            if saved_sid and saved_sid != session_id:
                return False  # Different session, don't restore

            config = get_workflow_config(data.get("workflow_type", ""))
            actual_sid = saved_sid or session_id
            session = WorkflowSession(
                session_id=actual_sid,
                project_id=project_id,
                workflow_type=data.get("workflow_type", ""),
                config=config,
            )
            session.step_data = data.get("step_data", {})
            session.step_status = data.get("step_status", {})
            session.current_step_id = data.get("current_step_id", config.initial_step)
            session.status = data.get("status", "active")
            self._sessions[actual_sid] = session
            return True
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Session restore failed: {e}")
            return False

    def _try_restore_by_project(self, project_id: str, workflow_type: str) -> Optional[WorkflowSession]:
        """通过 project_id 从数据库恢复 session（不需要 session_id）"""
        try:
            from lib.projects.store import project_store
            data = project_store.get_workflow_data(project_id)
            if not data:
                return None

            saved_sid = data.pop('_session_id', None)
            if not saved_sid:
                return None

            # 检查 workflow_type 是否匹配
            if data.get("workflow_type") and data["workflow_type"] != workflow_type:
                return None

            config = get_workflow_config(data.get("workflow_type", workflow_type))
            session = WorkflowSession(
                session_id=saved_sid,
                project_id=project_id,
                workflow_type=data.get("workflow_type", workflow_type),
                config=config,
            )
            session.step_data = data.get("step_data", {})
            session.step_status = data.get("step_status", {})
            session.current_step_id = data.get("current_step_id", config.initial_step)
            session.status = data.get("status", "active")
            self._sessions[saved_sid] = session
            return session
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(f"Project restore failed: {e}")
            return None

    async def start_workflow(
        self,
        project_id: str,
        workflow_type: str,
        input_data: Optional[Dict[str, Any]] = None,
        session_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        启动工作流

        Returns:
            包含 session_id, current_step, workflow_info 的字典
        """
        config = get_workflow_config(workflow_type)

        # 尝试从数据库恢复已有 session
        restored = False
        if session_id and self._restore_session(session_id, project_id):
            session = self._sessions[session_id]
            restored = True
        else:
            # 没有 session_id 时，尝试从 DB 查找该项目的已有 session
            saved = self._try_restore_by_project(project_id, workflow_type)
            if saved:
                session = saved
                session_id = saved.session_id
                restored = True
            else:
                session = self._get_or_create_session(session_id, project_id, workflow_type)

        session.status = "active"
        if not restored:
            session.current_step_id = config.initial_step
        session.updated_at = datetime.utcnow().isoformat()

        # 保存初始输入
        if input_data:
            session.step_data["input"] = input_data

        result = session.to_dict()
        result["all_step_data"] = session.step_data
        return result

    async def get_step(self, session_id: str) -> Dict[str, Any]:
        """获取当前步骤状态"""
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"工作流会话不存在: {session_id}")

        current = self._get_step_config(session, session.current_step_id)
        return {
            "session_id": session_id,
            "current_step": {
                "id": current.id,
                "name": current.name,
                "type": current.type,
                "is_manual": current.is_manual,
            },
            "step_data": session.step_data.get(session.current_step_id, {}),
            "status": session.status,
        }

    async def advance_step(
        self,
        session_id: str,
        step_data: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        推进到下一步

        1. 保存当前步骤的人工编辑数据 (step_data)
        2. 如果下一步是自动步骤，执行处理器
        3. 返回新的当前步骤状态

        Args:
            session_id: 会话 ID
            step_data: 当前步骤的人工编辑/确认数据

        Returns:
            包含新步骤状态的字典
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"工作流会话不存在: {session_id}")

        # 保存当前步骤数据
        # 前端发送 {"step_data": {"step_id": data}}，需要展开一层避免双重嵌套
        if step_data:
            for key, value in step_data.items():
                if isinstance(value, dict) and key in value:
                    # 双重嵌套检测: {"milestone_plan": {"milestone_plan": {...}}}
                    session.step_data[key] = value[key]
                else:
                    session.step_data[key] = value

        # 标记当前步骤为 completed
        session.step_status[session.current_step_id] = "completed"

        # 查找下一步
        next_step = self._find_next_step(session)
        if not next_step:
            session.status = "completed"
            session.updated_at = datetime.utcnow().isoformat()
            return {
                "session_id": session_id,
                "status": "completed",
                "message": "工作流已完成所有步骤",
                "workflow": session.to_dict(),
            }

        # 推进到下一步
        session.current_step_id = next_step.id
        session.step_status[next_step.id] = "active"
        session.updated_at = datetime.utcnow().isoformat()

        # 如果下一步是自动步骤，立即执行
        result = None
        if not next_step.is_manual:
            try:
                handler = get_step_handler(next_step.type)
                context = {
                    "project_id": session.project_id,
                    "workflow_type": session.workflow_type,
                    "step_data": session.step_data,
                }
                result = await handler.execute(
                    step_id=next_step.id,
                    input_data=session.step_data,
                    context=context,
                )
                if result.success:
                    session.step_data[next_step.id] = result.data
                    session.step_status[next_step.id] = "completed"
                    # 递归推进 (自动步骤链)
                    return await self.advance_step(session_id)
                else:
                    session.step_status[next_step.id] = "failed"
                    return {
                        "session_id": session_id,
                        "status": "error",
                        "error": result.error,
                        "current_step": next_step.id,
                    }
            except Exception as e:
                session.step_status[next_step.id] = "failed"
                return {
                    "session_id": session_id,
                    "status": "error",
                    "error": str(e),
                    "current_step": next_step.id,
                }

        # 持久化 session 到数据库
        self._persist_session(session)

        return {
            "session_id": session_id,
            "current_step": {
                "id": next_step.id,
                "name": next_step.name,
                "type": next_step.type,
                "is_manual": next_step.is_manual,
            },
            "step_data": session.step_data.get(next_step.id, {}),
            "auto_result": result.data if result else None,
            "status": session.status,
        }

    async def execute_step(
        self,
        session_id: str,
        step_id: Optional[str] = None,
        input_data: Optional[Dict[str, Any]] = None,
    ) -> StepResult:
        """
        手动触发执行指定步骤 (用于 AI 生成等需要触发的手动步骤)

        Args:
            session_id: 会话 ID
            step_id: 要执行的步骤 ID (默认当前步骤)
            input_data: 步骤输入

        Returns:
            StepResult
        """
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"工作流会话不存在: {session_id}")

        target_id = step_id or session.current_step_id
        step_config = self._get_step_config(session, target_id)

        # 合并输入数据
        merged_input = {**session.step_data}
        if input_data:
            merged_input[target_id] = input_data

        handler = get_step_handler(step_config.type)
        context = {
            "project_id": session.project_id,
            "workflow_type": session.workflow_type,
            "step_data": session.step_data,
            "step_config": step_config.context or {},
        }

        result = await handler.execute(
            step_id=target_id,
            input_data=merged_input,
            context=context,
        )

        if result.success:
            session.step_data[target_id] = result.data
            session.updated_at = datetime.utcnow().isoformat()
            # 持久化到数据库
            self._persist_session(session)

        return result

    async def get_state(self, session_id: str) -> Dict[str, Any]:
        """获取工作流完整状态 (含所有步骤历史数据)"""
        session = self._sessions.get(session_id)
        if not session:
            raise ValueError(f"工作流会话不存在: {session_id}")

        return {
            "session_id": session_id,
            "project_id": session.project_id,
            "workflow_type": session.workflow_type,
            "workflow_name": session.config.name,
            "status": session.status,
            "current_step_id": session.current_step_id,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "steps": [
                {
                    "id": step.id,
                    "name": step.name,
                    "type": step.type,
                    "status": session.step_status.get(step.id, "pending"),
                    "is_manual": step.is_manual,
                    "data": session.step_data.get(step.id),
                }
                for step in session.config.steps
            ],
            "all_step_data": session.step_data,
        }

    def list_sessions(self, project_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """列出工作流会话"""
        sessions = self._sessions.values()
        if project_id:
            sessions = [s for s in sessions if s.project_id == project_id]
        return [s.to_dict() for s in sessions]

    # ============================================================
    # Internal helpers
    # ============================================================

    def _get_step_config(self, session: WorkflowSession, step_id: str) -> StepConfig:
        """获取步骤配置"""
        for step in session.config.steps:
            if step.id == step_id:
                return step
        raise ValueError(f"步骤不存在: {step_id}")

    def _find_next_step(self, session: WorkflowSession) -> Optional[StepConfig]:
        """找到当前步骤的下一步"""
        current_idx = None
        for i, step in enumerate(session.config.steps):
            if step.id == session.current_step_id:
                current_idx = i
                break

        if current_idx is None:
            return None

        # 返回列表中的下一个步骤
        if current_idx + 1 < len(session.config.steps):
            return session.config.steps[current_idx + 1]

        return None


# 全局引擎实例
workflow_engine = WorkflowEngine()
