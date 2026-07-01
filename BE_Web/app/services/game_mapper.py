from __future__ import annotations

import random

from app.db.models import Game, GameItem
from app.schemas.games import GameItemResponse, GameResponse, GameSummaryResponse


class GameMappingError(ValueError):
    pass


def _int_count(content: dict, key: str) -> int:
    """Coerce a supply-count field to a non-negative int.

    Treats absent/null as 0 and raises GameMappingError (caught at the route
    layer) for anything non-numeric, instead of letting a raw ValueError/
    TypeError from int() abort the response.
    """
    raw = content.get(key)
    if raw is None:
        return 0
    try:
        value = int(raw)
    except (ValueError, TypeError):
        raise GameMappingError(
            f"beat_forge content field {key!r} must be a non-negative integer, got {raw!r}"
        )
    if value < 0:
        raise GameMappingError(
            f"beat_forge content field {key!r} must be a non-negative integer, got {raw!r}"
        )
    return value


def battleship_content_to_items(content: dict) -> list[dict]:
    questions = content.get("questions")
    if not isinstance(questions, list) or not questions:
        raise GameMappingError("BE_AI battleship content must include a non-empty questions list")

    mapped: list[dict] = []
    for index, item in enumerate(questions):
        question = item.get("question")
        correct_answer = item.get("correct_answer")
        distractors = item.get("distractors")
        if not isinstance(question, str) or not question.strip():
            raise GameMappingError(f"BE_AI battleship item {index} is missing question")
        if not isinstance(correct_answer, str) or not correct_answer.strip():
            raise GameMappingError(f"BE_AI battleship item {index} is missing correct_answer")
        if not isinstance(distractors, list) or len(distractors) != 3:
            raise GameMappingError(f"BE_AI battleship item {index} must include exactly 3 distractors")

        # Store correct answer first so distractors can be reconstructed as options_json[1:]
        mapped.append(
            {
                "order_index": index,
                "question": question,
                "correct_answer": correct_answer,
                "options_json": [correct_answer, *[str(d) for d in distractors]],
                "explanation": item.get("explanation"),
                "hint": item.get("hint"),
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )
    return mapped


def quiz_content_to_items(content: dict) -> list[dict]:
    items = content.get("items")
    if not isinstance(items, list) or not items:
        raise GameMappingError("BE_AI quiz content must include a non-empty items list")

    mapped: list[dict] = []
    for index, item in enumerate(items):
        question = item.get("question")
        correct_answer = item.get("correct_answer")
        distractors = item.get("distractors")
        if not isinstance(question, str) or not question.strip():
            raise GameMappingError(f"BE_AI item {index} is missing question")
        if not isinstance(correct_answer, str) or not correct_answer.strip():
            raise GameMappingError(f"BE_AI item {index} is missing correct_answer")
        if not isinstance(distractors, list) or len(distractors) < 2:
            raise GameMappingError(f"BE_AI item {index} must include at least 2 distractors")

        options = [correct_answer, *[str(option) for option in distractors]]
        random.Random(f"{question}:{correct_answer}").shuffle(options)
        if len(options) > 1 and options[0] == correct_answer:
            options = [*options[1:], options[0]]
        mapped.append(
            {
                "order_index": index,
                "question": question,
                "correct_answer": correct_answer,
                "options_json": options,
                "explanation": item.get("explanation"),
                "hint": item.get("hint"),
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )
    return mapped


def cat_jump_content_to_items(content: dict) -> list[dict]:
    questions = content.get("questions")
    if not isinstance(questions, list) or not questions:
        raise GameMappingError("BE_AI cat_jump content must include a non-empty questions list")

    mapped: list[dict] = []
    for index, item in enumerate(questions):
        question = item.get("question")
        correct_answer = item.get("correct_answer")
        if not isinstance(question, str) or not question.strip():
            raise GameMappingError(f"BE_AI cat_jump item {index} is missing question")
        if not isinstance(correct_answer, str) or not correct_answer.strip():
            raise GameMappingError(f"BE_AI cat_jump item {index} is missing correct_answer")
        mapped.append(
            {
                "order_index": index,
                "question": question,
                "correct_answer": correct_answer,
                "options_json": [],
                "explanation": item.get("explanation"),
                "hint": item.get("hint"),
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )
    return mapped


def beat_forge_content_to_items(content: dict) -> list[dict]:
    time_sig = content.get("time_signature")
    if not time_sig:
        raise GameMappingError("beat_forge content must include time_signature")

    half_notes           = _int_count(content, "half_notes")
    quarter_notes        = _int_count(content, "quarter_notes")
    eighth_notes         = _int_count(content, "eighth_notes")
    dotted_half_notes    = _int_count(content, "dotted_half_notes")
    dotted_quarter_notes = _int_count(content, "dotted_quarter_notes")
    triplet_eighth_notes = _int_count(content, "triplet_eighth_notes")
    lanes = content.get("lanes")

    if not isinstance(lanes, list) or len(lanes) < 2:
        raise GameMappingError("beat_forge content must include at least 2 lanes")

    mapped: list[dict] = []

    # Item 0: global config — time signature + all six note-type supply counts.
    # options_json indices: [0]=half, [1]=quarter, [2]=eighth,
    #                       [3]=dotted_half, [4]=dotted_quarter, [5]=triplet_eighth
    mapped.append(
        {
            "order_index": 0,
            "question": content.get("title", "Beat Forge"),
            "correct_answer": time_sig,
            "options_json": [
                str(half_notes),
                str(quarter_notes),
                str(eighth_notes),
                str(dotted_half_notes),
                str(dotted_quarter_notes),
                str(triplet_eighth_notes),
            ],
            "explanation": "",
            "hint": "",
            "validation_status": "valid",
            "validation_errors_json": [],
        }
    )

    # Items 1..n: one per lane
    for i, lane in enumerate(lanes):
        correct = lane.get("correct_answer", "")
        if not correct:
            raise GameMappingError(f"beat_forge lane {i} is missing correct_answer")
        mapped.append(
            {
                "order_index": i + 1,
                "question": f"Lane {i + 1}",
                "correct_answer": correct,
                "options_json": [],
                "explanation": lane.get("explanation", ""),
                "hint": lane.get("hint", ""),
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )

    return mapped


def feed_cats_content_to_items(content: dict) -> list[dict]:
    items = content.get("items")
    if not isinstance(items, list) or not items:
        raise GameMappingError("BE_AI feed_the_cats content must include a non-empty items list")

    mapped: list[dict] = []
    for index, item in enumerate(items):
        question = item.get("question")
        correct_answer = item.get("correct_answer")
        if not isinstance(question, str) or not question.strip():
            raise GameMappingError(f"BE_AI feed_the_cats item {index} is missing question")
        if not isinstance(correct_answer, str) or not correct_answer.strip():
            raise GameMappingError(f"BE_AI feed_the_cats item {index} is missing correct_answer")
        mapped.append(
            {
                "order_index": index,
                "question": question,
                "correct_answer": correct_answer,
                "options_json": [],
                "explanation": item.get("explanation"),
                "hint": item.get("hint"),
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )
    return mapped


def farm_builder_content_to_items(content: dict) -> list[dict]:
    problems = content.get("problems")
    if not isinstance(problems, list) or len(problems) < 3:
        raise GameMappingError("BE_AI farm_builder content must include at least 3 problems")

    mapped: list[dict] = []
    for index, problem in enumerate(problems):
        shape_type = problem.get("shape_type")
        constraint = problem.get("constraint")
        value = problem.get("value")
        if not isinstance(shape_type, str) or not shape_type.strip():
            raise GameMappingError(f"BE_AI farm_builder problem {index} is missing shape_type")
        if not isinstance(constraint, str) or not constraint.strip():
            raise GameMappingError(f"BE_AI farm_builder problem {index} is missing constraint")
        if not isinstance(value, int) or value < 1:
            raise GameMappingError(f"BE_AI farm_builder problem {index} must have a positive integer value")

        # Human-readable question sentence
        question = f"Xây trang trại {shape_type} với {constraint} = {value}"
        if constraint == "diện tích":
            question += " ô vuông"
        else:
            question += " đoạn rào"

        # options_json encodes the full problem spec for the shell:
        #   [0] shape_type  — e.g. "hình vuông"
        #   [1] constraint  — e.g. "diện tích"
        #   [2] str(value)  — e.g. "12"
        mapped.append(
            {
                "order_index": index,
                "question": question,
                "correct_answer": f"{shape_type}|{constraint}|{value}",
                "options_json": [shape_type, constraint, str(value)],
                "explanation": problem.get("explanation") or "",
                "hint": problem.get("hint") or "",
                "validation_status": "valid",
                "validation_errors_json": [],
            }
        )
    return mapped


def game_to_response(game: Game) -> GameResponse:
    raw = game.ai_raw_response_json or {}
    session_id = raw.get("session_id") if isinstance(raw, dict) else None
    return GameResponse(
        lessonId=game.lesson_id,
        gameId=game.id,
        sessionId=session_id if isinstance(session_id, int) else None,
        status=game.status.value,
        productTemplateId=game.product_template_id,
        aiTemplateId=game.ai_template_id,
        title=game.lesson.title,
        input=game.lesson.input_text,
        subject=game.lesson.subject,
        grade=game.lesson.grade,
        difficulty=game.lesson.difficulty,
        objectiveId=game.lesson.objective_id,
        settings=game.settings_json or {},
        items=[item_to_response(item) for item in game.items],
    )


def game_to_summary_response(game: Game) -> GameSummaryResponse:
    return GameSummaryResponse(
        gameId=game.id,
        lessonId=game.lesson_id,
        title=game.lesson.title,
        input=game.lesson.input_text,
        status=game.status.value,
        productTemplateId=game.product_template_id,
        aiTemplateId=game.ai_template_id,
        subject=game.lesson.subject,
        grade=game.lesson.grade,
        difficulty=game.lesson.difficulty,
        itemCount=len(game.items),
        createdAt=game.created_at,
        updatedAt=game.updated_at,
    )


def item_to_response(item: GameItem) -> GameItemResponse:
    return GameItemResponse(
        id=item.id,
        orderIndex=item.order_index,
        question=item.question,
        correctAnswer=item.correct_answer,
        options=item.options_json or [],
        explanation=item.explanation,
        hint=item.hint,
        validationStatus=item.validation_status,
        validationErrors=item.validation_errors_json or [],
    )
