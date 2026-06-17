from __future__ import annotations

import json

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.orm import selectinload

from app.core.security import decode_access_token, get_current_user
from app.core.settings import settings
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


@router.get("/{game_id}/play", response_class=HTMLResponse)
async def play_game(
    game_id: int,
    token: str | None = Query(default=None),
    db: Session = Depends(get_db),
) -> HTMLResponse:
    """Serve the battleship game as a self-contained HTML page.

    Accepts the JWT as a ?token= query param so it can be loaded in an <iframe>.
    Reconstructs window.GAME_CONTENT from stored items and injects it into the
    battleship HTML shell fetched from the AI backend.
    """
    if not token:
        raise HTTPException(401, "Authentication required")

    subject = decode_access_token(token)
    try:
        user_id = int(subject)
    except ValueError as exc:
        raise HTTPException(401, "Invalid token") from exc

    current_user = db.get(User, user_id)
    if not current_user:
        raise HTTPException(401, "Authentication required")

    game = get_game_or_404(db, game_id, current_user)

    if game.product_template_id != "battleship":
        raise HTTPException(400, f"Game {game_id} is not a battleship game")

    game_content = {
        "template_id": "battleship",
        "title": game.lesson.title,
        "objective_id": game.lesson.objective_id,
        "questions": [
            {
                "question": item.question,
                "correct_answer": item.correct_answer,
                "distractors": item.options_json[1:] if item.options_json else [],
                "hint": item.hint,
                "explanation": item.explanation,
                "objective_id": game.lesson.objective_id,
            }
            for item in game.items
        ],
    }

    try:
        async with httpx.AsyncClient(base_url=settings.be_ai_base_url, timeout=10.0) as client:
            resp = await client.get("/static/battleship.html")
            resp.raise_for_status()
            html = resp.text
    except httpx.HTTPError as exc:
        raise HTTPException(502, f"Could not fetch battleship template: {exc}") from exc

    # The battleship.html uses relative paths (e.g. battleship/constants.js).
    # Rewrite them to absolute URLs pointing at the AI backend's static directory.
    ai_static = f"{settings.be_ai_base_url.rstrip('/')}/static"
    html = html.replace('href="battleship/', f'href="{ai_static}/battleship/')
    html = html.replace('src="battleship/', f'src="{ai_static}/battleship/')

    content_json = json.dumps(game_content, ensure_ascii=False)
    html = html.replace("</head>", f"<script>window.GAME_CONTENT = {content_json};</script>\n</head>", 1)

    return HTMLResponse(content=html)


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
