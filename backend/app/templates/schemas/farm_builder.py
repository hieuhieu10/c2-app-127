"""Farm Builder template schema — a shape-drawing geometry puzzle.

The AI generates exactly 3 problems with increasing difficulty. Each problem
asks the student to draw a fence that encloses a specific shape with a given
area constraint.

Shape types (two tiers):
  Standard (lớp 4–5, grid fence mode):
    "hình vuông"    — enclosed cells form a square (W = H)
    "hình chữ nhật" — enclosed cells form a rectangle

  Advanced (lớp 5, hard; vertex mode with diagonal lines):
    "hình bình hành" — parallelogram: 2 pairs of parallel sides (not all right angles)
    "hình thoi"      — rhombus: 4 equal sides, no right angles
    "hình thang"     — trapezoid: exactly 1 pair of parallel sides

Constraint types:
  "diện tích" — enclosed area in grid cells (all shape types)
  "chu vi"    — boundary fence segments (standard shapes only;
                advanced shapes may have irrational perimeters involving √2)

Difficulty progressions:
  Grade 4–5, easy/medium:
    1 (dễ)       — hình vuông    + diện tích  (unique solution, side = √value)
    2 (tb)       — hình chữ nhật + diện tích  (multiple factor-pair solutions)
    3 (khó)      — hình chữ nhật + chu vi     (student derives dimensions)

  Grade 5, hard:
    1 (tb)       — hình bình hành + diện tích  (base × height = value)
    2 (khó)      — hình thang     + diện tích  ((a+b)/2 × h = value)
    3 (khó hơn)  — hình thoi      + diện tích  (d1 × d2 / 2 = value)

Valid area values for advanced shapes (fit in a 10×8 corner-point grid):
  hình bình hành + diện tích : 4–36  (base × height)
  hình thang     + diện tích : 4–36  ((a+b)/2 × h — pick even a+b or even h)
  hình thoi      + diện tích : 4–32  (d1 × d2 / 2 — choose even d1×d2)
"""

from __future__ import annotations

import math
from typing import Literal

from pydantic import BaseModel, Field, model_validator

from ..spec import GameSpec
from .base import GameContentBase

_ADVANCED_SHAPES = frozenset({"hình bình hành", "hình thoi", "hình thang"})


class FarmProblem(BaseModel):
    """One shape-drawing problem."""

    shape_type: Literal[
        "hình vuông",
        "hình chữ nhật",
        "hình bình hành",
        "hình thoi",
        "hình thang",
    ] = Field(
        ...,
        description=(
            "Target shape the student must draw.\n"
            "STANDARD shapes (fence-edge mode, grade 4–5):\n"
            "  'hình vuông'    — square: 4 equal sides, 4 right angles. Use for easy problems.\n"
            "  'hình chữ nhật' — rectangle: 2 pairs of equal sides, 4 right angles.\n"
            "ADVANCED shapes (vertex/diagonal mode, grade 5 hard ONLY):\n"
            "  'hình bình hành' — parallelogram: 2 parallel pairs, no right angles.\n"
            "  'hình thoi'      — rhombus: 4 equal sides, no right angles (not a square).\n"
            "  'hình thang'     — trapezoid: exactly 1 pair of parallel sides.\n"
            "Advanced shapes require constraint='diện tích' only."
        ),
    )
    constraint: Literal["diện tích", "chu vi"] = Field(
        ...,
        description=(
            "'diện tích' — student must enclose exactly VALUE grid cells (area).\n"
            "'chu vi'    — student must use exactly VALUE fence segments (perimeter).\n"
            "IMPORTANT: Advanced shapes (hình bình hành / hình thoi / hình thang) must use\n"
            "'diện tích' only — their perimeters involve irrational lengths (√2, √5 …)."
        ),
    )
    value: int = Field(
        ...,
        ge=4,
        le=60,
        description=(
            "The numeric target (area in grid cells or fence-segment count).\n"
            "Standard shapes:\n"
            "  hình vuông  + diện tích → perfect square ≤ 36: 4, 9, 16, 25, 36\n"
            "  hình vuông  + chu vi    → multiple of 4:        8, 12, 16, 20, 24\n"
            "  hình chữ nhật + diện tích → composite:  6, 8, 10, 12, 15, 16, 18, 20, 24\n"
            "  hình chữ nhật + chu vi  → even ≥ 10:   10, 12, 14, 16, 18, 20\n"
            "Advanced shapes (diện tích only, fit in 9×7 corner grid):\n"
            "  hình bình hành: base × height ∈ {4..36}\n"
            "  hình thang:     (a+b)/2 × h; ensure (a+b)×h is even; range 4–36\n"
            "  hình thoi:      d1 × d2 / 2; ensure d1×d2 is even;   range 4–32"
        ),
    )
    hint: str = Field(
        ...,
        min_length=1,
        description=(
            "Short Vietnamese nudge (1–2 sentences). Don't give the exact answer.\n"
            "Standard: suggest a factor pair or remind the perimeter formula.\n"
            "Advanced: explain how to place the corner dots to get the shape.\n"
            "  hình bình hành: 'Đặt 4 điểm để tạo hình có 2 cặp cạnh đối song song.'\n"
            "  hình thoi:      'Tất cả 4 cạnh phải bằng nhau — thử đặt điểm đối xứng.'\n"
            "  hình thang:     'Đặt 2 điểm ở cùng hàng ngang và 2 điểm lệch sang một phía.'"
        ),
    )
    explanation: str = Field(
        ...,
        min_length=1,
        description=(
            "Post-solve Vietnamese explanation. Show the formula used.\n"
            "Standard: 'Diện tích = 3 × 4 = 12 ô vuông.' / 'Chu vi = 2×(3+4) = 14.'\n"
            "Advanced: explain how area was computed from the shape's dimensions.\n"
            "  hình bình hành: 'Diện tích = đáy × chiều cao = 4 × 3 = 12 ô vuông.'\n"
            "  hình thang: 'Diện tích = (đáy lớn + đáy nhỏ) / 2 × chiều cao = (5+3)/2×3 = 12.'\n"
            "  hình thoi: 'Diện tích = đường chéo 1 × đường chéo 2 / 2 = 4×6/2 = 12.'"
        ),
    )
    objective_id: str = Field(
        ..., min_length=1,
        description="GDPT 2018 learning objective id this problem assesses.",
    )

    @model_validator(mode="after")
    def _check_value_compatibility(self) -> "FarmProblem":
        st, con, v = self.shape_type, self.constraint, self.value

        if st in _ADVANCED_SHAPES:
            if con != "diện tích":
                raise ValueError(
                    f"'{st}' chỉ hỗ trợ constraint='diện tích'. "
                    f"Chu vi của các hình này có thể là số vô tỷ (√2, √5 …). "
                    f"Đặt constraint='diện tích'."
                )
            if v > 40:
                raise ValueError(
                    f"Với '{st}', value ≤ 40 để hình vừa trong lưới 9×7. Got {v}."
                )
        elif st == "hình vuông":
            if con == "diện tích":
                sr = math.isqrt(v)
                if sr * sr != v:
                    raise ValueError(
                        f"hình vuông + diện tích requires a perfect square. "
                        f"{v} is not. Use 4, 9, 16, 25 or 36."
                    )
            else:  # chu vi
                if v % 4 != 0:
                    raise ValueError(
                        f"hình vuông + chu vi requires a multiple of 4. "
                        f"{v} is not. Use 8, 12, 16, 20, 24."
                    )
        else:  # hình chữ nhật
            if con == "chu vi":
                if v % 2 != 0:
                    raise ValueError(
                        f"hình chữ nhật + chu vi requires an even number. "
                        f"{v} is odd. Use 10, 12, 14, 16, 18, 20."
                    )
                if v < 10:
                    raise ValueError(
                        f"hình chữ nhật + chu vi must be ≥ 10. Got {v}."
                    )
        return self


