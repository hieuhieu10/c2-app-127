from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import Game, GameItem, GameReviewEvent, GameStatus, Lesson, ReviewEventType, User
from app.schemas.ai import LessonRequest
from app.schemas.games import GenerateGameRequest, GameResponse
from app.services.ai_client import AIClient, AIClientError
from app.services.game_mapper import GameMappingError, battleship_content_to_items, game_to_response, quiz_content_to_items

PRODUCT_TEMPLATE_TO_AI_TEMPLATE = {
    "treasure_hunt": "quiz",
    "battleship": "battleship",
}

_CONTENT_MAPPERS = {
    "quiz": quiz_content_to_items,
    "battleship": battleship_content_to_items,
}

_DEFAULT_SETTINGS: dict[str, dict] = {
    "treasure_hunt": {"playerCount": 2, "mapTheme": "treasure-hunt"},
    "battleship": {},
}


async def generate_game(db: Session, request: GenerateGameRequest, ai_client: AIClient, current_user: User) -> GameResponse:
    ai_template_id = PRODUCT_TEMPLATE_TO_AI_TEMPLATE.get(request.product_template_id)
    if not ai_template_id:
        raise HTTPException(400, f"Unknown product_template_id '{request.product_template_id}'")

    ai_grade = max(request.grade, 6)

    lesson = Lesson(
        user_id=current_user.id,
        title=request.title,
        input_text=request.input,
        subject=request.subject or "General",
        grade=request.grade,
        difficulty=request.difficulty,
        objective_id=request.objective_id,
    )
    db.add(lesson)
    db.flush()

    game = Game(
        lesson_id=lesson.id,
        product_template_id=request.product_template_id,
        ai_template_id=ai_template_id,
        status=GameStatus.draft,
        settings_json={"numItems": request.num_items, **_DEFAULT_SETTINGS.get(request.product_template_id, {})},
    )
    db.add(game)
    db.flush()

    # BE_AI currently exposes active content templates only for grades 6-12.
    # Persist the lesson's real grade in BE_Web, but clamp the AI request upward for compatibility.
    ai_request = LessonRequest(
        subject=lesson.subject,
        grade=ai_grade,
        difficulty=lesson.difficulty,  # type: ignore[arg-type]
        prompt=lesson.input_text,
        objective_id=lesson.objective_id,
        source_text=lesson.input_text,
        num_items=request.num_items,
        override_template=ai_template_id,
    )

    try:
        ai_response = await ai_client.generate(ai_request)
        game.ai_raw_response_json = ai_response.model_dump()
        if not ai_response.ok or not ai_response.content:
            game.status = GameStatus.generation_failed
            db.add(GameReviewEvent(game_id=game.id, event_type=ReviewEventType.generate, payload_json=game.ai_raw_response_json))
            db.commit()
            raise HTTPException(502, ai_response.error or "BE_AI failed to generate content")
        if ai_response.template_id != ai_template_id:
            raise GameMappingError(f"BE_AI returned template '{ai_response.template_id}', expected '{ai_template_id}'")

        content_mapper = _CONTENT_MAPPERS[ai_template_id]
        for item_data in content_mapper(ai_response.content):
            db.add(GameItem(game_id=game.id, **item_data))
        db.add(GameReviewEvent(game_id=game.id, event_type=ReviewEventType.generate, payload_json=game.ai_raw_response_json))
        db.commit()
        db.refresh(game)
        return game_to_response(game)
    except AIClientError as exc:
        game.status = GameStatus.generation_failed
        db.add(GameReviewEvent(game_id=game.id, event_type=ReviewEventType.generate, payload_json={"error": str(exc)}))
        db.commit()
        raise HTTPException(502, str(exc)) from exc
    except GameMappingError as exc:
        game.status = GameStatus.generation_failed
        db.add(GameReviewEvent(game_id=game.id, event_type=ReviewEventType.generate, payload_json={"error": str(exc)}))
        db.commit()
        raise HTTPException(502, str(exc)) from exc
