"""Input guardrails for the agent workflow.

Before any retrieval or generation runs, a lesson request is screened so the tool
fails gracefully (explain + ask to re-prompt) instead of generating ungrounded,
off-topic, or age-inappropriate content. Three problems are caught:

1. **Out of scope** — the subject or grade is outside the knowledge base. The KB
   currently grounds only primary-school Math (grades 1-5) plus a legacy history
   objective, so anything else has no curriculum to stand on.
2. **Irrelevant / above grade** — the prompt asks for content that does not belong
   to the chosen subject, or that exceeds the chosen grade's scope.
3. **Not child-friendly** — the prompt requires content that is unsafe or not
   age-appropriate for a classroom game.

The check is layered cheapest-first: a deterministic scope check (free) and a tiny
explicit-term screen run always; a nuanced LLM screen (relevance + safety) runs only
when an API key is configured and **fails open** on any error, since the deterministic
layers already cover the hard rejections.
"""

from __future__ import annotations

import asyncio
import re
from functools import lru_cache
from typing import Literal

from pydantic import BaseModel, Field

from app.agents.llm import call_tool
from app.config import settings
from app.retrieval.context import _norm, default_provider

GuardrailCode = Literal[
    "ok",
    "out_of_scope_subject",
    "out_of_scope_grade",
    "irrelevant",
    "above_grade",
    "unsafe",
    "unclear",
]


class GuardrailReport(BaseModel):
    """Verdict for one lesson request. ``allowed`` gates the pipeline."""

    allowed: bool = True
    code: GuardrailCode = "ok"
    message: str = Field("", description="Teacher-facing explanation (Vietnamese) of the problem.")
    suggestion: str = Field("", description="How to re-prompt (Vietnamese).")


_ALLOW = GuardrailReport(allowed=True, code="ok")

# Minimal, unambiguous explicit-content terms. Kept deliberately tiny so legitimate
# educational topics (war, weapons in history, death in biology) are NOT blocked here;
# nuance is delegated to the LLM screen.
_BLOCKED_TERMS = (
    "khieu dam", "phim sex", "khoa than", "ma tuy", "thuoc lac", "ca do",
    "tu tu", "tu sat", "che tao bom", "che tao thuoc no",
    "porn", "sex video", "nude", "heroin", "cocaine", "make a bomb", "suicide",
)
_SOURCE_TEXT_BLOCKED_TERMS_RAW = (
    "khiêu dâm", "phim sex", "khỏa thân", "khoả thân", "ma túy", "ma tuý",
    "thuốc lắc", "cá độ", "tự tử", "tự sát", "chế tạo bom", "chế tạo thuốc nổ",
    "porn", "sex video", "nude", "heroin", "cocaine", "make a bomb", "suicide",
)

# Decimals ("0,5", "1,25") are comma-separated and never adjacent to "/"; excluding
# slash-adjacency avoids matching comma-joined fraction tokens like "1/4,1/4" ("4,1").
_DECIMAL_NUMBER_RE = re.compile(r"(?<![\d/])\d+,\d+(?![\d/])")
_DECIMAL_SCOPE_TERMS = (
    "so thap phan",
    "phan thap phan",
    "phan nguyen",
    "dau phay",
)
_FRACTION_NUMBER_RE = re.compile(r"(?<!\d)\d+/\d+(?!\d)")
_FRACTION_SCOPE_TERMS = (
    "phan so",
    "mau so",
    "rut gon phan so",
    "so sanh phan so",
    "cong phan so",
    "tru phan so",
)
_FRACTION_TU_SO_RE = re.compile(r"(?<![a-z0-9])(?<!thu )tu so(?![a-z0-9])")
_PERCENT_SCOPE_TERMS = (
    "phan tram",
    "ti so phan tram",
    "ty so phan tram",
)
_SUBJECT_ALIASES = {
    "toan hoc": "toan",
}


