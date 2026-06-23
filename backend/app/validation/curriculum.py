"""Curriculum-aware validation after schema validation."""

from __future__ import annotations

import json
import re
from typing import Any

from app.retrieval.context import RetrievedContext, _norm

_DECIMAL_NUMBER_RE = re.compile(r"(?<!\d)\d+,\d+(?!\d)")
_DECIMAL_SCOPE_TERMS = (
    "so thap phan",
    "phan thap phan",
    "phan nguyen",
    "dau phay",
)


def validate_curriculum_content(
    *,
    content: dict[str, Any],
    expected_objective_id: str | None,
    grade: int,
    context: RetrievedContext | None = None,
) -> list[str]:
    """Check that generated content remains faithful to the retrieved curriculum objective."""
    errors: list[str] = []
    errors.extend(_validate_objective_ids(content, expected_objective_id))
    errors.extend(_validate_primary_decimal_scope(content, grade, context))
    return errors


def _validate_objective_ids(content: dict[str, Any], expected_objective_id: str | None) -> list[str]:
    if not expected_objective_id:
        return ["Khong tim thay objective GDPT hop le de doi chieu noi dung sinh ra."]

    errors: list[str] = []
    top_objective_id = content.get("objective_id")
    if top_objective_id != expected_objective_id:
        errors.append(
            f"content.objective_id phai la '{expected_objective_id}', nhung dang la '{top_objective_id}'."
        )

    for collection_name in ("items", "questions", "blanks"):
        values = content.get(collection_name)
        if not isinstance(values, list):
            continue
        for index, item in enumerate(values, start=1):
            if isinstance(item, dict) and item.get("objective_id") != expected_objective_id:
                errors.append(
                    f"{collection_name}[{index}].objective_id phai la '{expected_objective_id}', "
                    f"nhung dang la '{item.get('objective_id')}'."
                )
    return errors


def _validate_primary_decimal_scope(
    content: dict[str, Any],
    grade: int,
    context: RetrievedContext | None,
) -> list[str]:
    if grade >= 5:
        return []

    text_raw = json.dumps(content, ensure_ascii=False)
    text_norm = _norm(text_raw)
    has_decimal_concept = any(term in text_norm for term in _DECIMAL_SCOPE_TERMS)
    has_decimal_notation = bool(_DECIMAL_NUMBER_RE.search(text_raw))
    if not (has_decimal_concept or has_decimal_notation):
        return []

    objective_text = _norm(context.objective_text if context else "")
    is_natural_number_place_value = "cau tao thap phan" in objective_text and "so tu nhien" in objective_text
    if is_natural_number_place_value and not has_decimal_notation and "so thap phan" not in text_norm:
        return []

    return [
        (
            "Nội dung sinh ra có dấu hiệu số thập phân dạng 0,5/1,25 hoặc phần thập phân, "
            f"nhưng Toán lớp {grade} trong KB chưa cho phép nội dung này. "
            "Hãy điều chỉnh về cấu tạo thập phân của số tự nhiên hoặc chọn lớp 5."
        )
    ]
