"""System prompts and prompt builders for the recommender (supervisor) and generator (worker)."""

from __future__ import annotations

from app.retrieval.context import RetrievedContext
from app.templates.registry import TemplateMeta

RECOMMENDER_SYSTEM = """You are a curriculum-aware game-design supervisor for Vietnamese \
secondary-school teachers (chương trình GDPT 2018). Given a lesson request, pick the SINGLE \
best game template from the provided candidates for the teacher's objective and content type. \
Prefer the mechanic that most naturally assesses the objective. Reply only via the tool, with \
a concise rationale (one or two sentences, in Vietnamese)."""

GENERATOR_SYSTEM = """You are a content-generation worker for a Vietnamese learning-game tool \
(GDPT 2018). Produce game content that is faithful to the supplied curriculum context and \
objective. Rules:
- The correct answer/match MUST be supported by the curriculum context. Do not invent facts.
- Distractors / wrong options MUST be verifiably wrong; whenever a misconception is supplied, \
turn it into a distractor so students confront it.
- Never include the correct answer among the distractors.
- Write in the lesson's language (Vietnamese unless the source is in another language) and at a \
level appropriate to the grade.
- Set every objective_id field to the linked objective id given to you.
Return content ONLY through the provided tool, matching its schema exactly."""


def _format_context(ctx: RetrievedContext) -> str:
    lines = []
    if ctx.objective_text:
        lines.append(f"Objective ({ctx.objective_id}): {ctx.objective_text}")
    else:
        lines.append(f"Objective id: {ctx.objective_id or '(none)'}")
    if ctx.passages:
        lines.append("\nCurriculum / source context:")
        for i, p in enumerate(ctx.passages, 1):
            lines.append(f"  [{i}] {p}")
    if ctx.misconceptions:
        lines.append("\nKnown misconceptions to target as distractors:")
        for m in ctx.misconceptions:
            lines.append(f"  - WRONG: {m.misconception}  |  RIGHT: {m.correct_concept}")
    return "\n".join(lines)


def build_recommender_user(
    *, subject: str, grade: int, difficulty: str, prompt: str, candidates: list[TemplateMeta]
) -> str:
    cand_lines = [
        f"- {c.id}: {c.name} — {c.description} (fits: {', '.join(c.content_type_fit)})"
        for c in candidates
    ]
    return (
        f"Subject: {subject}\nGrade: {grade}\nDifficulty: {difficulty}\n"
        f"Teacher request: {prompt}\n\n"
        f"Candidate templates:\n" + "\n".join(cand_lines)
    )


def build_generator_user(
    *,
    subject: str,
    grade: int,
    difficulty: str,
    prompt: str,
    num_items: int,
    template: TemplateMeta,
    ctx: RetrievedContext,
    repair_errors: list[str] | None = None,
) -> str:
    parts = [
        f"Subject: {subject}\nGrade: {grade}\nDifficulty: {difficulty}",
        f"Chosen game template: {template.id} ({template.name})",
        f"Teacher request: {prompt}",
        f"Target number of items/pairs: about {num_items}.",
        "",
        _format_context(ctx),
    ]
    if repair_errors:
        parts.append(
            "\nYour previous output FAILED schema validation. Fix exactly these problems "
            "and return valid content:\n- " + "\n- ".join(repair_errors)
        )
    return "\n".join(parts)
