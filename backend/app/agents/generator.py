"""Worker nodes: retrieve grounding, generate content, validate, repair."""

from __future__ import annotations

from app.agents.llm import call_tool
from app.agents.prompts import GENERATOR_SYSTEM, build_generator_user
from app.agents.state import GenerationState
from app.config import settings
from app.retrieval.context import RetrievedContext, default_provider
from app.templates.registry import get_template
from app.validation.curriculum import validate_curriculum_content
from app.validation.validator import json_schema_for, validate

_TOOL_NAME = "emit_game_content"


def _clean_optional_id(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    if stripped.lower() in {"", "string", "none", "null"}:
        return None
    return stripped


def retrieve_node(state: GenerationState) -> GenerationState:
    requested_objective_id = _clean_optional_id(state.get("objective_id"))
    ctx = default_provider.retrieve(
        subject=state["subject"],
        grade=state["grade"],
        objective_id=requested_objective_id,
        prompt=state["prompt"],
        source_text=state.get("source_text"),
        uploaded_file_id=state.get("uploaded_file_id"),
        upload_type=state.get("upload_type", "none"),
        teacher_requested_difficulty=state.get("difficulty", "medium"),
    )
    if not ctx.objective_id:
        message = (
            f"Không tìm thấy yêu cầu cần đạt GDPT 2018 phù hợp cho "
            f"{state['subject']} lớp {state['grade']}."
        )
        suggestion = (
            "Hãy nêu rõ nội dung bài học theo đúng môn/lớp đã chọn, hoặc đổi lớp nếu nội dung "
            "thuộc phạm vi chương trình của lớp khác."
        )
        if ctx.alignment_result and ctx.alignment_result.recommended_adjustments:
            suggestion = " ".join(ctx.alignment_result.recommended_adjustments)
        return {
            "context": ctx,
            "objective_id": requested_objective_id,
            "ok": False,
            "error": f"{message} {suggestion}",
            "validation_errors": [message],
            "content": None,
        }
    # Adopt the resolved objective id so downstream items reference a real objective.
    return {"context": ctx, "objective_id": ctx.objective_id or requested_objective_id}


def after_retrieve(state: GenerationState) -> str:
    """Stop early when retrieval cannot resolve a curriculum objective."""
    if state.get("error") or not state.get("objective_id"):
        return "error"
    return "ok"


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
    # Scale the LLM budget with the requested item count. A large pool (e.g.
    # Battleship's 25 MCQs) otherwise (a) trips the 30s default timeout and (b)
    # overflows the 4096-token output cap, truncating the JSON into an unparseable
    # tool call. Both scale with how many items we asked the model to emit.
    num_items = state.get("num_items", 5)
    timeout = min(180.0, max(30.0, num_items * 5.0))
    max_tokens = min(8000, max(settings.max_tokens, num_items * 300))
    return await call_tool(
        system=GENERATOR_SYSTEM,
        user=user,
        tool_name=_TOOL_NAME,
        tool_description=f"Emit schema-valid content for the '{template_id}' game.",
        input_schema=json_schema_for(template_id),
        max_tokens=max_tokens,
        timeout=timeout,
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
        curriculum_errors = validate_curriculum_content(
            content=result.content or {},
            expected_objective_id=state.get("objective_id"),
            grade=state["grade"],
            context=state.get("context"),
        )
        if curriculum_errors:
            return {"ok": False, "content": result.content, "validation_errors": curriculum_errors}
        return {"ok": True, "content": result.content, "validation_errors": []}
    return {"ok": False, "validation_errors": result.errors}


def after_validate(state: GenerationState) -> str:
    """Conditional edge: stop on success or exhausted repairs, else repair."""
    if state.get("ok"):
        return "done"
    if state.get("repair_attempts", 0) >= settings.max_repairs:
        return "give_up"
    return "repair"
