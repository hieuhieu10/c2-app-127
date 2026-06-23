"""Feed the Hungry Cats template schema — a math-facts drag-and-drop game.

**Math only.** Each fish-treat shows a basic arithmetic expression using +, -, ×, ÷
and the student drags it to the cat whose label equals the numeric result.

``question``      — the arithmetic expression printed ON the treat, e.g. "3 + 4", "12 ÷ 3"
``correct_answer`` — the numeric result as a string, e.g. "7", "4"

Treats that share the same ``correct_answer`` feed the same cat, so the shell groups
items by answer to build the cats. A round needs a few distinct numeric answers
(the cats), each with at least two treats.

Content type fits: addition, subtraction, multiplication, division, and mixed
arithmetic practice in grades 1-6 only. Do NOT generate non-math content.
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
            "A basic arithmetic expression printed ON THE FISH TREAT — MUST use only the "
            "operations +, -, ×, ÷ (or *, /). Keep it short so it fits on a small treat, "
            "e.g. '3 + 4', '15 - 8', '6 × 3', '12 ÷ 4', '7 × 8', '100 - 37'. "
            "Do NOT write non-math content like words, categories, or definitions."
        ),
    )
    correct_answer: str = Field(
        ...,
        min_length=1,
        description=(
            "The numeric result of the expression as a plain string, e.g. '7', '4', '18'. "
            "This label is printed ON THE CAT the treat must be fed to. "
            "All treats that evaluate to the same number MUST share the exact same string "
            "(e.g. all treats that equal 7 get correct_answer '7'). "
            "Do NOT write non-numeric values like 'Mammal' or 'Noun'."
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description=(
            "A short calculation hint, e.g. 'Count up from 3 four times' or "
            "'Break 15 into 10 + 5 then subtract 8'."
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description=(
            "A brief explanation of why the expression equals that result, "
            "grounded in the arithmetic skill the teacher's objective targets, "
            "e.g. '3 + 4 = 7 because we are adding ones to reach 7.'"
        ),
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
            "One-line math-focused instruction telling the student how to play, e.g. "
            "'Solve each sum on the fish treat, then drag it to the cat with that number!' "
            "or 'Drag each treat to the cat whose number matches the answer.'"
        ),
    )
    items: list[FeedCatsItem] = Field(
        ...,
        min_length=4,
        max_length=18,
        description=(
            "The fish treats. Every treat MUST be an arithmetic expression (+, -, ×, ÷). "
            "Their `correct_answer` numeric values must cluster into 2–5 distinct cats, "
            "with at least 2 treats per cat, so every cat can be fed. "
            "Vary the operations across treats — mix additions and subtractions, or "
            "mix multiplications and divisions, to reinforce the lesson skill. "
            "Prefer evenly sized cats."
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
        "MATH ONLY. Drag each fish-treat to the cat whose number equals the arithmetic result. "
        "Each treat shows a basic arithmetic expression (+, -, ×, ÷); the matching cat wears "
        "the numeric answer. Best for drilling addition, subtraction, multiplication, and division "
        "facts in grades 1-6. Do NOT use for non-math topics."
    ),
    content_type_fit=(
        "math-facts",
        "addition",
        "subtraction",
        "multiplication",
        "division",
        "arithmetic",
        "basic-operations",
        "number-facts",
    ),
    grade_range=(1, 6),
    content_model=FeedCatsContent,
    active=True,
    playable=True,
    min_items=6,
    default_num_items=9,
    sort_order=30,
)
