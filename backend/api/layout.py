"""
Layout Recommendation API

Provides endpoints for automatic layout selection based on content analysis.
Also supports template upload and parsing.
"""

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel
from typing import List, Optional
from loguru import logger
import os
import tempfile
import shutil

router = APIRouter(prefix="/layout", tags=["layout"])


# === Request/Response Models ===

class LayoutRecommendRequest(BaseModel):
    """Request for layout recommendation"""
    title: str
    key_message: str
    bullets: List[str]


class LayoutRecommendation(BaseModel):
    """A single layout recommendation"""
    layout_id: str
    layout_name: str
    confidence: float
    reason: str


class LayoutRecommendResponse(BaseModel):
    """Response with layout recommendations"""
    recommendations: List[LayoutRecommendation]
    best_layout_id: str
    best_layout_reason: str


class LayoutInfo(BaseModel):
    """Information about a single layout"""
    layout_id: str
    layout_name: str
    category: str
    description: str
    element_count_range: tuple
    keywords: List[str]


class LayoutListResponse(BaseModel):
    """Response with all available layouts"""
    layouts: List[LayoutInfo]
    total: int


# === API Endpoints ===

@router.post("/recommend", response_model=LayoutRecommendResponse)
async def recommend_layout(request: LayoutRecommendRequest):
    """
    Get layout recommendations based on content analysis.

    Analyzes the slide title, key message, and bullets to recommend
    the most appropriate visual layout.

    Returns:
        - recommendations: List of recommended layouts with confidence scores
        - best_layout_id: The single best layout
        - best_layout_reason: Explanation for the recommendation
    """
    try:
        from lib.layout.semantic_router import get_semantic_router
        from schemas.layout import SlideElement

        router_instance = get_semantic_router()

        # Convert bullets to SlideElements for the router
        elements = [
            SlideElement(
                element_id=f"elem_{i}",
                element_title=bullet[:50] if len(bullet) > 50 else bullet,
                element_content=bullet
            )
            for i, bullet in enumerate(request.bullets)
        ]

        # Get layout recommendation
        primary_layout, alternatives = router_instance.select_layout(
            elements=elements,
            reasoning=request.key_message
        )

        # Build response
        recommendations = []

        # Primary recommendation
        primary_manifest = router_instance.get_layout_by_id(primary_layout)
        if primary_manifest:
            recommendations.append(LayoutRecommendation(
                layout_id=primary_layout,
                layout_name=primary_manifest.get("layout_name", primary_layout),
                confidence=0.9,
                reason=f"最适合{len(request.bullets)}个要素的{primary_manifest.get('category', '内容')}展示"
            ))

        # Alternative recommendations
        for alt_layout in alternatives[:3]:
            alt_manifest = router_instance.get_layout_by_id(alt_layout)
            if alt_manifest:
                recommendations.append(LayoutRecommendation(
                    layout_id=alt_layout,
                    layout_name=alt_manifest.get("layout_name", alt_layout),
                    confidence=0.7,
                    reason=f"备选方案：{alt_manifest.get('description', '同类布局')}"
                ))

        # If no recommendations, provide fallback
        if not recommendations:
            recommendations.append(LayoutRecommendation(
                layout_id="PARALLEL_CARDS",
                layout_name="并列卡片",
                confidence=0.5,
                reason="默认推荐：适合大多数内容展示"
            ))

        return LayoutRecommendResponse(
            recommendations=recommendations,
            best_layout_id=primary_layout,
            best_layout_reason=recommendations[0].reason if recommendations else "默认布局"
        )

    except Exception as e:
        logger.error(f"Layout recommendation failed: {e}")
        # Return fallback response
        return LayoutRecommendResponse(
            recommendations=[
                LayoutRecommendation(
                    layout_id="PARALLEL_CARDS",
                    layout_name="并列卡片",
                    confidence=0.5,
                    reason="默认推荐"
                )
            ],
            best_layout_id="PARALLEL_CARDS",
            best_layout_reason="默认布局"
        )


