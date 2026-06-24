"""Beat Forge template schema — a music-based fraction puzzle game.

AI generates three things:
  1. time_signature — the rhythmic container ("4/4", "3/4", "2/4", "6/8")
  2. note_supply    — a limited set of note blocks drawn from six types
  3. lanes          — 2–5 instrument lines with a valid note arrangement each

Student quests:
  1. Choose an instrument for each empty lane (boom / clap / tss / bloop / yeah / pluck)
  2. Fill every lane exactly to the bar's target using only the supplied note blocks

The supply is designed so that every block must be used and each bar sums precisely
to the time-signature target.

── Note types and their 24th-unit values ──────────────────────────────────────
The game uses 24th-units as its internal resolution (LCM of 8ths and triplet-3rds).
1 whole note = 24 units.

  Plain notes
    1/2  → 12 units    (half note)
    1/4  →  6 units    (quarter note)
    1/8  →  3 units    (eighth note)

  Dotted notes  (dot adds half the note's own value)
    d.1/2 → 18 units   (dotted half  = ½ + ¼ = ¾ of a whole)
    d.1/4 →  9 units   (dotted quarter = ¼ + ⅛ = 3/8 of a whole)
    — Best for Grades 4-5: placing a dotted note means the student already
      computed ¼ + ⅛ in their head, and the displayed fraction (3/8) is a
      non-unit fraction, a real conceptual leap.

  Triplet notes  (three fit in the space of one note of the next larger value)
    t.1/8 →  2 units   (triplet eighth = ¼ ÷ 3 = 1/12 of a whole)
    — Grade 5 challenge / "hard mode": breaks the powers-of-two world and
      introduces 12ths. Mixing t.1/8 (1/12) with 1/8 (1/8 = 3/24) forces
      common-denominator thinking (24ths).

Bar capacities in 24th-units:
  4/4 → 24   3/4 → 18   2/4 → 12   6/8 → 18
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from ..spec import GameSpec
from .base import GameContentBase

# Bar capacity in 24th-units.
_SIGS_CAP: dict[str, int] = {"4/4": 24, "3/4": 18, "2/4": 12, "6/8": 18}

# 24th-unit value for each note token.
_NOTE_24: dict[str, int] = {
    "1/2": 12,
    "1/4": 6,
    "1/8": 3,
    "d.1/2": 18,
    "d.1/4": 9,
    "t.1/8": 2,
}

_VALID_NOTE_TOKENS = ", ".join(_NOTE_24.keys())


def _parse_note_24(note: str) -> int:
    """Return the 24th-unit value of a note token ('1/4', 'd.1/4', 't.1/8', …)."""
    key = note.strip()
    if key not in _NOTE_24:
        raise ValueError(
            f"Unsupported note token {note!r}. Allowed: {_VALID_NOTE_TOKENS}"
        )
    return _NOTE_24[key]


class BeatForgeLane(BaseModel):
    """One instrument line with a valid note arrangement.

    The ``correct_answer`` encodes a *suggested* valid arrangement for this lane.
    Any arrangement that exactly fills the bar is accepted in the game; this value
    confirms the puzzle has at least one solution and powers the hint.
    """

    correct_answer: str = Field(
        ...,
        min_length=1,
        description=(
            "A valid note arrangement for this lane as comma-separated note tokens. "
            "Allowed tokens: 1/2, 1/4, 1/8 (plain), d.1/2, d.1/4 (dotted), t.1/8 (triplet eighth). "
            "Each token maps to a 24th-unit value: 1/2=12, 1/4=6, 1/8=3, d.1/4=9, d.1/2=18, t.1/8=2. "
            "The tokens must sum exactly to the bar's time-signature target "
            "(4/4=24, 3/4=18, 2/4=12, 6/8=18). "
            "Examples for 4/4 (target=24): "
            "'1/4,1/4,1/4,1/4' (all quarters, 6×4=24); "
            "'d.1/4,d.1/4,t.1/8,t.1/8,t.1/8' (9+9+2+2+2=24). "
            "Vary rhythm across lanes for musical interest. "
            "Use dotted notes for Grade 4-5 puzzles, triplets for Grade 5 challenge puzzles."
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description=(
            "A short hint nudging the student toward a valid arrangement for this lane. "
            "For lanes with dotted notes, mention the fraction target (e.g., '3/8') and that "
            "a dotted quarter equals ¼ + ⅛. "
            "For lanes with triplet eighths, mention they are 1/12 of a whole note each. "
            "Keep it to one encouraging sentence without giving the exact solution."
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description=(
            "One or two sentences explaining why this rhythm pattern is musically interesting "
            "or how it connects to the lesson objective. "
            "For dotted notes, you can say '3/8 per note gives this lane a lilting, swung feel.' "
            "For triplets, mention the syncopation or swing effect."
        ),
    )
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Id of the linked GDPT 2018 learning objective this lane assesses.",
    )

    @field_validator("correct_answer")
    @classmethod
    def _validate_note_format(cls, v: str) -> str:
        tokens = [t.strip() for t in v.split(",") if t.strip()]
        if not tokens:
            raise ValueError("correct_answer must not be empty")
        for tok in tokens:
            _parse_note_24(tok)
        return ",".join(tokens)


class BeatForgeContent(GameContentBase):
    """Content envelope for one Beat Forge puzzle session."""

    template_id: Literal["beat_forge"] = "beat_forge"

    time_signature: Literal["4/4", "3/4", "2/4", "6/8"] = Field(
        ...,
        description=(
            "The rhythmic time signature for the puzzle. "
            "4/4 is the most common (pop, rock). "
            "3/4 creates a waltz feel. "
            "2/4 is brisk and march-like. "
            "6/8 has a compound, swinging feel. "
            "Choose based on the musical context of the lesson."
        ),
    )

    # ── Note supply (auto-computed from lanes; provide best-effort counts) ──────
    # These fields are overridden server-side by counting tokens in lane
    # correct_answers, so their exact value in the model output doesn't matter.
    # Provide reasonable estimates so the JSON Schema description guides the model
    # toward appropriate note mixes.

    half_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total 1/2 (half) note blocks across all lanes. "
            "Each is worth 12 twenty-fourth-units. "
            "Count how many '1/2' tokens appear in all lanes combined."
        ),
    )
    quarter_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total 1/4 (quarter) note blocks across all lanes. "
            "Each is worth 6 twenty-fourth-units. "
            "Count how many '1/4' tokens appear in all lanes combined."
        ),
    )
    eighth_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total 1/8 (eighth) note blocks across all lanes. "
            "Each is worth 3 twenty-fourth-units. "
            "Count how many '1/8' tokens appear in all lanes combined."
        ),
    )
    dotted_half_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total d.1/2 (dotted half) note blocks across all lanes. "
            "Each is worth 18 twenty-fourth-units. Grade 4-5. "
            "Count how many 'd.1/2' tokens appear in all lanes combined."
        ),
    )
    dotted_quarter_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total d.1/4 (dotted quarter) note blocks across all lanes. "
            "Each is worth 9 twenty-fourth-units (= ¼ + ⅛ = 3/8). Grade 4-5. "
            "Count how many 'd.1/4' tokens appear in all lanes combined."
        ),
    )
    triplet_eighth_notes: int = Field(
        default=0, ge=0,
        description=(
            "Total t.1/8 (triplet eighth) note blocks across all lanes. "
            "Each is worth 2 twenty-fourth-units (= ¼ ÷ 3 = 1/12). Grade 5 challenge. "
            "Count how many 't.1/8' tokens appear in all lanes combined. Always in multiples of 3."
        ),
    )

    lanes: list[BeatForgeLane] = Field(
        ...,
        min_length=2,
        max_length=5,
        description=(
            "The instrument lines in this Beat Forge puzzle. Generate 2–5 lanes. "
            "Keep the time signature constant across all lanes. "
            "For Grade 3 puzzles: use only plain 1/2, 1/4, 1/8 notes. "
            "For Grade 4-5 puzzles: include d.1/4 (dotted quarter) in some lanes. "
            "For Grade 5 challenge: include t.1/8 (triplet eighth) in a lane. "
            "Vary rhythm across lanes. The AI does NOT assign instruments."
        ),
    )

    @model_validator(mode="after")
    def _validate_lanes_and_compute_supply(self) -> "BeatForgeContent":
        """Validate each lane's arithmetic, then auto-compute supply from lanes.

        Supply counts are derived from the actual lane content rather than
        requiring the model to count correctly — the lane arrangements are the
        ground truth; supply is a cached summary of them.
        """
        cap = _SIGS_CAP[self.time_signature]
        supply_counter: dict[str, int] = {k: 0 for k in _NOTE_24}
        lane_errors: list[str] = []

        for i, lane in enumerate(self.lanes):
            tokens = [t.strip() for t in lane.correct_answer.split(",") if t.strip()]
            total = sum(_parse_note_24(t) for t in tokens)
            if total != cap:
                lane_errors.append(
                    f"Lane {i + 1} correct_answer '{lane.correct_answer}' sums to {total} "
                    f"twenty-fourth-units but {self.time_signature} requires exactly {cap}. "
                    "Adjust the note arrangement so all tokens sum to the bar's target."
                )
            else:
                for tok in tokens:
                    supply_counter[tok] += 1

        if lane_errors:
            raise ValueError(
                "One or more lanes have incorrect note arrangements:\n"
                + "\n".join(f"  • {e}" for e in lane_errors)
            )

        # Override model-provided supply with exact counts from the validated lanes.
        self.half_notes = supply_counter["1/2"]
        self.quarter_notes = supply_counter["1/4"]
        self.eighth_notes = supply_counter["1/8"]
        self.dotted_half_notes = supply_counter["d.1/2"]
        self.dotted_quarter_notes = supply_counter["d.1/4"]
        self.triplet_eighth_notes = supply_counter["t.1/8"]
        return self


SPEC = GameSpec(
    id="beat_forge",
    name="Beat Forge",
    description=(
        "A music-based fraction puzzle. AI sets the time signature and gives students a "
        "limited supply of note blocks (half, quarter, eighth — plus dotted and triplet variants "
        "for harder puzzles). Students choose an instrument for each line and fill every bar "
        "exactly using fraction addition — they can only win when every lane sums precisely to "
        "the bar target. Best for fraction arithmetic lessons that benefit from a creative, "
        "audible hook. Works for 2/4, 3/4, 4/4, and 6/8 time. "
        "Dotted notes (d.1/4 = 3/8) suit Grades 4-5; triplet eighths (t.1/8 = 1/12) are a "
        "Grade 5 challenge."
    ),
    content_type_fit=(
        "fractions",
        "fraction-addition",
        "dotted-notes",
        "triplets",
        "music-theory",
        "rhythm",
        "musical-patterns",
        "measurement",
        "number-sense",
        "common-denominators",
    ),
    grade_range=(2, 8),
    content_model=BeatForgeContent,
    active=True,
    playable=True,
    min_items=2,
    default_num_items=3,
    sort_order=30,
)
