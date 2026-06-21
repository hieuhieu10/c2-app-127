"""Feed the Hungry Cats template schema — a drag-to-sort matching game.

Each fish-treat carries a short ``question`` (an expression, clue, or example) and
the ``correct_answer`` is the label of the cat it should be fed to. Treats that
share the same ``correct_answer`` belong to the same cat, so the play shell groups
items by ``correct_answer`` to build the cats. A round therefore needs a few
distinct answers (the cats), each with a couple of treats.

This generalises the original math design ("3 + 4" → cat "7") to any sorting task:
classify examples into categories ("whale" → "Mammal"), match words to parts of
speech ("happiness" → "Noun"), etc.
"""

from __future__ import annotations

from collections import Counter
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from ..spec import GameSpec
from .base import GameContentBase


class FeedCatsItem(BaseModel):
    """One fish-treat the student drags onto a cat."""

    question: str = Field(
        ...,
        min_length=1,
        description=(
            "Short text printed ON THE FISH TREAT — a problem, clue, or example the student "
            "must classify, e.g. '3 + 4', 'whale', or 'happiness'. Keep it to a few characters "
            "or words so it fits on a small treat."
        ),
    )
    correct_answer: str = Field(
        ...,
        min_length=1,
        description=(
            "Short label printed ON THE CAT this treat should be fed to — the matching value, "
            "category, or bucket, e.g. '7', 'Mammal', or 'Noun'. Treats that belong together MUST "
            "share the exact same correct_answer string (identical casing and spelling)."
        ),
    )
    hint: str = Field(..., min_length=1, description="A short hint for this treat.")
    explanation: str = Field(
        ...,
        min_length=1,
        description="Why this treat is fed to that cat; grounded in the source/curriculum.",
    )
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Id of the linked GDPT 2018 learning objective this treat assesses.",
    )


class FeedCatsContent(GameContentBase):
    template_id: Literal["feed_the_cats"] = "feed_the_cats"
    instructions: str = Field(
        ...,
        min_length=1,
        description=(
            "One-line instruction telling the student how to play, e.g. "
            "'Drag each treat to the cat whose number matches the answer.'"
        ),
    )
    items: list[FeedCatsItem] = Field(
        ...,
        min_length=4,
        max_length=18,
        description=(
            "The fish treats. Their `correct_answer` values must cluster into 2–5 distinct cats, "
            "with at least 2 treats per cat, so every cat can be fed. Prefer evenly sized cats."
        ),
    )

    @model_validator(mode="after")
    def _check_cats(self) -> "FeedCatsContent":
        """Guarantee the items form a playable round: a few cats, each with enough treats."""
        counts = Counter(it.correct_answer.strip() for it in self.items)
        n = len(counts)
        if n < 2:
            raise ValueError(
                "feed_the_cats needs at least 2 distinct correct_answer values (one per cat)."
            )
        if n > 5:
            raise ValueError(
                "feed_the_cats supports at most 5 distinct correct_answer values (cats)."
            )
        thin = sorted(answer for answer, count in counts.items() if count < 2)
        if thin:
            raise ValueError(
                "each cat needs at least 2 treats; too few for: " + ", ".join(thin)
            )
        return self


SPEC = GameSpec(
    id="feed_the_cats",
    name="Feed the Hungry Cats",
    description=(
        "Drag each fish-treat to the cat whose label matches the treat's answer. A playful "
        "drag-and-drop sorting game — best for math facts, classifying examples into categories, "
        "and matching in the early grades."
    ),
    content_type_fit=("math-facts", "classification", "sorting", "categories", "vocabulary"),
    grade_range=(1, 5),
    content_model=FeedCatsContent,
    active=True,
    playable=True,
    min_items=6,
    default_num_items=9,
    sort_order=30,
)
