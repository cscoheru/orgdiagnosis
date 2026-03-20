"""
Consulting Knowledge Retriever

Provides semantic search and retrieval capabilities for consulting knowledge base.
Supports filtering by category, dimension, and metadata.
"""

from typing import List, Dict, Any, Optional
from loguru import logger

from llama_index.core import VectorStoreIndex
from llama_index.core.schema import NodeWithScore, QueryBundle
from llama_index.core.retrievers import VectorIndexRetriever
from llama_index.core.postprocessor import MetadataReplacementPostProcessor


# MDS 五维维度关键词映射
MDS_DIMENSION_KEYWORDS = {
    "strategy": {
        "name": "战略",
        "keywords": ["战略", "战略规划", "市场洞察", "业务设计", "竞争", "愿景", "使命"],
        "subcategories": ["业务现状", "战略规划", "战略执行", "战略评估"]
    },
    "structure": {
        "name": "组织",
        "keywords": ["组织", "组织架构", "权责", "流程", "协同", "部门", "矩阵"],
        "subcategories": ["组织架构", "权责体系", "协同机制"]
    },
    "performance": {
        "name": "绩效",
        "keywords": ["绩效", "考核", "KPI", "OKR", "目标", "指标", "评价"],
        "subcategories": ["绩效体系设计", "过程管理", "考核反馈", "结果应用"]
    },
    "compensation": {
        "name": "薪酬",
        "keywords": ["薪酬", "激励", "工资", "奖金", "股权", "福利", "固浮比"],
        "subcategories": ["薪酬策略", "薪酬结构", "总额管控"]
    },
    "talent": {
        "name": "人才",
        "keywords": ["人才", "招聘", "培养", "发展", "保留", "离职", "能力"],
        "subcategories": ["人才规划", "招聘配置", "培养发展", "保留激励"]
    },
}