class FarmBuilderContent(GameContentBase):
    """Content envelope for one Farm Builder session — always 3 problems."""

    template_id: Literal["farm_builder"] = "farm_builder"
    instructions: str = Field(
        ...,
        min_length=1,
        description=(
            "One-line Vietnamese instruction shown at the top of the game. "
            "E.g. 'Đặt hàng rào để tạo đúng hình theo yêu cầu!'"
        ),
    )
    problems: list[FarmProblem] = Field(
        ...,
        min_length=3,
        max_length=3,
        description=(
            "Exactly 3 problems in increasing difficulty order.\n\n"
            "Grade 4–5, easy/medium difficulty:\n"
            "  Problem 1 (dễ)  — 'hình vuông'    + 'diện tích'  (one unique answer)\n"
            "  Problem 2 (tb)  — 'hình chữ nhật' + 'diện tích'  (multiple answers)\n"
            "  Problem 3 (khó) — 'hình chữ nhật' + 'chu vi'     (derive dimensions)\n\n"
            "Grade 5, hard difficulty:\n"
            "  Problem 1 (tb)       — 'hình bình hành' + 'diện tích'\n"
            "  Problem 2 (khó)      — 'hình thang'     + 'diện tích'\n"
            "  Problem 3 (khó hơn)  — 'hình thoi'      + 'diện tích'\n\n"
            "All values must fit in a 9×7 fence grid (standard) or 10×8 vertex grid (advanced)."
        ),
    )


SPEC = GameSpec(
    id="farm_builder",
    name="Xây Dựng Trang Trại",
    description=(
        "Hình học tương tác: học sinh vẽ hàng rào / đặt điểm đỉnh trên lưới để tạo đúng hình "
        "theo diện tích hoặc chu vi cho trước. Lớp 4–5: hình vuông & chữ nhật (chế độ hàng rào). "
        "Lớp 5 nâng cao: hình bình hành, hình thoi, hình thang (chế độ đỉnh với đường chéo)."
    ),
    content_type_fit=(
        "area",
        "perimeter",
        "geometry",
        "shapes",
        "rectangles",
        "squares",
        "parallelogram",
        "rhombus",
        "trapezoid",
        "spatial-reasoning",
        "measurement",
        "multiplication",
        "diagonal",
    ),
    grade_range=(4, 8),
    content_model=FarmBuilderContent,
    category="Toán học",
    active=True,
    playable=True,
    min_items=3,
    default_num_items=3,
    sort_order=40,
)
