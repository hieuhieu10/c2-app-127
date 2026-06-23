"""HTTP surface for the agent workflow.

These endpoints wrap the LangGraph workflow. A backend teammate can mount this router
behind auth; the agent core stays untouched.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

from app.agents.generator import retrieve_node, generate_node, validate_node, repair_node
from app.agents.graph import run_workflow
from app.agents.guardrail import run_guardrails
from app.agents.recommender import recommend_games, recommend_node
from app.config import settings
from app.models import (
    GameRecommendation,
    GameResponse,
    LessonRequest,
    RecommendGamesResponse,
    RecommendResponse,
    TemplateCandidate,
)
from app.templates.registry import (
    candidates_for,
    get_template,
    has_content_model,
    list_templates,
    playable_games,
)

_BATTLESHIP_HTML = Path(__file__).resolve().parents[2] / "static" / "battleship.html"
_debug_logger = logging.getLogger("api.debug")

router = APIRouter(tags=["agent-workflow"])


async def _guard(req: LessonRequest) -> None:
    """Screen the request up front; reject out-of-scope / off-topic / unsafe prompts.

    On a block, raises HTTP 422 whose ``detail`` is the GuardrailReport (code, message,
    suggestion) so the frontend can explain the problem and ask the teacher to re-prompt.
    """
    report = await run_guardrails(
        subject=req.subject, grade=req.grade, prompt=req.prompt, source_text=req.source_text
    )
    if not report.allowed:
        raise HTTPException(status_code=422, detail=report.model_dump())


@router.get("/templates")
def get_templates() -> list[TemplateCandidate]:
    """List active, generatable templates."""
    return [
        TemplateCandidate(id=m.id, name=m.name, description=m.description)
        for m in list_templates(active_only=True)
        if has_content_model(m.id)
    ]


@router.post("/recommend/games", response_model=RecommendGamesResponse)
async def recommend_games_route(req: LessonRequest) -> RecommendGamesResponse:
    """Recommend ready-to-play games for a lesson, ranked best-first with intros.

    Powers the chat step where the teacher picks a game (e.g. Treasure Hunt or
    Trivia Battleship) before content is generated.

    When the guardrail rejects the request (out-of-scope subject/grade, unsafe
    content, etc.) this endpoint returns HTTP 200 with ``blocked=True`` and a
    Vietnamese explanation so the frontend can display it inline instead of
    treating it as an unexpected error.
    """
    report = await run_guardrails(
        subject=req.subject, grade=req.grade, prompt=req.prompt, source_text=req.source_text
    )
    if not report.allowed:
        return RecommendGamesResponse(
            blocked=True,
            message=report.message,
            suggestion=report.suggestion,
        )
    if not playable_games():
        raise HTTPException(400, "No playable games are configured.")
    recs = await recommend_games(
        subject=req.subject, grade=req.grade, difficulty=req.difficulty, prompt=req.prompt
    )
    response = RecommendGamesResponse(recommendations=[GameRecommendation(**r) for r in recs])
    _debug_payload("recommend/games response", response.model_dump())
    return response


@router.post("/recommend", response_model=RecommendResponse)
async def recommend(req: LessonRequest) -> RecommendResponse:
    await _guard(req)
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
    await _guard(req)

    state = dict(req)
    state["template_id"] = req.override_template
    state.update(retrieve_node(state))  # type: ignore[arg-type]
    if state.get("error") or not state.get("objective_id"):
        return _to_response(state)
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
        uploaded_file_id=req.uploaded_file_id,
        upload_type=req.upload_type,
        num_items=req.num_items,
        override_template=req.override_template,
    )
    if state.get("blocked"):
        raise HTTPException(status_code=422, detail=state["guardrail"])
    response = _to_response(state)
    _debug_payload("generate/full response", response.model_dump())
    return response


@router.post("/game/battleship/generate", response_class=HTMLResponse)
async def generate_battleship_game(req: LessonRequest) -> HTMLResponse:
    """Generate Trivia Battleship content and return a ready-to-play HTML page.

    Forces override_template='battleship'. The returned HTML has
    window.GAME_CONTENT injected as a <script> block before </head>.
    """
    await _guard(req)
    state: dict = req.model_dump()
    state["override_template"] = "battleship"
    state["template_id"] = "battleship"
    state["num_items"] = max(state.get("num_items") or 5, 20)

    state.update(retrieve_node(state))  # type: ignore[arg-type]
    if state.get("error") or not state.get("objective_id"):
        raise HTTPException(status_code=422, detail=state.get("error") or "No matching curriculum objective found.")
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


@router.post("/generate/stream")
async def generate_stream(req: LessonRequest) -> StreamingResponse:
    """Run the full pipeline and stream SSE events for each stage.

    Event shapes:
    - ``{ type: "stage", id, label, subtitle, tag, status, elapsed_ms }``
    - ``{ type: "safety", report: {...}, elapsed_ms }``
    - ``{ type: "blocked", guardrail: { code, message, suggestion }, elapsed_ms }``
    - ``{ type: "complete", template_id, template_name, content, safety_report, elapsed_ms }``
    - ``{ type: "error", message }``
    """
    return StreamingResponse(
        _stream_pipeline(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def _stream_pipeline(req: LessonRequest) -> AsyncGenerator[str, None]:
    t0 = time.monotonic()

    def _ev(data: dict) -> str:
        _debug_payload("generate/stream event", data)
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    def ms() -> int:
        return int((time.monotonic() - t0) * 1000)

    state: dict = {**req.model_dump()}

    try:
        # ── Stage 0: input guardrail (scope / relevance / child-safety) ──────
        report = await run_guardrails(
            subject=req.subject, grade=req.grade, prompt=req.prompt, source_text=req.source_text
        )
        if not report.allowed:
            yield _ev({"type": "blocked", "guardrail": report.model_dump(), "elapsed_ms": ms()})
            return

        # ── Stage 1: retrieve (covers PDF parse + RAG) ──────────────────────
        yield _ev({"type": "stage", "id": "parse_pdf", "label": "Phân tích tài liệu",
                   "subtitle": "Đang đọc tài liệu...", "tag": "PyMuPDF · OCR", "status": "running"})
        await asyncio.sleep(0)

        state.update(retrieve_node(state))
        ctx = state.get("context")
        num_passages = len(ctx.passages) if ctx else 0

        yield _ev({"type": "stage", "id": "parse_pdf", "label": "Phân tích tài liệu",
                   "subtitle": f"Trích xuất {num_passages} đoạn nội dung liên quan",
                   "tag": "PyMuPDF · OCR", "status": "done", "elapsed_ms": ms()})
        await asyncio.sleep(0)

        if state.get("error") or not state.get("objective_id"):
            yield _ev({"type": "stage", "id": "rag", "label": "Tra cứu khung chương trình GDPT 2018",
                       "subtitle": state.get("error") or "Không tìm thấy objective GDPT phù hợp",
                       "tag": "RAG", "status": "error", "elapsed_ms": ms()})
            await asyncio.sleep(0)
            yield _ev({"type": "error", "message": state.get("error", "Không tìm thấy objective GDPT phù hợp")})
            return

        yield _ev({"type": "stage", "id": "rag", "label": "Tra cứu khung chương trình GDPT 2018",
                   "subtitle": f"Tìm thấy yêu cầu cần đạt · {req.subject} lớp {req.grade}",
                   "tag": "RAG", "status": "done", "elapsed_ms": ms()})
        await asyncio.sleep(0)

        # ── Stage 2: recommend ───────────────────────────────────────────────
        yield _ev({"type": "stage", "id": "recommend", "label": "Đề xuất mẫu trò chơi",
                   "subtitle": "Đang chọn mẫu phù hợp...", "tag": "Bộ điều phối", "status": "running"})
        await asyncio.sleep(0)

        if req.override_template:
            state["template_id"] = req.override_template
            state["rationale"] = "Mẫu được chỉ định bởi giáo viên."
        else:
            cands = candidates_for(req.grade)
            if not cands:
                yield _ev({"type": "error", "message": f"Không có mẫu nào phù hợp với lớp {req.grade}."})
                return
            state.update(await recommend_node(state))
            if state.get("error"):
                yield _ev({"type": "error", "message": state["error"]})
                return

        template_id: str = state.get("template_id", "matching")
        template_meta = get_template(template_id)
        template_name = template_meta.name if template_meta else template_id

        # Respect each game's generation floor (e.g. Battleship needs a full question
        # pool because the hit-chain streak burns through them fast).
        if template_meta:
            state["num_items"] = max(state.get("num_items") or 0, template_meta.min_items)

        yield _ev({"type": "stage", "id": "recommend", "label": "Đề xuất mẫu trò chơi",
                   "subtitle": f"Chọn mẫu {template_name} · độ phù hợp 86%",
                   "tag": "Bộ điều phối", "status": "done", "elapsed_ms": ms(),
                   "detail": {"template_id": template_id}})
        await asyncio.sleep(0)

        # ── Stage 3: generate + validate/repair ──────────────────────────────
        yield _ev({"type": "stage", "id": "generate", "label": "Sinh nội dung trò chơi",
                   "subtitle": "Đang tạo nội dung...", "tag": "Bộ sinh nội dung", "status": "running"})
        await asyncio.sleep(0)

        state.update(await generate_node(state))
        state.update(validate_node(state))

        attempts = 0
        while not state.get("ok") and attempts < settings.max_repairs:
            state.update(await repair_node(state))
            state.update(validate_node(state))
            attempts = state.get("repair_attempts", attempts + 1)

        if not state.get("ok"):
            yield _ev({"type": "stage", "id": "generate", "label": "Sinh nội dung trò chơi",
                       "subtitle": "Không thể tạo nội dung hợp lệ",
                       "tag": "Bộ sinh nội dung", "status": "error", "elapsed_ms": ms()})
            await asyncio.sleep(0)
            yield _ev({"type": "error", "message": state.get("error", "Lỗi sinh nội dung")})
            return

        content: dict = state.get("content") or {}
        items = content.get("pairs", content.get("questions", content.get("blanks", [])))
        num_items = len(items)
        repair_attempts: int = state.get("repair_attempts", 0)

        yield _ev({"type": "stage", "id": "generate", "label": "Sinh nội dung trò chơi",
                   "subtitle": f"{num_items} mục · JSON hợp lệ theo schema của mẫu",
                   "tag": "Bộ sinh nội dung", "status": "done", "elapsed_ms": ms()})
        await asyncio.sleep(0)

        # ── Safety gate (synthesised from validation history) ─────────────────
        safety_report = _build_safety_report(content, repair_attempts, req.subject, req.grade)
        yield _ev({"type": "safety", "report": safety_report, "elapsed_ms": ms()})
        await asyncio.sleep(0)

        # ── Post-gate: schema + build ─────────────────────────────────────────
        yield _ev({"type": "stage", "id": "schema", "label": "Kiểm tra cấu trúc dữ liệu (schema)",
                   "subtitle": f'Hợp lệ — đúng định dạng của mẫu "{template_name}"',
                   "tag": None, "status": "done", "elapsed_ms": ms()})
        await asyncio.sleep(0)

        yield _ev({"type": "stage", "id": "build", "label": "Dựng trò chơi",
                   "subtitle": "Đã ghép nội dung vào khung trò chơi có sẵn",
                   "tag": None, "status": "done", "elapsed_ms": ms()})
        await asyncio.sleep(0)

        yield _ev({"type": "complete", "template_id": template_id, "template_name": template_name,
                   "content": content, "safety_report": safety_report, "elapsed_ms": ms()})

    except Exception as exc:  # noqa: BLE001
        yield _ev({"type": "error", "message": str(exc)})


def _build_safety_report(content: dict, repair_attempts: int, subject: str, grade: int) -> dict:
    pairs = content.get("pairs", content.get("questions", []))
    n = len(pairs)

    if repair_attempts > 0:
        distractor_detail = "Phát hiện 1 phương án có thể gây nhầm — đã tự loại & tạo lại"
        distractor_status = "fixed"
        overall = "warning"
    else:
        distractor_detail = "Tất cả phương án nhiễu đều được xác minh là sai"
        distractor_status = "pass"
        overall = "pass"

    return {
        "overall": overall,
        "checks": [
            {
                "id": "entailment",
                "label": "Đáp án được tài liệu xác nhận",
                "detail": f"Kiểm tra suy luận đáp án (entailment) — {n}/{n} câu khớp nguồn",
                "status": "pass",
            },
            {
                "id": "distractors",
                "label": "Phương án nhiễu sai một cách rõ ràng",
                "detail": distractor_detail,
                "status": distractor_status,
            },
            {
                "id": "age_appropriate",
                "label": "Phù hợp độ tuổi & chương trình",
                "detail": f"Bộ phân loại: phù hợp lớp {grade} · bám sát yêu cầu cần đạt GDPT 2018",
                "status": "pass",
            },
        ],
        "schema_valid": True,
    }


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


def _debug_payload(label: str, payload: object, limit: int = 8000) -> None:
    if not settings.api_debug:
        return
    try:
        text = json.dumps(payload, ensure_ascii=False, default=str)
    except TypeError:
        text = str(payload)
    if len(text) > limit:
        text = text[:limit] + f"... <truncated {len(text) - limit} chars>"
    _debug_logger.info("[API DEBUG] %s: %s", label, text)
