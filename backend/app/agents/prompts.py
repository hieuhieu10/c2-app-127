"""System prompts and prompt builders for the recommender (supervisor) and generator (worker)."""

from __future__ import annotations

from app.retrieval.context import RetrievedContext
from app.templates.registry import TemplateMeta

RECOMMENDER_SYSTEM = """You are a curriculum-aware game-design supervisor for Vietnamese \
teachers (chương trình GDPT 2018), with the current MVP focused on primary-school Mathematics. \
Given a lesson request, pick the SINGLE best game template from the provided candidates for the \
teacher's objective, grade, and content type. Prefer the mechanic that most naturally assesses \
the objective and fits primary students when the grade is 1-5. Reply only via the tool, with \
a concise rationale (one or two sentences, in Vietnamese)."""

GENERATOR_SYSTEM = """You are a content-generation worker for a Vietnamese learning-game tool \
(GDPT 2018). Produce game content that is faithful to the supplied curriculum context and \
objective. Rules:
- Treat GDPT 2018 as the curriculum authority. Teacher-uploaded lesson plans/slides are \
personalization context only; never let them override grade scope or objective boundaries.
- The correct answer/match MUST be supported by the curriculum context. Do not invent facts.
- Distractors / wrong options MUST be verifiably wrong; whenever a misconception is supplied, \
turn it into a distractor so students confront it.
- Never include the correct answer among the distractors.
- Write in the lesson's language (Vietnamese unless the source is in another language) and at a \
level appropriate to the grade.
- Set every objective_id field to the linked objective id given to you.
- For primary-school content, keep visible game-card text short and concrete; put longer \
reasoning in explanation fields.
- Use teacher-uploaded examples first when they are aligned with GDPT 2018. Add extra practice \
items only after the uploaded example is represented.
- Do not mention pictures/images/visual cards unless the schema contains image fields or the \
teacher explicitly supplied image descriptions.
Return content ONLY through the provided tool, matching its schema exactly."""


def _difficulty_guidance(difficulty: str, grade: int, template_id: str, ctx: RetrievedContext) -> str:
    final = (ctx.difficulty_assessment.final_difficulty if ctx.difficulty_assessment else difficulty).lower()
    requested = (ctx.difficulty_assessment.teacher_requested_difficulty if ctx.difficulty_assessment else difficulty).lower()
    required_skills = ctx.curriculum_context.required_skills if ctx.curriculum_context else []
    lines = [
        "\nDifficulty-specific generation rules:",
        f"- Teacher selected: {requested}; curriculum-safe final level: {final}.",
        "- Respect the final level. If teacher selected hard but curriculum caps it lower, use the upper end of the allowed GDPT range without exceeding grade scope.",
    ]
    if required_skills:
        lines.append("- Use these objective skills as the difficulty source: " + ", ".join(required_skills[:6]) + ".")

    if final == "easy":
        lines.extend(
            [
                "- Use direct recall or one-step tasks with friendly numbers.",
                "- Avoid multi-condition prompts and avoid hidden intermediate steps.",
            ]
        )
    elif final == "medium":
        lines.extend(
            [
                "- Use at-grade tasks that require one meaningful reasoning step, not just recall.",
                "- Prefer mixed representations when the objective allows it, such as concept-to-example, representation-to-expression, or short application.",
                "- Avoid generating a set where every item has the same shallow pattern.",
            ]
        )
    else:
        lines.extend(
            [
                "- Use the hardest grade-appropriate version of the objective.",
                "- Combine two allowed skills from the objective when possible, but do not introduce above-grade content.",
                "- Prefer non-obvious values/examples over purely round, repetitive, or recall-only items.",
                "- Include plausible near-miss values that reveal misconceptions.",
                "- Keep visible game text short, but make the reasoning in hint/explanation clearly harder than easy/medium.",
            ]
        )

    return "\n".join(lines)


