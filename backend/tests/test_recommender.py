"""Recommender (supervisor) node tests with a mocked LLM."""

from __future__ import annotations

import pytest

import app.agents.recommender as rec
from app.agents.recommender import recommend_node


async def test_override_skips_llm(monkeypatch):
    async def boom(*a, **k):  # would fail if called
        raise AssertionError("LLM must not be called on override")

    monkeypatch.setattr(rec, "call_tool", boom)
    out = await recommend_node({"grade": 8, "override_template": "quiz"})
    assert out["template_id"] == "quiz"


async def test_llm_choice(monkeypatch):
    async def fake(*a, **k):
        return {"template_id": "matching", "rationale": "phù hợp ghép cặp"}

    monkeypatch.setattr(rec, "call_tool", fake)
    out = await recommend_node(
        {"subject": "Lịch sử", "grade": 8, "difficulty": "medium", "prompt": "ghép lãnh tụ"}
    )
    assert out["template_id"] == "matching"
    assert out["rationale"]


async def test_llm_invalid_choice_falls_back(monkeypatch):
    async def fake(*a, **k):
        return {"template_id": "not_a_template", "rationale": "x"}

    monkeypatch.setattr(rec, "call_tool", fake)
    out = await recommend_node(
        {"subject": "Lịch sử", "grade": 8, "difficulty": "medium", "prompt": "p"}
    )
    # Falls back to a real candidate rather than propagating a bad id.
    assert out["template_id"] in {"quiz", "matching", "fill_in_blank"}


async def test_no_templates_for_grade(monkeypatch):
    out = await recommend_node({"grade": 99})
    assert "error" in out
