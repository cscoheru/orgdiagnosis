"""
W3-Step2: 人工编辑计划

顾问编辑项目计划（阶段目标、成果要求），无需 AI 调用。
"""
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("manual_edit")
class ManualEditHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        # User has edited the plan data, save it
        edited_plan = input_data.get("edit_plan", {})

        if not edited_plan:
            return StepResult(success=False, error="没有编辑数据")

        # Sync edited phases to kernel
        project_id = context.get("project_id", "")
        if project_id and edited_plan.get("phases"):
            try:
                from app.kernel.database import get_db
                from app.services.kernel.object_service import ObjectService

                db = get_db()
                obj_service = ObjectService(db)

                for phase in edited_plan["phases"]:
                    phase_id = phase.get("phase_id")
                    phase_data = {
                        "project_id": project_id,
                        "phase_name": phase.get("phase_name", ""),
                        "phase_order": phase.get("phase_order", 0),
                        "goals": phase.get("goals", ""),
                        "deliverables": phase.get("deliverables", []),
                    }
                    if phase_id:
                        obj_service.update_object(phase_id, phase_data)
                    else:
                        obj_service.create_object("Project_Plan", phase_data)

            except Exception as e:
                logger.warning(f"Failed to sync edited plan to kernel: {e}")

        return StepResult(success=True, data={
            "plan": edited_plan,
            "saved": True,
        })

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        return None  # Always valid (user is editing)

    def get_description(self, step_id: str) -> str:
        return "编辑项目计划：调整阶段目标和成果要求"
