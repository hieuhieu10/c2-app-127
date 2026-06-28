"""Prompt/schema guidance tests for primary-friendly generated content."""

from __future__ import annotations

from app.agents.prompts import build_generator_user
from app.retrieval.context import GDPT2018RetrievalProvider
from app.templates.registry import get_template
from app.validation.validator import json_schema_for


def test_matching_prompt_includes_card_label_guidance():
    ctx = GDPT2018RetrievalProvider().retrieve(
        subject="Toán",
        grade=3,
        objective_id="math_3_multiplication_repeated_addition",
        prompt="Tạo game nối phép nhân với phép cộng lặp",
        source_text="Ví dụ: 3 giỏ táo, mỗi giỏ 4 quả\nHoạt động 10 phút cuối giờ",
        upload_type="slide",
        teacher_requested_difficulty="medium",
    )
    prompt = build_generator_user(
        subject="Toán",
        grade=3,
        difficulty="medium",
        prompt="Tạo game nối phép nhân với phép cộng lặp",
        num_items=5,
        template=get_template("matching"),
        ctx=ctx,
    )

    assert "Matching-specific output rules" in prompt
    assert "short card labels" in prompt
    assert "3 giỏ táo" in prompt
    assert "do not call it picture matching unless images are present" in prompt


def test_matching_schema_describes_short_card_labels():
    schema = json_schema_for("matching")
    pair_ref = schema["properties"]["pairs"]["items"]["$ref"]
    pair_def_name = pair_ref.rsplit("/", 1)[-1]
    pair_props = schema["$defs"][pair_def_name]["properties"]

    assert "Short left-side card label" in pair_props["left"]["description"]
    assert "Short correct right-side card label" in pair_props["right"]["description"]
    assert "Do not write long explanations" in schema["properties"]["distractors"]["description"]


def test_hard_prompt_includes_generic_curriculum_difficulty_guidance():
    ctx = GDPT2018RetrievalProvider().retrieve(
        subject="Toan",
        grade=3,
        objective_id="math_3_numbers_100000_rounding_roman",
        prompt="Bai 01: On tap cac so den 1000 T1 trang 6 tao game",
        source_text="Doc, viet, xep thu tu cac so den 1000. Phan tich so co ba chu so.",
        upload_type="lesson_plan",
        teacher_requested_difficulty="hard",
    )
    prompt = build_generator_user(
        subject="Toan",
        grade=3,
        difficulty="hard",
        prompt="Bai 01: On tap cac so den 1000 T1 trang 6 tao game",
        num_items=9,
        template=get_template("feed_the_cats"),
        ctx=ctx,
    )

    assert "Difficulty-specific generation rules" in prompt
    assert "Teacher selected: hard; curriculum-safe final level: medium." in prompt
    assert "upper end of the allowed GDPT range" in prompt
    assert "Use these objective skills as the difficulty source" in prompt
    assert "one meaningful reasoning step" in prompt
    assert "same shallow pattern" in prompt
    assert "Feed the Hungry Cats at medium/hard" not in prompt


def test_repair_prompt_uses_generic_schema_strategy_not_game_hardcode():
    ctx = GDPT2018RetrievalProvider().retrieve(
        subject="Toan",
        grade=3,
        objective_id="math_3_numbers_100000_rounding_roman",
        prompt="Tao game on tap so den 1000",
        source_text="Doc, viet, so sanh cac so den 1000.",
        upload_type="lesson_plan",
        teacher_requested_difficulty="medium",
    )
    prompt = build_generator_user(
        subject="Toan",
        grade=3,
        difficulty="medium",
        prompt="Tao game on tap so den 1000",
        num_items=8,
        template=get_template("feed_the_cats"),
        ctx=ctx,
        repair_errors=["<root>: Value error, each cat needs at least 2 treats; too few for: 54, 6, 7, 8"],
    )

    assert "Schema repair strategy" in prompt
    assert "validation errors as hard constraints" in prompt
    assert "collection/model-level invariant" in prompt
    assert "rebuild the affected collection from scratch" in prompt
    assert "manual consistency check" in prompt
    assert "Plan exactly 3 distinct numeric cat labels first" not in prompt
    assert "Feed the Hungry Cats repair checklist" not in prompt
    assert "Choose exactly 3 numeric answers" not in prompt
