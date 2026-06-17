"""GDPT 2018 retrieval + teacher-context tests."""

from __future__ import annotations

from app.retrieval.context import GDPT2018RetrievalProvider


def test_math_grade_3_retrieval_without_upload():
    provider = GDPT2018RetrievalProvider()
    ctx = provider.retrieve(
        subject="Toan",
        grade=3,
        objective_id=None,
        prompt="Tao game ve phep nhan la phep cong lap",
        teacher_requested_difficulty="medium",
    )

    assert ctx.objective_id == "math_3_multiplication_repeated_addition"
    assert ctx.curriculum_context is not None
    assert ctx.curriculum_context.scope_status == "in_scope"
    assert ctx.teacher_lesson_context is not None
    assert ctx.teacher_lesson_context.upload_type == "none"
    assert ctx.difficulty_assessment is not None
    assert ctx.difficulty_assessment.final_difficulty in {"easy", "medium"}


def test_math_grade_3_retrieval_with_slide_context():
    provider = GDPT2018RetrievalProvider()
    slide_text = "\n".join(
        [
            "Phep nhan la phep cong lap",
            "Vi du: 3 gio tao, moi gio 4 qua",
            "Hoat dong 10 phut cuoi gio",
            "Hoc sinh con nham 3 x 4 voi 3 + 4",
        ]
    )

    ctx = provider.retrieve(
        subject="Toan",
        grade=3,
        objective_id="math_3_multiplication_repeated_addition",
        prompt="Tao game ngan ve phep nhan",
        source_text=slide_text,
        uploaded_file_id="slide_001",
        upload_type="slide",
        teacher_requested_difficulty="medium",
    )

    teacher = ctx.teacher_lesson_context
    assert teacher is not None
    assert teacher.upload_type == "slide"
    assert teacher.time_limit_minutes == 10
    assert teacher.preferred_examples
    assert teacher.preferred_examples[0].structured["expected_result"] == 12
    assert ctx.difficulty_assessment is not None
    assert ctx.difficulty_assessment.final_difficulty == "easy"


def test_above_grade_request_is_warned_and_downgraded():
    provider = GDPT2018RetrievalProvider()
    ctx = provider.retrieve(
        subject="Toan",
        grade=3,
        objective_id="math_3_multiplication_repeated_addition",
        prompt="Dung bieu thuc dai so va bai toan nhieu buoc phuc tap",
        teacher_requested_difficulty="hard",
    )

    assert ctx.curriculum_context is not None
    assert ctx.curriculum_context.scope_status == "above_grade"
    assert ctx.alignment_result is not None
    assert ctx.alignment_result.mismatch_warnings
    assert ctx.difficulty_assessment is not None
    assert ctx.difficulty_assessment.final_difficulty == "medium"
