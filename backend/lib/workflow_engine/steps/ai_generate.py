"""
W1-Step2/3/4: AI 内容生成

通用 AI 生成步骤处理器，支持里程碑计划、MDS 幻灯片、实施计划大纲。
通过 step_config.context 区分不同生成目标。
"""
import json
import logging
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)

# Step-specific prompt templates
PROMPTS = {
    "milestone_plan": {
        "system": """你是一位资深管理咨询顾问，擅长制定项目计划和里程碑。
根据客户需求信息，生成项目目标、阶段计划、主要任务和成果要求。

【重要】你必须返回完整的 JSON，所有字段都是必填项，不可省略。

返回格式（严格遵守）：
{
    "project_goal": "项目总体目标（1-2句话概括）",
    "phases": [
        {
            "phase_name": "阶段名称",
            "phase_order": 1,
            "duration_weeks": 4,
            "time_range": "第1-4周",
            "goals": "阶段目标描述（至少20字）",
            "key_activities": ["关键活动1", "关键活动2", "关键活动3"],
            "deliverables": ["交付成果1", "交付成果2"]
        }
    ],
    "success_criteria": ["成功标准1", "成功标准2", "成功标准3"],
    "main_tasks": ["主要任务1", "主要任务2", "主要任务3"],
    "total_duration_weeks": 12
}

【必填检查清单】（返回前逐项确认）：
1. project_goal: 非空字符串
2. phases: 数组，至少2个阶段，最多5个
3. 每个阶段必须包含全部6个字段: phase_name, phase_order, duration_weeks, time_range, goals, key_activities, deliverables
4. key_activities: 每个阶段至少2项活动
5. deliverables: 每个阶段至少1项
6. duration_weeks: 每个阶段为正整数（1-12）
7. total_duration_weeks: 等于所有阶段 duration_weeks 之和
8. main_tasks: 数组，至少2项
9. success_criteria: 数组，至少2项

【阶段规划规则】：
- 根据客户痛点数量和严重程度设计阶段（通常3-4个阶段）
- critical/high 级别痛点应分配更多时间
- 典型阶段: 需求诊断(2-3周) → 调研分析(3-4周) → 方案设计(3-4周) → 实施交付(4-6周)
- 只返回 JSON，不要任何解释或额外文字""",
    },
    "mds_content": {
        "system": """你是一位资深管理咨询顾问，擅长制作 Million Dollar Slide (MDS)。
MDS 是一张汇总幻灯片，将项目的核心价值浓缩在一页中，让决策者一目了然。

根据里程碑计划，生成一张 Million Dollar Slide，以 JSON 格式返回：

{
    "title": "项目建议书 — [客户公司名]",
    "project_goal": "项目总体目标（1-2句话）",
    "key_message": "核心信息（一句话概括为什么选择我们/为什么这个方案有效）",
    "phases_summary": [
        {
            "phase_name": "阶段名称",
            "duration_weeks": 4,
            "key_deliverable": "本阶段最核心的交付物（一句话）"
        }
    ],
    "total_duration_weeks": 12,
    "expected_outcomes": ["预期成果1", "预期成果2", "预期成果3"]
}

【必填检查清单】（返回前逐项确认）：
1. title: 包含客户公司名
2. project_goal: 非空，与里程碑计划一致
3. key_message: 非空，是价值主张而非描述
4. phases_summary: 与里程碑计划的阶段一一对应
5. 每个阶段的 key_deliverable: 非空，是该阶段最重要的一个交付物
6. total_duration_weeks: 等于所有阶段 duration_weeks 之和
7. expected_outcomes: 至少2项，描述项目完成后的预期效果

只返回 JSON，不要任何解释或额外文字。""",
    },
    "impl_outline": {
        "system": """你是一位资深咨询顾问，擅长制作项目建议书的详细大纲。
根据 MDS 幻灯片和里程碑计划，为建议书每一页生成详细大纲。

按阶段分组，每个阶段包含关键活动，每个关键活动对应 1-多个页面。每页包含 4 个要素：
- storyline: 核心观点（一句话概括本页要传达的信息）
- arguments: 重要论点（支撑核心观点的论点列表）
- evidence: 论据（数据、案例、行业报告等具体证据）
- supporting_materials: 素材（图表、引用、模板等支撑材料）

页面类型分为三种：
- content: 核心内容页（storyline + 论点 + 论据 + 素材，三段论结构）
- methodology: 方法论页（分析框架/工具/流程/模型）
- case: 案例页（行业案例/对标分析/最佳实践）

以 JSON 格式返回：
{
    "sections": [
        {
            "section_name": "阶段名称",
            "activities": [
                {
                    "activity_name": "关键活动名称",
                    "slides": [
                        {
                            "slide_index": 1,
                            "title": "页面标题",
                            "slide_type": "content",
                            "storyline": "核心观点",
                            "arguments": ["论点1", "论点2"],
                            "evidence": ["论据1"],
                            "supporting_materials": ["素材1"]
                        }
                    ]
                }
            ]
        }
    ]
}

【必填检查清单】（返回前逐项确认）：
1. sections: 与 MDS 的阶段一一对应
2. 每个阶段至少 1 个 activity
3. 每个 activity 至少 1 个 slide
4. 每个 slide 必须包含全部 6 个字段
5. slide_type 必须是 content / methodology / case 之一
6. 每个 activity 建议包含：1个方法论页 + 1-2个案例页 + 1-3个内容页
7. slide_index: 在整个 sections 中全局递增

只返回 JSON，不要任何解释或额外文字。""",
    },
    "impl_outline_section": {
        "system": """你是一位资深咨询顾问。请为指定的一个阶段生成详细大纲。

该阶段包含若干关键活动，每个关键活动对应 1-多个页面。

页面类型分为三种：
- content: 核心内容页（storyline + 论点 + 论据 + 素材，三段论结构）
- methodology: 方法论页（分析框架/工具/流程/模型）
- case: 案例页（行业案例/对标分析/最佳实践）

每个 activity 建议：1个方法论页 + 1-2个案例页 + 1-3个内容页

以 JSON 格式返回一个 section 对象：
{
    "section_name": "阶段名称",
    "activities": [
        {
            "activity_name": "关键活动名称",
            "slides": [
                {
                    "slide_index": 1,
                    "title": "页面标题",
                    "slide_type": "content",
                    "storyline": "核心观点",
                    "arguments": ["论点1"],
                    "evidence": ["论据1"],
                    "supporting_materials": ["素材1"]
                }
            ]
        }
    ]
}

只返回 JSON，不要任何解释。""",
    },
    "impl_outline_activity": {
        "system": """你是一位资深咨询顾问。请为指定的一个关键活动生成页面大纲。

页面类型分为三种：
- content: 核心内容页（storyline + 论点 + 论据 + 素材）
- methodology: 方法论页（分析框架/工具/流程/模型）
- case: 案例页（行业案例/对标分析/最佳实践）

建议包含：1个方法论页 + 1-2个案例页 + 1-3个内容页

以 JSON 格式返回一个 activity 对象：
{
    "activity_name": "活动名称",
    "slides": [
        {
            "slide_index": 1,
            "title": "页面标题",
            "slide_type": "content",
            "storyline": "核心观点",
            "arguments": ["论点1"],
            "evidence": ["论据1"],
            "supporting_materials": ["素材1"]
        }
    ]
}

只返回 JSON，不要任何解释。""",
    },
}