@lru_cache(maxsize=1)
def _coverage() -> dict[str, set[int]]:
    """KB coverage as ``{subject_display: {grades}}``; empty if the provider can't report it."""
    fn = getattr(default_provider, "coverage", None)
    return fn() if callable(fn) else {}


def _supported_summary(cov: dict[str, set[int]]) -> str:
    parts = []
    for subject, grades in cov.items():
        gs = sorted(grades)
        rng = f"{gs[0]}-{gs[-1]}" if gs == list(range(gs[0], gs[-1] + 1)) else ", ".join(map(str, gs))
        parts.append(f"{subject} (lớp {rng})")
    return "; ".join(parts)


def _check_scope(subject: str, grade: int) -> GuardrailReport | None:
    """Deterministic out-of-scope rejection (case 1). ``None`` means in scope."""
    cov = _coverage()
    if not cov:  # Unknown coverage — don't block on a guess.
        return None

    by_norm = {_norm(s): s for s in cov}
    nsubj = _SUBJECT_ALIASES.get(_norm(subject), _norm(subject))
    if nsubj not in by_norm:
        return GuardrailReport(
            allowed=False,
            code="out_of_scope_subject",
            message=(
                f"Kho tri thức hiện chưa hỗ trợ môn “{subject}”. "
                f"Hệ thống mới phủ: {_supported_summary(cov)}."
            ),
            suggestion="Vui lòng chọn một môn/lớp đã được hỗ trợ rồi nhập lại yêu cầu.",
        )

    grades = cov[by_norm[nsubj]]
    if grade not in grades:
        gs = sorted(grades)
        return GuardrailReport(
            allowed=False,
            code="out_of_scope_grade",
            message=(
                f"Môn “{subject}” hiện chỉ hỗ trợ lớp {', '.join(map(str, gs))}, "
                f"chưa có dữ liệu cho lớp {grade}."
            ),
            suggestion=f"Vui lòng chọn lớp trong khoảng {gs[0]}-{gs[-1]} rồi nhập lại yêu cầu.",
        )
    return None


