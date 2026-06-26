"""Recommender (supervisor) node tests with a mocked LLM."""

from __future__ import annotations

import pytest

import app.agents.recommender as rec
from app.agents.recommender import recommend_games, recommend_node


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
    valid = {c.id for c in rec.candidates_for(8)}
    assert out["template_id"] in valid


async def test_no_templates_for_grade(monkeypatch):
    out = await recommend_node({"grade": 99})
    assert "error" in out


async def test_recommend_games_single_skips_llm(monkeypatch):
    async def boom(*a, **k):  # only one playable game → no LLM call needed
        raise AssertionError("LLM must not be called for a single game")

    only = next(g for g in rec.playable_games() if g.id == "treasure_hunt")
    monkeypatch.setattr(rec, "playable_games", lambda: [only])
    monkeypatch.setattr(rec, "call_tool", boom)
    out = await recommend_games(subject="Toán", grade=4, difficulty="easy", prompt="Bảng cửu chương")
    assert [g["template_id"] for g in out] == ["treasure_hunt"]
    assert out[0]["recommended"] is True
    assert out[0]["intro"]


async def test_recommend_games_offers_all_regardless_of_grade(monkeypatch):
    # A low grade still gets Battleship offered (ranked by the model), not filtered out.
    async def fake(*a, **k):
        return {
            "recommendations": [
                {"template_id": "treasure_hunt", "intro": "Phù hợp tiểu học."},
                {"template_id": "battleship", "intro": "Khó hơn nhưng vẫn dùng được."},
            ]
        }

    monkeypatch.setattr(rec, "call_tool", fake)
    out = await recommend_games(subject="Toán", grade=3, difficulty="easy", prompt="cộng trừ")
    # Model ranked two; omitted games are still appended so every playable game shows.
    ids = {g["template_id"] for g in out}
    assert {"treasure_hunt", "battleship"}.issubset(ids)   # ranked games are present
    assert len(ids) == len({g["template_id"] for g in out})  # no duplicates


async def test_recommend_games_ranks_and_introduces(monkeypatch):
    async def fake(*a, **k):
        return {
            "recommendations": [
                {"template_id": "battleship", "intro": "Trò chơi đối kháng phù hợp ôn tập."},
                {"template_id": "treasure_hunt", "intro": "Đua bản đồ vui nhộn."},
            ]
        }

    monkeypatch.setattr(rec, "call_tool", fake)
    out = await recommend_games(subject="Lịch sử", grade=8, difficulty="medium", prompt="Cần Vương")
    # Model ranked two; omitted games appended after in sort_order.
    ids = [g["template_id"] for g in out]
    assert ids[:2] == ["battleship", "treasure_hunt"]  # ranked games come first in model order
    assert out[0]["recommended"] is True               # top pick flagged
    assert all(not g["recommended"] for g in out[1:])
    assert all(g["intro"] and g["name"] for g in out)


async def test_recommend_games_appends_omitted(monkeypatch):
    async def fake(*a, **k):  # model only ranked one of the two grade-8 games
        return {"recommendations": [{"template_id": "treasure_hunt", "intro": "Đua bản đồ."}]}

    monkeypatch.setattr(rec, "call_tool", fake)
    out = await recommend_games(subject="Lịch sử", grade=8, difficulty="medium", prompt="p")
    ids = [g["template_id"] for g in out]
    # Ranked game comes first; all other playable games are appended.
    assert ids[0] == "treasure_hunt"
    assert len(ids) == len(set(ids))   # no duplicates
