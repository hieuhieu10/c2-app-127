"""Embedding helpers for Vietnamese-first retrieval.

BGE-M3 is multilingual and works well for Vietnamese semantic search. The model
is loaded lazily so the normal file-backed MVP can still run without torch or
sentence-transformers installed.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Iterable

from app.config import settings


class BgeM3Embedder:
    """Small wrapper around sentence-transformers for BAAI/bge-m3."""

    def __init__(self, model_name: str | None = None, device: str | None = None) -> None:
        self.model_name = model_name or settings.embedding_model
        self.device = device if device is not None else settings.embedding_device

    @property
    def model(self):
        return _load_model(self.model_name, self.device or None)

    def embed_query(self, text: str) -> list[float]:
        vectors = self.embed_documents([text])
        return vectors[0] if vectors else []

    def embed_documents(self, texts: Iterable[str]) -> list[list[float]]:
        clean = [text.strip() for text in texts if text and text.strip()]
        if not clean:
            return []
        vectors = self.model.encode(
            clean,
            normalize_embeddings=True,
            batch_size=settings.embedding_batch_size,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]


@lru_cache(maxsize=2)
def _load_model(model_name: str, device: str | None):
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise RuntimeError(
            "Missing dependency 'sentence-transformers'. Install backend requirements "
            "before using BGE-M3 retrieval."
        ) from exc
    kwargs = {"device": device} if device else {}
    return SentenceTransformer(model_name, **kwargs)

