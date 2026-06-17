from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class LessonRequest(BaseModel):
    subject: str
    grade: int = Field(..., ge=1, le=12)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    prompt: str
    objective_id: str | None = None
    source_text: str | None = None
    num_items: int = Field(5, ge=1, le=20)
    override_template: str | None = None


class TemplateCandidate(BaseModel):
    id: str
    name: str
    description: str


class AIGameResponse(BaseModel):
    ok: bool
    template_id: str | None = None
    rationale: str | None = None
    content: dict[str, Any] | None = None
    objective_id: str | None = None
    validation_errors: list[str] = []
    repair_attempts: int = 0
    error: str | None = None
