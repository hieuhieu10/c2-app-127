"""Supervisor node: recommend a game template for the lesson request."""

from __future__ import annotations

from app.agents.llm import call_tool
from app.agents.prompts import (
    GAME_RECOMMENDER_SYSTEM,
    RECOMMENDER_SYSTEM,
    build_game_recommender_user,
    build_recommender_user,
)
from app.agents.state import GenerationState
from app.templates.registry import TemplateMeta, candidates_for, has_content_model, playable_games

_TOOL_NAME = "recommend_template"
_GAMES_TOOL_NAME = "recommend_games"


async def recommend_node(state: GenerationState) -> GenerationState:
    # FR-05: honour an explicit teacher override and skip the LLM.
    override = state.get("override_template")
    if override and has_content_model(override):
        return {"template_id": override, "rationale": "Teacher selected this template."}

    grade = state.get("grade")
    candidates = candidates_for(grade)
    if not candidates:
        return {"error": f"No active templates available for grade {grade}."}

    # If only one candidate, no need to spend an LLM call.
    if len(candidates) == 1:
        only = candidates[0]
        return {"template_id": only.id, "rationale": f"Only available template: {only.name}."}

    input_schema = {
        "type": "object",
        "properties": {
            "template_id": {
                "type": "string",
                "enum": [c.id for c in candidates],
                "description": "Id of the chosen template.",
            },
            "rationale": {
                "type": "string",
                "description": "One or two sentences (Vietnamese) explaining the choice.",
            },
        },
        "required": ["template_id", "rationale"],
    }

    user = build_recommender_user(
        subject=state["subject"],
        grade=state["grade"],
        difficulty=state["difficulty"],
        prompt=state["prompt"],
        candidates=candidates,
        ctx=state.get("context"),
    )

    result = await call_tool(
        system=RECOMMENDER_SYSTEM,
        user=user,
        tool_name=_TOOL_NAME,
        tool_description="Choose the single best game template for this lesson.",
        input_schema=input_schema,
    )

    template_id = result.get("template_id")
    valid_ids = {c.id for c in candidates}
    if template_id not in valid_ids:
        # Defensive fallback: pick the first candidate rather than fail.
        template_id = candidates[0].id
    return {"template_id": template_id, "rationale": result.get("rationale", "")}


def _default_intro(game: TemplateMeta) -> str:
    """Plain intro used when there is only one game (no LLM call needed)."""
    return f"{game.name}: {game.description}"


async def recommend_games(
    *,
    subject: str,
    grade: int,
    difficulty: str,
    prompt: str,
) -> list[dict]:
    """Rank ALL playable games for this lesson and write a short intro for each.

    Every playable game is offered (no hard grade filter); the model orders them by
    suitability for the grade/objective, so a less-ideal game still appears, ranked
    lower. Returns a best-first list of ``{template_id, name, intro, recommended}``
    dicts; the first entry is flagged ``recommended`` as the top pick.
    """
    games = playable_games()
    if not games:
        return []

    by_id = {g.id: g for g in games}

    # One game → no need to spend an LLM call; offer it as the recommended pick.
    if len(games) == 1:
        only = games[0]
        return [{"template_id": only.id, "name": only.name, "intro": _default_intro(only), "recommended": True}]

    input_schema = {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "description": "Every available game, ordered best-first (index 0 = top pick).",
                "items": {
                    "type": "object",
                    "properties": {
                        "template_id": {
                            "type": "string",
                            "enum": [g.id for g in games],
                            "description": "Id of the game.",
                        },
                        "intro": {
                            "type": "string",
                            "description": "One or two sentences (Vietnamese) on what this game is and why it fits.",
                        },
                    },
                    "required": ["template_id", "intro"],
                },
            },
        },
        "required": ["recommendations"],
    }

    result = await call_tool(
        system=GAME_RECOMMENDER_SYSTEM,
        user=build_game_recommender_user(
            subject=subject, grade=grade, difficulty=difficulty, prompt=prompt, games=games
        ),
        tool_name=_GAMES_TOOL_NAME,
        tool_description="Rank the available games best-first and introduce each one.",
        input_schema=input_schema,
    )

    seen: set[str] = set()
    out: list[dict] = []
    for rec in result.get("recommendations", []):
        tid = rec.get("template_id")
        game = by_id.get(tid)
        if not game or tid in seen:
            continue
        seen.add(tid)
        out.append({
            "template_id": tid,
            "name": game.name,
            "intro": rec.get("intro") or _default_intro(game),
            "recommended": not out,  # first valid entry is the top pick
        })

    # Append any games the model omitted, so the teacher still sees every option.
    for game in games:
        if game.id not in seen:
            out.append({
                "template_id": game.id,
                "name": game.name,
                "intro": _default_intro(game),
                "recommended": not out,
            })

    return out
