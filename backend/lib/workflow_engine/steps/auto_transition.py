"""
W3-Step1: 自动状态转换

创建咨询订单，项目状态变为"交付中"，自动继承 W1 数据。
"""
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("auto_transition")
class AutoTransitionHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        project_id = context.get("project_id", "")

        # Collect inherited data from W1
        inherited_data = {
            "milestone_plan": input_data.get("milestone_plan"),
            "phases": [],
        }

        # Convert milestone plan phases to project plan objects
        plan_data = input_data.get("milestone_plan", {})
        if plan_data and plan_data.get("phases"):
            for phase in plan_data["phases"]:
                inherited_data["phases"].append({
                    "phase_name": phase.get("phase_name", ""),
                    "phase_order": phase.get("phase_order", 0),
                    "goals": phase.get("goals", ""),
                    "deliverables": phase.get("deliverables", []),
                    "status": "planned",
                })

        # Update project status to "delivering"
        try:
            from lib.projects.store import project_store
            project_store.update_project(project_id, {"status": "delivering"})
        except Exception as e:
            logger.warning(f"Failed to update project status: {e}")

        # Save phases to kernel
        try:
            from app.kernel.database import get_db
            from app.services.kernel.object_service import ObjectService

            db = get_db()
            obj_service = ObjectService(db)

            for phase in inherited_data["phases"]:
                obj_service.create_object("Project_Plan", {
                    "project_id": project_id,
                    "phase_name": phase["phase_name"],
                    "phase_order": phase["phase_order"],
                    "goals": phase["goals"],
                    "deliverables": phase["deliverables"],
                    "status": "planned",
                })

            inherited_data["kernel_synced"] = True

        except Exception as e:
            logger.warning(f"Failed to sync phases to kernel: {e}")
            inherited_data["kernel_synced"] = False

        return StepResult(success=True, data=inherited_data)

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        if not input_data.get("milestone_plan"):
            return "缺少里程碑计划数据，请先完成需求分析工作流"
        return None

    def get_description(self, step_id: str) -> str:
        return "自动创建咨询订单，继承 W1 里程碑计划数据"