@router.get("/list", response_model=LayoutListResponse)
async def list_layouts():
    """
    List all available layouts.

    Returns all layout manifests with their metadata.
    """
    try:
        from schemas.layout import DEFAULT_LAYOUT_MANIFESTS

        layouts = []
        for manifest in DEFAULT_LAYOUT_MANIFESTS:
            layouts.append(LayoutInfo(
                layout_id=manifest.get("layout_id", ""),
                layout_name=manifest.get("layout_name", ""),
                category=manifest.get("category", ""),
                description=manifest.get("description", ""),
                element_count_range=manifest.get("element_count_range", (1, 6)),
                keywords=manifest.get("keywords", [])
            ))

        return LayoutListResponse(
            layouts=layouts,
            total=len(layouts)
        )

    except Exception as e:
        logger.error(f"Failed to list layouts: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/category/{category}")
async def get_layouts_by_category(category: str):
    """
    Get layouts by category.

    Args:
        category: One of MATRIX, PROCESS, PARALLEL, TABLE, TIMELINE, DATA_VIZ, KEY_INSIGHT
    """
    try:
        from lib.layout.semantic_router import get_semantic_router
        from schemas.layout import VisualModelCategory

        router_instance = get_semantic_router()

        # Convert string to enum
        try:
            cat_enum = VisualModelCategory[category.upper()]
        except KeyError:
            raise HTTPException(status_code=400, detail=f"Invalid category: {category}")

        layouts = router_instance.get_layouts_by_category(cat_enum)

        return {
            "category": category,
            "layouts": layouts,
            "total": len(layouts)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get layouts by category: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# === Template Upload Models ===

class TemplateUploadResponse(BaseModel):
    """Response for template upload"""
    success: bool
    template_name: str
    layouts_count: int
    layouts: List[LayoutInfo]
    message: str


class TemplateStatusResponse(BaseModel):
    """Response for template processing status"""
    template_id: str
    status: str  # pending, processing, completed, failed
    layouts_count: int
    error_message: Optional[str] = None


# === Template Upload Endpoints ===

# Store for uploaded templates
_uploaded_templates: dict = {}


@router.post("/template/upload", response_model=TemplateUploadResponse)
async def upload_template(
    file: UploadFile = File(..., description="PPTX template file"),
    use_ai_description: bool = True
):
    """
    Upload and analyze a PPTX template.

    The template will be parsed and all layouts extracted with their
    placeholder information and semantic descriptions.

    Args:
        file: PPTX template file
        use_ai_description: Whether to use AI for generating semantic descriptions

    Returns:
        List of extracted layouts with their manifests
    """
    # Validate file type
    if not file.filename.endswith('.pptx'):
        raise HTTPException(status_code=400, detail="Only PPTX files are supported")

    try:
        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix='.pptx') as tmp:
            shutil.copyfileobj(file.file, tmp)
            tmp_path = tmp.name

        logger.info(f"Analyzing uploaded template: {file.filename}")

        # Analyze template
        from lib.layout.template_analyzer import get_template_analyzer

        analyzer = get_template_analyzer()
        analyzer.use_ai_description = use_ai_description

        manifests = analyzer.analyze_template(tmp_path)

        # Clean up temp file
        os.unlink(tmp_path)

        if not manifests:
            return TemplateUploadResponse(
                success=False,
                template_name=file.filename,
                layouts_count=0,
                layouts=[],
                message="Failed to extract layouts from template"
            )

        # Convert to LayoutInfo
        layouts = []
        for m in manifests:
            layouts.append(LayoutInfo(
                layout_id=m.layout_id,
                layout_name=m.layout_name,
                category=m.category,
                description=m.description,
                element_count_range=m.element_count_range,
                keywords=m.keywords
            ))

        # Store for later use
        template_id = file.filename.replace('.pptx', '').replace(' ', '_')
        _uploaded_templates[template_id] = {
            "manifests": manifests,
            "layouts": layouts
        }

        logger.info(f"Successfully extracted {len(layouts)} layouts from {file.filename}")

        return TemplateUploadResponse(
            success=True,
            template_name=file.filename,
            layouts_count=len(layouts),
            layouts=layouts,
            message=f"成功解析模板，提取了 {len(layouts)} 个布局"
        )

    except Exception as e:
        logger.error(f"Template upload failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/template/list")
async def list_uploaded_templates():
    """
    List all uploaded templates.

    Returns:
        List of uploaded template names and their layout counts
    """
    templates = []
    for template_id, data in _uploaded_templates.items():
        templates.append({
            "template_id": template_id,
            "layouts_count": len(data.get("layouts", []))
        })

    return {
        "templates": templates,
        "total": len(templates)
    }


