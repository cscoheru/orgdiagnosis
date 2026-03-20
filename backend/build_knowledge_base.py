#!/usr/bin/env python3
"""
Build Knowledge Base from Historical Consulting Reports

This script processes all documents in data/historical_reports/
and builds a persistent vector index using LlamaIndex + DashScope.
"""

import os
import sys
from pathlib import Path
from loguru import logger

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from lib.llamaindex import (
    ConsultingDocumentProcessor,
    ConsultingKnowledgeIndexer,
    ConsultingKnowledgeRetriever,
)


def main():
    """Build knowledge base from historical reports"""

    # Configure logging
    logger.remove()
    logger.add(sys.stderr, level="INFO", format="{time:HH:mm:ss} | {level} | {message}")

    print("="*60)
    print(" 咨询知识库构建工具")
    print("="*60)

    # Check API key
    api_key = os.getenv("DASHSCOPE_API_KEY")
    if not api_key:
        print("❌ 错误: DASHSCOPE_API_KEY 环境变量未设置")
        print("请运行: export DASHSCOPE_API_KEY=your-api-key")
        sys.exit(1)

    data_dir = Path("./data/historical_reports")
    persist_dir = "./storage/chroma"

    # Step 1: Load documents
    print("\n📂 Step 1: 加载历史报告...")
    processor = ConsultingDocumentProcessor(data_dir=str(data_dir))

    # 按类别加载
    all_docs = []
    categories = ["strategy", "hr", "performance", "compensation", "talent", "finance", "operations"]

    for category in categories:
        cat_dir = data_dir / category
        if cat_dir.exists():
            docs = processor.load_documents(category=category)
            if docs:
                print(f"   {category}: {len(docs)} 个文档片段")
                all_docs.extend(docs)

    if not all_docs:
        print("❌ 错误: 没有找到任何文档")
        sys.exit(1)

    print(f"\n✅ 共加载 {len(all_docs)} 个文档片段")

    # Step 2: Build index
    print(f"\n🔨 Step 2: 构建向量索引...")
    print(f"   Embedding 模型: DashScope text-embedding-v3")
    print(f"   持久化目录: {persist_dir}")

    indexer = ConsultingKnowledgeIndexer(
        persist_dir=persist_dir,
        embed_model_type="dashscope",
        chunk_size=512,
        chunk_overlap=50,
    )

    index = indexer.build_index(all_docs, show_progress=True)

    if index is None:
        print("❌ 错误: 索引构建失败")
        sys.exit(1)

    print(f"\n✅ 索引构建完成")

    # Step 3: Test retrieval
    print(f"\n🔍 Step 3: 测试检索功能...")

    retriever = ConsultingKnowledgeRetriever(index, similarity_top_k=3)

    # Test queries
    test_queries = [
        ("绩效考核体系优化", "performance"),
        ("战略规划方法论", "strategy"),
        ("人才盘点与培养", "talent"),
        ("薪酬激励设计", "compensation"),
    ]

    for query, expected_dim in test_queries:
        nodes = retriever.retrieve(query)
        print(f"\n   查询: '{query}'")
        print(f"   返回: {len(nodes)} 条结果")
        if nodes:
            top_node = nodes[0]
            source = top_node.node.metadata.get("file_name", "unknown")
            score = top_node.score
            print(f"   最佳匹配: {source} (相关度: {score:.2f})")

    # Step 4: Show stats
    stats = indexer.get_stats()
    print(f"\n📊 知识库统计:")
    print(f"   状态: {stats['status']}")
    print(f"   文档数: {stats['document_count']}")
    print(f"   集合名: {stats['collection_name']}")

    print("\n" + "="*60)
    print(" ✅ 知识库构建完成!")
    print("="*60)
    print(f"\n知识库已保存到: {persist_dir}")
    print("可以使用 ConsultingKnowledgeRetriever 进行检索")


if __name__ == "__main__":
    main()
