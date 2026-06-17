from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.core.security import get_current_user
from app.db.models import Game, GameStatus, ReviewEventType, GameReviewEvent
from app.db.session import get_db
from app.db.models import User
from app.schemas.games import (
    GameSummaryResponse,
    GenerateGameRequest,
    GameItemResponse,
    GameResponse,
    StatusResponse,
    UpdateGameItemRequest,
)
from app.services.ai_client import AIClient, get_ai_client
from app.services.game_generation import generate_game
from app.services.game_mapper import game_to_response, game_to_summary_response
from app.services.game_review import get_game_or_404, recheck_item, set_status, update_item

router = APIRouter(prefix="/api/games", tags=["games"])


@router.get("", response_model=list[GameSummaryResponse])
def list_games(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[GameSummaryResponse]:
    games = db.scalars(
        select(Game)
        .join(Game.lesson)
        .options(selectinload(Game.lesson), selectinload(Game.items))
        .where(Game.lesson.has(user_id=current_user.id))
        .order_by(Game.updated_at.desc(), Game.created_at.desc(), Game.id.desc())
    ).all()
    return [game_to_summary_response(game) for game in games]


@router.post("/generate", response_model=GameResponse)
async def generate(
    request: GenerateGameRequest,
    db: Session = Depends(get_db),
    ai_client: AIClient = Depends(get_ai_client),
    current_user: User = Depends(get_current_user),
) -> GameResponse:
    return await generate_game(db, request, ai_client, current_user)


@router.get("/{game_id}", response_model=GameResponse)
def get_game(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GameResponse:
    return game_to_response(get_game_or_404(db, game_id, current_user))


@router.patch("/{game_id}/items/{item_id}", response_model=GameItemResponse)
def patch_item(
    game_id: int,
    item_id: int,
    request: UpdateGameItemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GameItemResponse:
    return update_item(db, game_id, item_id, request, current_user)


@router.post("/{game_id}/items/{item_id}/recheck", response_model=GameItemResponse)
def recheck(
    game_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GameItemResponse:
    return recheck_item(db, game_id, item_id, current_user)


@router.post("/{game_id}/items/{item_id}/regenerate")
def regenerate(
    game_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    get_game_or_404(db, game_id, current_user)
    db.add(GameReviewEvent(game_id=game_id, item_id=item_id, event_type=ReviewEventType.regenerate, payload_json={"status": "not_implemented"}))
    db.commit()
    raise HTTPException(501, "Single-item regeneration is not implemented until BE_AI exposes an endpoint")


@router.post("/{game_id}/approve", response_model=StatusResponse)
def approve(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatusResponse:
    return set_status(db, game_id, GameStatus.approved, current_user)


@router.post("/{game_id}/publish", response_model=StatusResponse)
def publish(
    game_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StatusResponse:
    return set_status(db, game_id, GameStatus.published, current_user)
