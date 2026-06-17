"""Repair curated primary math KB entries and mirror them to backend data.

The data values below intentionally use Python unicode escapes so this script
stays ASCII-only and cannot be corrupted by a Windows console codepage.
"""

from __future__ import annotations

import json
import shutil
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
KB = ROOT / "knowledge_base" / "gdpt_2018" / "math"
BACKEND = ROOT / "backend" / "data" / "gdpt_2018" / "math"


def u(value: str) -> str:
    return value.encode("ascii").decode("unicode_escape")


PREREQUISITES: dict[str, list[str]] = {
    "math_1_measurement_time_cm": [
        u("\\u0110\\u1ebfm v\\u00e0 \\u0111\\u1ecdc s\\u1ed1 trong ph\\u1ea1m vi 100"),
        u("Nh\\u1eadn bi\\u1ebft d\\u00e0i h\\u01a1n v\\u00e0 ng\\u1eafn h\\u01a1n qua v\\u1eadt th\\u1eadt"),
    ],
    "math_2_geometry_lines_shapes_solids": [
        u("Nh\\u1eadn bi\\u1ebft h\\u00ecnh vu\\u00f4ng, h\\u00ecnh tr\\u00f2n, h\\u00ecnh tam gi\\u00e1c, h\\u00ecnh ch\\u1eef nh\\u1eadt"),
        u("Bi\\u1ebft \\u0111o \\u0111\\u1ed9 d\\u00e0i b\\u1eb1ng cm"),
    ],
    "math_2_statistics_probability_picture_chart": [
        u("\\u0110\\u1ebfm v\\u00e0 so s\\u00e1nh s\\u1ed1 trong ph\\u1ea1m vi 1000"),
        u("\\u0110\\u1ecdc th\\u00f4ng tin t\\u1eeb tranh \\u0111\\u01a1n gi\\u1ea3n"),
    ],
    "math_3_numbers_100000_rounding_roman": [
        u("Bi\\u1ebft s\\u1ed1 \\u0111\\u1ebfn 1000"),
        u("Hi\\u1ec3u h\\u00e0ng tr\\u0103m, ch\\u1ee5c, \\u0111\\u01a1n v\\u1ecb"),
    ],
    "math_3_multiplication_division_within_100": [
        u("Hi\\u1ec3u \\u00fd ngh\\u0129a ph\\u00e9p nh\\u00e2n v\\u00e0 ph\\u00e9p chia"),
        u("Bi\\u1ebft c\\u00e1c b\\u1ea3ng nh\\u00e2n, chia c\\u01a1 b\\u1ea3n"),
    ],
    "math_3_expressions_unknowns_word_problems": [
        u("Bi\\u1ebft b\\u1ed1n ph\\u00e9p t\\u00ednh c\\u01a1 b\\u1ea3n"),
        u("Hi\\u1ec3u th\\u1ee9 t\\u1ef1 th\\u1ef1c hi\\u1ec7n \\u0111\\u01a1n gi\\u1ea3n"),
    ],
    "math_3_statistics_probability_table_simple": [
        u("Bi\\u1ebft \\u0111\\u1ecdc s\\u1ed1 v\\u00e0 so s\\u00e1nh s\\u1ed1"),
        u("\\u0110\\u00e3 l\\u00e0m quen bi\\u1ec3u \\u0111\\u1ed3 tranh l\\u1edbp 2"),
    ],
    "math_4_rounding_natural_numbers_million": [
        u("Bi\\u1ebft s\\u1ed1 \\u0111\\u1ebfn 100000"),
        u("Hi\\u1ec3u c\\u1ea5u t\\u1ea1o th\\u1eadp ph\\u00e2n"),
    ],
    "math_4_fraction_operations_basic": [
        u("L\\u00e0m quen ph\\u00e2n s\\u1ed1 l\\u1edbp 3"),
        u("Bi\\u1ebft chia ph\\u1ea7n b\\u1eb1ng nhau"),
    ],
    "math_4_measurement_units_area_mass": [
        u("Bi\\u1ebft \\u0111\\u01a1n v\\u1ecb \\u0111o \\u0111\\u1ed9 d\\u00e0i, kh\\u1ed1i l\\u01b0\\u1ee3ng, dung t\\u00edch l\\u1edbp 3"),
        u("Bi\\u1ebft nh\\u00e2n chia c\\u01a1 b\\u1ea3n"),
    ],
    "math_5_natural_numbers_review_dependency": [
        u("B\\u1ed1n ph\\u00e9p t\\u00ednh v\\u1edbi s\\u1ed1 t\\u1ef1 nhi\\u00ean"),
        u("B\\u00e0i to\\u00e1n c\\u00f3 l\\u1eddi v\\u0103n l\\u1edbp 4"),
    ],
    "math_5_fractions_review_operations": [
        u("Ph\\u00e2n s\\u1ed1 l\\u1edbp 4"),
        u("B\\u1ed1n ph\\u00e9p t\\u00ednh v\\u1edbi ph\\u00e2n s\\u1ed1 \\u0111\\u01a1n gi\\u1ea3n"),
    ],
}


