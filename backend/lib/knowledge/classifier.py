"""
五维分类器

自动将文档分类到五维模型:
- L1: 战略、组织、绩效、薪酬、人才
- L2: 19个分类
- L3: 58个指标

分类策略:
1. 关键词匹配 (快速、低成本)
2. AI分类 (高精度、有成本)

Created: 2026-03-22
"""

import json
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from loguru import logger

from .taxonomy_data import TaxonomyManager


@dataclass
class ClassificationResult:
    """分类结果"""
    dimension_l1: str  # L1维度代码
    dimension_l1_name: str  # L1维度名称
    dimension_l2: str  # L2分类代码
    dimension_l2_name: str  # L2分类名称
    dimension_l3: Optional[str]  # L3指标代码
    dimension_l3_name: Optional[str]  # L3指标名称
    confidence: float  # 置信度 0-1
    method: str  # 分类方法: keyword, ai
    evidence: str  # 分类依据
    all_matches: List[Dict[str, Any]] = None  # 所有匹配结果


class DocumentClassifier:
    """
    文档分类器

    支持两种分类方式:
    1. 关键词匹配: 基于五维分类关键词库
    2. AI分类: 调用LLM进行语义理解
    """

    def __init__(self, taxonomy_manager: TaxonomyManager, ai_client=None):
        """
        初始化分类器

        Args:
            taxonomy_manager: 分类管理器
            ai_client: AI客户端 (可选，用于AI分类)
        """
        self.taxonomy = taxonomy_manager
        self.ai_client = ai_client
        self._keyword_map = None

    def classify(
        self,
        text: str,
        use_ai: bool = False,
        min_confidence: float = 0.3
    ) -> ClassificationResult:
        """
        分类文档

        Args:
            text: 待分类的文本
            use_ai: 是否使用AI分类
            min_confidence: 最低置信度阈值

        Returns:
            ClassificationResult
        """
        # 先尝试关键词匹配
        keyword_result = self._classify_by_keywords(text)

        # 如果关键词匹配置信度足够高，直接返回
        if keyword_result.confidence >= 0.5:
            return keyword_result

        # 如果启用AI且置信度不够，使用AI分类
        if use_ai and self.ai_client:
            ai_result = self._classify_by_ai(text)
            if ai_result and ai_result.confidence > keyword_result.confidence:
                return ai_result

        # 返回关键词结果（即使置信度较低）
        if keyword_result.confidence >= min_confidence:
            return keyword_result

        # 返回默认分类
        return self._get_default_classification()

    def _classify_by_keywords(self, text: str) -> ClassificationResult:
        """基于关键词的分类"""
        matches = self.taxonomy.find_by_keywords(text)

        if not matches:
            return self._get_default_classification()

        # 按分数排序，取最佳匹配
        best_match = matches[0]

        # 获取完整的分类层级
        l1_id, l2_id, l3_id = self._get_classification_hierarchy(best_match)

        # 获取名称
        l1_name = self._get_taxonomy_name(l1_id)
        l2_name = self._get_taxonomy_name(l2_id) if l2_id else None
        l3_name = self._get_taxonomy_name(l3_id) if l3_id else None

        # 计算置信度
        confidence = min(best_match["score"], 1.0)

        return ClassificationResult(
            dimension_l1=l1_id,
            dimension_l1_name=l1_name,
            dimension_l2=l2_id,
            dimension_l2_name=l2_name,
            dimension_l3=l3_id,
            dimension_l3_name=l3_name,
            confidence=confidence,
            method="keyword",
            evidence=f"关键词匹配: {', '.join(best_match['matched_keywords'])}",
            all_matches=matches[:5]  # 保留前5个匹配
        )

    def _classify_by_ai(self, text: str) -> Optional[ClassificationResult]:
        """基于AI的分类"""
        if not self.ai_client:
            return None

        try:
            # 获取分类选项
            taxonomy_tree = self.taxonomy.get_taxonomy_tree()
            options = self._build_classification_options(taxonomy_tree)

            prompt = f"""请分析以下文档内容，将其分类到最合适的五维分类中。

文档内容（摘要）:
{text[:2000]}

可选分类:
{options}

请以JSON格式返回分类结果:
{{
    "l1": "维度代码(strategy/structure/performance/compensation/talent)",
    "l2": "L2分类代码",
    "l3": "L3指标代码",
    "confidence": 0.8,
    "reason": "分类理由"
}}
"""

            response = self.ai_client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=500
            )

            result_text = response.choices[0].message.content
            result = json.loads(result_text)

            # 获取名称
            l1_id = result.get("l1")
            l2_id = result.get("l2")
            l3_id = result.get("l3")

            l1_name = self._get_taxonomy_name(l1_id)
            l2_name = self._get_taxonomy_name(l2_id) if l2_id else None
            l3_name = self._get_taxonomy_name(l3_id) if l3_id else None

            return ClassificationResult(
                dimension_l1=l1_id,
                dimension_l1_name=l1_name,
                dimension_l2=l2_id,
                dimension_l2_name=l2_name,
                dimension_l3=l3_id,
                dimension_l3_name=l3_name,
                confidence=result.get("confidence", 0.5),
                method="ai",
                evidence=result.get("reason", "AI分类")
            )

        except Exception as e:
            logger.error(f"AI classification failed: {e}")
            return None

    def _get_classification_hierarchy(self, match: Dict) -> Tuple[str, str, str]:
        """获取完整的分类层级"""
        level = match["level"]
        item_id = match["id"]
        parent_id = match.get("parent_id")

        if level == 1:
            return item_id, None, None
        elif level == 2:
            return parent_id, item_id, None
        else:  # level == 3
            # 需要获取L2的parent_id
            l2_parent = self._get_parent_id(item_id)
            if l2_parent:
                l1_parent = self._get_parent_id(l2_parent)
                return l1_parent, l2_parent, item_id
            return None, None, item_id

    def _get_parent_id(self, item_id: str) -> Optional[str]:
        """获取父级ID"""
        conn = self.taxonomy.store._get_conn()
        cursor = conn.execute(
            "SELECT parent_id FROM taxonomy_dimensions WHERE id = ?",
            (item_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return row["parent_id"] if row else None

    def _get_taxonomy_name(self, item_id: str) -> Optional[str]:
        """获取分类名称"""
        if not item_id:
            return None
        conn = self.taxonomy.store._get_conn()
        cursor = conn.execute(
            "SELECT name FROM taxonomy_dimensions WHERE id = ?",
            (item_id,)
        )
        row = cursor.fetchone()
        conn.close()
        return row["name"] if row else None

    def _build_classification_options(self, tree: List[Dict]) -> str:
        """构建分类选项文本"""
        lines = []
        for l1 in tree:
            lines.append(f"- {l1['name']} ({l1['code']})")
            for l2 in l1.get("children", []):
                lines.append(f"  - {l2['name']} ({l2['code']})")
                for l3 in l2.get("children", []):
                    lines.append(f"    - {l3['name']} ({l3['code']})")
        return "\n".join(lines)

    def _get_default_classification(self) -> ClassificationResult:
        """获取默认分类（战略-业务现状）"""
        return ClassificationResult(
            dimension_l1="strategy",
            dimension_l1_name="战略",
            dimension_l2="business_status",
            dimension_l2_name="业务现状",
            dimension_l3=None,
            dimension_l3_name=None,
            confidence=0.1,
            method="default",
            evidence="未找到明确匹配，使用默认分类"
        )

    def classify_document(
        self,
        doc_id: str,
        store,
        use_ai: bool = False
    ) -> ClassificationResult:
        """
        分类已存储的文档

        Args:
            doc_id: 文档ID
            store: KnowledgeBaseStore 实例
            use_ai: 是否使用AI分类

        Returns:
            ClassificationResult
        """
        # 获取文档的所有页面
        pages = store.get_pages(doc_id)

        if not pages:
            return self._get_default_classification()

        # 合并所有页面文本
        full_text = "\n\n".join([p["content"] for p in pages[:10]])  # 最多取前10页

        # 分类
        result = self.classify(full_text, use_ai=use_ai)

        # 保存分类结果
        store.save_classification({
            "document_id": doc_id,
            "dimension_l1": result.dimension_l1,
            "dimension_l2": result.dimension_l2,
            "dimension_l3": result.dimension_l3,
            "confidence": result.confidence,
            "classification_method": result.method,
            "evidence": result.evidence
        })

        logger.info(f"Document classified: {doc_id} -> {result.dimension_l1}/{result.dimension_l2} ({result.confidence:.2f})")

        return result

    def batch_classify(
        self,
        doc_ids: List[str],
        store,
        use_ai: bool = False
    ) -> Dict[str, ClassificationResult]:
        """
        批量分类文档

        Args:
            doc_ids: 文档ID列表
            store: KnowledgeBaseStore 实例
            use_ai: 是否使用AI分类

        Returns:
            {doc_id: ClassificationResult} 映射
        """
        results = {}
        for doc_id in doc_ids:
            try:
                result = self.classify_document(doc_id, store, use_ai)
                results[doc_id] = result
            except Exception as e:
                logger.error(f"Failed to classify {doc_id}: {e}")
        return results


def get_classifier(store, ai_client=None) -> DocumentClassifier:
    """
    获取分类器实例

    Args:
        store: KnowledgeBaseStore 实例
        ai_client: AI客户端 (可选)

    Returns:
        DocumentClassifier 实例
    """
    taxonomy = TaxonomyManager(store)
    taxonomy.initialize_taxonomy()
    return DocumentClassifier(taxonomy, ai_client)
