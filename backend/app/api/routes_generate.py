"""HTTP surface for the agent workflow.

These endpoints wrap the LangGraph workflow. A backend teammate can mount this router
behind auth; the agent core stays untouched.
"""

from __future__ import annotations

import json
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse

from app.agents.generator import retrieve_node, generate_node, validate_node, repair_node
from app.agents.graph import run_workflow
from app.agents.recommender import recommend_node
from app.config import settings
from app.models import GameResponse, LessonRequest, RecommendResponse, TemplateCandidate
from app.templates.registry import candidates_for, has_content_model, list_templates

_BATTLESHIP_HTML = Path(__file__).resolve().parents[2] / "static" / "battleship.html"

router = APIRouter(tags=["agent-workflow"])


@router.get("/templates")
def get_templates() -> list[TemplateCandidate]:
    """List active, generatable templates."""
    return [
        TemplateCandidate(id=m.id, name=m.name, description=m.description)
        for m in list_templates(active_only=True)
        if has_content_model(m.id)
    ]


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: LessonRequest) -> RecommendResponse:
    cands = candidates_for(req.grade)
    if not cands:
        raise HTTPException(400, f"No templates available for grade {req.grade}.")
    state = await recommend_node(dict(req))  # type: ignore[arg-type]
    if state.get("error"):
        raise HTTPException(400, state["error"])
    return RecommendResponse(
        template_id=state["template_id"],
        rationale=state.get("rationale", ""),
        candidates=[TemplateCandidate(id=c.id, name=c.name, description=c.description) for c in cands],
    )


@router.post("/generate", response_model=GameResponse)
async def generate(req: LessonRequest) -> GameResponse:
    """Generate content for an explicitly chosen template (override_template required)."""
    if not req.override_template:
        raise HTTPException(400, "override_template is required for /generate; use /generate/full to auto-pick.")
    if not has_content_model(req.override_template):
        raise HTTPException(400, f"Unknown or inactive template '{req.override_template}'.")

    state = dict(req)
    state["template_id"] = req.override_template
    state.update(retrieve_node(state))  # type: ignore[arg-type]
    state.update(await generate_node(state))  # type: ignore[arg-type]
    state.update(validate_node(state))  # type: ignore[arg-type]
    attempts = 0
    while not state.get("ok") and attempts < settings.max_repairs:
        state.update(await repair_node(state))  # type: ignore[arg-type]
        state.update(validate_node(state))  # type: ignore[arg-type]
        attempts = state.get("repair_attempts", attempts + 1)

    return _to_response(state)


@router.post("/generate/full", response_model=GameResponse)
async def generate_full(req: LessonRequest) -> GameResponse:
    """Run the whole workflow: recommend -> generate -> validate/repair."""
    state = await run_workflow(
        subject=req.subject,
        grade=req.grade,
        difficulty=req.difficulty,
        prompt=req.prompt,
        objective_id=req.objective_id,
        source_text=req.source_text,
        num_items=req.num_items,
        override_template=req.override_template,
    )
    return _to_response(state)


@router.post("/game/battleship/generate", response_class=HTMLResponse)
async def generate_battleship_game(req: LessonRequest) -> HTMLResponse:
    """Generate Trivia Battleship content and return a ready-to-play HTML page.

    Forces override_template='battleship'. The returned HTML has
    window.GAME_CONTENT injected as a <script> block before </head>.
    """
    state: dict = req.model_dump()
    state["override_template"] = "battleship"
    state["template_id"] = "battleship"
    state["num_items"] = max(state.get("num_items") or 5, 20)

    state.update(retrieve_node(state))  # type: ignore[arg-type]
    state.update(await generate_node(state))  # type: ignore[arg-type]
    state.update(validate_node(state))  # type: ignore[arg-type]
    attempts = 0
    while not state.get("ok") and attempts < settings.max_repairs:
        state.update(await repair_node(state))  # type: ignore[arg-type]
        state.update(validate_node(state))  # type: ignore[arg-type]
        attempts = state.get("repair_attempts", attempts + 1)

    if not state.get("ok"):
        raise HTTPException(502, detail=f"Content generation failed: {state.get('error')}")

    content_json = json.dumps(state["content"], ensure_ascii=False)
    html = _BATTLESHIP_HTML.read_text(encoding="utf-8")
    injected = html.replace("</head>", f"<script>window.GAME_CONTENT = {content_json};</script>\n</head>", 1)
    return HTMLResponse(content=injected)


def _to_response(state: dict) -> GameResponse:
    return GameResponse(
        ok=bool(state.get("ok")),
        template_id=state.get("template_id"),
        rationale=state.get("rationale"),
        content=state.get("content") if state.get("ok") else None,
        objective_id=state.get("objective_id"),
        validation_errors=state.get("validation_errors", []),
        repair_attempts=state.get("repair_attempts", 0),
        error=state.get("error"),
    )
