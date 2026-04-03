"""
报告生成工具 — 从 executor_node 抽取

将蒸馏后的数据转换为 slides 并生成 PPTX 报告。
"""
import json
import os
from datetime import datetime

from loguru import logger

from app.tools.base import BaseConsultingTool, ToolContext, ToolResult
from app.tools.registry import register_tool


@register_tool
class ReportGeneratorTool(BaseConsultingTool):
    name = "report_generator"
    description = "将蒸馏后的项目数据生成 PPTX 咨询报告"
    category = "generation"

    async def execute(self, ctx: ToolContext) -> ToolResult:
        distilled = ctx.extra.get("distilled_spec", {})
        collected = ctx.collected_data

        if not collected:
            return ToolResult(success=False, error="没有数据可生成报告")

        if not distilled:
            distilled = {
                "project_title": ctx.project_goal[:50],
                "spec_data": collected,
            }

        # 构建 slides
        slides = []

        # 封面页
        slides.append({
            "layout": "title_slide",
            "title": distilled.get("project_title", "组织诊断报告"),
            "subtitle": datetime.now().strftime("%Y年%m月"),
        })

        # 为每个 node_type 生成一页
        from app.agent.nodes import _get_blueprint_service
        svc = _get_blueprint_service()

        for node_type, data in collected.items():
            if not isinstance(data, dict) or not data:
                continue

            logic_node = svc.get_logic_node_by_type(node_type)
            display_name = (
                logic_node.get("properties", {}).get("display_name", node_type)
                if logic_node else node_type
            )

            bullets = []
            for key, value in data.items():
                if isinstance(value, str) and value:
                    bullets.append(value)
                elif isinstance(value, (int, float)) and value:
                    bullets.append(str(value))
                elif isinstance(value, list):
                    bullets.extend(str(v) for v in value if v)

            if not bullets:
                continue

            key_message = ""
            if logic_node:
                key_message = logic_node.get("properties", {}).get("description", "")
            if not key_message and bullets:
                key_message = bullets[0][:50]

            slides.append({
                "title": display_name,
                "key_message": key_message,
                "bullets": bullets[:8],
            })

        # 关键发现页
        if distilled.get("key_findings"):
            slides.append({
                "title": "关键发现",
                "key_message": distilled["key_findings"],
            })

        # 建议页
        if distilled.get("recommendations"):
            slides.append({
                "title": "建议与展望",
                "key_message": distilled["recommendations"],
            })

        if len(slides) < 2:
            return ToolResult(success=False, error="数据不足以生成报告")

        # 调用 PPTXRendererV2
        try:
            from services.pptx_renderer_v2 import create_presentation_v2

            output_dir = os.path.join(
                os.path.dirname(__file__), "..", "..", "..", "..", "output", "pptx"
            )
            pptx_path = create_presentation_v2(
                slides=slides,
                report_id=f"agent_{ctx.session_id}",
                client_name=distilled.get("project_title", ""),
                output_dir=output_dir,
                theme_id="blue_professional",
            )

            logger.info(f"PPTX generated: {pptx_path} ({len(slides)} slides)")

            return ToolResult(
                data={
                    "pptx_path": pptx_path,
                    "slide_count": len(slides),
                },
                metadata={"pptx_path": pptx_path},
            )
        except ImportError:
            logger.warning("PPTXRendererV2 not available")
            return ToolResult(success=False, error="PPTX 渲染器不可用")
        except Exception as e:
            logger.error(f"PPTX generation failed: {e}")
            return ToolResult(success=False, error=str(e))

    def is_read_only(self) -> bool:
        return False  # 生成文件

    def get_cost_estimate(self) -> int:
        return 0  # 不消耗 AI tokens（纯渲染）
