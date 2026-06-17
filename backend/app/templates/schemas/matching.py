"""Matching / memory template schema: match left items to right items."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .base import GameContentBase


class MatchingPair(BaseModel):
    left: str = Field(
        ...,
        min_length=1,
        description=(
            "Short left-side card label. For primary learners, keep it concrete and concise; "
            "prefer the teacher's uploaded example when available."
        ),
    )
    right: str = Field(
        ...,
        min_length=1,
        description=(
            "Short correct right-side card label. Do not include long reasoning here; put it "
            "in explanation."
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description="Why this left matches this right; grounded in the source/curriculum.",
    )


class MatchingContent(GameContentBase):
    template_id: Literal["matching"] = "matching"
    instructions: str = Field(
        ...,
        min_length=1,
        description="One-line instruction telling the student how to match items.",
    )
    pairs: list[MatchingPair] = Field(
        ...,
        min_length=3,
        max_length=8,
        description="The correct left-right pairs (3-8), with short labels suitable for game cards.",
    )
    distractors: list[str] = Field(
        default_factory=list,
        max_length=4,
        description=(
            "Optional extra short right-side card labels that match NO left item. Each is a "
            "verifiably wrong choice, ideally a known misconception. Do not write long "
            "explanations here."
        ),
    )
    hint: str = Field(..., min_length=1, description="A short hint for the whole matching set.")