@router.get("/all")
async def get_all_layouts():
    """
    Get all available layouts (default + uploaded templates).

    Returns layouts organized by category for easy selection.
    """
    from schemas.layout import DEFAULT_LAYOUT_MANIFESTS

    # Start with default layouts
    layouts_by_category: dict = {}

    # Add default layouts
    for manifest in DEFAULT_LAYOUT_MANIFESTS:
        category = manifest.get("category", "PARALLEL")
        if category not in layouts_by_category:
            layouts_by_category[category] = []

        layouts_by_category[category].append({
            "layout_id": manifest.get("layout_id", ""),
            "layout_name": manifest.get("layout_name", ""),
            "category": category,
            "description": manifest.get("description", ""),
            "element_count_range": manifest.get("element_count_range", (1, 6)),
            "keywords": manifest.get("keywords", []),
            "source": "default"
        })

    # Add uploaded template layouts
    for template_id, data in _uploaded_templates.items():
        for layout in data.get("layouts", []):
            category = layout.get("category", "PARALLEL")
            if category not in layouts_by_category:
                layouts_by_category[category] = []

            layouts_by_category[category].append({
                **layout,
                "source": f"template:{template_id}"
            })

    # Convert to list format with counts
    result = []
    category_labels = {
        "MATRIX": "矩阵布局",
        "PROCESS": "流程布局",
        "PARALLEL": "并列布局",
        "TABLE": "对比布局",
        "TIMELINE": "时间线",
        "DATA_VIZ": "数据可视化",
        "KEY_INSIGHT": "核心观点"
    }

    for category, layouts in layouts_by_category.items():
        result.append({
            "category_id": category,
            "category_label": category_labels.get(category, category),
            "layouts": layouts,
            "count": len(layouts)
        })

    return {
        "categories": result,
        "total_layouts": sum(len(cat["layouts"]) for cat in result)
    }


@router.get("/template/{template_id}")
async def get_template_layouts(template_id: str):
    """
    Get layouts from an uploaded template.

    Args:
        template_id: ID of the uploaded template

    Returns:
        List of layouts for the template
    """
    if template_id not in _uploaded_templates:
        raise HTTPException(status_code=404, detail="Template not found")

    data = _uploaded_templates[template_id]
    return {
        "template_id": template_id,
        "layouts": data.get("layouts", []),
        "total": len(data.get("layouts", []))
    }


@router.delete("/template/{template_id}")
async def delete_template(template_id: str):
    """
    Delete an uploaded template.

    Args:
        template_id: ID of the template to delete
    """
    if template_id not in _uploaded_templates:
        raise HTTPException(status_code=404, detail="Template not found")

    del _uploaded_templates[template_id]

    return {
        "success": True,
        "message": f"Template {template_id} deleted"
    }


# === Theme Management Endpoints ===

class ThemeInfo(BaseModel):
    """Information about a theme"""
    theme_id: str
    theme_name: str
    style: str
    color: str
    primary_color: str
    secondary_color: str
    accent_color: str
    description: str
    preview_url: Optional[str] = None


class ThemeListResponse(BaseModel):
    """Response with all available themes"""
    themes: List[ThemeInfo]
    total: int


class LayoutMatchRequest(BaseModel):
    """Request for intelligent layout matching"""
    element_count: int
    relationship: str = "parallel"  # parallel, sequential, matrix, temporal, hierarchical, contrast
    context: Optional[dict] = None


class LayoutMatchResponse(BaseModel):
    """Response with matched layout"""
    primary_layout_id: str
    primary_layout_name: str
    primary_layout_description: str
    alternative_layout_ids: List[str]
    matched_category: str


@router.get("/themes", response_model=ThemeListResponse)
async def list_themes():
    """
    List all available themes.

    Returns all theme configurations with their color schemes and styles.
    """
    try:
        from lib.layout.template_manager import get_template_manager

        manager = get_template_manager()
        themes = manager.get_all_themes()

        theme_infos = []
        for theme in themes:
            theme_infos.append(ThemeInfo(
                theme_id=theme.theme_id,
                theme_name=theme.theme_name,
                style=theme.style.value,
                color=theme.color.value,
                primary_color=theme.primary_color,
                secondary_color=theme.secondary_color,
                accent_color=theme.accent_color,
                description=theme.description,
                preview_url=theme.preview_url if hasattr(theme, 'preview_url') else None
            ))

        return ThemeListResponse(
            themes=theme_infos,
            total=len(theme_infos)
        )

    except Exception as e:
        logger.error(f"Failed to list themes: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/themes/{theme_id}")
