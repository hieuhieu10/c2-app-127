"""Cat Jump template schema — a MATH-ONLY number-sequence completion game.

**Math only.** Students guide a cat across 8 river stones by identifying the next number
in a purely mathematical sequence. Every sequence must follow a discoverable mathematical
rule (arithmetic, geometric, Fibonacci, quadratic, triangular, fraction, decimal, etc.).
Non-math content (words, categories, facts) is NOT permitted.

Each level (``question``) encodes the full 8-term sequence in ``correct_answer`` as a
SEMICOLON-separated string. Each term may be a positive integer (``"3;6;9;12;15;18;21;24"``),
a fraction (``"1/2;1;3/2;2;5/2;3;7/2;4"``), or a Vietnamese-style decimal
(``"0,5;1,0;1,5;2,0;2,5;3,0;3,5;4,0"``). The React shell parses this, shows the first 3
terms, and generates three multiple-choice options dynamically so the AI never needs to
provide distractors.

Semicolons (not commas) separate the terms so the comma stays free to act as the Vietnamese
decimal point. Decimals are stored in comma form ("0,5") so the curriculum decimal-scope
validator still recognises them and keeps them out of grades that have not introduced số
thập phân yet (decimals are GDPT grade 5+, fractions grade 4+).

Difficulty guidance:
  easy   — constant arithmetic step (skip-count by 2, 3, 5, 10)
  medium — geometric (×2, ×3), Fibonacci-like, triangular numbers
  hard   — quadratic (n²), alternating step sizes, fraction/decimal steps, multi-rule patterns
"""

from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

# A term is a positive integer ("6"), a fraction ("1/4"), or a decimal ("0,5" / "0.5").
_INT_RE = re.compile(r"-?\d+")
_FRAC_RE = re.compile(r"-?\d+/\d+")
_DEC_RE = re.compile(r"-?\d+[.,]\d+")

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
            "hard → quadratic, triangular, alternating-step, fraction/decimal steps, or multi-rule patterns."
        ),
    )
    correct_answer: str = Field(
        ...,
        min_length=1,
        description=(
            "Exactly 8 terms forming the complete sequence, written as a SEMICOLON-separated "
            "string with NO spaces. Each term is a positive value and may be: "
            "an integer '3;6;9;12;15;18;21;24'; "
            "a fraction 'numerator/denominator' '1/2;1;3/2;2;5/2;3;7/2;4'; "
            "or a Vietnamese decimal using a comma 'X,Y' '0,5;1,0;1,5;2,0;2,5;3,0;3,5;4,0'. "
            "ALWAYS separate the 8 terms with semicolons ';' — the comma is reserved for the "
            "decimal point, never for separating terms. "
            "Pick the term type that fits the lesson and grade: integers for skip-counting and "
            "patterns; fractions (phân số) for grade 4+; decimals (số thập phân) for grade 5+. "
            "Students see only the first 3 terms; they must deduce terms 4-8 one at a time. "
            "Hard / medium sequences should use non-constant differences to challenge deeper reasoning: "
            "Fibonacci '1;1;2;3;5;8;13;21', squares '1;4;9;16;25;36;49;64', "
            "triangle numbers '1;3;6;10;15;21;28;36', "
            "growing gaps '2;4;8;14;22;32;44;58' (differences: +2,+4,+6,+8,+10,+12,+14), "
            "fraction steps '1/4;1/2;3/4;1;5/4;3/2;7/4;2', decimal steps '0,2;0,4;0,6;0,8;1,0;1,2;1,4;1,6'. "
            "Every term must be greater than 0."
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
        # Semicolons are the canonical term separator. Older content (and models that
        # ignore the instruction) comma-separate plain integer sequences like "3,6,9";
        # tolerate that ONLY when no semicolon is present, so a comma is never mistaken
        # for a decimal point in a sequence that actually uses semicolons.
        raw = v.strip()
        sep = ";" if ";" in raw else ","
        parts = [p.strip() for p in raw.split(sep) if p.strip()]
        if len(parts) != 8:
            raise ValueError(
                f"correct_answer must have exactly 8 terms separated by ';', got {len(parts)}: {v!r}"
            )

        canonical: list[str] = []
        for p in parts:
            if _INT_RE.fullmatch(p):
                if int(p) <= 0:
                    raise ValueError(
                        f"All terms must be positive (> 0), got {p!r}. Start the sequence from at least 1."
                    )
                canonical.append(p)
            elif _FRAC_RE.fullmatch(p):
                num, den = (int(x) for x in p.split("/"))
                if den == 0:
                    raise ValueError(f"Fraction denominator cannot be 0: {p!r}.")
                if num <= 0 or den <= 0:
                    raise ValueError(f"Fraction terms must be positive (> 0), got {p!r}.")
                canonical.append(f"{num}/{den}")
            elif _DEC_RE.fullmatch(p):
                # Store decimals in Vietnamese comma form ("0,5") so the curriculum
                # decimal-scope check still recognises them and gates them to grade 5+.
                if float(p.replace(",", ".")) <= 0:
                    raise ValueError(f"Decimal terms must be positive (> 0), got {p!r}.")
                canonical.append(p.replace(".", ","))
            else:
                raise ValueError(
                    f"Each term must be a positive integer ('6'), fraction ('1/4'), or "
                    f"decimal ('0,5'), got {p!r}. Separate the 8 terms with ';'."
                )
        return ";".join(canonical)


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
            "Vary sequence types across levels — never repeat the same step size or pattern type, and mix "
            "term types across the set rather than making every level the same kind. "
            "Whole-number patterns are the backbone (skip-counting, squares, cubes, Fibonacci, triangular, "
            "primes, geometric, growing gaps); for grades that have introduced them, include SOME — at most "
            "about half — fraction or decimal sequences for extra challenge. Never make every level a fraction "
            "or decimal sequence. "
            "For hard difficulty, at least half the levels should use non-arithmetic patterns "
            "(geometric, Fibonacci, quadratic, triangular, alternating-step, primes, or fraction/decimal steps)."
        ),
    )


SPEC = GameSpec(
    id="cat_jump",
    name="Cat Jump",
    description=(
        "MATH ONLY. A cat hops across 8 stepping stones in a river — students identify the "
        "next term in a purely mathematical sequence by choosing from 3 options. Each term may "
        "be an integer, a fraction (1/4), or a decimal (0,5). Each level uses a different pattern. "
        "Difficulty controls complexity: easy uses constant-step skip-counting (hop by 2, 3, 5, 10); "
        "medium adds geometric (×2, ×3), Fibonacci, or triangular numbers; "
        "hard introduces quadratic (n²), alternating step sizes, fraction/decimal steps, or multi-rule patterns. "
        "ONLY suitable for math lessons on number patterns, sequences, fractions, decimals, and mathematical reasoning. "
        "Do NOT use for non-math topics such as vocabulary, history, or science classification."
    ),
    content_type_fit=(
        "number-sequences",
        "number-patterns",
        "skip-counting",
        "arithmetic-sequences",
        "geometric-sequences",
        "fraction-sequences",
        "decimal-sequences",
        "mathematical-reasoning",
        "multiplication-tables",
        "algebra",
    ),
    grade_range=(1, 7),
    content_model=CatJumpContent,
    category="Toán học",
    active=True,
    playable=True,
    min_items=4,
    default_num_items=6,
    sort_order=20,
)
