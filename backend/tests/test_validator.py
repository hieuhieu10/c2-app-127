"""Validation gate tests."""

from __future__ import annotations

import pytest

from app.validation.validator import validate
from tests.conftest import invalid_content, valid_content

ACTIVE = ["quiz", "matching", "fill_in_blank"]


@pytest.mark.parametrize("tid", ACTIVE)
def test_valid_passes(tid):
    res = validate(tid, valid_content(tid))
    assert res.ok
    assert res.content is not None
    assert res.errors == []


@pytest.mark.parametrize("tid", ACTIVE)
def test_invalid_fails_with_errors(tid):
    res = validate(tid, invalid_content(tid))
    assert not res.ok
    assert res.errors  # non-empty, human-readable


def test_unknown_template():
    res = validate("does_not_exist", {})
    assert not res.ok
    assert "unknown template_id" in res.errors[0]
