"""Retrieval seam.

The agent workflow needs grounding context (relevant curriculum/source passages) and a
misconception list for the linked objective. Real RAG over the GDPT 2018 KB + PDF/OCR
parsing is a teammate's job; here we define the *interface* the agents code against and a
fixture-backed stub so the workflow runs end-to-end today.

When the real provider lands, implement ``RetrievalProvider`` and inject it — no change
to the agents.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Protocol

from pydantic import BaseModel

_FIXTURE = Path(__file__).resolve().parents[2] / "data" / "fixtures" / "sample_subject.json"


class Misconception(BaseModel):
    id: str
    misconception: str
    correct_concept: str


class RetrievedContext(BaseModel):
    """Grounding bundle for one lesson request."""

    objective_id: str
    objective_text: str = ""
    # Relevant curriculum/source passages — the premise for downstream NLI checks.
    passages: list[str] = []
    misconceptions: list[Misconception] = []


class RetrievalProvider(Protocol):
    def retrieve(
        self,
        *,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None = None,
    ) -> RetrievedContext: ...


class StubRetrievalProvider:
    """Fixture-backed provider. Looks up the objective in the bundled sample subject.

    If the objective id is unknown, it still returns any teacher-supplied source_text as a
    passage so generation has *something* to ground on.
    """

    def __init__(self, fixture_path: Path = _FIXTURE) -> None:
        self._data = json.loads(fixture_path.read_text(encoding="utf-8"))
        self._objectives = {o["id"]: o for o in self._data.get("objectives", [])}

    def retrieve(
        self,
        *,
        subject: str,
        grade: int,
        objective_id: str | None,
        prompt: str,
        source_text: str | None = None,
    ) -> RetrievedContext:
        obj = self._objectives.get(objective_id) if objective_id else None
        # Fallback: if no exact match but only one objective exists, use it for the demo.
        if obj is None and len(self._objectives) == 1:
            obj = next(iter(self._objectives.values()))

        passages: list[str] = []
        misconceptions: list[Misconception] = []
        objective_text = ""
        resolved_id = objective_id or ""

        if obj is not None:
            resolved_id = obj["id"]
            objective_text = obj.get("description", "")
            passages.extend(obj.get("curriculum_context", []))
            misconceptions = [Misconception(**m) for m in obj.get("misconceptions", [])]

        if source_text:
            passages.append(source_text.strip())

        return RetrievedContext(
            objective_id=resolved_id,
            objective_text=objective_text,
            passages=passages,
            misconceptions=misconceptions,
        )


# Default provider instance used by the graph unless one is injected.
default_provider: RetrievalProvider = StubRetrievalProvider()
