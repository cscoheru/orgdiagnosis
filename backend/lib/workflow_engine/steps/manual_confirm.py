"""
W2-Step2: 人工确认

人工审核问卷数据并确认提交。无需 AI 调用。
"""
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("manual_confirm")
class ManualConfirmHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        questionnaire_data = input_data.get("questionnaire", {})

        # Validate completeness
        stats = self._compute_stats(questionnaire_data)

        return StepResult(success=True, data={
            "confirmed": True,
            "stats": stats,
            "questionnaire": questionnaire_data,
        })

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        if not input_data.get("questionnaire"):
            return "没有问卷数据可供确认"
        return None

    def get_description(self, step_id: str) -> str:
        return "客户确认：审核问卷数据并确认提交"

    def _compute_stats(self, questionnaire: Dict) -> Dict[str, Any]:
        """Compute questionnaire completion statistics"""
        total_questions = 0
        answered_questions = 0
        dimension_stats = {}

        for dim_name, dim_data in questionnaire.items():
            if not isinstance(dim_data, dict):
                continue
            questions = dim_data.get("questions", [])
            dim_total = len(questions)
            dim_answered = sum(1 for q in questions if q.get("answer", "").strip())
            total_questions += dim_total
            answered_questions += dim_answered
            dimension_stats[dim_name] = {
                "total": dim_total,
                "answered": dim_answered,
                "missing": dim_total - dim_answered,
            }

        return {
            "total_questions": total_questions,
            "answered_questions": answered_questions,
            "missing_questions": total_questions - answered_questions,
            "completeness_percent": round(answered_questions / total_questions * 100, 1) if total_questions > 0 else 0,
            "by_dimension": dimension_stats,
        }
