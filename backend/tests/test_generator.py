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


def test_validate_rejects_generated_fake_objective_id():
    state = {
        "subject": "Toán học",
        "grade": 3,
        "difficulty": "medium",
        "prompt": "Tạo câu hỏi phép nhân",
        "objective_id": "math_3_multiplication_repeated_addition",
        "num_items": 1,
        "template_id": "quiz",
        "content": {
            "title": "Bài quiz",
            "objective_id": "MATH_3_DECIMALS",
            "items": [
                {
                    "question": "Có 3 nhóm, mỗi nhóm 4 quả. Có bao nhiêu quả?",
                    "correct_answer": "12",
                    "distractors": ["7", "9"],
                    "hint": "Dùng phép nhân.",
                    "explanation": "3 x 4 = 12.",
                    "objective_id": "MATH_3_DECIMALS",
                }
            ],
        },
    }

    state.update(validate_node(state))
    assert not state["ok"]
    assert any("objective_id" in error for error in state["validation_errors"])


def test_validate_rejects_decimal_content_below_grade_5():
    state = {
        "subject": "Toán học",
        "grade": 3,
        "difficulty": "medium",
        "prompt": "Tạo câu hỏi phép nhân",
        "objective_id": "math_3_multiplication_repeated_addition",
        "num_items": 1,
        "template_id": "quiz",
        "content": {
            "title": "Số thập phân",
            "objective_id": "math_3_multiplication_repeated_addition",
            "items": [
                {
                    "question": "Số nào lớn hơn 0,5?",
                    "correct_answer": "0,6",
                    "distractors": ["0,4", "0,3"],
                    "hint": "So sánh phần thập phân.",
                    "explanation": "0,6 lớn hơn 0,5.",
                    "objective_id": "math_3_multiplication_repeated_addition",
                }
            ],
        },
    }

    state.update(validate_node(state))
    assert not state["ok"]
    assert any("lớp 3" in error for error in state["validation_errors"])


def test_validate_allows_cat_jump_integer_csv_sequences_below_grade_5():
    state = {
        "subject": "Toan",
        "grade": 3,
        "difficulty": "medium",
        "prompt": "Tao game day so",
        "objective_id": "math_3_numbers_100000_rounding_roman",
        "num_items": 4,
        "template_id": "cat_jump",
        "content": {
            "title": "Day so",
            "objective_id": "math_3_numbers_100000_rounding_roman",
            "template_id": "cat_jump",
            "instructions": "Chon so tiep theo.",
            "questions": [
                {
                    "question": "Dem them 3",
                    "correct_answer": "3,6,9,12,15,18,21,24",
                    "hint": "Cong them 3 moi lan.",
                    "explanation": "Day so dung quy tac cong them 3.",
                    "objective_id": "math_3_numbers_100000_rounding_roman",
                },
                {
                    "question": "Dem them 5",
                    "correct_answer": "5,10,15,20,25,30,35,40",
                    "hint": "Cong them 5 moi lan.",
                    "explanation": "Day so dung quy tac cong them 5.",
                    "objective_id": "math_3_numbers_100000_rounding_roman",
                },
                {
                    "question": "Tang dan",
                    "correct_answer": "1,3,6,10,15,21,28,36",
                    "hint": "Khoang cach tang dan.",
                    "explanation": "Day so co khoang cach tang dan.",
                    "objective_id": "math_3_numbers_100000_rounding_roman",
                },
                {
                    "question": "Gap doi",
                    "correct_answer": "1,2,4,8,16,32,64,128",
                    "hint": "Nhan doi moi lan.",
                    "explanation": "Day so dung quy tac gap doi.",
                    "objective_id": "math_3_numbers_100000_rounding_roman",
                },
            ],
        },
    }

    state.update(validate_node(state))
    assert state["ok"]


def test_retrieve_does_not_keep_placeholder_objective_id():
    state = {
        "subject": "Toán học",
        "grade": 3,
        "difficulty": "medium",
        "prompt": "Tạo câu hỏi về phép nhân trong phạm vi 100",
        "objective_id": "string",
        "num_items": 1,
        "template_id": "quiz",
    }
    state.update(retrieve_node(state))
    assert state["objective_id"] != "string"
    assert state["objective_id"]