def _format_context(ctx: RetrievedContext) -> str:
    lines = []
    if ctx.curriculum_context:
        c = ctx.curriculum_context
        lines.append("GDPT 2018 curriculum authority:")
        lines.append(f"  Objective ({c.objective_id}): {c.objective_text}")
        lines.append(f"  Subject/grade/topic: {c.subject} / grade {c.grade} / {c.topic}")
        lines.append(f"  Cognitive level: {c.cognitive_level}")
        lines.append(f"  Curriculum difficulty: {c.curriculum_difficulty}")
        lines.append(f"  Allowed difficulty range: {', '.join(c.allowed_difficulty_range)}")
        lines.append(f"  Scope status: {c.scope_status}")
        if c.recommended_question_types:
            lines.append(f"  Recommended question types: {', '.join(c.recommended_question_types)}")
        if c.not_allowed_question_types:
            lines.append(f"  Not allowed: {', '.join(c.not_allowed_question_types)}")
    elif ctx.objective_text:
        lines.append(f"Objective ({ctx.objective_id}): {ctx.objective_text}")
    else:
        lines.append(f"Objective id: {ctx.objective_id or '(none)'}")
    if ctx.difficulty_assessment:
        d = ctx.difficulty_assessment
        lines.append("\nDifficulty assessment:")
        lines.append(f"  Teacher requested: {d.teacher_requested_difficulty}")
        lines.append(f"  Final difficulty: {d.final_difficulty}")
        lines.append(f"  Rationale: {d.difficulty_rationale}")
    if ctx.teacher_lesson_context:
        t = ctx.teacher_lesson_context
        lines.append("\nTeacher lesson/slide context (optional personalization, not curriculum authority):")
        lines.append(f"  Upload type: {t.upload_type}")
        lines.append(f"  Lesson title: {t.lesson_title or '(none)'}")
        lines.append(f"  Teacher focus: {t.teacher_focus}")
        if t.time_limit_minutes:
            lines.append(f"  Time limit: {t.time_limit_minutes} minutes")
        if t.student_level_note:
            lines.append(f"  Student note: {t.student_level_note}")
        if t.constraints:
            lines.append(f"  Constraints: {', '.join(t.constraints)}")
        if t.preferred_examples:
            lines.append("  Preferred examples:")
            for ex in t.preferred_examples:
                lines.append(f"    - {ex.raw_text} -> {ex.structured}")
    if ctx.alignment_result:
        a = ctx.alignment_result
        lines.append("\nAlignment result:")
        lines.append(f"  Aligned with curriculum: {a.is_aligned_with_curriculum}")
        lines.append(f"  Confidence: {a.alignment_confidence}")
        if a.mismatch_warnings:
            lines.append(f"  Warnings: {'; '.join(a.mismatch_warnings)}")
        if a.recommended_adjustments:
            lines.append(f"  Adjustments: {'; '.join(a.recommended_adjustments)}")
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
    *,
    subject: str,
    grade: int,
    difficulty: str,
    prompt: str,
    candidates: list[TemplateMeta],
    ctx: RetrievedContext | None = None,
) -> str:
    cand_lines = [
        f"- {c.id}: {c.name} — {c.description} (fits: {', '.join(c.content_type_fit)})"
        for c in candidates
    ]
    parts = [
        f"Subject: {subject}\nGrade: {grade}\nDifficulty: {difficulty}\n"
        f"Teacher request: {prompt}",
    ]
    if ctx:
        parts.append(_format_context(ctx))
    parts.append("Candidate templates:\n" + "\n".join(cand_lines))
    return "\n\n".join(parts)


GAME_RECOMMENDER_SYSTEM = """You are a curriculum-aware game-design advisor for Vietnamese \
teachers (chương trình GDPT 2018). You are given a lesson request and the full list of ready-to-play \
games. Rank EVERY game by how well it suits this lesson, grade, and objective — most suitable first, \
least suitable last. Include all games even if some are a weaker fit; never drop one. Use each game's \
recommended grade range as a suitability signal (a game listed for higher grades is a weaker fit for \
young pupils, but may still be offered). For EVERY game, write a brief, teacher-facing introduction in \
Vietnamese (one or two friendly sentences) that says what the game is and why it does or does not fit \
this particular lesson. Reply only via the tool."""


