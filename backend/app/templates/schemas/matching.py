"""Matching / memory template schema — match left items to right items."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from .base import GameContentBase


class MatchingPair(BaseModel):
    left: str = Field(..., min_length=1, description="Left-side prompt (e.g. a term).")
    right: str = Field(..., min_length=1, description="Correct right-side match (e.g. its definition).")
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
        description="The correct left-right pairs (3-8).",
    )
    distractors: list[str] = Field(
        default_factory=list,
        max_length=4,
        description=(
            "Optional extra right-side options that match NO left item — each a verifiably "
            "wrong choice, ideally a known misconception. May be empty."
        ),
    )
    hint: str = Field(..., min_length=1, description="A short hint for the whole matching set.")
