"""Shared building blocks for game content schemas.

These Pydantic v2 models are the single source of truth. Their JSON Schema (via
``model_json_schema()``) drives three consumers: the worker agent's forced tool-use
``input_schema``, the validation gate, and the frontend game-shell contract.

Field descriptions are intentionally written *for the model* — they are exported into
the JSON Schema the worker sees, so they steer generation.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class BaseGameItem(BaseModel):
    """One question-shaped item shared by quiz-like templates."""

    question: str = Field(
        ...,
        min_length=1,
        description="The question or prompt shown to the student, in the lesson's language.",
    )
    correct_answer: str = Field(
        ...,
        min_length=1,
        description="The single correct answer. Must be supported by the source/curriculum.",
    )
    distractors: list[str] = Field(
        ...,
        min_length=2,
        max_length=4,
        description=(
            "2-4 plausible but verifiably WRONG options. Each should target a known "
            "student misconception when one is supplied. Never include the correct answer."
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description="A short hint that nudges without giving away the answer.",
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description="Why the correct answer is right; may also clear up the targeted misconception.",
    )
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Id of the linked GDPT 2018 learning objective this item assesses.",
    )


class GameContentBase(BaseModel):
    """Common envelope fields every template's content carries."""

    title: str = Field(..., min_length=1, description="Short, teacher-facing title for the game.")
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Primary GDPT 2018 objective id this game targets.",
    )