@register_step("ai_generate")
class AIGenerateHandler(BaseStepHandler):

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        # Determine generation target from step_id
        gen_target = self._resolve_gen_target(step_id)
        prompt_config = PROMPTS.get(gen_target)
        if not prompt_config:
            return StepResult(success=False, error=f"未知的生成目标: {gen_target}")

        # Build context summary from previous steps
        context_summary = self._build_context_summary(input_data, step_id)

        # impl_outline 生成内容量大，需要更长超时和更多 token
        is_outline = gen_target == "impl_outline"

        try:
            from app.services.ai_client import ai_client

            result_text = await ai_client.chat(
                system_prompt=prompt_config["system"],
                user_prompt=f"请根据以下信息生成内容：\n\n{context_summary}",
                temperature=0.5,
                timeout=180 if is_outline else 60,
                max_tokens=8192 if is_outline else 4096,
            )

            parsed = self._parse_json(result_text)
            if not parsed:
                return StepResult(success=False, error="AI 生成结果解析失败，请重试")

            return StepResult(success=True, data=parsed)

        except Exception as e:
            logger.error(f"AI generate ({gen_target}) failed: {e}")
            return StepResult(success=False, error=f"AI 生成出错: {str(e)}")

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        gen_target = self._resolve_gen_target(step_id)
        # Check that prerequisite step data exists
        prereqs = {
            "milestone_plan": ["smart_extract"],
            "mds_content": ["milestone_plan"],
            "impl_outline": ["mds_content"],
        }
        required = prereqs.get(gen_target, [])
        for req in required:
            if not input_data.get(req):
                return f"缺少前置步骤数据: {req}"
        return None

    def get_description(self, step_id: str) -> str:
        gen_target = self._resolve_gen_target(step_id)
        descriptions = {
            "milestone_plan": "AI 生成里程碑计划和阶段安排",
            "mds_content": "AI 生成 MDS 幻灯片内容",
            "impl_outline": "AI 生成实施计划大纲 (逐页 storyline + 论点 + 论据)",
        }
        return descriptions.get(gen_target, "AI 内容生成")

    def _resolve_gen_target(self, step_id: str) -> str:
        """Map step_id to generation target"""
        mapping = {
            "milestone_plan": "milestone_plan",
            "mds_content": "mds_content",
            "impl_outline": "impl_outline",
        }
        return mapping.get(step_id, step_id)

    def _build_context_summary(self, input_data: Dict[str, Any], current_step: str) -> str:
        """Build context summary from previous step outputs"""
        parts = []

        if input_data.get("smart_extract"):
            extract = input_data["smart_extract"]
            # Support both old (pain_points: string[]) and new (core_pain_points: [{description, severity}])
            pains = extract.get('core_pain_points', extract.get('pain_points', []))
            if isinstance(pains, list) and pains and isinstance(pains[0], dict):
                pain_str = ", ".join(
                    f"[{p.get('severity', 'medium')}]{p.get('description', '')}" for p in pains
                )
            else:
                pain_str = json.dumps(pains, ensure_ascii=False)
            parts.append(
                f"## 客户需求\n"
                f"客户: {extract.get('client_name', 'N/A')}\n"
                f"行业: {extract.get('industry', 'N/A')}\n"
                f"规模: {extract.get('company_scale', 'N/A')}\n"
                f"痛点: {pain_str}\n"
                f"目标: {json.dumps(extract.get('expected_goals', []), ensure_ascii=False)}\n"
                f"成功标准: {json.dumps(extract.get('success_criteria', []), ensure_ascii=False)}"
            )

        if input_data.get("milestone_plan"):
            plan = input_data["milestone_plan"]
            parts.append(f"## 里程碑计划\n项目目标: {plan.get('project_goal', 'N/A')}\n阶段: {json.dumps(plan.get('phases', []), ensure_ascii=False, indent=2)}")

        if input_data.get("mds_content"):
            mds = input_data["mds_content"]
            # Support new table format (phases + rows) and old format (phases_summary)
            phases = mds.get("phases", [])
            if phases:
                parts.append(
                    f"## MDS 幻灯片\n"
                    f"标题: {mds.get('title', 'N/A')}\n"
                    f"核心信息: {mds.get('key_message', 'N/A')}\n"
                    f"阶段: {json.dumps(phases, ensure_ascii=False)}\n"
                    f"预期成果: {json.dumps(mds.get('expected_outcomes', []), ensure_ascii=False)}"
                )
            elif mds.get("phases_summary"):
                parts.append(
                    f"## MDS 幻灯片\n"
                    f"标题: {mds.get('title', 'N/A')}\n"
                    f"核心信息: {mds.get('key_message', 'N/A')}\n"
                    f"阶段汇总: {json.dumps(mds.get('phases_summary', []), ensure_ascii=False)}\n"
                    f"预期成果: {json.dumps(mds.get('expected_outcomes', []), ensure_ascii=False)}"
                )
            else:
                parts.append(f"## MDS 幻灯片\n{json.dumps(mds, ensure_ascii=False, indent=2)}")

        # Section/activity context for graded generation
        if input_data.get("section_context"):
            sc = input_data["section_context"]
            parts.append(
                f"## 当前阶段\n"
                f"阶段名称: {sc.get('section_name', 'N/A')}\n"
                f"阶段目标: {sc.get('goals', 'N/A')}\n"
                f"关键活动: {json.dumps(sc.get('key_activities', []), ensure_ascii=False)}\n"
                f"交付物: {json.dumps(sc.get('deliverables', []), ensure_ascii=False)}"
            )

        if input_data.get("activity_context"):
            ac = input_data["activity_context"]
            parts.append(
                f"## 当前关键活动\n"
                f"活动名称: {ac.get('activity_name', 'N/A')}\n"
                f"所属阶段: {ac.get('section_name', 'N/A')}"
            )

        return "\n\n".join(parts) if parts else "无前置数据"

    def _parse_json(self, text: str) -> Optional[Dict]:
        """Parse JSON from AI response"""
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
        if "```" in text:
            start = text.index("```") + 3
            end = text.index("```", start)
            try:
                return json.loads(text[start:end].strip())
            except (json.JSONDecodeError, ValueError):
                pass
        return None
