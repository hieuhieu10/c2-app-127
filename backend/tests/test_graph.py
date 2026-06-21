"""End-to-end graph + HTTP tests with a mocked LLM."""

from __future__ import annotations

import app.agents.generator as gen
import app.agents.recommender as rec
from app.agents.graph import run_workflow
from tests.conftest import invalid_content, valid_content


def _patch_llm(monkeypatch, *, chosen="quiz", gen_fn=None):
    async def fake_rec(*a, **k):
        return {"template_id": chosen, "rationale": "lý do"}

    async def default_gen(*a, **k):
        return valid_content(chosen)

    monkeypatch.setattr(rec, "call_tool", fake_rec)
    monkeypatch.setattr(gen, "call_tool", gen_fn or default_gen)


async def test_full_workflow_success(monkeypatch):
    _patch_llm(monkeypatch, chosen="quiz")
    state = await run_workflow(
        subject="Lịch sử", grade=8, difficulty="medium",
        prompt="Cần Vương", objective_id="ls8-phongtrao-canvuong", num_items=3,
    )
    assert state["ok"]
    assert state["template_id"] == "quiz"
    assert state["content"]["template_id"] == "quiz"
    assert state["rationale"]


async def test_full_workflow_override(monkeypatch):
    # recommend node must NOT call the LLM when overriding.
    async def boom(*a, **k):
        raise AssertionError("recommender LLM called despite override")

    monkeypatch.setattr(rec, "call_tool", boom)

    async def good(*a, **k):
        return valid_content("matching")

    monkeypatch.setattr(gen, "call_tool", good)
    state = await run_workflow(
        subject="Lịch sử", grade=8, difficulty="medium", prompt="ghép",
        objective_id="ls8-phongtrao-canvuong", override_template="matching",
    )
    assert state["ok"]
    assert state["template_id"] == "matching"


async def test_full_workflow_gives_up_on_persistent_invalid(monkeypatch):
    async def always_bad(*a, **k):
        return invalid_content("quiz")

    _patch_llm(monkeypatch, chosen="quiz", gen_fn=always_bad)
    state = await run_workflow(
        subject="Lịch sử", grade=8, difficulty="medium",
        prompt="Cần Vương", objective_id="ls8-phongtrao-canvuong",
    )
    assert not state["ok"]
    assert state["error"]
    assert "schema validation" in state["error"]


def test_http_endpoints(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    _patch_llm(monkeypatch, chosen="quiz")
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}

    templates = client.get("/templates").json()
    assert {t["id"] for t in templates} == {"quiz", "matching", "fill_in_blank", "treasure_hunt", "battleship", "feed_the_cats"}

    payload = {
        "subject": "Lịch sử", "grade": 8, "difficulty": "medium",
        "prompt": "Cần Vương", "objective_id": "ls8-phongtrao-canvuong", "num_items": 3,
    }
    r = client.post("/generate/full", json=payload)
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True
    assert body["content"]["template_id"] == "quiz"

    # Malformed request -> clean 422, never a 500.
    bad = client.post("/generate/full", json={"subject": "x"})
    assert bad.status_code == 422
