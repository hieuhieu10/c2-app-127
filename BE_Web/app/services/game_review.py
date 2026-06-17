from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.db.models import Game, GameItem, GameReviewEvent, GameStatus, ReviewEventType, User
from app.schemas.games import GameItemResponse, StatusResponse, UpdateGameItemRequest
from app.services.game_mapper import item_to_response


def get_game_or_404(db: Session, game_id: int, current_user: User | None = None) -> Game:
    game = db.get(Game, game_id)
    if not game or (current_user and game.lesson.user_id != current_user.id):
        raise HTTPException(404, "Game not found")
    return game


def get_item_or_404(db: Session, game_id: int, item_id: int, current_user: User | None = None) -> GameItem:
    item = db.get(GameItem, item_id)
    if not item or item.game_id != game_id:
        raise HTTPException(404, "Game item not found")
    game = get_game_or_404(db, game_id, current_user)
    if item.game_id != game.id:
        raise HTTPException(404, "Game item not found")
    return item


def update_item(db: Session, game_id: int, item_id: int, request: UpdateGameItemRequest, current_user: User) -> GameItemResponse:
    item = get_item_or_404(db, game_id, item_id, current_user)
    if request.question is not None:
        item.question = request.question
    if request.correctAnswer is not None:
        item.correct_answer = request.correctAnswer
    if request.options is not None:
        item.options_json = request.options
    if request.explanation is not None:
        item.explanation = request.explanation
    if request.hint is not None:
        item.hint = request.hint
    item.reviewed_at = datetime.now(timezone.utc)
    db.add(GameReviewEvent(game_id=game_id, item_id=item_id, event_type=ReviewEventType.edit, payload_json=request.model_dump(exclude_none=True)))
    db.commit()
    db.refresh(item)
    return item_to_response(item)


def recheck_item(db: Session, game_id: int, item_id: int, current_user: User) -> GameItemResponse:
    item = get_item_or_404(db, game_id, item_id, current_user)
    errors: list[str] = []
    if item.correct_answer not in (item.options_json or []):
        errors.append("Correct answer must be included in options")
    if len(set(item.options_json or [])) != len(item.options_json or []):
        errors.append("Options must be unique")
    item.validation_status = "valid" if not errors else "invalid"
    item.validation_errors_json = errors
    db.add(GameReviewEvent(game_id=game_id, item_id=item_id, event_type=ReviewEventType.recheck, payload_json={"errors": errors}))
    db.commit()
    db.refresh(item)
    return item_to_response(item)


def set_status(db: Session, game_id: int, status: GameStatus, current_user: User) -> StatusResponse:
    game = get_game_or_404(db, game_id, current_user)
    if status == GameStatus.published and game.status != GameStatus.approved:
        raise HTTPException(400, "Game must be approved before publish")
    game.status = status
    event_type = ReviewEventType.approve if status == GameStatus.approved else ReviewEventType.publish
    db.add(GameReviewEvent(game_id=game_id, event_type=event_type, payload_json={"status": status.value}))
    db.commit()
    return StatusResponse(gameId=game.id, status=game.status.value)
