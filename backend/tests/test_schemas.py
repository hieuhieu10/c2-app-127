"""Schema source-of-truth tests."""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.templates.registry import content_model_for, list_templates
from app.validation.validator import json_schema_for
from tests.conftest import invalid_content, valid_content

ACTIVE = ["quiz", "matching", "fill_in_blank", "treasure_hunt", "battleship", "feed_the_cats", "cat_jump"]


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
