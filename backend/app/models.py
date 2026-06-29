"""Request/response models for the agent-workflow API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator


class LessonRequest(BaseModel):
    subject: str = Field(..., description="Subject, e.g. 'Toán'.")
    grade: int = Field(..., ge=1, le=12, description="Grade level (1-12).")
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    prompt: str = Field(..., min_length=1, description="Teacher's topic / learning-objective request.")
    objective_id: str | None = Field(None, description="Linked GDPT 2018 objective id, if known.")
    source_text: str | None = Field(
        None,
        description=(
            "Optional pasted teacher material, lesson plan, slide text, or source material. "
            "It personalizes generation but does not override GDPT 2018."
        ),
    )
    uploaded_file_id: str | None = Field(None, description="Optional id of an uploaded lesson plan/slide.")
    upload_type: Literal["lesson_plan", "slide", "none"] = Field(
        "none", description="Type of optional teacher upload."
    )
    num_items: int = Field(5, ge=1, le=20, description="Desired number of items/pairs.")
    override_template: str | None = Field(
        None, description="Force a specific template id (FR-05); skips recommendation."
    )

    @field_validator("objective_id", "uploaded_file_id", "override_template", mode="before")
    @classmethod
    def _empty_or_placeholder_to_none(cls, value: object) -> object:
        if isinstance(value, str) and value.strip().lower() in {"", "string", "none", "null"}:
            return None
        return value


class TemplateCandidate(BaseModel):
    id: str
    name: str
    description: str
    category: str = "Tổng quát"


class RecommendResponse(BaseModel):
    template_id: str
    rationale: str
    candidates: list[TemplateCandidate]


class GameRecommendation(BaseModel):
    """A single playable game offered to the teacher, with an AI-written intro."""

    template_id: str = Field(..., description="Backend template id, e.g. 'treasure_hunt'.")
    name: str = Field(..., description="Teacher-facing game name, e.g. 'Treasure Hunt'.")
    intro: str = Field(..., description="One or two sentences (Vietnamese) on why this game fits the lesson.")
    recommended: bool = Field(False, description="True for the single best-fit game (the top pick).")


class RecommendGamesResponse(BaseModel):
    """Ranked list of playable games for the teacher to choose from (best-first).

    When the request is blocked by the guardrail, ``blocked`` is True,
    ``recommendations`` is empty, and ``message`` / ``suggestion`` carry the
    teacher-facing explanation so the frontend can display them without crashing.
    """

    recommendations: list[GameRecommendation] = []
    blocked: bool = False
    message: str = ""
    suggestion: str = ""


class GameResponse(BaseModel):
    ok: bool
    template_id: str | None = None
    rationale: str | None = None
    content: dict[str, Any] | None = None
    objective_id: str | None = None
    validation_errors: list[str] = []
    repair_attempts: int = 0
    error: str | None = None
