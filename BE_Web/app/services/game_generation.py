from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.db.models import ChatSession, Game, GameItem, GameReviewEvent, GameStatus, Lesson, ReviewEventType, User
from app.services.game_mapper import (
    GameMappingError,
    battleship_content_to_items,
    beat_forge_content_to_items,
    cat_jump_content_to_items,
    farm_builder_content_to_items,
    feed_cats_content_to_items,
    quiz_content_to_items,
)


def create_game_from_generation(
    db: Session,
    *,
    current_user: User,
    session: ChatSession,
    template_id: str,
    content: dict[str, Any],
    safety_report: dict[str, Any] | None,
    elapsed_ms: int | None,
) -> tuple[Lesson, Game]:
    lesson = Lesson(
        user_id=current_user.id,
        title=session.title or "Trò chơi mới",
        input_text=_latest_user_prompt(session),
        subject=session.subject or "General",
        grade=session.grade or 6,
        difficulty=session.difficulty or "medium",
        objective_id=_extract_objective_id(content),
    )
    db.add(lesson)
    db.flush()

    game = Game(
        lesson_id=lesson.id,
        product_template_id=template_id,
        ai_template_id=template_id,
        status=GameStatus.draft,
        settings_json={
            "numItems": session.num_items or _infer_num_items(content),
            "playerCount": 2,
            "mapTheme": "treasure-hunt" if template_id == "treasure_hunt" else None,
        },
        ai_raw_response_json={
            "session_id": session.id,
            "content": content,
            "safety_report": safety_report,
            "elapsed_ms": elapsed_ms,
        },
    )
    db.add(game)
    db.flush()

    item_rows = map_content_to_items(template_id, content)
    for row in item_rows:
        db.add(GameItem(game_id=game.id, **row))

    db.flush()
    db.add(
        GameReviewEvent(
            game_id=game.id,
            event_type=ReviewEventType.generate,
            payload_json={
                "template_id": template_id,
                "elapsed_ms": elapsed_ms,
                "item_count": len(item_rows),
            },
        )
    )
    db.commit()
    db.refresh(lesson)
    db.refresh(game)
    return lesson, game


def map_content_to_items(template_id: str, content: dict[str, Any]) -> list[dict[str, Any]]:
    if template_id in {"treasure_hunt", "battleship"}:
        question_pool = content.get("questions")
        if not isinstance(question_pool, list) or not question_pool:
            raise GameMappingError(f"BE_AI {template_id} content must include a non-empty questions list")
        synthetic_quiz_content = {"items": question_pool}
        if template_id == "battleship":
            return battleship_content_to_items(content)
        return quiz_content_to_items(synthetic_quiz_content)

    if template_id == "quiz":
        return quiz_content_to_items(content)

    if template_id == "cat_jump":
        return cat_jump_content_to_items(content)

    if template_id == "feed_the_cats":
        return feed_cats_content_to_items(content)

    if template_id == "beat_forge":
        return beat_forge_content_to_items(content)

    if template_id == "farm_builder":
        return farm_builder_content_to_items(content)

    raise GameMappingError(f"Unsupported template '{template_id}' for BE_Web persistence")


def _latest_user_prompt(session: ChatSession) -> str:
    for message in reversed(session.messages):
        if message.role.value == "user" and message.content.strip():
            return message.content
    return session.title or "Trò chơi mới"


def _infer_num_items(content: dict[str, Any]) -> int | None:
    if isinstance(content.get("questions"), list):
        return len(content["questions"])
    if isinstance(content.get("items"), list):
        return len(content["items"])
    return None


def _extract_objective_id(content: dict[str, Any]) -> str | None:
    if isinstance(content.get("objective_id"), str):
        return content["objective_id"]
    questions = content.get("questions")
    if isinstance(questions, list):
        for item in questions:
            if isinstance(item, dict) and isinstance(item.get("objective_id"), str):
                return item["objective_id"]
    items = content.get("items")
    if isinstance(items, list):
        for item in items:
            if isinstance(item, dict) and isinstance(item.get("objective_id"), str):
                return item["objective_id"]
    return None
