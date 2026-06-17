"""Shared test fixtures and helpers."""

from __future__ import annotations

import pytest

OBJ = "ls8-phongtrao-canvuong"


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