async def get_theme(theme_id: str):
    """
    Get a specific theme by ID.

    Args:
        theme_id: Theme identifier (e.g., "blue_professional")
    """
    try:
        from lib.layout.template_manager import get_template_manager

        manager = get_template_manager()
        theme = manager.get_theme(theme_id)

        if not theme:
            raise HTTPException(status_code=404, detail=f"Theme not found: {theme_id}")

        return {
            "theme_id": theme.theme_id,
            "theme_name": theme.theme_name,
            "style": theme.style.value,
            "color": theme.color.value,
            "colors": {
                "primary": theme.primary_color,
                "secondary": theme.secondary_color,
                "accent": theme.accent_color,
                "text": theme.text_color,
                "background": theme.background_color
            },
            "font_family": theme.font_family,
            "description": theme.description
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get theme: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/match", response_model=LayoutMatchResponse)
async def match_layout_intelligent(request: LayoutMatchRequest):
    """
    Intelligently match the best layout for content.

    Analyzes element count and content relationship to recommend
    the most appropriate layout.

    Args:
        element_count: Number of content elements
        relationship: Content relationship type
            - parallel: Side-by-side elements
            - sequential: Step-by-step process
            - matrix: 2D grid (SWOT, BCG)
            - temporal: Time-based (timeline, gantt)
            - hierarchical: Pyramid/tree structure
            - contrast: Comparison/contrast

    Returns:
        Primary layout recommendation with alternatives
    """
    try:
        from lib.layout.template_manager import get_template_manager

        manager = get_template_manager()

        # Get layout match
        primary_id, alternatives = manager.match_layout(
            element_count=request.element_count,
            relationship=request.relationship,
            context=request.context
        )

        # Get layout details
        primary_layout = manager.get_layout(primary_id)

        return LayoutMatchResponse(
            primary_layout_id=primary_id,
            primary_layout_name=primary_layout.layout_name if primary_layout else primary_id,
            primary_layout_description=primary_layout.description if primary_layout else "",
            alternative_layout_ids=alternatives,
            matched_category=primary_layout.category if primary_layout else "PARALLEL"
        )

    except Exception as e:
        logger.error(f"Layout matching failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/layouts/extended")
async def get_extended_layouts():
    """
    Get all extended layouts from the template manager.

    Returns layouts organized by category with full metadata.
    """
    try:
        from lib.layout.template_manager import get_template_manager

        manager = get_template_manager()
        layouts = manager.get_all_layouts()

        # Group by category
        layouts_by_category: dict = {}
        for layout in layouts:
            category = layout.category
            if category not in layouts_by_category:
                layouts_by_category[category] = []
            layouts_by_category[category].append({
                "layout_id": layout.layout_id,
                "layout_name": layout.layout_name,
                "description": layout.description,
                "element_count_range": list(layout.element_count_range),
                "keywords": layout.keywords,
                "params": layout.params
            })

        # Category labels
        category_labels = {
            "KEY_INSIGHT": "核心观点",
            "PARALLEL": "并列布局",
            "MATRIX": "矩阵布局",
            "PROCESS": "流程布局",
            "TIMELINE": "时间线",
            "TABLE": "表格/对比",
            "DATA_VIZ": "数据可视化",
            "HIERARCHY": "层级结构",
            "SECTION": "章节分隔",
            "TITLE": "封面/标题"
        }

        result = []
        for category, cat_layouts in layouts_by_category.items():
            result.append({
                "category_id": category,
                "category_label": category_labels.get(category, category),
                "layouts": cat_layouts,
                "count": len(cat_layouts)
            })

        return {
            "categories": result,
            "total_layouts": sum(len(cat["layouts"]) for cat in result)
        }

    except Exception as e:
        logger.error(f"Failed to get extended layouts: {e}")
        raise HTTPException(status_code=500, detail=str(e))
