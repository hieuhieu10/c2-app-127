"""Treasure Hunt template schema — MCQ pool for the map-race game.

Treasure Hunt is a turn-based map race: players answer a multiple-choice question
correctly to advance toward a treasure cave. Mechanically it is a quiz pool, so it
reuses the standard MCQ item shape (1 correct answer + misconception distractors).
The frontend shell builds the on-screen options from ``correct_answer`` + ``distractors``.
"""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from ..spec import GameSpec
from .base import BaseGameItem, GameContentBase


class TreasureHuntQuestion(BaseGameItem):
    """One multiple-choice question drawn during a Treasure Hunt turn.

    Narrows parent distractors to exactly 3 so the shell always renders a clean
    4-option layout (1 correct + 3 wrong).
    """

    distractors: list[str] = Field(
        ...,
        min_length=3,
        max_length=3,
        description=(
            "Exactly 3 plausible but verifiably WRONG options. "
            "Each should target a known student misconception when one is supplied. "
            "Never include the correct answer. Never repeat a distractor."
        ),
    )


class TreasureHuntContent(GameContentBase):
    """Content envelope for one Treasure Hunt session.

    Questions are drawn sequentially as players race along the map. Keep prompts
    short and concrete — they are shown one at a time on a game card.
    """

    template_id: Literal["treasure_hunt"] = "treasure_hunt"
    questions: list[TreasureHuntQuestion] = Field(
        ...,
        min_length=4,
        max_length=20,
        description=(
            "Pool of 4–20 multiple-choice questions drawn sequentially during the map race. "
            "Keep each question short, self-contained, and answerable on its own."
        ),
    )


SPEC = GameSpec(
    id="treasure_hunt",
    name="Treasure Hunt",
    description=(
        "Turn-based map race: players answer a multiple-choice question correctly to advance "
        "their ship along the map toward a treasure cave. Best for energetic recall practice "
        "and elementary lessons."
    ),
    content_type_fit=("facts", "definitions", "concepts", "vocabulary", "formulas"),
    grade_range=(1, 12),
    content_model=TreasureHuntContent,
    category="Tổng quát",
    active=True,
    playable=True,
    min_items=8,
    default_num_items=8,
    sort_order=10,
)
