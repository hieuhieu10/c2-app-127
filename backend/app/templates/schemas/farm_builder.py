"""Farm Builder template schema — a fence-drawing geometry puzzle.

Players place fence segments on a grid to enclose exactly the target number of
squares. Earning stars by minimising perimeter teaches that compact (rectangular)
shapes are more efficient than long, thin ones for the same area.

The shell is fully procedural. The AI supplies a sequence of *challenges*, each
specifying a target area, a spatial-reasoning hint, and a perimeter explanation.
No MCQ distractors are needed.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from ..spec import GameSpec
from .base import GameContentBase


class FarmBuilderChallenge(BaseModel):
    """One fence-drawing puzzle level."""

    target_area: int = Field(
        ...,
        ge=4,
        le=40,
        description=(
            "Number of grid squares the student must enclose. "
            "Prefer values with nice factor pairs (6, 8, 9, 12, 15, 16, 20, 24) "
            "so students can discover compact rectangle solutions. "
            "Increase difficulty across challenges."
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description=(
            "Short spatial-reasoning nudge in Vietnamese, e.g. "
            "'Hãy thử hình chữ nhật 3×4 — đó là 12 ô vuông!' "
            "Keep it concise and encouraging."
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description=(
            "Brief mathematical explanation in Vietnamese of why a compact shape "
            "minimises perimeter for this area, tied to the lesson objective. "
            "E.g. 'Hình 3×4 cần chu vi 14, ít hơn hình 1×12 cần chu vi 26 — cùng "
            "diện tích nhưng gọn hơn nhiều.'"
        ),
    )
    objective_id: str = Field(
        ...,
        min_length=1,
        description="Id of the linked GDPT 2018 learning objective this challenge assesses.",
    )


class FarmBuilderContent(GameContentBase):
    """Content envelope for one Farm Builder session."""

    template_id: Literal["farm_builder"] = "farm_builder"
    instructions: str = Field(
        ...,
        min_length=1,
        description=(
            "One-line Vietnamese instruction shown to the student, e.g. "
            "'Đặt hàng rào để quây đúng số ô vuông được chỉ định. "
            "Hình gọn hơn sẽ nhận được nhiều sao hơn!'"
        ),
    )
    challenges: list[FarmBuilderChallenge] = Field(
        ...,
        min_length=3,
        max_length=8,
        description=(
            "Ordered puzzle challenges. Start with a small, easily factorable area "
            "(e.g. 6 or 8) and increase difficulty. Vary target areas so each "
            "challenge teaches a new insight about compact shapes and the "
            "area-perimeter relationship."
        ),
    )


SPEC = GameSpec(
    id="farm_builder",
    name="Xây Dựng Trang Trại",
    description=(
        "Đố hình học: vẽ hàng rào trên lưới để quây đúng diện tích yêu cầu. "
        "Hình gọn hơn nhận được nhiều sao hơn, dạy học sinh rằng hình chữ nhật "
        "có chu vi nhỏ nhất cho cùng diện tích. "
        "Phù hợp nhất cho lớp 4-8, diện tích, chu vi, thừa số, tư duy không gian."
    ),
    content_type_fit=(
        "area",
        "perimeter",
        "geometry",
        "multiplication",
        "factors",
        "spatial-reasoning",
        "shapes",
        "rectangles",
    ),
    grade_range=(4, 8),
    content_model=FarmBuilderContent,
    active=True,
    playable=True,
    min_items=3,
    default_num_items=5,
    sort_order=40,
)
