"""Hybrid RAG retrieval provider.

The existing file-backed provider remains the curriculum source of truth for
building structured context. This provider swaps only the objective matching
step: it first tries Weaviate vector search over BGE-M3 embeddings, then falls
back to the deterministic keyword matcher when configured as `hybrid`.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.retrieval.context import GDPT2018RetrievalProvider, _domain_confidence_adjustment
from app.retrieval.embeddings import BgeM3Embedder
from app.retrieval.weaviate_store import WeaviateObjectiveStore, compact_query


class HybridRAGRetrievalProvider(GDPT2018RetrievalProvider):
    def __init__(
        self,
        kb_root: Path | None = None,
        *,
        require_weaviate: bool = False,
        store: WeaviateObjectiveStore | None = None,
        embedder: BgeM3Embedder | None = None,
    ) -> None:
        super().__init__(kb_root) if kb_root else super().__init__()
        self.require_weaviate = require_weaviate
        self.store = store or WeaviateObjectiveStore()
        self.embedder = embedder or BgeM3Embedder()

    def _match_objective(
        self,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None,
    ) -> tuple[dict[str, Any] | None, float]:
        if objective_id:
            return super()._match_objective(subject, grade, objective_id, prompt, source_text)

        try:
            query = compact_query(prompt, source_text)
            vector = self.embedder.embed_query(query)
            hits = self.store.search(subject=subject, grade=grade, query_vector=vector, limit=10)
            if hits:
                best = max(
                    hits,
                    key=lambda hit: hit.confidence + _domain_confidence_adjustment(hit.objective, prompt, source_text),
                )
                confidence = best.confidence + _domain_confidence_adjustment(best.objective, prompt, source_text)
                return best.objective, max(min(confidence, 0.99), 0.6)
        except Exception:
            if self.require_weaviate:
                raise

        return super()._match_objective(subject, grade, objective_id, prompt, source_text)
