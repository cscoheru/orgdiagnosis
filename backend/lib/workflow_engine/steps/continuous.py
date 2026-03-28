"""
W3-Step3: 阶段推进 (持续型)

管理项目阶段推进，支持 AI 触发任务。
这是特殊步骤 — 不通过 advance_step 推进，而是通过子操作 (触发任务/完成阶段)。
"""
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("continuous")
class ContinuousStepHandler(BaseStepHandler):
    """持续型步骤 — 不自动完成，通过子操作管理"""

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        # Get current phase progress from kernel
        project_id = context.get("project_id", "")
        action = input_data.get("action", "status")  # status / trigger_task / complete_phase

        if action == "status":
            return await self._get_phase_status(project_id, context)
        elif action == "trigger_task":
            return await self._trigger_task(project_id, input_data, context)
        elif action == "complete_phase":
            return await self._complete_phase(project_id, input_data)
        else:
            return StepResult(success=False, error=f"未知操作: {action}")

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        return None

    def get_description(self, step_id: str) -> str:
        return "阶段推进：按阶段推进项目执行，AI 驱动任务"

    async def _get_phase_status(
        self,
        project_id: str,
        context: Dict[str, Any],
    ) -> StepResult:
        """Get current phase progress"""
        try:
            from app.kernel.database import get_db
            from app.services.kernel.object_service import ObjectService

            db = get_db()
            obj_service = ObjectService(db)

            phases = obj_service.list_objects("Project_Plan")
            project_phases = [
                p for p in phases
                if p.get("properties", {}).get("project_id") == project_id
            ]
            project_phases.sort(
                key=lambda p: p.get("properties", {}).get("phase_order", 0)
            )

            # Get deliverables per phase
            all_deliverables = obj_service.list_objects("Deliverable")
            project_deliverables = [
                d for d in all_deliverables
                if d.get("properties", {}).get("project_id") == project_id
            ]

            phase_list = []
            for phase in project_phases:
                props = phase.get("properties", {})
                phase_id = phase.get("_id", phase.get("id", ""))
                phase_deliverables = [
                    d for d in project_deliverables
                    if d.get("properties", {}).get("phase_id") == phase_id
                ]
                phase_list.append({
                    "phase_id": phase_id,
                    "phase_name": props.get("phase_name", ""),
                    "phase_order": props.get("phase_order", 0),
                    "goals": props.get("goals", ""),
                    "status": props.get("status", "planned"),
                    "deliverables": phase_deliverables,
                })

            total = len(phase_list)
            completed = sum(1 for p in phase_list if p["status"] == "completed")
            progress = (completed / total * 100) if total > 0 else 0

            return StepResult(success=True, data={
                "phases": phase_list,
                "total_phases": total,
                "completed_phases": completed,
                "progress_percent": round(progress, 1),
                "current_phase": next(
                    (p for p in phase_list if p["status"] != "completed"),
                    None,
                ),
            })

        except Exception as e:
            logger.error(f"Get phase status failed: {e}")
            return StepResult(success=False, error=str(e))

    async def _trigger_task(
        self,
        project_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        """Trigger an AI-driven task for a phase"""
        phase_id = input_data.get("phase_id")
        task_type = input_data.get("task_type", "analysis")

        if not phase_id:
            return StepResult(success=False, error="缺少阶段 ID")

        try:
            from app.services.ai_client import ai_client

            # Get phase info
            phase_name = input_data.get("phase_name", "当前阶段")
            goals = input_data.get("goals", "")

            system_prompt = f"你是一位资深咨询顾问，正在执行「{phase_name}」阶段的{task_type}任务。"
            user_prompt = f"阶段目标: {goals}\n\n请执行{task_type}分析并给出结果。"

            result_text = await ai_client.chat(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.5,
                timeout=60,
            )

            return StepResult(success=True, data={
                "task_type": task_type,
                "phase_id": phase_id,
                "result": result_text,
                "status": "completed",
            })

        except Exception as e:
            logger.error(f"Trigger task failed: {e}")
            return StepResult(success=False, error=f"任务执行失败: {str(e)}")

    async def _complete_phase(
        self,
        project_id: str,
        input_data: Dict[str, Any],
    ) -> StepResult:
        """Mark a phase as completed"""
        phase_id = input_data.get("phase_id")
        if not phase_id:
            return StepResult(success=False, error="缺少阶段 ID")

        try:
            from app.kernel.database import get_db
            from app.services.kernel.object_service import ObjectService

            db = get_db()
            obj_service = ObjectService(db)
            obj_service.update_object(phase_id, {"status": "completed"})

            return StepResult(success=True, data={
                "phase_id": phase_id,
                "status": "completed",
            })

        except Exception as e:
            logger.error(f"Complete phase failed: {e}")
            return StepResult(success=False, error=str(e))
