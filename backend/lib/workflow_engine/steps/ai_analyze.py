"""
W2-Step3: AI 五维分析

基于问卷数据执行五维诊断分析，生成雷达图数据和详细维度分析。
"""
import json
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("ai_analyze")
class AIAnalyzeHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        questionnaire = input_data.get("questionnaire", input_data.get("client_confirm", {}))
        if not questionnaire:
            return StepResult(success=False, error="缺少问卷数据")

        try:
            from app.services.ai_client import ai_client

            system_prompt = """你是一位资深咨询顾问，擅长组织诊断分析。
根据客户填写的问卷数据，对五个维度进行评分和分析。
以 JSON 格式返回：
{
    "overall_score": 75,
    "dimensions": [
        {
            "name": "战略",
            "score": 80,
            "level": "良好",
            "summary": "一句话总结",
            "sub_dimensions": [
                {
                    "name": "战略目标",
                    "score": 85,
                    "summary": "分析说明",
                    "findings": ["发现1", "发现2"],
                    "recommendations": ["建议1"]
                }
            ]
        }
    ],
    "key_insights": ["跨维度洞察1", "跨维度洞察2"],
    "risk_areas": ["风险领域1"]
}

评分标准：
- 90-100: 优秀
- 75-89: 良好
- 60-74: 一般
- 40-59: 较差
- 0-39: 严重不足"""

            user_prompt = f"请根据以下问卷数据进行五维诊断分析：\n\n{json.dumps(questionnaire, ensure_ascii=False, indent=2)}"

            result_text = await ai_client.chat(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                timeout=90,
            )

            parsed = self._parse_json(result_text)
            if not parsed:
                return StepResult(success=False, error="AI 分析结果解析失败")

            return StepResult(success=True, data=parsed)

        except Exception as e:
            logger.error(f"AI analyze failed: {e}")
            return StepResult(success=False, error=f"AI 分析出错: {str(e)}")

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        questionnaire = input_data.get("questionnaire", input_data.get("client_confirm", {}))
        if not questionnaire:
            return "缺少问卷数据"
        return None

    def get_description(self, step_id: str) -> str:
        return "AI 五维分析：基于问卷数据生成雷达图和详细维度分析"

    def _parse_json(self, text: str) -> Optional[Dict]:
        text = text.strip()
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            try:
                return json.loads(text[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass
        return None
