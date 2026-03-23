"""
Semantic Router for Layout Auto-Selection

Routes content to appropriate layout based on semantic analysis.
This is the core component for intelligent layout selection.

Created: 2026-03-21
"""

from typing import List, Tuple, Dict, Any, Optional
from loguru import logger

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from schemas.layout import (
    VisualModelCategory,
    SlideElement,
    DEFAULT_LAYOUT_MANIFESTS,
)


class SemanticRouter:
    """
    Routes content to appropriate layout based on semantic analysis.

    Usage:
        router = SemanticRouter()
        primary_layout, candidates = router.select_layout(
            elements=slide_elements,
            reasoning="首先进行诊断，然后设计方案，最后实施落地"
        )
    """

    def __init__(self, layout_manifests: List[Dict[str, Any]] = None):
        """
        Initialize the semantic router.

        Args:
            layout_manifests: Custom layout manifests (uses defaults if None)
        """
        self.layout_manifests = layout_manifests or DEFAULT_LAYOUT_MANIFESTS
        logger.info(f"SemanticRouter initialized with {len(self.layout_manifests)} layouts")

    def select_layout(
        self,
        elements: List[SlideElement],
        reasoning: str = "",
        context: Dict[str, Any] = None
    ) -> Tuple[str, List[str]]:
        """
        Select the most appropriate layout for the given content.

        Args:
            elements: List of slide elements
            reasoning: Text describing the content relationship/logic
            context: Additional context (section, module, etc.)

        Returns:
            Tuple[str, List[str]]: (primary_layout_id, candidate_layout_ids)
        """
        n = len(elements)

        # Step 1: Detect content relationship
        relationship = self._detect_relationship(elements, reasoning)
        logger.debug(f"Detected relationship: {relationship} for {n} elements")

        # Step 2: Query matching layouts
        candidates = self._query_manifests(
            element_count=n,
            relationship=relationship,
            context=context or {}
        )

        # Step 3: Rank by semantic similarity
        ranked = self._rank_by_similarity(candidates, reasoning, elements)

        if not ranked:
            # Fallback to bullet_points
            return "BULLET_01", ["TWO_COL_01", "KEY_INSIGHT_01"]

        primary = ranked[0]["layout_id"]
        alternatives = [r["layout_id"] for r in ranked[1:4]]

        logger.info(f"Selected layout: {primary}, alternatives: {alternatives}")
        return primary, alternatives

    def _detect_relationship(
        self,
        elements: List[SlideElement],
        reasoning: str
    ) -> str:
        """
        Analyze content relationship.

        Returns:
            str: 'parallel', 'sequential', 'contrast', 'temporal', 'hierarchical'
        """
        # Sequential keywords
        sequential_keywords = ['首先', '然后', '步骤', '阶段', '流程', '依次', 'first', 'then', 'step', 'phase']
        # Contrast keywords
        contrast_keywords = ['对比', 'vs', '优势', '劣势', '比较', '不同', 'contrast', 'compare', 'vs']
        # Temporal keywords
        temporal_keywords = ['时间', '年', '月', '里程碑', '进度', '周期', 'timeline', 'schedule', 'milestone']
        # Hierarchical keywords
        hierarchical_keywords = ['层级', '分类', '分组', '维度', '方面', 'hierarchy', 'category', 'dimension']
        # Matrix keywords
        matrix_keywords = ['矩阵', '四象限', 'SWOT', 'BCG', 'matrix', 'quadrant']

        reasoning_lower = reasoning.lower()

        # Check for matrix pattern (exactly 4 elements)
        if len(elements) == 4 and any(kw in reasoning_lower for kw in matrix_keywords):
            return 'matrix'

        # Check for sequential pattern
        if any(kw in reasoning_lower for kw in sequential_keywords):
            return 'sequential'

        # Check for contrast pattern
        if any(kw in reasoning_lower for kw in contrast_keywords):
            return 'contrast'

        # Check for temporal pattern
        if any(kw in reasoning_lower for kw in temporal_keywords):
            return 'temporal'

        # Check for hierarchical pattern
        if any(kw in reasoning_lower for kw in hierarchical_keywords):
            return 'hierarchical'

        # Default: parallel (independent elements)
        return 'parallel'

    def _query_manifests(
        self,
        element_count: int,
        relationship: str,
        context: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """
        Query layout manifests for matching layouts.

        Args:
            element_count: Number of elements
            relationship: Detected relationship type
            context: Additional context

        Returns:
            List of matching layout manifests
        """
        candidates = []

        # Map relationship to category
        relationship_category_map = {
            'matrix': VisualModelCategory.MATRIX,
            'sequential': VisualModelCategory.PROCESS,
            'contrast': VisualModelCategory.PARALLEL,
            'temporal': VisualModelCategory.TIMELINE,
            'hierarchical': VisualModelCategory.PARALLEL,
            'parallel': VisualModelCategory.KEY_INSIGHT,
        }

        preferred_category = relationship_category_map.get(relationship)

        for manifest in self.layout_manifests:
            # Check element count range
            min_count, max_count = manifest.get("element_count_range", (1, 6))
            if not (min_count <= element_count <= max_count):
                continue

            # Calculate match score
            score = 0

            # Category match bonus
            manifest_category = manifest.get("category")
            if manifest_category == preferred_category:
                score += 50

            # Keyword matching
            keywords = manifest.get("keywords", [])
            context_text = context.get("section", "") + " " + context.get("module", "")
            for keyword in keywords:
                if keyword.lower() in context_text.lower():
                    score += 10

            candidates.append({
                **manifest,
                "match_score": score
            })

        # Sort by match score
        candidates.sort(key=lambda x: x["match_score"], reverse=True)

        return candidates

    def _rank_by_similarity(
        self,
        candidates: List[Dict[str, Any]],
        reasoning: str,
        elements: List[SlideElement]
    ) -> List[Dict[str, Any]]:
        """
        Rank candidates by semantic similarity.

        Args:
            candidates: List of candidate layouts
            reasoning: Content reasoning
            elements: Slide elements

        Returns:
            Ranked list of candidates
        """
        if not candidates:
            return []

        # For now, use the match_score from query_manifests
        # In a more advanced version, we could use embeddings here

        # Boost scores based on element content
        for candidate in candidates:
            keywords = candidate.get("keywords", [])

            # Check element titles for keyword matches
            for element in elements:
                element_text = (element.element_title + " " + element.element_content).lower()
                for keyword in keywords:
                    if keyword.lower() in element_text:
                        candidate["match_score"] += 5

        # Re-sort by updated score
        candidates.sort(key=lambda x: x["match_score"], reverse=True)

        return candidates

    def get_layout_by_id(self, layout_id: str) -> Optional[Dict[str, Any]]:
        """Get layout manifest by ID"""
        for manifest in self.layout_manifests:
            if manifest.get("layout_id") == layout_id:
                return manifest
        return None

    def get_layouts_by_category(self, category: VisualModelCategory) -> List[Dict[str, Any]]:
        """Get all layouts for a specific category"""
        return [
            m for m in self.layout_manifests
            if m.get("category") == category
        ]


# Global router instance
_semantic_router: Optional[SemanticRouter] = None


def get_semantic_router() -> SemanticRouter:
    """Get the global semantic router instance"""
    global _semantic_router
    if _semantic_router is None:
        _semantic_router = SemanticRouter()
    return _semantic_router
