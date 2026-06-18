"""Quiz template schema — multiple-choice items."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..spec import GameSpec
from .base import BaseGameItem, GameContentBase


class QuizItem(BaseGameItem):
    """A multiple-choice question (inherits the standard item shape)."""


class QuizContent(GameContentBase):
    template_id: Literal["quiz"] = "quiz"
    items: list[QuizItem] = Field(
        ...,
        min_length=1,
        max_length=20,
        description="The quiz questions, each with one correct answer and misconception distractors.",
    )


SPEC = GameSpec(
    id="quiz",
    name="Multiple-choice quiz",
    description=(
        "Questions with one correct answer and misconception-targeting distractors. "
        "Best for checking factual recall and concept understanding."
    ),
    content_type_fit=("facts", "definitions", "concepts", "cause-effect"),
    grade_range=(1, 12),
    content_model=QuizContent,
    active=True,
    playable=False,
    sort_order=40,
)
