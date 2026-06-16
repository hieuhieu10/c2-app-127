"""Supervisor node: recommend a game template for the lesson request."""

from __future__ import annotations

from app.agents.llm import call_tool
from app.agents.prompts import RECOMMENDER_SYSTEM, build_recommender_user
from app.agents.state import GenerationState
from app.templates.registry import candidates_for, has_content_model

_TOOL_NAME = "recommend_template"


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
