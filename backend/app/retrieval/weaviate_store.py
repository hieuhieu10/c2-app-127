"""Weaviate storage for curriculum objectives.

Weaviate stores both vector embeddings and structured metadata. Retrieval always
filters by subject and grade before vector search, so semantic similarity cannot
pull an objective from the wrong curriculum scope.
"""

from __future__ import annotations

import re
import uuid
from collections.abc import Iterable
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

from app.config import settings
from app.retrieval.context import _norm


@dataclass(frozen=True)
class ObjectiveSearchHit:
    objective: dict[str, Any]
    confidence: float


def objective_to_embedding_text(objective: dict[str, Any]) -> str:
    """Build the Vietnamese-rich text that BGE-M3 embeds for one objective."""
    fields: list[str] = [
        f"Môn: {objective.get('subject_display') or objective.get('subject', '')}",
        f"Lớp: {objective.get('grade', '')}",
        f"Chủ đề: {objective.get('topic', '')}",
        f"Yêu cầu cần đạt: {objective.get('objective_text', '')}",
        f"Mức nhận thức: {objective.get('cognitive_level', '')}",
        f"Kỹ năng: {', '.join(objective.get('required_skills', []))}",
        f"Dạng câu hỏi phù hợp: {', '.join(objective.get('recommended_question_types', []))}",
        f"Từ khóa: {', '.join(objective.get('search_aliases', []))}",
    ]
    passages = objective.get("grounding_passages", [])
    if passages:
        fields.append("Ngữ cảnh chương trình: " + " ".join(str(p) for p in passages))
    return "\n".join(part for part in fields if part.strip())


def objective_uuid(objective_id: str) -> str:
    return str(uuid.uuid5(uuid.NAMESPACE_URL, f"learngame:curriculum-objective:{objective_id}"))


class WeaviateObjectiveStore:
    """Thin Weaviate v4 client wrapper for curriculum objective retrieval."""

    def __init__(self, url: str | None = None, collection_name: str | None = None) -> None:
        self.url = url or settings.weaviate_url
        self.collection_name = collection_name or settings.weaviate_collection
        self._client = None

    @property
    def client(self):
        if self._client is None:
            self._client = self._connect()
        return self._client

    @property
    def collection(self):
        return self.client.collections.get(self.collection_name)

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    def _connect(self):
        try:
            import weaviate
        except ImportError as exc:
            raise RuntimeError(
                "Missing dependency 'weaviate-client'. Install backend requirements "
                "before using Weaviate retrieval."
            ) from exc

        parsed = urlparse(self.url)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 8080)
        return weaviate.connect_to_local(host=host, port=port)

    def ensure_schema(self) -> None:
        try:
            from weaviate.classes.config import Configure, DataType, Property
        except ImportError as exc:
            raise RuntimeError("Installed weaviate-client does not expose the v4 schema API.") from exc

        if self.client.collections.exists(self.collection_name):
            return

        self.client.collections.create(
            name=self.collection_name,
            vectorizer_config=Configure.Vectorizer.none(),
            properties=[
                Property(name="objective_id", data_type=DataType.TEXT),
                Property(name="subject", data_type=DataType.TEXT),
                Property(name="subject_norm", data_type=DataType.TEXT),
                Property(name="grade", data_type=DataType.INT),
                Property(name="topic", data_type=DataType.TEXT),
                Property(name="objective_text", data_type=DataType.TEXT),
                Property(name="embedding_text", data_type=DataType.TEXT),
                Property(name="payload_json", data_type=DataType.TEXT),
            ],
        )

    def upsert_objectives(self, objectives: Iterable[dict[str, Any]], vectors: list[list[float]]) -> int:
        import json

        self.ensure_schema()
        collection = self.collection
        count = 0
        for objective, vector in zip(objectives, vectors, strict=False):
            objective_id = objective["objective_id"]
            object_id = objective_uuid(objective_id)
            try:
                collection.data.delete_by_id(object_id)
            except Exception:
                pass
            subject = objective.get("subject_display") or objective.get("subject") or ""
            collection.data.insert(
                uuid=object_id,
                vector=vector,
                properties={
                    "objective_id": objective_id,
                    "subject": subject,
                    "subject_norm": _norm(subject),
                    "grade": int(objective.get("grade", 0)),
                    "topic": objective.get("topic", ""),
                    "objective_text": objective.get("objective_text", ""),
                    "embedding_text": objective_to_embedding_text(objective),
                    "payload_json": json.dumps(objective, ensure_ascii=False),
                },
            )
            count += 1
        return count

    def search(
        self,
        *,
        subject: str,
        grade: int,
        query_vector: list[float],
        limit: int = 5,
    ) -> list[ObjectiveSearchHit]:
        import json

        try:
            from weaviate.classes.query import Filter, MetadataQuery
        except ImportError as exc:
            raise RuntimeError("Installed weaviate-client does not expose the v4 query API.") from exc

        filters = Filter.by_property("subject_norm").equal(_norm(subject)) & Filter.by_property("grade").equal(grade)
        result = self.collection.query.near_vector(
            near_vector=query_vector,
            filters=filters,
            limit=limit,
            return_metadata=MetadataQuery(distance=True),
        )
        hits: list[ObjectiveSearchHit] = []
        for item in result.objects:
            payload = json.loads(item.properties["payload_json"])
            distance = getattr(item.metadata, "distance", None)
            confidence = _distance_to_confidence(distance)
            hits.append(ObjectiveSearchHit(objective=payload, confidence=confidence))
        return hits


def _distance_to_confidence(distance: float | None) -> float:
    if distance is None:
        return 0.75
    if distance < 0:
        return 0.0
    return max(0.0, min(0.99, 1.0 - distance))


def compact_query(prompt: str, source_text: str | None, max_chars: int = 6000) -> str:
    """Bound query text before embedding to avoid very large pasted documents."""
    text = f"{prompt}\n\n{source_text or ''}".strip()
    text = re.sub(r"\s+", " ", text)
    return text[:max_chars]

