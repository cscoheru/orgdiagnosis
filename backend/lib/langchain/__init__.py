"""
LangChain Integration for Five-Dimensional Diagnosis

This module provides document processing and vector store management
for the consultation diagnostic system.

Components:
- DocumentProcessor: Load, clean, and chunk documents
- VectorStoreManager: ChromaDB integration for semantic retrieval
- Schemas: Pydantic models for structured output
"""

from .schemas import (
    TertiaryDimension,
    SecondaryDimension,
    PrimaryDimension,
    ConsultationDiagnosticReport,
    ConfidenceLevel,
    FIVE_DIMENSIONS_SCHEMA,
    create_empty_report,
)

from .processor import (
    DocumentProcessor,
    process_text,
)

from .vectorstore import (
    VectorStoreManager,
    DimensionRetriever,
    create_vectorstore_from_documents,
)

__all__ = [
    # Schemas
    "TertiaryDimension",
    "SecondaryDimension",
    "PrimaryDimension",
    "ConsultationDiagnosticReport",
    "ConfidenceLevel",
    "FIVE_DIMENSIONS_SCHEMA",
    "create_empty_report",

    # Processor
    "DocumentProcessor",
    "process_text",

    # VectorStore
    "VectorStoreManager",
    "DimensionRetriever",
    "create_vectorstore_from_documents",
]

__version__ = "0.1.0"
