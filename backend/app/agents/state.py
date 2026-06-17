"""Shared LangGraph state for the recommend -> generate -> validate/repair flow."""

from __future__ import annotations

from typing import Any, TypedDict

from app.retrieval.context import RetrievedContext


class GenerationState(TypedDict, total=False):
    # --- inputs ---
    subject: str
    grade: int
    difficulty: str
    prompt: str
    objective_id: str | None
    source_text: str | None
    uploaded_file_id: str | None
    upload_type: str
    num_items: int
    override_template: str | None  # FR-05: teacher picks template explicitly

    # --- populated by nodes ---
    context: RetrievedContext
    template_id: str
    rationale: str
    content: dict[str, Any] | None
    validation_errors: list[str]
    repair_attempts: int
    ok: bool
    error: str | None  # terminal error message (e.g. exhausted repairs)
