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
