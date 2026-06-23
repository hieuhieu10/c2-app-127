from __future__ import annotations

import random

from app.db.models import Game, GameItem
from app.schemas.games import GameItemResponse, GameResponse, GameSummaryResponse


class GameMappingError(ValueError):
    pass


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


def game_to_response(game: Game) -> GameResponse:
    return GameResponse(
        lessonId=game.lesson_id,
        gameId=game.id,
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
