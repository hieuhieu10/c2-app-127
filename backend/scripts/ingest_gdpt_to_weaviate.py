"""Ingest GDPT 2018 objectives into Weaviate with BGE-M3 embeddings.

Run from backend/:
    uv run python scripts/ingest_gdpt_to_weaviate.py
"""

from __future__ import annotations

import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.retrieval.context import GDPT2018RetrievalProvider  # noqa: E402
from app.retrieval.embeddings import BgeM3Embedder  # noqa: E402
from app.retrieval.weaviate_store import WeaviateObjectiveStore, objective_to_embedding_text  # noqa: E402


def main() -> None:
    provider = GDPT2018RetrievalProvider()
    objectives = provider._objectives
    if not objectives:
        raise RuntimeError("No GDPT objectives found to ingest.")

    texts = [objective_to_embedding_text(obj) for obj in objectives]
    embedder = BgeM3Embedder(settings.embedding_model, settings.embedding_device)
    vectors = embedder.embed_documents(texts)

    store = WeaviateObjectiveStore()
    try:
        count = store.upsert_objectives(objectives, vectors)
    finally:
        store.close()

    print(
        f"Ingested {count} objectives into Weaviate collection "
        f"'{settings.weaviate_collection}' using embedding model '{settings.embedding_model}'."
    )


if __name__ == "__main__":
    main()

