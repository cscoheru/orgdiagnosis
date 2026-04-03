"""
数据蒸馏工具 — 从 distill_node 抽取

将 collected_data + messages 压缩为结构化 Project_Spec。
"""
import json

from loguru import logger

from app.tools.base import BaseConsultingTool, ToolContext, ToolResult
from app.tools.registry import register_tool


@register_tool
class DataDistillerTool(BaseConsultingTool):
    name = "data_distiller"
    description = "将已收集的项目数据蒸馏为结构化 Project_Spec"
    category = "analysis"

    async def execute(self, ctx: ToolContext) -> ToolResult:
        collected = ctx.collected_data
        blueprint = ctx.blueprint
        goal = ctx.project_goal

        if not collected:
            return ToolResult(success=False, error="没有已收集数据需要蒸馏")

        from app.services.ai_client import AIClient
        ai_client = AIClient()

        distilled = None
        if ai_client.is_configured():
            system_prompt = (
                "你是一位资深管理咨询顾问。请将以下已收集的项目数据整理为结构化的项目规格书。"
                "保留所有关键信息，去除冗余和重复内容。输出格式为 JSON。"
                "直接输出 JSON，不要加 markdown 代码块。"
            )

            user_prompt = f"""项目目标：{goal}
标杆模板：{blueprint.get('title', '')}
已收集数据：
{json.dumps(collected, ensure_ascii=False, indent=2)}

请整理为以下 JSON 结构：
{{
  "project_title": "项目标题",
  "industry": "行业",
  "spec_data": {{
    "node_type_1": {{ ... }},
    "node_type_2": {{ ... }}
  }},
  "key_findings": "关键发现摘要",
  "recommendations": "建议摘要"
}}"""

            try:
                distilled = await ai_client.chat_json(
                    system_prompt, user_prompt,
                    temperature=0.2,
                )
            except Exception as e:
                logger.warning(f"AI distillation failed: {e}, using raw data")

        if not distilled:
            distilled = {
                "project_title": goal[:50],
                "spec_data": collected,
            }

        return ToolResult(
            data={"distilled_spec": distilled},
            message={
                "role": "system",
                "content": f"已完成对话记忆蒸馏，整理出 {len(distilled.get('spec_data', {}))} 个分析模块的结构化数据。继续收集剩余数据...",
            },
        )

    def get_cost_estimate(self) -> int:
        return 2000  # ~2000 tokens for distillation
