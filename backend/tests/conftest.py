"""Shared test fixtures and helpers."""

from __future__ import annotations

import pytest

OBJ = "ls8-phongtrao-canvuong"


@pytest.fixture(autouse=True)
def _allow_guardrail_llm(monkeypatch):
    """Default the guardrail's LLM screen to "allow" so tests never hit the network.

    The deterministic scope/keyword layers still run. Guardrail-specific tests override
    this by patching ``app.agents.guardrail.call_tool`` with their own verdict.
    """
    import app.agents.guardrail as guardrail

    async def _allow(*a, **k):
        return {"verdict": "ok", "reason": "", "suggestion": ""}

    monkeypatch.setattr(guardrail, "call_tool", _allow)


def valid_content(template_id: str) -> dict:
    """A schema-valid content dict for each active template."""
    if template_id == "quiz":
        return {
            "title": "Cần Vương",
            "objective_id": OBJ,
            "items": [
                {
                    "question": "Ai lãnh đạo khởi nghĩa Hương Khê?",
                    "correct_answer": "Phan Đình Phùng",
                    "distractors": ["Nguyễn Thiện Thuật", "Đinh Công Tráng"],
                    "hint": "Cuộc khởi nghĩa tiêu biểu nhất.",
                    "explanation": "Phan Đình Phùng lãnh đạo khởi nghĩa Hương Khê.",
                    "objective_id": OBJ,
                }
            ],
        }
    if template_id == "matching":
        return {
            "title": "Khởi nghĩa và lãnh tụ",
            "objective_id": OBJ,
            "instructions": "Nối cuộc khởi nghĩa với người lãnh đạo.",
            "pairs": [
                {"left": "Hương Khê", "right": "Phan Đình Phùng", "explanation": "..."},
                {"left": "Bãi Sậy", "right": "Nguyễn Thiện Thuật", "explanation": "..."},
                {"left": "Ba Đình", "right": "Đinh Công Tráng", "explanation": "..."},
            ],
            "distractors": ["Hàm Nghi"],
            "hint": "Nhớ lãnh tụ tiêu biểu.",
        }
    if template_id == "fill_in_blank":
        return {
            "title": "Cần Vương",
            "objective_id": OBJ,
            "items": [
                {
                    "text": "Phong trào Cần Vương bùng nổ năm ___.",
                    "answers": ["1885"],
                    "distractors": ["1888", "1896"],
                    "hint": "Năm chiếu Cần Vương.",
                    "explanation": "Chiếu Cần Vương ban năm 1885.",
                    "objective_id": OBJ,
                }
            ],
        }
    if template_id == "battleship":
        q = {
            "question": "Ai lãnh đạo khởi nghĩa Hương Khê?",
            "correct_answer": "Phan Đình Phùng",
            "distractors": ["Nguyễn Thiện Thuật", "Đinh Công Tráng", "Hoàng Hoa Thám"],
            "hint": "Cuộc khởi nghĩa tiêu biểu nhất của phong trào Cần Vương.",
            "explanation": "Phan Đình Phùng lãnh đạo khởi nghĩa Hương Khê (1885–1896).",
            "objective_id": OBJ,
        }
        return {
            "title": "Cần Vương Battleship",
            "objective_id": OBJ,
            "questions": [q] * 9,
        }
    if template_id == "treasure_hunt":
        q = {
            "question": "Ai lãnh đạo khởi nghĩa Hương Khê?",
            "correct_answer": "Phan Đình Phùng",
            "distractors": ["Nguyễn Thiện Thuật", "Đinh Công Tráng", "Hoàng Hoa Thám"],
            "hint": "Cuộc khởi nghĩa tiêu biểu nhất của phong trào Cần Vương.",
            "explanation": "Phan Đình Phùng lãnh đạo khởi nghĩa Hương Khê (1885–1896).",
            "objective_id": OBJ,
        }
        return {
            "title": "Cần Vương Treasure Hunt",
            "objective_id": OBJ,
            "questions": [q] * 4,
        }
    if template_id == "feed_the_cats":
        def treat(question: str, answer: str) -> dict:
            return {
                "question": question,
                "correct_answer": answer,
                "hint": "Tính tổng rồi tìm chú mèo có số đó.",
                "explanation": f"{question} = {answer}.",
                "objective_id": OBJ,
            }

        return {
            "title": "Cho mèo ăn — Phép cộng",
            "objective_id": OBJ,
            "instructions": "Kéo mỗi miếng cá đến chú mèo có số khớp với đáp án.",
            "items": [
                treat("3 + 4", "7"),
                treat("5 + 2", "7"),
                treat("6 + 4", "10"),
                treat("8 + 2", "10"),
                treat("4 + 5", "9"),
                treat("7 + 2", "9"),
            ],
        }
    if template_id == "cat_jump":
        def level(name: str, seq: str) -> dict:
            return {
                "question": name,
                "correct_answer": seq,
                "hint": "Tìm quy luật của dãy số.",
                "explanation": f"Dãy {name.lower()} giúp học sinh nhận biết quy luật số học.",
                "objective_id": OBJ,
            }

        return {
            "title": "Cat Jump — Dãy số",
            "objective_id": OBJ,
            "instructions": "Giúp chú mèo nhảy đúng tảng đá — chọn số tiếp theo trong dãy!",
            "questions": [
                level("Đếm thêm 3", "3,6,9,12,15,18,21,24"),
                level("Đếm thêm 5", "5,10,15,20,25,30,35,40"),
                level("Số bình phương", "1,4,9,16,25,36,49,64"),
                level("Dãy Fibonacci", "1,1,2,3,5,8,13,21"),
            ],
        }
    raise ValueError(template_id)


def invalid_content(template_id: str) -> dict:
    """A content dict that violates the schema (too few distractors)."""
    c = valid_content(template_id)
    if template_id == "quiz" or template_id == "fill_in_blank":
        c["items"][0]["distractors"] = ["only-one"]
    elif template_id == "matching":
        c["pairs"] = c["pairs"][:1]  # below min_length=3
    elif template_id == "battleship":
        c["questions"] = c["questions"][:3]          # below min_length=9
        for q in c["questions"]:
            q["distractors"] = q["distractors"][:2]  # below min_length=3
    elif template_id == "treasure_hunt":
        c["questions"] = c["questions"][:1]          # below min_length=4
        for q in c["questions"]:
            q["distractors"] = q["distractors"][:2]  # below min_length=3
    elif template_id == "feed_the_cats":
        c["items"] = c["items"][:1]                  # below min_length=4
    elif template_id == "cat_jump":
        c["questions"] = c["questions"][:2]          # below min_length=4
    return c


@pytest.fixture
def lesson_payload() -> dict:
    return {
        "subject": "Lịch sử",
        "grade": 8,
        "difficulty": "medium",
        "prompt": "Phong trào Cần Vương",
        "objective_id": OBJ,
        "num_items": 3,
    }
