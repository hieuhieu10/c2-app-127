"""Generator/validate/repair tests with a mocked LLM."""

from __future__ import annotations

import app.agents.generator as gen
from app.agents.generator import generate_node, repair_node, retrieve_node, validate_node
from tests.conftest import invalid_content, valid_content


def _base_state():
    state = {
        "subject": "Lịch sử",
        "grade": 8,
        "difficulty": "medium",
        "prompt": "Cần Vương",
        "objective_id": "ls8-phongtrao-canvuong",
        "num_items": 3,
        "template_id": "quiz",
    }
    state.update(retrieve_node(state))
    return state


async def test_generate_then_validate_ok(monkeypatch):
    async def fake(*a, **k):
        return valid_content("quiz")

    monkeypatch.setattr(gen, "call_tool", fake)
    state = _base_state()
    state.update(await generate_node(state))
    state.update(validate_node(state))
    assert state["ok"]
    assert state["content"]["template_id"] == "quiz"


async def test_repair_recovers_from_bad_then_good(monkeypatch):
    calls = {"n": 0}

    async def fake(*a, **k):
        calls["n"] += 1
        return invalid_content("quiz") if calls["n"] == 1 else valid_content("quiz")

    monkeypatch.setattr(gen, "call_tool", fake)
    state = _base_state()

    state.update(await generate_node(state))
    state.update(validate_node(state))
    assert not state["ok"]
    assert state["validation_errors"]

    state.update(await repair_node(state))
    state.update(validate_node(state))
    assert state["ok"]
    assert state["repair_attempts"] == 1


def test_retrieve_adopts_objective():
    state = _base_state()
    assert state["context"].objective_id == "ls8-phongtrao-canvuong"
    assert state["context"].misconceptions  # fixtures provide them
