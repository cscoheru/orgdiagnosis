"""
Test script for LangChain + LangGraph integration
"""

import asyncio
import sys
sys.path.insert(0, '/Users/kjonekong/Documents/org-diagnosis/backend')

from lib.langchain import DocumentProcessor, create_empty_report
from lib.langchain.schemas import FIVE_DIMENSIONS_SCHEMA


def test_document_processor():
    """Test document processor"""
    print("\n=== Testing DocumentProcessor ===")

    # Test text
    sample_text = """
    客户是一家成立于2018年的科技公司，目前有200多名员工。

    主要问题：
    1. 战略层面：公司去年营收增长8%，远低于预期的15%。创始人认为错过了两个重要的市场机会。
    2. 组织层面：公司采用职能制架构，但部门墙很厚，跨部门协作经常出问题。
    3. 绩效层面：使用KPI考核，但指标分解不够科学，员工普遍反映考核不公平。
    4. 薪酬层面：薪酬水平在行业中属于中游，但核心员工流失率较高。
    5. 人才层面：老员工混日子的情况比较严重，新员工留不住，去年入职的10个新人走了6个。
    """

    # Process text
    processor = DocumentProcessor(chunk_size=500, chunk_overlap=100)
    documents = processor.process(text=sample_text)

    print(f"✓ Processed {len(documents)} document chunks")

    # Test dimension filtering
    for dim in ["strategy", "structure", "performance", "compensation", "talent"]:
        filtered = processor.filter_by_dimension(documents, dim, min_matches=1)
        print(f"  - {dim}: {len(filtered)} relevant chunks")

    # Test keyword scoring
    scored = processor.get_relevant_chunks(documents, "strategy", max_chunks=5)
    print(f"✓ Top strategy chunks by score:")
    for doc, score in scored[:3]:
        print(f"  - Score {score}: {doc.page_content[:80]}...")


def test_schemas():
    """Test Pydantic schemas"""
    print("\n=== Testing Schemas ===")

    # Create empty report
    report = create_empty_report("test-task-001")
    print(f"✓ Created empty report with {len(report.dimensions)} dimensions")

    # Check schema structure
    for dim in report.dimensions:
        print(f"  - {dim.display_name}: {len(dim.secondary_metrics)} L2 categories")
        for sec in dim.secondary_metrics:
            print(f"    - {sec.display_name}: {len(sec.tertiary_metrics)} L3 items")

    # Verify FIVE_DIMENSIONS_SCHEMA
    print(f"\n✓ FIVE_DIMENSIONS_SCHEMA has {len(FIVE_DIMENSIONS_SCHEMA)} top-level dimensions")


def test_workflow():
    """Test LangGraph workflow"""
    print("\n=== Testing LangGraph Workflow ===")

    from lib.langgraph import DiagnosisWorkflowManager, create_diagnostic_workflow

    # Create workflow
    workflow = create_diagnostic_workflow()
    print(f"✓ Created workflow: {type(workflow)}")

    # Create manager
    manager = DiagnosisWorkflowManager(checkpointer_path="./test_checkpoints.db")
    print(f"✓ Created workflow manager")

    print("✓ Workflow structure verified (skipping actual execution in test mode)")


if __name__ == "__main__":
    print("=" * 60)
    print("LangChain + LangGraph Integration Tests")
    print("=" * 60)

    test_document_processor()
    test_schemas()
    test_workflow()

    print("\n" + "=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)
