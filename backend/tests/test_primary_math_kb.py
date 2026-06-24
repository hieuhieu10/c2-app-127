"""Integrity checks for the primary Mathematics GDPT 2018 KB."""

from __future__ import annotations

from app.retrieval.context import GDPT2018RetrievalProvider


def test_primary_math_kb_covers_grades_1_to_5():
    provider = GDPT2018RetrievalProvider()
    objectives = provider._objectives  # intentional integrity check of file-backed data

    grades = {obj["grade"] for obj in objectives if obj.get("subject") == "Toán"}
    assert {1, 2, 3, 4, 5}.issubset(grades)
    assert len([obj for obj in objectives if obj.get("subject") == "Toán" and 1 <= obj["grade"] <= 5]) >= 32


def test_primary_math_objectives_have_required_fields():
    provider = GDPT2018RetrievalProvider()
    seen: set[str] = set()
    required = {
        "objective_id",
        "subject",
        "grade",
        "topic",
        "objective_text",
        "cognitive_level",
        "difficulty_band",
        "allowed_difficulty_range",
        "required_skills",
        "prerequisites",
        "grade_scope",
        "complexity_signals",
        "recommended_question_types",
        "misconceptions",
        "scope_policy",
        "grounding_passages",
    }

    for obj in provider._objectives:
        if obj.get("subject") != "Toán" or not (1 <= obj.get("grade", 0) <= 5):
            continue
        assert required.issubset(obj.keys())
        assert obj["objective_id"] not in seen
        seen.add(obj["objective_id"])
        assert obj["allowed_difficulty_range"]
        assert obj["recommended_question_types"]
        assert obj["search_aliases"]
        assert obj["scope_policy"]["not_allowed"]


def test_retrieval_matches_representative_primary_math_topics():
    provider = GDPT2018RetrievalProvider()

    cases = [
        (1, "Tao game dem va so sanh cac so trong pham vi 100", "math_1_count_compare_numbers_100"),
        (2, "Tao game ve so co ba chu so tram chuc don vi", "math_2_numbers_1000_place_value"),
        (3, "Tao game chia deu 12 cai keo cho 3 ban", "math_3_division_equal_sharing"),
        (3, "Tạo 5 bài toán đố về phép nhân và phép chia trong phạm vi 100", "math_3_multiplication_division_within_100"),
        (4, "Tao game ve phan so va so sanh phan so", "math_4_fractions_intro"),
        (4, "Tạo câu hỏi đo lường về cột cờ cao 6m", "math_4_measurement_units_area_mass"),
        (4, "Chỉ tạo câu hỏi về đơn vị đo lường, không thống kê, không biểu đồ cột", "math_4_measurement_units_area_mass"),
        (5, "Tạo game về tỉ số phần trăm và giảm giá", "math_5_percent_ratio"),
    ]

    for grade, prompt, expected_id in cases:
        ctx = provider.retrieve(subject="Toan", grade=grade, objective_id=None, prompt=prompt)
        assert ctx.objective_id == expected_id
        assert ctx.curriculum_context is not None
        assert ctx.curriculum_context.scope_status in {"in_scope", "above_grade"}
