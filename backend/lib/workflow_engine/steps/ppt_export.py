"""
W1-Step6 + W2-Step4 + W3-Step4: PPT 渲染导出

使用 PPTXRendererV2 生成 PPTX 文件。
"""
import logging
import uuid
from typing import Any, Dict, Optional

from ..step import BaseStepHandler, StepResult
from ..registry import register_step

logger = logging.getLogger(__name__)


@register_step("ppt_export")
class PPTExportHandler(BaseStepHandler):
    """通用 PPT 导出处理器 (V2 renderer)"""

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        step_config = context.get("step_config", {})
        scope = step_config.get("scope", "full")

        # Collect slide data from previous steps
        slides = self._collect_slides(input_data, step_id, scope)

        if not slides:
            return StepResult(
                success=False,
                error="没有可用的幻灯片数据，请先生成内容",
            )

        # Get theme and layout selection from template_select step
        template_select = input_data.get("template_select", {})
        theme_id = template_select.get("theme_id", "blue_professional")
        slide_layouts = template_select.get("slide_layouts", [])

        # Build layout map: slide_index → layout_id
        layout_map = {}
        for sl in slide_layouts:
            if isinstance(sl, dict):
                layout_map[sl.get("slide_index")] = sl.get("layout_id")

        # Apply user-selected layouts to slides
        for i, slide in enumerate(slides):
            if (i + 1) in layout_map:
                slide["layout"] = layout_map[i + 1]

        # Get client name
        client_name = "客户"
        extract = input_data.get("smart_extract", {})
        if isinstance(extract, dict):
            client_name = extract.get("client_name", "客户") or "客户"

        try:
            from services.pptx_renderer_v2 import create_presentation_v2
            from pathlib import Path

            report_id = f"proposal_{uuid.uuid4().hex[:8]}"
            file_path = create_presentation_v2(
                slides=slides,
                report_id=report_id,
                client_name=client_name,
                theme_id=theme_id,
                auto_layout=len(layout_map) == 0,  # Only auto-layout if no user selection
            )

            # Return download URL (filename only, frontend builds full URL)
            filename = Path(file_path).name
            return StepResult(success=True, data={
                "file_path": f"/api/output/pptx/{filename}",
                "filename": filename,
                "slide_count": len(slides),
                "theme_id": theme_id,
                "status": "generated",
            })

        except ImportError as e:
            logger.warning(f"PPTXRendererV2 not available: {e}")
            return StepResult(
                success=True,
                data={
                    "slides": slides,
                    "slide_count": len(slides),
                    "status": "data_ready",
                    "message": "PPT 渲染器未就绪，幻灯片数据已准备好",
                },
            )
        except Exception as e:
            logger.error(f"PPT export failed: {e}")
            return StepResult(
                success=False,
                error=f"PPT 生成失败: {str(e)}",
            )

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        slides = self._collect_slides(input_data, step_id)
        if not slides:
            return "没有幻灯片数据，请先完成前置步骤"
        return None

    def get_description(self, step_id: str) -> str:
        return "PPT 渲染导出：将幻灯片数据渲染为 PPTX 文件"

    def _collect_slides(
        self,
        input_data: Dict[str, Any],
        step_id: str,
        scope: str = "full",
    ) -> list:
        """Collect slide data from previous step outputs"""
        slides = []

        # W1: impl_outline (3-level format: sections → activities → slides)
        outline = input_data.get("impl_outline", {})
        if outline and outline.get("sections"):
            for section in outline["sections"]:
                # New 3-level: activities → slides
                if section.get("activities"):
                    for activity in section["activities"]:
                        for s in activity.get("slides", []):
                            slides.append({
                                "title": s.get("title", ""),
                                "key_message": s.get("storyline", ""),
                                "bullets": s.get("arguments", []),
                                "evidence": s.get("evidence", []),
                                "supporting_materials": s.get("supporting_materials", []),
                                "context": {"section": section.get("section_name", ""), "activity": activity.get("activity_name", ""), "slide_type": s.get("slide_type", "content")},
                            })
                # Legacy 2-level: sections → slides (backward compat)
                elif section.get("slides"):
                    for s in section["slides"]:
                        slides.append({
                            "title": s.get("title", ""),
                            "key_message": s.get("storyline", ""),
                            "bullets": s.get("arguments", []),
                            "evidence": s.get("evidence", []),
                            "supporting_materials": s.get("supporting_materials", []),
                            "context": {"section": section.get("section_name", "")},
                        })
            return slides

        # W1: impl_outline (legacy flat slides format)
        if outline and outline.get("slides"):
            for s in outline["slides"]:
                slides.append({
                    "title": s.get("title", ""),
                    "key_message": s.get("storyline", ""),
                    "bullets": s.get("arguments", []),
                    "evidence": s.get("evidence", []),
                })
            return slides

        # W2: diagnosis dashboard data
        if input_data.get("dashboard"):
            dashboard = input_data["dashboard"]
            for dim_data in dashboard.get("dimensions", []):
                slides.append({
                    "title": f"{dim_data.get('name', '')} 诊断",
                    "key_message": dim_data.get("summary", ""),
                    "bullets": dim_data.get("findings", []),
                    "score": dim_data.get("score", 0),
                })

        # Direct slides data
        if input_data.get("slides"):
            slides = input_data["slides"]

        return slides


@register_step("ppt_export_by_dimension")
class PPTExportByDimensionHandler(BaseStepHandler):
    """按 L2 维度导出诊断报告 PPT"""

    async def execute(
        self,
        step_id: str,
        input_data: Dict[str, Any],
        context: Dict[str, Any],
    ) -> StepResult:
        dashboard_data = input_data.get("dashboard", {})
        if not dashboard_data:
            return StepResult(
                success=False,
                error="缺少五维诊断数据，请先完成诊断分析",
            )

        slides = []
        dimensions = dashboard_data.get("dimensions", [])

        for dim in dimensions:
            for l2 in dim.get("sub_dimensions", []):
                slides.append({
                    "title": l2.get("name", ""),
                    "key_message": l2.get("summary", ""),
                    "bullets": l2.get("findings", []),
                    "score": l2.get("score", 0),
                    "context": {"dimension": dim.get("name", "")},
                })

        if not slides:
            return StepResult(success=False, error="没有 L2 维度数据")

        try:
            from services.pptx_renderer_v2 import create_presentation_v2
            from pathlib import Path

            import uuid
            report_id = f"diagnosis_{uuid.uuid4().hex[:8]}"
            file_path = create_presentation_v2(
                slides=slides,
                report_id=report_id,
                client_name="诊断报告",
            )
            filename = Path(file_path).name
            return StepResult(success=True, data={
                "file_path": f"/api/output/pptx/{filename}",
                "filename": filename,
                "slide_count": len(slides),
                "status": "generated",
            })
        except Exception as e:
            logger.error(f"PPT export by dimension failed: {e}")
            return StepResult(
                success=True,
                data={
                    "slides": slides,
                    "slide_count": len(slides),
                    "status": "data_ready",
                    "message": f"PPT 渲染出错: {e}",
                },
            )

    async def validate_input(self, step_id: str, input_data: Dict[str, Any]) -> Optional[str]:
        if not input_data.get("dashboard"):
            return "缺少五维诊断数据"
        return None

    def get_description(self, step_id: str) -> str:
        return "按 L2 维度生成诊断报告 PPT"
