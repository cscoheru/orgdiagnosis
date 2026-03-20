"""
Test script for LlamaIndex Knowledge Base Module

Tests document loading, indexing, and retrieval functionality.
"""

import os
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from loguru import logger

# Configure logging
logger.remove()
logger.add(sys.stderr, level="DEBUG")


def test_document_processor():
    """Test document processor"""
    from lib.llamaindex.document_processor import ConsultingDocumentProcessor

    print("\n" + "="*50)
    print("Testing ConsultingDocumentProcessor")
    print("="*50)

    processor = ConsultingDocumentProcessor(
        data_dir="./data/historical_reports"
    )

    # Test category inference
    test_text = """
    公司绩效考核体系存在问题：
    1. KPI 指标分解不科学
    2. 考核结果与薪酬挂钩不紧密
    3. 缺乏有效的绩效辅导机制
    """

    category = processor.infer_category_from_content(test_text)
    print(f"Inferred category: {category}")
    assert category == "performance", f"Expected 'performance', got '{category}'"

    keywords = processor.extract_keywords(test_text)
    print(f"Extracted keywords: {keywords}")

    print("✅ ConsultingDocumentProcessor tests passed")


def test_indexer_initialization():
    """Test indexer initialization"""
    from lib.llamaindex.indexer import ConsultingKnowledgeIndexer

    print("\n" + "="*50)
    print("Testing ConsultingKnowledgeIndexer Initialization")
    print("="*50)

    # Check if API key is available
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("⚠️ DASHSCOPE_API_KEY not set, skipping embed model test")
        return

    indexer = ConsultingKnowledgeIndexer(
        persist_dir="./storage/chroma_test",
        embed_model_type="dashscope",
    )

    stats = indexer.get_stats()
    print(f"Indexer stats: {stats}")

    print("✅ ConsultingKnowledgeIndexer initialization passed")


def test_retriever_keywords():
    """Test retriever keyword mappings"""
    from lib.llamaindex.retriever import get_dimension_keywords, get_all_dimensions

    print("\n" + "="*50)
    print("Testing Dimension Keywords")
    print("="*50)

    dimensions = get_all_dimensions()
    print(f"Available dimensions: {list(dimensions.keys())}")

    for dim in ["strategy", "performance", "talent"]:
        info = get_dimension_keywords(dim)
        print(f"\n{dim}:")
        print(f"  Name: {info.get('name')}")
        print(f"  Keywords: {info.get('keywords')[:3]}...")

    print("\n✅ Dimension keywords tests passed")


def test_full_pipeline():
    """Test full pipeline with sample documents"""
    print("\n" + "="*50)
    print("Testing Full Pipeline")
    print("="*50)

    # Check if API key is available
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("⚠️ DASHSCOPE_API_KEY not set, skipping full pipeline test")
        return

    from llama_index.core import Document
    from lib.llamaindex.indexer import ConsultingKnowledgeIndexer
    from lib.llamaindex.retriever import ConsultingKnowledgeRetriever

    # Create sample documents
    sample_docs = [
        Document(
            text="""
            绩效考核体系优化方案

            一、现状分析
            公司目前采用 KPI 考核方式，但存在以下问题：
            1. 指标分解不够科学，部门目标与公司战略脱节
            2. 考核周期不合理，年度考核周期太长
            3. 缺乏有效的绩效辅导和反馈机制

            二、优化建议
            1. 引入 OKR 目标管理方法
            2. 建立季度考核 + 年度综合评估机制
            3. 强化主管绩效辅导能力培训
            """,
            metadata={"category": "performance", "file_name": "performance_sample.md"}
        ),
        Document(
            text="""
            战略规划咨询方法论

            一、战略分析框架
            采用五力模型分析行业竞争态势：
            1. 现有竞争者竞争程度
            2. 潜在进入者威胁
            3. 替代品威胁
            4. 供应商议价能力
            5. 买方议价能力

            二、战略制定步骤
            1. 市场洞察
            2. 战略意图确定
            3. 创新焦点识别
            4. 业务设计
            """,
            metadata={"category": "strategy", "file_name": "strategy_sample.md"}
        ),
    ]

    print(f"Created {len(sample_docs)} sample documents")

    # Build index
    indexer = ConsultingKnowledgeIndexer(
        persist_dir="./storage/chroma_test",
        embed_model_type="dashscope",
    )

    index = indexer.build_index(sample_docs, show_progress=False)
    print("Index built successfully")

    # Create retriever
    retriever = ConsultingKnowledgeRetriever(index, similarity_top_k=3)

    # Test retrieval
    print("\n--- Testing retrieval ---")

    nodes = retriever.retrieve("如何优化绩效考核")
    print(f"Query: '如何优化绩效考核' -> {len(nodes)} results")

    nodes = retriever.retrieve_for_dimension("strategy")
    print(f"Dimension: 'strategy' -> {len(nodes)} results")

    if nodes:
        print("\nSample result:")
        print(retriever.format_retrieved_content(nodes[:1]))

    print("\n✅ Full pipeline test passed")


def main():
    """Run all tests"""
    print("\n" + "="*60)
    print(" LlamaIndex Knowledge Base Module Tests")
    print("="*60)

    try:
        test_document_processor()
        test_indexer_initialization()
        test_retriever_keywords()
        test_full_pipeline()

        print("\n" + "="*60)
        print(" ✅ All tests passed!")
        print("="*60)

    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
