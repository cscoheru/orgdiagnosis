"""
W1-Step1: AI 智能提取

大块客户文本 → AI 解析 → 结构化需求表单
"""
import json
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("ai_extract_form")
class AIExtractFormHandler(BaseStepHandler):

    EXTRACTION_SCHEMA = {
        "client_name": "客户公司名称",
        "industry": "所在行业（必须是以下之一: 制造业, 零售, 金融, 科技, 医疗, 教育, 房地产, 其他）",
        "company_scale": "公司规模（员工数、年营收等）",
        "company_info": "公司介绍（主营业务、发展历程、组织架构，至少50字）",
        "industry_background": "行业背景（行业趋势、竞争格局、机遇与挑战，至少50字）",
        "core_pain_points": [
            {"description": "痛点描述", "severity": "critical|high|medium|low"}
        ],
        "expected_goals": ["目标1", "目标2"],
        "success_criteria": ["成功标准1", "成功标准2"],
        "other_requirements": "其他特殊要求"
    }

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        raw_text = input_data.get("smart_extract", {}).get("text", "")
        if not raw_text:
            raw_text = input_data.get("input", {}).get("text", "")

        if not raw_text or len(raw_text.strip()) < 10:
            return StepResult(
                success=False,
                error="输入文本过短，请提供更多客户信息",
                requires_input=True,
            )

        try:
            from app.services.ai_client import ai_client

            system_prompt = """你是一位资深咨询顾问，擅长从客户提供的文本中提取结构化的需求信息。
请从文本中提取以下字段，以 JSON 格式返回：

{
    "client_name": "客户公司名称",
    "industry": "制造业|零售|金融|科技|医疗|教育|房地产|其他",
    "company_scale": "公司规模（如: 200人、年营收5000万等）",
    "company_info": "公司详细介绍（至少50字）",
    "industry_background": "行业背景分析（至少50字）",
    "core_pain_points": [
        {"description": "痛点描述", "severity": "critical|high|medium|low"}
    ],
    "expected_goals": ["目标1", "目标2"],
    "success_criteria": ["成功标准1", "成功标准2"],
    "other_requirements": "其他特殊要求"
}

【必填检查清单】（返回前逐项确认）：
1. client_name: 非空字符串
2. industry: 必须且只能是以下8个值之一 → 制造业, 零售, 金融, 科技, 医疗, 教育, 房地产, 其他
   - ⚠️ 绝对不能返回其他值（如"信息技术"、"互联网"、"SaaS"等都是错误的）
   - 如果文本描述的是软件/互联网/IT公司，必须返回"科技"
3. company_info: 至少50字，如果文本信息不足请根据上下文合理推断补充
4. industry_background: 至少50字，结合客户所在行业推断行业趋势和竞争格局
5. core_pain_points: 数组，至少1项，每项必须有 description 和 severity
   - severity 只能是: critical(严重-影响业务生存), high(高-显著影响运营), medium(中-存在改进空间), low(低-优化建议)
   - 根据痛点的业务影响程度判断严重级别
6. expected_goals: 数组，至少1项
7. success_criteria: 数组，至少1项（如果文本未明确提及，根据痛点推断合理的验收标准）
8. other_requirements: 字符串，没有则填空字符串""

只返回 JSON，不要任何解释或额外文字。"""

            user_prompt = f"请从以下客户文本中提取需求信息：\n\n{raw_text}"

            result_text = await ai_client.chat(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                timeout=30,
            )

            # Extract JSON from response
            extracted = self._parse_json(result_text)
            if not extracted:
                return StepResult(
                    success=False,
                    error="AI 提取失败，请重试或手动填写",
                    requires_input=True,
                )

            return StepResult(success=True, data=extracted)

        except Exception as e:
            logger.error(f"AI extract failed: {e}")
            return StepResult(
                success=False,
                error=f"AI 提取出错: {str(e)}",
                requires_input=True,
            )

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        text = input_data.get("smart_extract", {}).get("text", "") or input_data.get("input", {}).get("text", "")
        if not text or len(text.strip()) < 10:
            return "请输入至少 10 个字符的客户描述文本"
        return None

    def get_description(self, step_id: str) -> str:
        return "AI 智能提取：粘贴客户文本，自动解析为结构化需求表单"

    def _parse_json(self, text: str) -> Optional[Dict]:
        """从 AI 回复中提取 JSON"""
        text = text.strip()
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try markdown code block
        if "```json" in text:
            start = text.index("```json") + 7
            end = text.index("```", start)
            try:
                return json.loads(text[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass
        if "```" in text:
            start = text.index("```") + 3
            end = text.index("```", start)
            try:
                return json.loads(text[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass
        return None
