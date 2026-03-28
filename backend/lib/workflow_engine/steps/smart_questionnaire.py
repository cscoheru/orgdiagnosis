"""
W2-Step1: 结构化问卷 + AI 智能补问

基于 L1-L3 诊断指标生成结构化问卷，AI 发现缺失信息并补充问题。
"""
import json
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)

# 五维诊断指标 (L1-L3)
DIMENSION_INDICATORS = {
    "战略": {
        "L1": ["战略目标", "市场定位"],
        "L2": ["战略目标", "市场定位", "竞争策略"],
        "L3": ["目标清晰度", "市场分析", "竞争格局", "战略路径"],
    },
    "组织": {
        "L1": ["组织架构", "权责分配"],
        "L2": ["组织结构", "权责体系", "流程效率"],
        "L3": ["部门设置", "管理层级", "汇报关系", "流程效率"],
    },
    "绩效": {
        "L1": ["绩效体系", "目标管理"],
        "L2": ["绩效指标", "考核流程", "结果应用"],
        "L3": ["KPI 设置", "考核周期", "反馈机制", "激励挂钩"],
    },
    "薪酬": {
        "L1": ["薪酬策略", "薪酬结构"],
        "L2": ["薪酬水平", "薪酬结构", "内部公平"],
        "L3": ["固定薪酬", "浮动薪酬", "福利体系", "外部竞争力"],
    },
    "人才": {
        "L1": ["人才盘点", "发展体系"],
        "L2": ["人才画像", "继任计划", "培养体系"],
        "L3": ["能力模型", "梯队建设", "培训发展", "人才流失"],
    },
}


@register_step("smart_questionnaire")
class SmartQuestionnaireHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        # Get selected modules from project context
        selected_modules = context.get("selected_modules", ["战略", "组织", "绩效", "薪酬", "人才"])

        # Get existing questionnaire data (if user has filled some)
        existing_data = input_data.get("questionnaire", {})
        raw_text = input_data.get("input", {}).get("text", "")

        # Build questionnaire structure
        questionnaire = self._build_questionnaire(selected_modules)

        # If user provided text, extract answers
        if raw_text:
            questionnaire = await self._extract_from_text(questionnaire, raw_text)

        # Merge existing data
        if existing_data:
            questionnaire = self._merge_data(questionnaire, existing_data)

        return StepResult(success=True, data={
            "questionnaire": questionnaire,
            "selected_modules": selected_modules,
        })

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        return None  # No strict validation needed

    def get_description(self, step_id: str) -> str:
        return "结构化问卷：按五维度生成诊断问题，支持 AI 智能补问"

    async def smart_question(self, questionnaire_data: Dict[str, Any]) -> StepResult:
        """AI 基于已填问卷发现缺失信息，生成补充问题"""
        try:
            from app.services.ai_client import ai_client

            system_prompt = """你是一位资深咨询顾问，擅长发现诊断问卷中的信息缺口。
分析已填写的问卷数据，找出缺失的关键信息，生成补充问题。
以 JSON 格式返回：
{
    "missing_dimensions": ["缺失较多的维度"],
    "supplementary_questions": [
        {
            "dimension": "维度",
            "question": "问题",
            "reason": "为什么需要这个问题"
        }
    ],
    "completeness_score": 75
}"""

            user_prompt = f"已填写的问卷数据：\n{json.dumps(questionnaire_data, ensure_ascii=False, indent=2)}"

            result_text = await ai_client.chat(
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                temperature=0.3,
                timeout=30,
            )

            parsed = self._parse_json(result_text)
            if parsed:
                return StepResult(success=True, data=parsed)
            return StepResult(success=False, error="AI 补问结果解析失败")

        except Exception as e:
            logger.error(f"Smart question failed: {e}")
            return StepResult(success=False, error=f"AI 补问出错: {str(e)}")

    def _build_questionnaire(self, selected_modules: list) -> Dict[str, Any]:
        """Build questionnaire structure based on selected dimensions"""
        questionnaire = {}
        for dim_name in selected_modules:
            indicators = DIMENSION_INDICATORS.get(dim_name)
            if not indicators:
                continue
            questionnaire[dim_name] = {
                "indicators": indicators,
                "questions": [],
                "answers": {},
            }
            # Add L3 questions
            for l3_item in indicators.get("L3", []):
                questionnaire[dim_name]["questions"].append({
                    "id": f"{dim_name}_{l3_item}",
                    "text": f"请描述贵公司在「{l3_item}」方面的现状和挑战",
                    "level": "L3",
                    "answer": "",
                })
        return questionnaire

    async def _extract_from_text(self, questionnaire: Dict, raw_text: str) -> Dict:
        """Try to extract answers from raw text"""
        try:
            from app.services.ai_client import ai_client

            system_prompt = """从客户提供的文本中提取与诊断问卷相关的信息。
以 JSON 格式返回，键为 "维度_指标"，值为提取的答案文本。
只提取文本中明确提到的信息，没有提到的不要编造。"""

            result_text = await ai_client.chat(
                system_prompt=system_prompt,
                user_prompt=raw_text,
                temperature=0.3,
                timeout=30,
            )

            extracted = self._parse_json(result_text)
            if extracted:
                for dim_name, dim_data in questionnaire.items():
                    for q in dim_data.get("questions", []):
                        key = f"{dim_name}_{q['text'].split('「')[1].split('」')[0]}" if '「' in q['text'] else q["id"]
                        if key in extracted:
                            q["answer"] = extracted[key]

        except Exception as e:
            logger.warning(f"Text extraction failed: {e}")

        return questionnaire

    def _merge_data(self, questionnaire: Dict, existing: Dict) -> Dict:
        """Merge existing questionnaire data"""
        for dim_name, dim_data in existing.items():
            if dim_name not in questionnaire:
                questionnaire[dim_name] = dim_data
                continue
            if isinstance(dim_data, dict) and "questions" in dim_data:
                for q in dim_data["questions"]:
                    for target_q in questionnaire[dim_name]["questions"]:
                        if target_q.get("id") == q.get("id"):
                            target_q["answer"] = q.get("answer", "")
        return questionnaire

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
