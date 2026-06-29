"""End-to-end graph + HTTP tests with a mocked LLM."""

from __future__ import annotations

import app.agents.generator as gen
import app.agents.recommender as rec
from app.agents.graph import run_workflow
from app.retrieval.context import RetrievedContext
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
    assert "Không thể tạo nội dung hợp lệ" in state["error"]


async def test_full_workflow_survives_llm_generation_failure(monkeypatch):
    """A timeout / no-tool-call from the LLM must not crash the graph; it should
    route through the repair loop and finish with a clean teacher-facing error."""
    import asyncio

    calls = {"n": 0}

    async def always_timeout(*a, **k):
        calls["n"] += 1
        raise asyncio.TimeoutError

    _patch_llm(monkeypatch, chosen="quiz", gen_fn=always_timeout)
    state = await run_workflow(
        subject="Lịch sử", grade=8, difficulty="medium",
        prompt="Cần Vương", objective_id="ls8-phongtrao-canvuong",
    )
    assert not state["ok"]
    assert state["error"]
    assert "timeout" in state["error"].lower()
    # 1 generate + MAX_REPAIRS retries — the failure was retried, not fatal.
    assert calls["n"] >= 2


async def test_full_workflow_recovers_after_transient_llm_failure(monkeypatch):
    """First attempt throws, a retry succeeds — the workflow should still produce content."""
    import asyncio

    calls = {"n": 0}

    async def flaky(*a, **k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise RuntimeError("Model returned no tool call for tool 'emit_game_content'.")
        return valid_content("quiz")

    _patch_llm(monkeypatch, chosen="quiz", gen_fn=flaky)
    state = await run_workflow(
        subject="Lịch sử", grade=8, difficulty="medium",
        prompt="Cần Vương", objective_id="ls8-phongtrao-canvuong", num_items=3,
    )
    assert state["ok"]
    assert state["content"]["template_id"] == "quiz"
    assert calls["n"] == 2


async def test_full_workflow_stops_when_objective_missing(monkeypatch):
    class MissingObjectiveProvider:
        def retrieve(self, **kwargs):
            return RetrievedContext(objective_id="", matched_confidence=0.0)

    async def boom(*a, **k):
        raise AssertionError("LLM should not be called when retrieval cannot resolve an objective")

    monkeypatch.setattr(gen, "default_provider", MissingObjectiveProvider())
    monkeypatch.setattr(rec, "call_tool", boom)
    monkeypatch.setattr(gen, "call_tool", boom)

    state = await run_workflow(
        subject="Toán", grade=3, difficulty="medium",
        prompt="Tạo một game thật vui cho lớp học",
    )
    assert not state["ok"]
    assert state["error"]
    assert "Không tìm thấy yêu cầu cần đạt" in state["error"]
    assert state["content"] is None


def test_http_endpoints(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    _patch_llm(monkeypatch, chosen="quiz")
    client = TestClient(app)

    assert client.get("/health").json() == {"status": "ok"}

    templates = client.get("/templates").json()
    assert {t["id"] for t in templates} >= {"quiz", "matching", "fill_in_blank", "treasure_hunt", "battleship", "feed_the_cats", "farm_builder"}

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
