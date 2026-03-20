"""
Custom Embedding Wrapper for DashScope

Properly handles batch size limits for DashScope API (max 10 per batch).
"""

import os
from typing import List, Any, ClassVar
from loguru import logger

try:
    from llama_index.embeddings.dashscope import DashScopeEmbedding
    from llama_index.core.base.embeddings.base import BaseEmbedding
    from pydantic import PrivateAttr
    HAS_DASHSCOPE = True
except ImportError:
    HAS_DASHSCOPE = False


class BatchedDashScopeEmbedding(BaseEmbedding):
    """
    DashScope Embedding with proper batch size handling

    DashScope API limits batch size to 10, but LlamaIndex's default
    implementation doesn't respect this properly.
    """

    # DashScope batch size limit
    MAX_BATCH_SIZE: ClassVar[int] = 10

    # Private attributes for Pydantic v2
    _dashscope_embed: Any = PrivateAttr()
    _model_name: str = PrivateAttr()

    def __init__(
        self,
        model_name: str = "text-embedding-v3",
        api_key: str = None,
        **kwargs,
    ):
        """
        Initialize batched DashScope embedding

        Args:
            model_name: Embedding model name
            api_key: DashScope API key
        """
        if not HAS_DASHSCOPE:
            raise ImportError("llama-index-embeddings-dashscope not installed")

        api_key = api_key or os.getenv("DASHSCOPE_API_KEY")
        if not api_key:
            raise ValueError("DASHSCOPE_API_KEY not set")

        # Initialize the underlying DashScope embedding
        dashscope_embed = DashScopeEmbedding(
            model_name=model_name,
            api_key=api_key,
        )

        # Call parent constructor first
        super().__init__(**kwargs)

        # Set private attributes after parent init
        self._dashscope_embed = dashscope_embed
        self._model_name = model_name

        logger.info(f"BatchedDashScopeEmbedding initialized with model={model_name}")

    @classmethod
    def class_name(cls) -> str:
        return "BatchedDashScopeEmbedding"

    def _get_query_embedding(self, query: str) -> List[float]:
        """Get embedding for a single query"""
        return self._dashscope_embed.get_query_embedding(query)

    def _get_text_embedding(self, text: str) -> List[float]:
        """Get embedding for a single text"""
        return self._dashscope_embed.get_text_embedding(text)

    def _get_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """
        Get embeddings for multiple texts with proper batching

        This is the key method that handles batch size limits and retries.
        """
        import time

        all_embeddings = []

        # Process in batches of MAX_BATCH_SIZE
        for i in range(0, len(texts), self.MAX_BATCH_SIZE):
            batch = texts[i:i + self.MAX_BATCH_SIZE]

            # Retry logic with exponential backoff
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    batch_embeddings = self._dashscope_embed.get_text_embedding_batch(batch)
                    all_embeddings.extend(batch_embeddings)

                    if i + self.MAX_BATCH_SIZE < len(texts):
                        logger.debug(f"Processed batch {i//self.MAX_BATCH_SIZE + 1}, {len(all_embeddings)}/{len(texts)} texts")
                        time.sleep(0.3)  # Small delay to avoid rate limiting

                    break  # Success, exit retry loop

                except Exception as e:
                    if attempt < max_retries - 1:
                        wait_time = (2 ** attempt) + 1  # Exponential backoff + 1
                        logger.warning(f"Batch failed (attempt {attempt + 1}/{max_retries}): {str(e)[:100]}. Retrying in {wait_time}s...")
                        time.sleep(wait_time)
                    else:
                        logger.error(f"Batch failed after {max_retries} attempts")
                        raise

        return all_embeddings

    async def _aget_query_embedding(self, query: str) -> List[float]:
        """Async get embedding for a single query"""
        return self._get_query_embedding(query)

    async def _aget_text_embedding(self, text: str) -> List[float]:
        """Async get embedding for a single text"""
        return self._get_text_embedding(text)

    async def _aget_text_embeddings(self, texts: List[str]) -> List[List[float]]:
        """Async get embeddings for multiple texts"""
        return self._get_text_embeddings(texts)


def get_embed_model(embed_model_type: str = "dashscope", **kwargs) -> Any:
    """
    Get embedding model by type

    Args:
        embed_model_type: Type of embedding model (dashscope/openai/huggingface)
        **kwargs: Additional arguments for the embedding model

    Returns:
        Embedding model instance
    """
    if embed_model_type == "dashscope":
        return BatchedDashScopeEmbedding(**kwargs)

    elif embed_model_type == "openai":
        try:
            from llama_index.embeddings.openai import OpenAIEmbedding
            return OpenAIEmbedding(**kwargs)
        except ImportError:
            raise ImportError("llama-index-embeddings-openai not installed")

    elif embed_model_type == "huggingface":
        try:
            from llama_index.embeddings.huggingface import HuggingFaceEmbedding
            return HuggingFaceEmbedding(
                model_name=kwargs.get("model_name", "BAAI/bge-small-zh-v1.5")
            )
        except ImportError:
            raise ImportError("llama-index-embeddings-huggingface not installed")

    else:
        raise ValueError(f"Unknown embedding model type: {embed_model_type}")