def _contains_normalized_blocked_term(text: str, terms: tuple[str, ...]) -> bool:
    haystack = _norm(text)
    return any(re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", haystack) for term in terms)


def _contains_normalized_scope_term(haystack: str, terms: tuple[str, ...]) -> bool:
    return any(re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", haystack) for term in terms)


def _has_fraction_scope_concept(haystack: str) -> bool:
    return _contains_normalized_scope_term(haystack, _FRACTION_SCOPE_TERMS) or bool(_FRACTION_TU_SO_RE.search(haystack))


def _contains_raw_blocked_term(text: str, terms: tuple[str, ...]) -> bool:
    haystack = text.casefold()
    for term in terms:
        needle = term.casefold()
        if needle.isascii() and re.fullmatch(r"[a-z0-9 ]+", needle):
            if re.search(rf"(?<![a-z0-9]){re.escape(needle)}(?![a-z0-9])", haystack):
                return True
            continue
        if needle in haystack:
            return True
    return False


def _keyword_safety(prompt: str, source_text: str | None) -> GuardrailReport | None:
    """Fast block for unambiguous non-child-friendly terms (case 3). ``None`` if clean."""
    prompt_blocked = _contains_normalized_blocked_term(prompt, _BLOCKED_TERMS)
    source_blocked = bool(source_text) and _contains_raw_blocked_term(
        source_text or "",
        _SOURCE_TEXT_BLOCKED_TERMS_RAW,
    )
    if prompt_blocked or source_blocked:
        return GuardrailReport(
            allowed=False,
            code="unsafe",
            message="Yêu cầu chứa nội dung không phù hợp với môi trường giáo dục cho học sinh.",
            suggestion="Vui lòng nhập lại một chủ đề học tập an toàn, phù hợp lứa tuổi.",
        )
    return None


def _keyword_curriculum_scope(subject: str, grade: int, prompt: str, source_text: str | None) -> GuardrailReport | None:
    """Block clear above-grade primary Math concepts before retrieval/generation."""
    if _norm(subject) not in {"toan", "toan hoc"} or grade >= 5:
        return None

    haystack_raw = f"{prompt} {source_text or ''}"
    haystack = _norm(haystack_raw)

    if grade < 4:
        has_fraction_concept = _has_fraction_scope_concept(haystack)
        has_fraction_notation = bool(_FRACTION_NUMBER_RE.search(haystack_raw))
        if has_fraction_concept or has_fraction_notation:
            return GuardrailReport(
                allowed=False,
                code="above_grade",
                message=(
                    "Yêu cầu có nội dung về phân số như tử số, mẫu số, so sánh hoặc phép tính phân số. "
                    "Nội dung này thuộc phạm vi Toán lớp 4 trở lên, chưa phù hợp với Toán lớp 3."
                ),
                suggestion=(
                    "Hãy đổi lớp sang 4 nếu muốn tạo trò chơi về phân số, hoặc giữ lớp 3 và chọn nội dung "
                    "như phép nhân/chia trong phạm vi 100, chu vi/diện tích cơ bản, đo lường hoặc bảng số liệu đơn giản."
                ),
            )

    has_percent_concept = "%" in haystack_raw or any(term in haystack for term in _PERCENT_SCOPE_TERMS)
    if has_percent_concept:
        return GuardrailReport(
            allowed=False,
            code="above_grade",
            message="Yêu cầu có nội dung về tỉ số phần trăm, thuộc phạm vi Toán lớp 5.",
            suggestion="Hãy chọn lớp 5 nếu muốn tạo trò chơi về phần trăm, hoặc đổi nội dung về phạm vi lớp hiện tại.",
        )

    has_decimal_concept = any(term in haystack for term in _DECIMAL_SCOPE_TERMS)
    has_decimal_notation = bool(_DECIMAL_NUMBER_RE.search(haystack_raw))
    if not (has_decimal_concept or has_decimal_notation):
        return None

    return GuardrailReport(
        allowed=False,
        code="above_grade",
        message=(
            "Yêu cầu có nội dung về số thập phân dạng 0,5/1,25 hoặc phần thập phân. "
            "Nội dung này thuộc phạm vi Toán lớp 5, chưa phù hợp với lớp dưới 5."
        ),
        suggestion=(
            "Hãy chọn lớp 5 nếu muốn tạo trò chơi về số thập phân, hoặc đổi yêu cầu về "
            "cấu tạo thập phân của số tự nhiên theo đúng lớp hiện tại."
        ),
    )


_SCREEN_SYSTEM = """You are a safety-and-scope guardrail for a learning-game generator \
for school children following Vietnam's GDPT 2018 curriculum. The UI/output language is \
Vietnamese, but that does NOT mean the subject is Vietnamese Language. The subject authority \
is ONLY the explicit `Môn` field in the user message. For example, if `Môn: Toán`, evaluate \
the request as Mathematics even though the request and your explanation are written in Vietnamese. \
You DO NOT create content; you only judge whether a teacher's request should proceed. Given the \
subject, grade, and request, return exactly one verdict via the tool:
- "ok": the request is on-topic for the subject, within the grade's scope, and child-appropriate.
- "irrelevant": the request asks for content that does not belong to the stated subject.
- "above_grade": the request belongs to the subject but clearly exceeds the stated grade's level.
- "unsafe": the request is violent, sexual, hateful, dangerous, or otherwise not child-friendly.
- "unclear": the request is too vague to generate a meaningful learning game.
A request may dress a subject's skill in a real-world or cross-domain theme. Judge by the \
underlying skill being practiced, NOT by the theme. In particular, using musical rhythm — note \
durations, time signatures, bars, or dotted/triplet notes — as a concrete way to practice \
fraction addition, equivalent fractions, or common denominators is a legitimate Mathematics \
activity (this tool's library includes a music-themed fraction game). When `Môn: Toán`, treat \
such a request as Math and return "ok" if the underlying fraction skill fits the grade; do NOT \
return "irrelevant" just because the wording mentions music or notes. \
Educational topics that mention conflict, war, or the human body in an age-appropriate, curricular \
way are "ok" — only flag "unsafe" for genuinely inappropriate content. Uploaded teacher documents \
are supporting context; do not block solely because of parser noise, isolated ambiguous words, or \
unrelated administrative text unless the teacher request or lesson material clearly asks to generate \
unsafe classroom content. Write `reason` and \
`suggestion` in Vietnamese, friendly and concrete, telling the teacher how to re-prompt."""


def _screen_user(subject: str, grade: int, prompt: str, source_text: str | None) -> str:
    parts = [f"Môn: {subject}", f"Lớp: {grade}", f"Yêu cầu của giáo viên: {prompt}"]
    if source_text:
        parts.append(f"Tài liệu giáo viên cung cấp:\n{source_text[:1500]}")
    return "\n".join(parts)


_VERDICT_TO_CODE: dict[str, GuardrailCode] = {
    "irrelevant": "irrelevant",
    "above_grade": "above_grade",
    "unsafe": "unsafe",
    "unclear": "unclear",
}


async def _llm_screen(subject: str, grade: int, prompt: str, source_text: str | None) -> GuardrailReport:
    """Nuanced relevance + safety screen (cases 2 & 3). Fails open to the caller via exceptions."""
    result = await call_tool(
        system=_SCREEN_SYSTEM,
        user=_screen_user(subject, grade, prompt, source_text),
        tool_name="screen_request",
        tool_description="Judge whether the lesson request may proceed.",
        input_schema={
            "type": "object",
            "properties": {
                "verdict": {
                    "type": "string",
                    "enum": ["ok", "irrelevant", "above_grade", "unsafe", "unclear"],
                    "description": "Single verdict for the request.",
                },
                "reason": {"type": "string", "description": "Vietnamese, why (one or two sentences)."},
                "suggestion": {"type": "string", "description": "Vietnamese, how to re-prompt."},
            },
            "required": ["verdict", "reason", "suggestion"],
        },
    )
    verdict = result.get("verdict", "ok")
    code = _VERDICT_TO_CODE.get(verdict)
    if code is None:  # "ok" or anything unexpected -> allow.
        return _ALLOW
    return GuardrailReport(
        allowed=False,
        code=code,
        message=result.get("reason") or "Yêu cầu chưa phù hợp để tạo trò chơi học tập.",
        suggestion=result.get("suggestion") or "Vui lòng điều chỉnh và nhập lại yêu cầu.",
    )


async def run_guardrails(
    *, subject: str, grade: int, prompt: str, source_text: str | None = None
) -> GuardrailReport:
    """Screen a lesson request; return the first blocking report or an allow verdict."""
    scope = _check_scope(subject, grade)
    if scope is not None:
        return scope

    keyword = _keyword_safety(prompt, source_text)
    if keyword is not None:
        return keyword

    curriculum_scope = _keyword_curriculum_scope(subject, grade, prompt, source_text)
    if curriculum_scope is not None:
        return curriculum_scope

    if settings.has_api_key:
        try:
            return await asyncio.wait_for(
                _llm_screen(subject, grade, prompt, source_text),
                timeout=10.0,  # never let a slow/hung API call block the whole request
            )
        except (Exception, asyncio.TimeoutError):  # noqa: BLE001
            return _ALLOW

    return _ALLOW


async def guardrail_node(state: dict) -> dict:
    """LangGraph entry node. Blocks short-circuit the graph to END via ``after_guardrail``."""
    report = await run_guardrails(
        subject=state["subject"],
        grade=state["grade"],
        prompt=state["prompt"],
        source_text=state.get("source_text"),
    )
    if report.allowed:
        return {"blocked": False}
    return {
        "blocked": True,
        "ok": False,
        "error": report.message,
        "guardrail": report.model_dump(),
    }


def after_guardrail(state: dict) -> str:
    return "blocked" if state.get("blocked") else "ok"