def build_game_recommender_user(
    *,
    subject: str,
    grade: int,
    difficulty: str,
    prompt: str,
    games: list[TemplateMeta],
) -> str:
    game_lines = [
        f"- {g.id}: {g.name} — {g.description} (suits grades {g.grade_range[0]}-{g.grade_range[1]})"
        for g in games
    ]
    return (
        f"Subject: {subject}\nGrade: {grade}\nDifficulty: {difficulty}\n"
        f"Teacher request: {prompt}\n\n"
        "Available games:\n" + "\n".join(game_lines)
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
        _difficulty_guidance(difficulty, grade, template.id, ctx),
    ]
    if template.id == "matching":
        parts.append(
            "\nMatching-specific output rules:\n"
            "- Keep `left`, `right`, and `distractors` as short card labels, ideally under 12 Vietnamese words.\n"
            "- Put detailed reasoning only in `explanation`, not in the card labels.\n"
            "- If teacher context provides an example such as '3 giỏ táo, mỗi giỏ 4 quả', make the first pair use that exact context.\n"
            "- Distractors should be short wrong right-side cards, e.g. '3 + 4 = 7' or '3 quả', not long explanations.\n"
            "- The rationale should describe the actual text matching mechanic; do not call it picture matching unless images are present."
        )
    if template.id == "feed_the_cats":
        parts.append(
            "\nFeed the Hungry Cats-specific output rules — CRITICAL:\n"
            "- This game accepts ONLY short arithmetic expressions on fish treats, such as '8 + 7', '45 - 18', '6 x 4', '56 / 7'.\n"
            "- `correct_answer` MUST be a plain numeric string only, such as '15' or '24'. Do NOT include units like 'cm', 'm', 'kg', 'l'.\n"
            "- If the teacher topic is measurement or unit conversion, convert it into numeric arithmetic practice and keep unit context in `hint`/`explanation`, not in `correct_answer`.\n"
            "- Create 2-5 distinct numeric cat labels. Every distinct `correct_answer` MUST appear in at least 2 items.\n"
            "- Example valid grouping: answers 12, 24, 36 with two or three expressions for each answer.\n"
            "- Do NOT create word problems, definitions, matching cards, or multiple-choice questions for this template."
        )
    if template.id == "beat_forge":
        parts.append(
            "\nBeat Forge lane arithmetic — CRITICAL:\n"
            "Bar capacity in 24th-units: 4/4=24  3/4=18  2/4=12  6/8=18\n"
            "Note values in 24th-units:  1/2=12  1/4=6  1/8=3  d.1/2=18  d.1/4=9  t.1/8=2\n"
            "\n"
            "Each lane's correct_answer tokens MUST sum exactly to the bar capacity.\n"
            "  4/4 (cap=24): '1/4,1/4,1/4,1/4'=24 ✓  '1/2,1/4,1/4'=24 ✓  '1/8,1/8,1/4,1/2'=24 ✓\n"
            "  3/4 (cap=18): '1/4,1/4,1/4'=18 ✓  'd.1/2'=18 ✓  'd.1/4,d.1/4'=18 ✓\n"
            "  6/8 (cap=18): '1/8,1/8,1/8,1/8,1/8,1/8'=18 ✓  'd.1/4,d.1/4'=18 ✓\n"
            "\n"
            "Supply counts (half_notes etc.) are auto-computed server-side from the lanes —\n"
            "provide best-effort counts but any arithmetic error there is corrected automatically.\n"
            "The ONLY thing that must be exactly right is each lane's token sum = bar capacity."
        )
    if repair_errors:
        parts.append(
            "\nSchema repair strategy:\n"
            "- Treat validation errors as hard constraints, not suggestions.\n"
            "- If an error location is `<root>` or describes a collection/model-level invariant, rebuild the affected collection from scratch instead of patching one item.\n"
            "- Re-check the selected template schema: required fields, min/max counts, enum values, const ids, uniqueness, grouping, and numeric/text format constraints.\n"
            "- Before returning, run a manual consistency check against the exact validation errors and the curriculum scope.\n"
            "- Do not introduce a new template, above-grade concept, or unsupported content type while repairing."
        )
        parts.append(
            "\nYour previous output FAILED schema validation. Fix exactly these problems "
            "and return valid content:\n- " + "\n- ".join(repair_errors)
        )
    return "\n".join(parts)
