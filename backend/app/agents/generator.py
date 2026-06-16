"""Worker nodes: retrieve grounding, generate content, validate, repair."""

from __future__ import annotations

from app.agents.llm import call_tool
from app.agents.prompts import GENERATOR_SYSTEM, build_generator_user
from app.agents.state import GenerationState
from app.config import settings
from app.retrieval.context import RetrievedContext, default_provider
from app.templates.registry import get_template
from app.validation.validator import json_schema_for, validate

_TOOL_NAME = "emit_game_content"


def retrieve_node(state: GenerationState) -> GenerationState:
    ctx = default_provider.retrieve(
        subject=state["subject"],
        grade=state["grade"],
        objective_id=state.get("objective_id"),
        prompt=state["prompt"],
        source_text=state.get("source_text"),
    )
    # Adopt the resolved objective id so downstream items reference a real objective.
    return {"context": ctx, "objective_id": ctx.objective_id or state.get("objective_id")}


async def _generate(state: GenerationState, repair_errors: list[str] | None) -> dict:
    template_id = state["template_id"]
    template = get_template(template_id)
    ctx: RetrievedContext = state["context"]

    user = build_generator_user(
        subject=state["subject"],
        grade=state["grade"],
        difficulty=state["difficulty"],
        prompt=state["prompt"],
        num_items=state.get("num_items", 5),
        template=template,
        ctx=ctx,
        repair_errors=repair_errors,
    )
    return await call_tool(
        system=GENERATOR_SYSTEM,
        user=user,
        tool_name=_TOOL_NAME,
        tool_description=f"Emit schema-valid content for the '{template_id}' game.",
        input_schema=json_schema_for(template_id),
    )


async def generate_node(state: GenerationState) -> GenerationState:
    content = await _generate(state, repair_errors=None)
    return {"content": content, "repair_attempts": 0}


async def repair_node(state: GenerationState) -> GenerationState:
    errors = state.get("validation_errors", [])
    content = await _generate(state, repair_errors=errors)
    return {"content": content, "repair_attempts": state.get("repair_attempts", 0) + 1}


def validate_node(state: GenerationState) -> GenerationState:
    result = validate(state["template_id"], state.get("content") or {})
    if result.ok:
        return {"ok": True, "content": result.content, "validation_errors": []}
    return {"ok": False, "validation_errors": result.errors}


def after_validate(state: GenerationState) -> str:
    """Conditional edge: stop on success or exhausted repairs, else repair."""
    if state.get("ok"):
        return "done"
    if state.get("repair_attempts", 0) >= settings.max_repairs:
        return "give_up"
    return "repair"
