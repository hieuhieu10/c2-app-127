"""Trivia Battleship template schema — question pool for the 2-player hot-seat game."""

from __future__ import annotations

from typing import Literal

from pydantic import Field

from .base import BaseGameItem, GameContentBase


class BattleshipQuestion(BaseGameItem):
    """One MCQ drawn during a Trivia Battleship turn.

    Narrows parent distractors to exactly 3 so the UI always renders a clean
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


class BattleshipContent(GameContentBase):
    """Content envelope for one Trivia Battleship session.

    The question pool is drawn sequentially during gameplay. Generate 20 questions
    by default — the hit-chain mechanic (correct answer + hit = another free turn)
    means one player can consume many questions in a single streak. The minimum of
    9 covers one question per ship cell (2+3+4 = 9 total cells in the fleet).
    """

    template_id: Literal["battleship"] = "battleship"
    questions: list[BattleshipQuestion] = Field(
        ...,
        min_length=9,
        max_length=25,
        description=(
            "Pool of 9–25 trivia questions drawn sequentially during play. "
            "Vary difficulty across the pool (easier early, harder later). "
            "Each question must be fully self-contained — no 'see above' references, "
            "since the player sees only one question at a time."
        ),
    )
