"""LangGraph wiring for the agent workflow.

    guardrail --ok--> retrieve -> recommend -> generate -> validate --done--> END
        |                                          ^   |
        +--blocked--> END                          |   +--repair--> repair --> validate
                                                    |
                                                    +--give_up--> finalize_failure -> END

The guardrail node screens the request (scope / relevance / child-safety) and short-circuits
to END when it rejects. The recommend node is skipped logically when a template override is supplied (handled
inside the node). The conditional edge after `validate` drives the repair loop up to
`settings.max_repairs`.
"""

from __future__ import annotations

from functools import lru_cache

from langgraph.graph import END, StateGraph

from app.agents.generator import (
    after_retrieve,
    after_validate,
    generate_node,
    repair_node,
    retrieve_node,
    validate_node,
)
from app.agents.guardrail import after_guardrail, guardrail_node
from app.agents.recommender import recommend_node
from app.agents.state import GenerationState


def _finalize_failure(state: GenerationState) -> GenerationState:
    errs = "; ".join(state.get("validation_errors", [])) or "unknown validation failure"
    return {
        "ok": False,
        "error": f"Content failed schema validation after repairs: {errs}",
    }


def _route_after_recommend(state: GenerationState) -> str:
    return "error" if state.get("error") else "ok"


@lru_cache(maxsize=1)
def build_graph():
    g = StateGraph(GenerationState)

    g.add_node("guardrail", guardrail_node)
    g.add_node("retrieve", retrieve_node)
    g.add_node("recommend", recommend_node)
    g.add_node("generate", generate_node)
    g.add_node("validate", validate_node)
    g.add_node("repair", repair_node)
    g.add_node("finalize_failure", _finalize_failure)

    g.set_entry_point("guardrail")
    g.add_conditional_edges(
        "guardrail", after_guardrail, {"ok": "retrieve", "blocked": END}
    )
    g.add_conditional_edges(
        "retrieve", after_retrieve, {"ok": "recommend", "error": END}
    )
    g.add_conditional_edges(
        "recommend", _route_after_recommend, {"ok": "generate", "error": END}
    )
    g.add_edge("generate", "validate")
    g.add_conditional_edges(
        "validate",
        after_validate,
        {"done": END, "repair": "repair", "give_up": "finalize_failure"},
    )
    g.add_edge("repair", "validate")
    g.add_edge("finalize_failure", END)

    return g.compile()


async def run_workflow(
    *,
    subject: str,
    grade: int,
    difficulty: str,
    prompt: str,
    objective_id: str | None = None,
    source_text: str | None = None,
    uploaded_file_id: str | None = None,
    upload_type: str = "none",
    num_items: int = 5,
    override_template: str | None = None,
) -> GenerationState:
    """Entry point for the backend / CLI. Returns the final graph state."""
    graph = build_graph()
    initial: GenerationState = {
        "subject": subject,
        "grade": grade,
        "difficulty": difficulty,
        "prompt": prompt,
        "objective_id": objective_id,
        "source_text": source_text,
        "uploaded_file_id": uploaded_file_id,
        "upload_type": upload_type,
        "num_items": num_items,
        "override_template": override_template,
    }
    return await graph.ainvoke(initial)
