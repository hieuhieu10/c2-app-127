"""Fill-in-the-blank template schema."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..spec import GameSpec
from .base import GameContentBase


class FillBlankItem(BaseModel):
    text: str = Field(
        ...,
        min_length=1,
        description=(
            "Sentence(s) with one or more blanks marked as '___' (three underscores). "
            "The number of blanks must equal the number of entries in `answers`."
        ),
    )
    answers: list[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="Correct fill(s), in order of appearance of each '___' blank.",
    )
    distractors: list[str] = Field(
        ...,
        min_length=2,
        max_length=4,
        description="2-4 verifiably wrong fills offered as options, ideally misconception-based.",
    )
    hint: str = Field(..., min_length=1, description="A short hint for this item.")
    explanation: str = Field(..., min_length=1, description="Why the answer(s) are correct.")
    objective_id: str = Field(..., min_length=1, description="Linked GDPT 2018 objective id.")


class FillBlankContent(GameContentBase):
    template_id: Literal["fill_in_blank"] = "fill_in_blank"
    items: list[FillBlankItem] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="The fill-in-the-blank items.",
    )


SPEC = GameSpec(
    id="fill_in_blank",
    name="Fill in the blank",
    description=(
        "Complete sentences by choosing the missing word(s). Best for key terminology in context."
    ),
    content_type_fit=("vocabulary", "key-terms", "definitions", "formulas"),
    grade_range=(1, 12),
    content_model=FillBlankContent,
    active=True,
    playable=False,
    sort_order=60,
)
