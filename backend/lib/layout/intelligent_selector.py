"""
Intelligent Layout Selector

Combines content analysis with template matching to select the optimal layout.
Provides smart defaults and AI-enhanced layout recommendations.

Created: 2026-03-23
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from loguru import logger

from .content_analyzer import (
    ContentAnalyzer,
    ContentAnalysisResult,
    ContentRelationship,
    TextDensity,
    get_content_analyzer
)
from .template_manager import (
    TemplateManager,
    LayoutConfig,
    get_template_manager
)


@dataclass
class LayoutRecommendation:
    """A layout recommendation with confidence and reasoning"""
    layout_id: str
    layout_name: str
    category: str
    confidence: float
    reason: str
    params: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        return {
            "layout_id": self.layout_id,
            "layout_name": self.layout_name,
            "category": self.category,
            "confidence": self.confidence,
            "reason": self.reason,
            "params": self.params
        }


@dataclass
class LayoutSelectionResult:
    """Complete layout selection result"""
    primary: LayoutRecommendation
    alternatives: List[LayoutRecommendation]
    analysis: ContentAnalysisResult
    theme_suggestion: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "primary": self.primary.to_dict(),
            "alternatives": [a.to_dict() for a in self.alternatives],
            "analysis": self.analysis.to_dict(),
            "theme_suggestion": self.theme_suggestion
        }


class IntelligentLayoutSelector:
    """
    Intelligently selects the best layout based on content analysis.

    Combines multiple signals:
    - Content relationship detection
    - Element count matching
    - Text density optimization
    - Visual type suggestions
    - Keyword matching

    Usage:
        selector = IntelligentLayoutSelector()
        result = selector.select(
            title="项目实施步骤",
            key_message="分四阶段推进",
            bullets=["阶段一", "阶段二", "阶段三", "阶段四"]
        )
        # result.primary.layout_id == "PROCESS_04_H"
    """

    # Category mapping from relationship to layout category
    RELATIONSHIP_CATEGORY_MAP = {
        ContentRelationship.SINGLE: "KEY_INSIGHT",
        ContentRelationship.PARALLEL: "PARALLEL",
        ContentRelationship.SEQUENTIAL: "PROCESS",
        ContentRelationship.MATRIX: "MATRIX",
        ContentRelationship.TEMPORAL: "TIMELINE",
        ContentRelationship.HIERARCHICAL: "HIERARCHY",
        ContentRelationship.CONTRAST: "TABLE",
        ContentRelationship.CAUSAL: "PROCESS",
    }

    # Density-based font size adjustments
    DENSITY_FONT_MAP = {
        TextDensity.MINIMAL: {"title_size": 32, "body_size": 18},
        TextDensity.MODERATE: {"title_size": 28, "body_size": 16},
        TextDensity.DENSE: {"title_size": 24, "body_size": 14},
    }

    def __init__(self):
        """Initialize the selector with analyzer and template manager"""
        self.analyzer = get_content_analyzer()
        self.template_manager = get_template_manager()

    def select(
        self,
        title: str,
        key_message: str,
        bullets: List[str],
        context: Dict[str, Any] = None,
        preferred_category: str = None
    ) -> LayoutSelectionResult:
        """
        Select the best layout for the given content.

        Args:
            title: Slide title
            key_message: Key message / action title
            bullets: List of content elements
            context: Additional context (section, module, etc.)
            preferred_category: Optional preferred layout category

        Returns:
            LayoutSelectionResult with primary and alternative recommendations
        """
        context = context or {}

        # Step 1: Analyze content
        analysis = self.analyzer.analyze(
            title=title,
            key_message=key_message,
            bullets=bullets,
            context=context
        )

        logger.debug(f"Content analysis: {analysis.to_dict()}")

        # Step 2: Get candidate layouts
        candidates = self._get_candidate_layouts(
            analysis=analysis,
            preferred_category=preferred_category
        )

        # Step 3: Score and rank candidates
        scored = self._score_layouts(candidates, analysis, context)

        # Step 4: Select primary and alternatives
        if not scored:
            # Fallback
            primary = LayoutRecommendation(
                layout_id="BULLET_01",
                layout_name="要点-标准列表",
                category="PARALLEL",
                confidence=0.5,
                reason="默认布局：适合大多数内容",
                params={}
            )
            alternatives = []
        else:
            primary = scored[0]
            alternatives = scored[1:4]

        # Step 5: Suggest theme based on context
        theme_suggestion = self._suggest_theme(context, analysis)

        return LayoutSelectionResult(
            primary=primary,
            alternatives=alternatives,
            analysis=analysis,
            theme_suggestion=theme_suggestion
        )

    def _get_candidate_layouts(
        self,
        analysis: ContentAnalysisResult,
        preferred_category: str = None
    ) -> List[LayoutConfig]:
        """Get candidate layouts based on analysis"""
        candidates = []

        # Get target category
        target_category = preferred_category or self.RELATIONSHIP_CATEGORY_MAP.get(
            analysis.relationship, "PARALLEL"
        )

        # Get layouts by category
        category_layouts = self.template_manager.get_layouts_by_category(target_category)

        # Filter by element count
        for layout in category_layouts:
            min_count, max_count = layout.element_count_range
            if min_count <= analysis.element_count <= max_count:
                candidates.append(layout)

        # If no exact match, get layouts from adjacent categories
        if not candidates:
            # Try PARALLEL as fallback
            parallel_layouts = self.template_manager.get_layouts_by_category("PARALLEL")
            for layout in parallel_layouts:
                min_count, max_count = layout.element_count_range
                if min_count <= analysis.element_count <= max_count:
                    candidates.append(layout)

        # If still no match, get all layouts that fit element count
        if not candidates:
            all_layouts = self.template_manager.get_all_layouts()
            for layout in all_layouts:
                min_count, max_count = layout.element_count_range
                if min_count <= analysis.element_count <= max_count:
                    candidates.append(layout)

        return candidates

    def _score_layouts(
        self,
        layouts: List[LayoutConfig],
        analysis: ContentAnalysisResult,
        context: Dict[str, Any]
    ) -> List[LayoutRecommendation]:
        """Score and rank layout candidates"""
        scored = []

        for layout in layouts:
            score = 0.0
            reasons = []

            # === Element count match (0-30 points) ===
            min_count, max_count = layout.element_count_range
            if analysis.element_count == min_count or analysis.element_count == max_count:
                score += 30
                reasons.append("要素数量完美匹配")
            elif min_count <= analysis.element_count <= max_count:
                score += 20
                reasons.append("要素数量匹配")

            # === Category match (0-25 points) ===
            target_category = self.RELATIONSHIP_CATEGORY_MAP.get(analysis.relationship)
            if layout.category == target_category:
                score += 25
                reasons.append(f"关系类型匹配 ({analysis.relationship.value})")
            elif layout.category in ["PARALLEL", "BULLET"]:
                score += 10  # Universal layouts

            # === Keyword matching (0-20 points) ===
            context_text = f"{context.get('section', '')} {context.get('module', '')}"
            keyword_matches = sum(
                1 for kw in layout.keywords
                if kw.lower() in context_text.lower()
            )
            if keyword_matches > 0:
                score += min(keyword_matches * 5, 20)
                reasons.append(f"关键词匹配 ({keyword_matches}个)")

            # === Visual type alignment (0-15 points) ===
            if analysis.suggested_visual_type == "diagram" and layout.category in ["MATRIX", "PROCESS", "HIERARCHY"]:
                score += 15
                reasons.append("适合图示化展示")
            elif analysis.suggested_visual_type == "table" and layout.category == "TABLE":
                score += 15
                reasons.append("适合表格展示")
            elif analysis.suggested_visual_type == "chart" and layout.category == "DATA_VIZ":
                score += 15
                reasons.append("适合图表展示")

            # === Complexity fit (0-10 points) ===
            if analysis.complexity_score > 0.7 and layout.category in ["MATRIX", "TABLE"]:
                score += 10
                reasons.append("适合复杂内容")
            elif analysis.complexity_score < 0.3 and layout.category == "KEY_INSIGHT":
                score += 10
                reasons.append("适合简洁内容")

            # Normalize score to 0-1
            confidence = min(score / 100, 1.0)

            # Get font size adjustments
            font_params = self.DENSITY_FONT_MAP.get(analysis.text_density, {})

            recommendation = LayoutRecommendation(
                layout_id=layout.layout_id,
                layout_name=layout.layout_name,
                category=layout.category,
                confidence=confidence,
                reason="; ".join(reasons) if reasons else "基础匹配",
                params={**layout.params, **font_params}
            )
            scored.append(recommendation)

        # Sort by confidence
        scored.sort(key=lambda x: x.confidence, reverse=True)

        return scored

    def _suggest_theme(
        self,
        context: Dict[str, Any],
        analysis: ContentAnalysisResult
    ) -> str:
        """Suggest a theme based on context and content"""
        # Check for industry hints
        industry = context.get("industry", "").lower()

        # Tech/internet -> vibrant
        if any(kw in industry for kw in ["科技", "互联网", "tech", "software"]):
            return "orange_vibrant"

        # Finance/corporate -> professional
        if any(kw in industry for kw in ["金融", "银行", "finance", "bank"]):
            return "gray_corporate"

        # Healthcare/environment -> natural
        if any(kw in industry for kw in ["医疗", "健康", "环保", "health", "green"]):
            return "green_natural"

        # Creative/design -> elegant
        if any(kw in industry for kw in ["设计", "创意", "design", "creative"]):
            return "purple_elegant"

        # Default to professional blue
        return "blue_professional"

    def quick_select(
        self,
        element_count: int,
        relationship: str = "parallel"
    ) -> Tuple[str, List[str]]:
        """
        Quick layout selection without full analysis.

        Args:
            element_count: Number of elements
            relationship: Content relationship type

        Returns:
            Tuple of (primary_layout_id, alternative_layout_ids)
        """
        return self.template_manager.match_layout(
            element_count=element_count,
            relationship=relationship
        )


# Singleton instance
_selector: Optional[IntelligentLayoutSelector] = None


def get_layout_selector() -> IntelligentLayoutSelector:
    """Get the global layout selector instance"""
    global _selector
    if _selector is None:
        _selector = IntelligentLayoutSelector()
    return _selector
