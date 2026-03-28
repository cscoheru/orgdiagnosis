"""
PPT Template & Layout API

GET /api/templates/themes    → list built-in themes
GET /api/templates/layouts   → list available layouts by category
POST /api/templates/recommend → AI-recommend a layout for slide content
"""
from typing import List, Dict, Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()


class RecommendRequest(BaseModel):
    content: str
    title: str = ""


@router.get("/themes")
async def get_themes():
    """Return all built-in PPT themes"""
    try:
        from lib.layout.template_manager import get_template_manager
        tm = get_template_manager()
        themes = tm.get_all_themes()
        return [
            {
                "id": t.theme_id,
                "name": t.theme_name,
                "description": t.description,
                "preview_colors": [t.primary_color, t.secondary_color, t.accent_color],
            }
            for t in themes
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载主题失败: {str(e)}")


@router.get("/layouts")
async def get_layouts():
    """Return all available layouts grouped by category"""
    try:
        from lib.layout.template_manager import get_template_manager
        tm = get_template_manager()
        layouts = tm.get_all_layouts()

        # Group by category
        categories: Dict[str, Dict[str, Any]] = {}
        for l in layouts:
            cat = l.category
            if cat not in categories:
                categories[cat] = {
                    "category": cat,
                    "category_name": _category_display_name(cat),
                    "layouts": [],
                }
            categories[cat]["layouts"].append(l.layout_id)

        return {"categories": list(categories.values())}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"加载布局失败: {str(e)}")


@router.post("/recommend")
async def recommend_layout(req: RecommendRequest):
    """AI-recommend a layout for slide content"""
    try:
        from lib.layout.intelligent_selector import IntelligentLayoutSelector
        selector = IntelligentLayoutSelector()

        # Use the intelligent selector
        result = selector.select(
            title=req.title or "",
            key_message=req.content,
            bullets=[req.content],
        )
        return {"layout_id": result.primary.layout_id}
    except Exception as e:
        # Fallback: return a general-purpose layout
        return {"layout_id": "centered_insight"}


def _category_display_name(cat: str) -> str:
    names = {
        "KEY_INSIGHT": "核心观点",
        "PARALLEL": "并列对比",
        "MATRIX": "矩阵分析",
        "PROCESS": "流程步骤",
        "TIMELINE": "时间线",
        "TABLE": "表格数据",
        "DATA_VIZ": "数据可视化",
        "HIERARCHY": "层级结构",
        "SECTION": "章节标题",
        "TITLE": "封面标题",
    }
    return names.get(cat, cat)
