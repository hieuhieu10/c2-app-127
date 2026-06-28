"""Cat Jump template schema — a MATH-ONLY number-sequence completion game.

**Math only.** Students guide a cat across 8 river stones by identifying the next number
in a purely mathematical integer sequence. Every sequence must follow a discoverable
mathematical rule (arithmetic, geometric, Fibonacci, quadratic, triangular, etc.).
Non-math content (words, categories, facts) is NOT permitted.

Each level (``question``) encodes the full 8-number sequence in ``correct_answer`` as a
semicolon-separated string, e.g. ``"3;6;9;12;15;18;21;24"``. The React shell parses this,
shows the first 3 numbers, and generates three multiple-choice options dynamically so the
AI never needs to provide distractors. Semicolons (not commas) are used so the curriculum
decimal-scope validator never misreads a list like "5,10" as the decimal 5.10 and wrongly
rejects an integer sequence at grade ≤ 4.

Difficulty guidance:
  easy   — constant arithmetic step (skip-count by 2, 3, 5, 10)
  medium — geometric (×2, ×3), Fibonacci-like, triangular numbers
  hard   — quadratic (n²), alternating step sizes, multi-rule patterns
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from ..spec import GameSpec
from .base import GameContentBase


class CatJumpLevel(BaseModel):
    """One river crossing: a named pattern sequence the cat must complete."""

    question: str = Field(
        ...,
        min_length=1,
        description=(
            "Level name describing the mathematical pattern rule, e.g. "
            "'Hop by 3', 'Fibonacci sequence', 'Square numbers (1, 4, 9…)', "
            "'Triangular numbers', 'Doubling: ×2 each hop', 'Growing gaps: +2, +4, +6…', "
            "'Odd numbers squared'. "
            "MUST describe a purely numerical/mathematical sequence — no words, categories, "
            "or non-math content. Match complexity to the teacher's difficulty and grade: "
            "easy → simple skip-counting; medium → geometric or Fibonacci; "
            "hard → quadratic, triangular, alternating-step, or multi-rule patterns."
        ),
    )
    correct_answer: str = Field(
        ...,
        min_length=1,
        description=(
            "Exactly 8 positive integers forming the complete sequence, written as a "
            "SEMICOLON-separated string with NO spaces, e.g. '3;6;9;12;15;18;21;24'. "
            "Use semicolons, never commas, to separate the numbers. "
            "Students see only the first 3 numbers; they must deduce numbers 4-8 one at a time. "
            "Hard / medium sequences should use non-constant differences to challenge deeper reasoning: "
            "Fibonacci '1;1;2;3;5;8;13;21', squares '1;4;9;16;25;36;49;64', "
            "triangle numbers '1;3;6;10;15;21;28;36', "
            "growing gaps '2;4;8;14;22;32;44;58' (differences: +2,+4,+6,+8,+10,+12,+14). "
            "All 8 values must be positive integers greater than 0."
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description=(
            "One-sentence hint revealing the pattern rule, shown when the student is stuck. "
            "e.g. 'Add 3 each time', "
            "'Each number equals the sum of the two numbers before it', "
            "'Multiply the position number by itself (1×1, 2×2, 3×3…)', "
            "'The gap between each hop grows by 2 every time'. "
            "Never give away the exact next number."
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description=(
            "Why this sequence pattern appears in the lesson. Ground it in the teacher's "
            "curriculum objective, e.g. 'Multiples of 3 are used in multiplication tables and "
            "area problems.' or 'The Fibonacci sequence appears in nature, art, and architecture.' "
            "One or two sentences maximum."
        ),
    )
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Id of the linked GDPT 2018 learning objective this level assesses.",
    )

    @field_validator("correct_answer")
    @classmethod
    def _validate_sequence(cls, v: str) -> str:
        # Accept either separator from the model (it sometimes falls back to commas),
        # but always store a semicolon-joined string so the curriculum decimal-scope
        # check never misreads "5,10" as the decimal 5.10 and rejects the sequence.
        parts = [p.strip() for p in v.replace(",", ";").split(";") if p.strip()]
        if len(parts) != 8:
            raise ValueError(
                f"correct_answer must have exactly 8 integers separated by ';', got {len(parts)}: {v!r}"
            )
        for p in parts:
            if not p.lstrip("-").isdigit():
                raise ValueError(f"Each element must be an integer, got {p!r}")
            if int(p) <= 0:
                raise ValueError(
                    f"All integers must be positive (> 0), got {p!r}. "
                    "Start the sequence from at least 1."
                )
        return ";".join(parts)


class CatJumpContent(GameContentBase):
    template_id: Literal["cat_jump"] = "cat_jump"
    instructions: str = Field(
        ...,
        min_length=1,
        description=(
            "One-line instruction telling the student how to play, e.g. "
            "'Help the cat jump to the right stone — pick the number that continues the pattern!' "
            "Keep it short and encouraging."
        ),
    )
    questions: list[CatJumpLevel] = Field(
        ...,
        min_length=4,
        max_length=8,
        description=(
            "The river-crossing levels in order of increasing difficulty. "
            "Start simple (easy arithmetic) and escalate to harder patterns by the last level. "
            "Minimum 4 levels, maximum 8 levels. "
            "Vary sequence types across levels — never repeat the same step size or pattern type. "
            "For hard difficulty, at least half the levels should use non-arithmetic patterns "
            "(geometric, Fibonacci, quadratic, triangular, or alternating-step)."
        ),
    )


SPEC = GameSpec(
    id="cat_jump",
    name="Cat Jump",
    description=(
        "MATH ONLY. A cat hops across 8 stepping stones in a river — students identify the "
        "next number in a purely mathematical integer sequence by choosing from 3 options. "
        "Each level uses a different numeric pattern. "
        "Difficulty controls complexity: easy uses constant-step skip-counting (hop by 2, 3, 5, 10); "
        "medium adds geometric (×2, ×3), Fibonacci, or triangular numbers; "
        "hard introduces quadratic (n²), alternating step sizes, or multi-rule patterns. "
        "ONLY suitable for math lessons on number patterns, sequences, and mathematical reasoning. "
        "Do NOT use for non-math topics such as vocabulary, history, or science classification."
    ),
    content_type_fit=(
        "number-sequences",
        "number-patterns",
        "skip-counting",
        "arithmetic-sequences",
        "geometric-sequences",
        "mathematical-reasoning",
        "multiplication-tables",
        "algebra",
    ),
    grade_range=(1, 7),
    content_model=CatJumpContent,
    active=True,
    playable=True,
    min_items=4,
    default_num_items=6,
    sort_order=20,
)
