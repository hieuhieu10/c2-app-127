"""Schema source-of-truth tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.templates.registry import content_model_for, list_templates
from app.validation.validator import json_schema_for
from tests.conftest import invalid_content, valid_content

ACTIVE = ["quiz", "matching", "fill_in_blank", "treasure_hunt", "battleship", "feed_the_cats", "cat_jump", "beat_forge", "farm_builder"]


@pytest.mark.parametrize("tid", ACTIVE)
def test_valid_content_constructs(tid):
    model = content_model_for(tid)
    obj = model.model_validate(valid_content(tid))
    assert obj.template_id == tid


@pytest.mark.parametrize("tid", ACTIVE)
def test_invalid_content_rejected(tid):
    model = content_model_for(tid)
    with pytest.raises(ValidationError):
        model.model_validate(invalid_content(tid))


@pytest.mark.parametrize("tid", ACTIVE)
def test_json_schema_export(tid):
    schema = json_schema_for(tid)
    assert schema["type"] == "object"
    assert "properties" in schema


def test_registry_active_set():
    assert {m.id for m in list_templates(active_only=True)} == set(ACTIVE)


def _cat_jump_level(seq: str) -> dict:
    return {
        "question": "Dãy số",
        "correct_answer": seq,
        "hint": "Tìm quy luật.",
        "explanation": "Củng cố quy luật dãy số.",
        "objective_id": "OBJ",
    }


@pytest.mark.parametrize(
    "seq, stored",
    [
        ("3;6;9;12;15;18;21;24", "3;6;9;12;15;18;21;24"),    # integers, semicolons
        ("3,6,9,12,15,18,21,24", "3;6;9;12;15;18;21;24"),    # legacy integer CSV
        ("1/4;1/5;1/6;1/7;1/8;1/9;1/10;1/11", "1/4;1/5;1/6;1/7;1/8;1/9;1/10;1/11"),  # fractions
        ("0,1;0,3;0,6;1,0;1,5;2,1;2,8;3,6", "0,1;0,3;0,6;1,0;1,5;2,1;2,8;3,6"),      # VN decimals
        ("0.5;1.0;1.5;2.0;2.5;3.0;3.5;4.0", "0,5;1,0;1,5;2,0;2,5;3,0;3,5;4,0"),      # dot decimals -> comma
    ],
)
def test_cat_jump_accepts_int_fraction_decimal_terms(seq, stored):
    model = content_model_for("cat_jump")
    level = model.model_validate(valid_content("cat_jump")).questions[0]
    level = level.model_validate(_cat_jump_level(seq))
    assert level.correct_answer == stored


@pytest.mark.parametrize(
    "seq",
    [
        "1;2;3",                       # too few terms
        "0;1;2;3;4;5;6;7",             # non-positive term
        "-1/2;1;3/2;2;5/2;3;7/2;4",    # negative fraction
        "1;2;3;4;5;6;7;cat",           # non-numeric term
    ],
)
def test_cat_jump_rejects_malformed_sequences(seq):
    model = content_model_for("cat_jump")
    level_model = type(model.model_validate(valid_content("cat_jump")).questions[0])
    with pytest.raises(ValidationError):
        level_model.model_validate(_cat_jump_level(seq))
