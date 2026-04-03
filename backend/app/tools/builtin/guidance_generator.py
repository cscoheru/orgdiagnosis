"""
引导话术生成工具 — 从 interact_node 抽取

根据 missing_fields 和项目上下文，调用 LLM 生成自然语言引导话术。
"""
import json

from loguru import logger

from app.tools.base import BaseConsultingTool, ToolContext, ToolResult
from app.tools.registry import register_tool


@register_tool
class GuidanceGeneratorTool(BaseConsultingTool):
    name = "guidance_generator"
    description = "根据缺失字段和项目上下文，生成咨询引导话术"
    category = "generation"

    async def execute(self, ctx: ToolContext) -> ToolResult:
        missing = ctx.extra.get("missing_fields", [])
        blueprint = ctx.blueprint
        collected = ctx.collected_data
        goal = ctx.project_goal

        if not missing:
            return ToolResult(success=False, error="没有缺失字段需要引导")

        # 构建 UI 组件
        ui_components = []
        current_node_display = ""
        for field in missing:
            comp = {
                "type": field.get("field_type", "input"),
                "key": field.get("field_key", ""),
                "label": field.get("field_label", ""),
                "required": field.get("required", False),
            }
            if field.get("field_options"):
                comp["options"] = field["field_options"]
            ui_components.append(comp)
            current_node_display = field.get("node_display_name", "")

        # 构建 LLM 引导话术
        system_prompt = (
            "你是一位资深管理咨询顾问。根据用户的项目目标和当前需要收集的数据，"
            "用专业但亲切的语气，生成一段引导话术（2-3句话），"
            "帮助用户理解为什么需要这些数据以及如何填写。"
            "直接输出话术文本，不要加引号或额外格式。"
        )

        fields_summary = "\n".join(
            f"- {f['field_label']} ({'必填' if f['required'] else '选填'})"
            for f in missing
        )

        user_prompt = f"""项目目标：{goal}
标杆模板：{blueprint.get('title', '')}
当前分析节点：{current_node_display}
已收集数据概要：{json.dumps({k: '...' for k in collected.keys()}, ensure_ascii=False)}
需要收集的字段：
{fields_summary}

请生成引导话术。"""

        from app.services.ai_client import AIClient
        ai_client = AIClient()

        if ai_client.is_configured():
            try:
                guidance = await ai_client.chat(
                    system_prompt, user_prompt,
                    temperature=0.7, max_tokens=512,
                )
                return ToolResult(
                    data={
                        "guidance": guidance,
                        "ui_components": ui_components,
                        "current_node": current_node_display,
                    },
                    message={
                        "role": "assistant",
                        "content": guidance,
                        "metadata": {
                            "ui_components": ui_components,
                            "context": {
                                "current_node": current_node_display,
                                "progress": ctx.extra.get("progress", 0.0),
                                "benchmark_title": blueprint.get("title", ""),
                                "interaction_count": ctx.extra.get("interaction_count", 0) + 1,
                            },
                        },
                    },
                )
            except Exception as e:
                logger.warning(f"AI guidance failed: {e}, using template")

        # Fallback: 模板引导
        fields = "、".join(f.get("field_label", "") for f in missing[:3])
        if len(missing) > 3:
            fields += f" 等 {len(missing)} 项"
        guidance = f"为了完成「{current_node_display}」分析，请补充以下信息：{fields}。"

        return ToolResult(
            data={
                "guidance": guidance,
                "ui_components": ui_components,
                "current_node": current_node_display,
            },
            message={
                "role": "assistant",
                "content": guidance,
                "metadata": {
                    "ui_components": ui_components,
                    "context": {
                        "current_node": current_node_display,
                        "progress": ctx.extra.get("progress", 0.0),
                    },
                },
            },
        )

    def get_cost_estimate(self) -> int:
        return 800  # ~800 tokens per guidance call