class ConsultingKnowledgeRetriever:
    """
    咨询知识检索器

    支持语义检索、维度检索、元数据过滤
    """

    def __init__(
        self,
        index: VectorStoreIndex,
        similarity_top_k: int = 5,
    ):
        """
        初始化检索器

        Args:
            index: VectorStoreIndex 实例
            similarity_top_k: 返回的最相似文档数量
        """
        self.index = index
        self.similarity_top_k = similarity_top_k

        # 创建基础检索器
        self.retriever = VectorIndexRetriever(
            index=index,
            similarity_top_k=similarity_top_k,
        )

        logger.info(f"ConsultingKnowledgeRetriever initialized with top_k={similarity_top_k}")

    def retrieve(
        self,
        query: str,
        top_k: Optional[int] = None,
    ) -> List[NodeWithScore]:
        """
        语义检索

        Args:
            query: 查询文本
            top_k: 返回数量 (可选，覆盖默认值)

        Returns:
            NodeWithScore 列表
        """
        k = top_k or self.similarity_top_k

        # 创建临时检索器 (如果 top_k 不同)
        if k != self.similarity_top_k:
            retriever = VectorIndexRetriever(
                index=self.index,
                similarity_top_k=k,
            )
            nodes = retriever.retrieve(query)
        else:
            nodes = self.retriever.retrieve(query)

        logger.info(f"Retrieved {len(nodes)} nodes for query: {query[:50]}...")
        return nodes

    def retrieve_with_filter(
        self,
        query: str,
        filters: Optional[Dict[str, Any]] = None,
        top_k: Optional[int] = None,
    ) -> List[NodeWithScore]:
        """
        带过滤条件的检索

        Args:
            query: 查询文本
            filters: 过滤条件 (如 {"category": "hr"})
            top_k: 返回数量

        Returns:
            NodeWithScore 列表
        """
        k = top_k or self.similarity_top_k

        # 使用 ChromaDB 的元数据过滤
        # 注意: 需要在索引构建时添加元数据
        retriever = VectorIndexRetriever(
            index=self.index,
            similarity_top_k=k,
        )

        nodes = retriever.retrieve(query)

        # 如果有过滤条件，手动过滤结果
        if filters:
            filtered_nodes = []
            for node in nodes:
                match = True
                for key, value in filters.items():
                    if node.node.metadata.get(key) != value:
                        match = False
                        break
                if match:
                    filtered_nodes.append(node)
            nodes = filtered_nodes

        logger.info(f"Retrieved {len(nodes)} nodes with filters: {filters}")
        return nodes

    def retrieve_for_dimension(
        self,
        dimension: str,
        context: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> List[NodeWithScore]:
        """
        根据 MDS 五维维度检索相关素材

        Args:
            dimension: 维度名称 (strategy/structure/performance/compensation/talent)
            context: 额外的上下文信息
            top_k: 返回数量

        Returns:
            NodeWithScore 列表
        """
        if dimension not in MDS_DIMENSION_KEYWORDS:
            logger.warning(f"Unknown dimension: {dimension}")
            return []

        dim_info = MDS_DIMENSION_KEYWORDS[dimension]
        keywords = dim_info["keywords"]

        # 构建查询
        query_parts = [f"关于{dim_info['name']}维度的咨询建议"]
        query_parts.extend(keywords[:3])  # 添加前3个关键词

        if context:
            query_parts.append(context)

        query = " ".join(query_parts)

        # 执行检索
        nodes = self.retrieve(query, top_k=top_k)

        logger.info(f"Retrieved {len(nodes)} nodes for dimension: {dimension}")
        return nodes

    def retrieve_for_report_section(
        self,
        section: str,
        client_context: Optional[str] = None,
        top_k: Optional[int] = None,
    ) -> List[NodeWithScore]:
        """
        根据报告章节检索相关素材

        Args:
            section: 章节名称 (需求背景/方法论/实施步骤/项目计划)
            client_context: 客户上下文
            top_k: 返回数量

        Returns:
            NodeWithScore 列表
        """
        section_keywords = {
            "需求背景": ["背景", "现状", "趋势", "挑战"],
            "关键需求": ["需求", "痛点", "问题", "诉求"],
            "客户目标": ["目标", "预期", "成果", "标准"],
            "方法论": ["方法论", "框架", "模型", "MDS"],
            "实施步骤": ["实施", "阶段", "步骤", "计划"],
            "项目计划": ["计划", "时间", "里程碑", "甘特图"],
            "团队配置": ["团队", "人员", "角色", "分工"],
            "报价": ["报价", "费用", "预算", "成本"],
        }

        keywords = section_keywords.get(section, [])
        query = f"{section} {' '.join(keywords)}"
        if client_context:
            query += f" {client_context}"

        return self.retrieve(query, top_k=top_k)

    def retrieve_similar_cases(
        self,
        pain_points: List[str],
        industry: Optional[str] = None,
        top_k: int = 3,
    ) -> Dict[str, List[NodeWithScore]]:
        """
        检索类似的咨询案例

        Args:
            pain_points: 痛点列表
            industry: 行业类型
            top_k: 每个痛点返回的案例数量

        Returns:
            {痛点: [案例节点]} 字典
        """
        results = {}

        for pain_point in pain_points:
            query = f"类似问题案例: {pain_point}"
            if industry:
                query += f" 行业: {industry}"

            nodes = self.retrieve(query, top_k=top_k)
            results[pain_point] = nodes

        return results

    def format_retrieved_content(
        self,
        nodes: List[NodeWithScore],
        include_metadata: bool = True,
        include_score: bool = True,
    ) -> str:
        """
        格式化检索结果为可读文本

        Args:
            nodes: 检索结果
            include_metadata: 是否包含元数据
            include_score: 是否包含相似度分数

        Returns:
            格式化的文本
        """
        if not nodes:
            return "未找到相关内容"

        parts = []
        for i, node in enumerate(nodes, 1):
            part = f"【素材 {i}】\n"
            part += node.node.get_content(metadata_mode="all")

            if include_score:
                part += f"\n(相关度: {node.score:.2f})"

            if include_metadata:
                metadata = node.node.metadata
                if "file_name" in metadata:
                    part += f"\n(来源: {metadata['file_name']})"
                if "category" in metadata:
                    part += f"\n(类别: {metadata['category']})"

            parts.append(part)

        return "\n\n".join(parts)


def get_dimension_keywords(dimension: str) -> Dict[str, Any]:
    """
    获取指定维度的关键词信息

    Args:
        dimension: 维度名称

    Returns:
        维度信息字典
    """
    return MDS_DIMENSION_KEYWORDS.get(dimension, {})


def get_all_dimensions() -> Dict[str, Dict[str, Any]]:
    """
    获取所有 MDS 维度信息

    Returns:
        所有维度的字典
    """
    return MDS_DIMENSION_KEYWORDS
