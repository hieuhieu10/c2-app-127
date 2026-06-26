"""Guardrail tests: out-of-scope, irrelevant/above-grade, and unsafe requests."""

from __future__ import annotations

import app.agents.guardrail as guardrail
from app.agents.guardrail import run_guardrails


def _patch_llm(monkeypatch, *, verdict="ok", reason="lý do", suggestion="gợi ý"):
    async def fake(*a, **k):
        return {"verdict": verdict, "reason": reason, "suggestion": suggestion}

    monkeypatch.setattr(guardrail, "call_tool", fake)


# ── Case 1: out of scope (deterministic, no LLM) ─────────────────────────────


async def test_unsupported_subject_blocked(monkeypatch):
    _patch_llm(monkeypatch)  # would allow, but scope check fires first
    report = await run_guardrails(subject="Hóa học", grade=10, prompt="phản ứng oxi hóa khử")
    assert not report.allowed
    assert report.code == "out_of_scope_subject"
    assert report.suggestion  # tells the teacher how to re-prompt


async def test_unsupported_grade_blocked(monkeypatch):
    _patch_llm(monkeypatch)
    # Toán is covered for grades 1-5; grade 9 is out of scope.
    report = await run_guardrails(subject="Toán", grade=9, prompt="đạo hàm")
    assert not report.allowed
    assert report.code == "out_of_scope_grade"


async def test_supported_subject_grade_passes_scope(monkeypatch):
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán", grade=3, prompt="phép nhân")
    assert report.allowed
    assert report.code == "ok"


def test_llm_screen_prompt_disambiguates_vietnamese_language_from_subject():
    assert "does NOT mean the subject is Vietnamese Language" in guardrail._SCREEN_SYSTEM
    assert "subject authority" in guardrail._SCREEN_SYSTEM
    assert "Môn: Toán" in guardrail._SCREEN_SYSTEM


# ── Case 2: irrelevant / above grade (LLM screen) ────────────────────────────


async def test_irrelevant_prompt_blocked(monkeypatch):
    _patch_llm(monkeypatch, verdict="irrelevant")
    report = await run_guardrails(subject="Toán", grade=3, prompt="kể chuyện lịch sử Hai Bà Trưng")
    assert not report.allowed
    assert report.code == "irrelevant"


async def test_above_grade_prompt_blocked(monkeypatch):
    _patch_llm(monkeypatch, verdict="above_grade")
    report = await run_guardrails(subject="Toán", grade=2, prompt="giải phương trình bậc hai")
    assert not report.allowed
    assert report.code == "above_grade"


async def test_primary_decimal_request_below_grade_5_blocked(monkeypatch):
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán học", grade=3, prompt="Tạo câu hỏi so sánh số thập phân 0,5 và 1,25")
    assert not report.allowed
    assert report.code == "above_grade"
    assert "lớp 5" in report.message


async def test_decimal_place_value_wording_for_grade_3_is_allowed(monkeypatch):
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán học", grade=3, prompt="Tạo game về cấu tạo thập phân của số tự nhiên")
    assert report.allowed


async def test_fraction_request_below_grade_4_blocked(monkeypatch):
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán", grade=3, prompt="Tạo quiz về phân số 3/5, tử số và mẫu số")
    assert not report.allowed
    assert report.code == "above_grade"
    assert "lớp 4" in report.message


async def test_percent_request_below_grade_5_blocked(monkeypatch):
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán", grade=4, prompt="Tạo câu hỏi về tỉ số phần trăm và 25%")
    assert not report.allowed
    assert report.code == "above_grade"
    assert "lớp 5" in report.message


# ── Case 3: not child-friendly ───────────────────────────────────────────────


async def test_unsafe_keyword_blocked_without_llm(monkeypatch):
    # Keyword screen must fire even if the LLM would allow.
    _patch_llm(monkeypatch, verdict="ok")
    report = await run_guardrails(subject="Toán", grade=4, prompt="bài toán về ma túy và cá độ")
    assert not report.allowed
    assert report.code == "unsafe"


async def test_unsafe_via_llm(monkeypatch):
    _patch_llm(monkeypatch, verdict="unsafe")
    report = await run_guardrails(subject="Toán", grade=4, prompt="nội dung bạo lực không phù hợp")
    assert not report.allowed
    assert report.code == "unsafe"


# ── Fail-open behaviour ──────────────────────────────────────────────────────


async def test_llm_error_fails_open(monkeypatch):
    async def boom(*a, **k):
        raise RuntimeError("provider down")

    monkeypatch.setattr(guardrail, "call_tool", boom)
    # Scope + keyword pass; LLM raises -> request is allowed (deterministic layers cover hard cases).
    report = await run_guardrails(subject="Toán", grade=3, prompt="phép nhân")
    assert report.allowed


# ── HTTP surface ─────────────────────────────────────────────────────────────


def test_recommend_games_block_returns_inline_payload(monkeypatch):
    from fastapi.testclient import TestClient

    from app.main import app

    client = TestClient(app)
    resp = client.post(
        "/recommend/games",
        json={"subject": "Hóa học", "grade": 11, "difficulty": "medium", "prompt": "oxi hóa khử"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["blocked"] is True
    assert body["message"] and body["suggestion"]
    assert body["recommendations"] == []
