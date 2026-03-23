"""
Content Analyzer for Intelligent Layout Selection

Analyzes slide content to determine:
- Element count and complexity
- Logical relationships (parallel, sequential, matrix, etc.)
- Text volume and density
- Visual element requirements

Created: 2026-03-23
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
from loguru import logger
import re


class ContentRelationship(str, Enum):
    """Content relationship types"""
    PARALLEL = "parallel"           # 并列关系 - 独立要点
    SEQUENTIAL = "sequential"       # 顺序关系 - 步骤/流程
    MATRIX = "matrix"               # 矩阵关系 - 四象限/对比
    TEMPORAL = "temporal"           # 时间关系 - 时间线/里程碑
    HIERARCHICAL = "hierarchical"   # 层级关系 - 金字塔/树形
    CONTRAST = "contrast"           # 对比关系 - 优劣/方案对比
    CAUSAL = "causal"               # 因果关系 - 问题→原因→方案
    SINGLE = "single"               # 单一强调 - 核心观点


class TextDensity(str, Enum):
    """Text density levels"""
    MINIMAL = "minimal"     # 少量文字 (< 50 字/要素)
    MODERATE = "moderate"   # 适中文字 (50-150 字/要素)
    DENSE = "dense"         # 大量文字 (> 150 字/要素)


@dataclass
class ContentAnalysisResult:
    """Result of content analysis"""
    element_count: int
    relationship: ContentRelationship
    text_density: TextDensity
    total_characters: int
    avg_characters_per_element: float

    # Detailed metrics
    has_numbers: bool
    has_timeline_keywords: bool
    has_comparison_keywords: bool
    has_sequence_keywords: bool
    has_matrix_keywords: bool

    # Visual hints
    suggested_visual_type: str  # text, chart, table, diagram
    complexity_score: float     # 0-1, higher = more complex

    def to_dict(self) -> Dict[str, Any]:
        return {
            "element_count": self.element_count,
            "relationship": self.relationship.value,
            "text_density": self.text_density.value,
            "total_characters": self.total_characters,
            "avg_characters_per_element": self.avg_characters_per_element,
            "has_numbers": self.has_numbers,
            "has_timeline_keywords": self.has_timeline_keywords,
            "has_comparison_keywords": self.has_comparison_keywords,
            "has_sequence_keywords": self.has_sequence_keywords,
            "has_matrix_keywords": self.has_matrix_keywords,
            "suggested_visual_type": self.suggested_visual_type,
            "complexity_score": self.complexity_score
        }


class ContentAnalyzer:
    """
    Analyzes slide content for intelligent layout selection.

    Usage:
        analyzer = ContentAnalyzer()
        result = analyzer.analyze(
            title="项目实施步骤",
            key_message="分四阶段推进，确保稳步落地",
            bullets=["阶段一：诊断", "阶段二：设计", "阶段三：试点", "阶段四：推广"]
        )
        # result.relationship == ContentRelationship.SEQUENTIAL
        # result.element_count == 4
    """

    # Keyword patterns for relationship detection
    SEQUENCE_KEYWORDS = [
        "首先", "然后", "接着", "最后", "步骤", "阶段", "流程", "顺序",
        "第一", "第二", "第三", "第四", "第五", "第六",
        "Step", "Phase", "阶段一", "阶段二", "阶段三", "阶段四",
        "依次", "逐步", "分步", "环节", "过程",
        "first", "second", "third", "then", "next", "finally",
        "step 1", "step 2", "phase 1", "phase 2"
    ]

    TIMELINE_KEYWORDS = [
        "时间", "进度", "里程碑", "周期", "日程", "计划",
        "月", "季度", "年", "周", "天",
        "开始", "结束", "截止", "期限",
        "甘特", "时间线", "时间表",
        "timeline", "schedule", "milestone", "deadline",
        "gantt", "week", "month", "quarter", "year"
    ]

    COMPARISON_KEYWORDS = [
        "对比", "比较", "优劣", "差异", "区别", "不同",
        "方案A", "方案B", "选项", "选择",
        "vs", "VS", "versus",
        "优势", "劣势", "利弊", "取舍",
        "compare", "comparison", "versus", "vs",
        "option", "alternative", "pros", "cons"
    ]

    MATRIX_KEYWORDS = [
        "矩阵", "四象限", "九宫格", "SWOT", "BCG",
        "维度", "象限", "方格", "交叉",
        "2x2", "3x3", "4x4",
        "matrix", "quadrant", "grid"
    ]

    HIERARCHY_KEYWORDS = [
        "层级", "层次", "金字塔", "树形", "分支",
        "上级", "下级", "顶层", "底层",
        "一级", "二级", "三级",
        "hierarchy", "pyramid", "level", "tier", "layer"
    ]

    CAUSAL_KEYWORDS = [
        "因为", "所以", "导致", "造成", "引起",
        "原因", "结果", "影响", "根因",
        "问题", "方案", "对策", "措施",
        "because", "therefore", "cause", "effect", "result"
    ]

    NUMBER_PATTERNS = [
        r'\d+%', r'\d+万', r'\d+亿', r'\d+.\d+',
        r'¥\d+', r'\$\d+', r'\d+人', r'\d+个', r'\d+项',
    ]

    def __init__(self):
        """Initialize the content analyzer"""
        self._number_regex = [re.compile(p) for p in self.NUMBER_PATTERNS]

    def analyze(
        self,
        title: str,
        key_message: str,
        bullets: List[str],
        context: Dict[str, Any] = None
    ) -> ContentAnalysisResult:
        """
        Analyze slide content and return analysis result.
        """
        context = context or {}
        all_text = f"{title} {key_message} {' '.join(bullets)}"
        element_count = len(bullets) if bullets else 1

        total_chars = len(all_text.replace(" ", ""))
        avg_chars = total_chars / element_count if element_count > 0 else 0
        text_density = self._calculate_text_density(avg_chars)

        relationship = self._detect_relationship(
            title=title,
            key_message=key_message,
            bullets=bullets,
            element_count=element_count
        )

        has_numbers = self._has_numbers(all_text)
        has_timeline = self._has_keywords(all_text, self.TIMELINE_KEYWORDS)
        has_comparison = self._has_keywords(all_text, self.COMPARISON_KEYWORDS)
        has_sequence = self._has_keywords(all_text, self.SEQUENCE_KEYWORDS)
        has_matrix = self._has_keywords(all_text, self.MATRIX_KEYWORDS)

        visual_type = self._suggest_visual_type(
            relationship=relationship,
            has_numbers=has_numbers,
            element_count=element_count,
            bullets=bullets
        )

        complexity = self._calculate_complexity(
            element_count=element_count,
            text_density=text_density,
            relationship=relationship,
            has_numbers=has_numbers
        )

        return ContentAnalysisResult(
            element_count=element_count,
            relationship=relationship,
            text_density=text_density,
            total_characters=total_chars,
            avg_characters_per_element=avg_chars,
            has_numbers=has_numbers,
            has_timeline_keywords=has_timeline,
            has_comparison_keywords=has_comparison,
            has_sequence_keywords=has_sequence,
            has_matrix_keywords=has_matrix,
            suggested_visual_type=visual_type,
            complexity_score=complexity
        )

    def _calculate_text_density(self, avg_chars: float) -> TextDensity:
        if avg_chars < 50:
            return TextDensity.MINIMAL
        elif avg_chars < 150:
            return TextDensity.MODERATE
        else:
            return TextDensity.DENSE

    def _detect_relationship(
        self, title: str, key_message: str, bullets: List[str], element_count: int
    ) -> ContentRelationship:
        all_text = f"{title} {key_message} {' '.join(bullets)}".lower()

        # Keyword matching priority
        if self._has_keywords(all_text, self.MATRIX_KEYWORDS):
            if element_count == 4 or element_count == 9:
                return ContentRelationship.MATRIX

        if self._has_keywords(all_text, self.TIMELINE_KEYWORDS):
            return ContentRelationship.TEMPORAL

        if self._has_keywords(all_text, self.COMPARISON_KEYWORDS):
            return ContentRelationship.CONTRAST

        if self._has_keywords(all_text, self.SEQUENCE_KEYWORDS):
            return ContentRelationship.SEQUENTIAL

        if self._has_keywords(all_text, self.HIERARCHY_KEYWORDS):
            return ContentRelationship.HIERARCHICAL

        if self._has_keywords(all_text, self.CAUSAL_KEYWORDS):
            return ContentRelationship.CAUSAL

        # Structural analysis
        if element_count == 1:
            return ContentRelationship.SINGLE
        if element_count == 2:
            return ContentRelationship.CONTRAST
        if element_count == 4:
            if self._suggests_2x2_structure(bullets):
                return ContentRelationship.MATRIX
            return ContentRelationship.PARALLEL
        if element_count == 9:
            return ContentRelationship.MATRIX
        if 3 <= element_count <= 6:
            if self._has_sequential_numbering(bullets):
                return ContentRelationship.SEQUENTIAL

        return ContentRelationship.PARALLEL

    def _has_keywords(self, text: str, keywords: List[str]) -> bool:
        text_lower = text.lower()
        return any(kw.lower() in text_lower for kw in keywords)

    def _has_numbers(self, text: str) -> bool:
        return any(pattern.search(text) for pattern in self._number_regex)

    def _suggests_2x2_structure(self, bullets: List[str]) -> bool:
        if len(bullets) != 4:
            return False
        bullet_text = " ".join(bullets).lower()
        patterns = [("左上", "右上", "左下", "右下"), ("内部", "外部", "优势", "劣势")]
        return any(sum(1 for p in pattern if p in bullet_text) >= 2 for pattern in patterns)

    def _has_sequential_numbering(self, bullets: List[str]) -> bool:
        if not bullets:
            return False
        arabic = re.compile(r'^[\d①②③④⑤⑥⑦⑧⑨⑩]')
        chinese = re.compile(r'^[一二三四五六七八九十]')
        numbered = sum(1 for b in bullets if arabic.match(b.strip()) or chinese.match(b.strip()))
        return numbered >= len(bullets) / 2

    def _suggest_visual_type(
        self, relationship: ContentRelationship, has_numbers: bool, element_count: int, bullets: List[str]
    ) -> str:
        if relationship == ContentRelationship.TEMPORAL:
            return "timeline"
        if relationship == ContentRelationship.MATRIX:
            return "diagram"
        if relationship == ContentRelationship.CONTRAST and has_numbers:
            return "table"
        if relationship == ContentRelationship.SEQUENTIAL:
            return "diagram"
        if relationship == ContentRelationship.HIERARCHICAL:
            return "diagram"
        if has_numbers and element_count >= 3:
            number_count = sum(1 for b in bullets if self._has_numbers(b))
            if number_count >= element_count * 0.5:
                return "chart"
        return "text"

    def _calculate_complexity(
        self, element_count: int, text_density: TextDensity, relationship: ContentRelationship, has_numbers: bool
    ) -> float:
        score = 0.0
        if element_count <= 2:
            score += 0.1
        elif element_count <= 4:
            score += 0.2
        elif element_count <= 6:
            score += 0.25
        else:
            score += 0.3

        density_scores = {TextDensity.MINIMAL: 0.1, TextDensity.MODERATE: 0.2, TextDensity.DENSE: 0.3}
        score += density_scores.get(text_density, 0.2)

        rel_scores = {
            ContentRelationship.SINGLE: 0.05, ContentRelationship.PARALLEL: 0.1,
            ContentRelationship.CONTRAST: 0.15, ContentRelationship.SEQUENTIAL: 0.15,
            ContentRelationship.TEMPORAL: 0.18, ContentRelationship.HIERARCHICAL: 0.18,
            ContentRelationship.CAUSAL: 0.15, ContentRelationship.MATRIX: 0.2
        }
        score += rel_scores.get(relationship, 0.1)

        if has_numbers:
            score += 0.15

        return min(score, 1.0)


_content_analyzer: Optional[ContentAnalyzer] = None


def get_content_analyzer() -> ContentAnalyzer:
    """Get the global content analyzer instance"""
    global _content_analyzer
    if _content_analyzer is None:
        _content_analyzer = ContentAnalyzer()
    return _content_analyzer