def has_question_mark(value: Any) -> bool:
    if isinstance(value, str):
        return "?" in value
    if isinstance(value, list):
        return any(has_question_mark(item) for item in value)
    if isinstance(value, dict):
        return any(has_question_mark(item) for item in value.values())
    return False


def clean_terms(obj: dict[str, Any]) -> list[str]:
    terms = [obj.get("topic", "")]
    terms.extend(obj.get("search_aliases", []))
    clean: list[str] = []
    for term in terms:
        if isinstance(term, str) and term and "?" not in term and term not in clean:
            clean.append(term)
    return clean[:6]


def clean_scope_policy(obj: dict[str, Any]) -> dict[str, Any]:
    policy = dict(obj.get("scope_policy") or {})
    policy["in_scope"] = clean_terms(obj)
    policy["not_allowed"] = [
        u("n\\u1ed9i dung v\\u01b0\\u1ee3t ph\\u1ea1m vi l\\u1edbp ") + str(obj.get("grade", "")),
        u("ki\\u1ebfn th\\u1ee9c ch\\u01b0a c\\u00f3 trong m\\u1ee5c ti\\u00eau n\\u00e0y"),
    ]
    return policy


def clean_misconceptions(obj: dict[str, Any]) -> list[dict[str, str]]:
    topic = obj.get("topic") or u("n\\u1ed9i dung n\\u00e0y")
    return [
        {
            "misconception": u("H\\u1ecdc sinh nh\\u1ea7m l\\u1eabn khi v\\u1eadn d\\u1ee5ng ") + topic + ".",
            "correct_concept": u("C\\u1ea7n b\\u00e1m s\\u00e1t y\\u00eau c\\u1ea7u c\\u1ea7n \\u0111\\u1ea1t v\\u00e0 d\\u00f9ng v\\u00ed d\\u1ee5 ph\\u00f9 h\\u1ee3p l\\u1edbp ") + str(obj.get("grade", "")) + ".",
        }
    ]


def clean_default_examples(obj: dict[str, Any]) -> list[dict[str, Any]]:
    topic = obj.get("topic") or u("n\\u1ed9i dung b\\u00e0i h\\u1ecdc")
    return [
        {
            "raw_text": u("V\\u00ed d\\u1ee5 ph\\u00f9 h\\u1ee3p v\\u1edbi ") + topic,
            "structured": {"topic": topic},
        }
    ]


def repair_obj(obj: dict[str, Any]) -> None:
    if obj["objective_id"] not in PREREQUISITES:
        return
    obj["subject"] = u("To\\u00e1n")
    obj["subject_display"] = u("To\\u00e1n")
    obj["language"] = "vi"
    obj["source_ref"] = "source_documents/toan1-5.pdf; source_documents/GDPT_2018.md"
    obj["prerequisites"] = PREREQUISITES[obj["objective_id"]]
    if has_question_mark(obj.get("misconceptions")):
        obj["misconceptions"] = clean_misconceptions(obj)
    if has_question_mark(obj.get("scope_policy")):
        obj["scope_policy"] = clean_scope_policy(obj)
    if has_question_mark(obj.get("default_examples")):
        obj["default_examples"] = clean_default_examples(obj)


def repair_file(path: Path) -> None:
    data = json.loads(path.read_text(encoding="utf-8"))
    for obj in data:
        repair_obj(obj)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    for grade in range(1, 6):
        src = KB / f"grade_{grade}" / "objectives.json"
        repair_file(src)
        dst_dir = BACKEND / f"grade_{grade}"
        dst_dir.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, dst_dir / "objectives.json")


if __name__ == "__main__":
    main()
