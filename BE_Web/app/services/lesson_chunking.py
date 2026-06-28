from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field
from typing import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import LessonUploadChunk

MAX_CHUNK_CHARS = 2_500
CHUNK_OVERLAP_CHARS = 200
MAX_RETRIEVED_CHARS = 8_000

_PAGE_RE = re.compile(r"^=+\s*PAGE\s+(\d+)\s*=+\s*$", re.IGNORECASE | re.MULTILINE)
_LESSON_HEADING_RE = re.compile(
    r"(?im)^\s*(?:b[aà]i|ti[eế]t)\s*([0-9]{1,3}|[ivxlcdm]+)\s*[:.\-–)]?\s*(.{0,180})$"
)
_TOKEN_RE = re.compile(r"[a-z0-9]+")
_STOPWORDS = {
    "bai",
    "tiet",
    "trang",
    "tao",
    "game",
    "tro",
    "choi",
    "mon",
    "toan",
    "lop",
    "luyen",
    "tap",
    "on",
}


@dataclass
class LessonChunkDraft:
    chunk_index: int
    chunk_type: str
    title: str | None
    lesson_no: str | None
    page_start: int | None
    page_end: int | None
    text: str
    keywords: list[str] = field(default_factory=list)


@dataclass
class RankedLessonChunk:
    chunk: LessonUploadChunk
    score: float
    reasons: list[str]


@dataclass
class RankedSourceTextChunk:
    draft: LessonChunkDraft
    score: float
    reasons: list[str]


def build_lesson_chunks(text: str) -> list[LessonChunkDraft]:
    normalized = text.strip()
    if not normalized:
        return []

    page_sections = _split_by_page_markers(normalized)
    drafts: list[LessonChunkDraft] = []
    for page_no, page_text in page_sections:
        drafts.extend(_split_page_by_lesson_heading(page_text, page_no))

    if not drafts:
        drafts = _fallback_chunks(normalized)

    merged: list[LessonChunkDraft] = []
    for draft in drafts:
        for piece in _split_long_text(draft.text, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS):
            merged.append(
                LessonChunkDraft(
                    chunk_index=len(merged),
                    chunk_type=draft.chunk_type,
                    title=draft.title,
                    lesson_no=draft.lesson_no,
                    page_start=draft.page_start,
                    page_end=draft.page_end,
                    text=piece,
                    keywords=extract_keywords(f"{draft.title or ''}\n{piece}"),
                )
            )
    return merged


def rank_lesson_chunks(
    db: Session,
    *,
    upload_id: str | int | None,
    user_id: int,
    prompt: str,
    top_k: int = 3,
) -> list[RankedLessonChunk]:
    parsed_upload_id = _parse_int(upload_id)
    if parsed_upload_id is None:
        return []

    chunks = db.scalars(
        select(LessonUploadChunk)
        .where(LessonUploadChunk.upload_id == parsed_upload_id, LessonUploadChunk.user_id == user_id)
        .order_by(LessonUploadChunk.chunk_index)
    ).all()
    if not chunks:
        return []

    prompt_norm = _norm(prompt)
    prompt_tokens = set(_tokens(prompt))
    requested_lessons = set(_extract_lesson_numbers(prompt))
    requested_sessions = set(_extract_session_numbers(prompt))
    requested_pages = set(_extract_page_numbers(prompt))

    ranked = [
        _score_chunk(
            chunk,
            prompt_norm=prompt_norm,
            prompt_tokens=prompt_tokens,
            requested_lessons=requested_lessons,
            requested_sessions=requested_sessions,
            requested_pages=requested_pages,
        )
        for chunk in chunks
    ]
    ranked.sort(key=lambda item: item.score, reverse=True)

    if len(ranked) == 1:
        return ranked
    if not ranked or ranked[0].score <= 0:
        return ranked[:1]

    selected: list[RankedLessonChunk] = []
    total_chars = 0
    for item in ranked:
        if item.score < max(1.0, ranked[0].score * 0.45):
            continue
        if total_chars + len(item.chunk.text) > MAX_RETRIEVED_CHARS and selected:
            break
        selected.append(item)
        total_chars += len(item.chunk.text)
        if len(selected) >= top_k:
            break
    return selected or ranked[:1]


def rank_source_text_chunks(
    source_text: str | None,
    *,
    prompt: str,
    top_k: int = 3,
) -> list[RankedSourceTextChunk]:
    drafts = build_lesson_chunks(source_text or "")
    if not drafts:
        return []

    prompt_norm = _norm(prompt)
    prompt_tokens = set(_tokens(prompt))
    requested_lessons = set(_extract_lesson_numbers(prompt))
    requested_sessions = set(_extract_session_numbers(prompt))
    requested_pages = set(_extract_page_numbers(prompt))

    ranked = [
        _score_draft_chunk(
            draft,
            prompt_norm=prompt_norm,
            prompt_tokens=prompt_tokens,
            requested_lessons=requested_lessons,
            requested_sessions=requested_sessions,
            requested_pages=requested_pages,
        )
        for draft in drafts
    ]
    ranked.sort(key=lambda item: item.score, reverse=True)
    if not ranked or ranked[0].score <= 0:
        return ranked[:1]

    selected: list[RankedSourceTextChunk] = []
    total_chars = 0
    for item in ranked:
        if item.score < max(1.0, ranked[0].score * 0.45):
            continue
        if total_chars + len(item.draft.text) > MAX_RETRIEVED_CHARS and selected:
            break
        selected.append(item)
        total_chars += len(item.draft.text)
        if len(selected) >= top_k:
            break
    return selected or ranked[:1]


def format_ranked_chunks_for_source_text(chunks: Iterable[RankedLessonChunk]) -> str:
    parts = []
    for item in chunks:
        chunk = item.chunk
        header = f"[Teacher chunk {chunk.id}"
        if chunk.title:
            header += f" | {chunk.title}"
        if chunk.page_start:
            header += f" | page {chunk.page_start}"
        header += f" | score {item.score:.2f}]"
        parts.append(f"{header}\n{chunk.text.strip()}")
    return "\n\n".join(parts).strip()


def format_ranked_source_chunks_for_source_text(chunks: Iterable[RankedSourceTextChunk]) -> str:
    parts = []
    for item in chunks:
        draft = item.draft
        header = f"[Teacher chunk fallback {draft.chunk_index}"
        if draft.title:
            header += f" | {draft.title}"
        if draft.page_start:
            header += f" | page {draft.page_start}"
        header += f" | score {item.score:.2f}]"
        parts.append(f"{header}\n{draft.text.strip()}")
    return "\n\n".join(parts).strip()


def selected_chunks_payload(chunks: Iterable[RankedLessonChunk]) -> list[dict]:
    payload = []
    for item in chunks:
        chunk = item.chunk
        payload.append(
            {
                "chunkId": chunk.id,
                "score": round(item.score, 3),
                "reasons": item.reasons,
                "title": chunk.title,
                "lessonNo": chunk.lesson_no,
                "pageStart": chunk.page_start,
                "pageEnd": chunk.page_end,
                "charCount": chunk.char_count,
            }
        )
    return payload


def selected_source_chunks_payload(chunks: Iterable[RankedSourceTextChunk]) -> list[dict]:
    payload = []
    for item in chunks:
        draft = item.draft
        payload.append(
            {
                "chunkId": None,
                "score": round(item.score, 3),
                "reasons": item.reasons,
                "title": draft.title,
                "lessonNo": draft.lesson_no,
                "pageStart": draft.page_start,
                "pageEnd": draft.page_end,
                "charCount": len(draft.text),
                "fallback": True,
            }
        )
    return payload


def extract_keywords(text: str, limit: int = 12) -> list[str]:
    counts: dict[str, int] = {}
    for token in _tokens(text):
        if len(token) < 3 or token in _STOPWORDS:
            continue
        counts[token] = counts.get(token, 0) + 1
    return [token for token, _ in sorted(counts.items(), key=lambda item: (-item[1], item[0]))[:limit]]


def _split_by_page_markers(text: str) -> list[tuple[int | None, str]]:
    matches = list(_PAGE_RE.finditer(text))
    if not matches:
        return [(None, text)]

    sections: list[tuple[int | None, str]] = []
    for index, match in enumerate(matches):
        start = match.end()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(text)
        page_text = text[start:end].strip()
        if page_text:
            sections.append((int(match.group(1)), page_text))
    return sections


def _split_page_by_lesson_heading(page_text: str, page_no: int | None) -> list[LessonChunkDraft]:
    matches = list(_LESSON_HEADING_RE.finditer(page_text))
    if not matches:
        title = _first_nonempty_line(page_text)
        return [
            LessonChunkDraft(
                chunk_index=0,
                chunk_type="page" if page_no else "section",
                title=title,
                lesson_no=None,
                page_start=page_no,
                page_end=page_no,
                text=page_text.strip(),
            )
        ]

    drafts: list[LessonChunkDraft] = []
    if matches[0].start() > 0:
        prefix = page_text[: matches[0].start()].strip()
        if prefix:
            drafts.append(
                LessonChunkDraft(
                    chunk_index=0,
                    chunk_type="page_intro",
                    title=_first_nonempty_line(prefix),
                    lesson_no=None,
                    page_start=page_no,
                    page_end=page_no,
                    text=prefix,
                )
            )

    for index, match in enumerate(matches):
        start = match.start()
        end = matches[index + 1].start() if index + 1 < len(matches) else len(page_text)
        block = page_text[start:end].strip()
        if not block:
            continue
        lesson_no = match.group(1).strip()
        heading_tail = match.group(2).strip(" :-–")
        title = match.group(0).strip()
        if heading_tail:
            title = f"Bài {lesson_no}: {heading_tail}"
        drafts.append(
            LessonChunkDraft(
                chunk_index=len(drafts),
                chunk_type="lesson_section",
                title=title,
                lesson_no=lesson_no,
                page_start=page_no,
                page_end=page_no,
                text=block,
            )
        )
    return drafts


def _fallback_chunks(text: str) -> list[LessonChunkDraft]:
    return [
        LessonChunkDraft(
            chunk_index=index,
            chunk_type="fallback",
            title=_first_nonempty_line(piece),
            lesson_no=None,
            page_start=None,
            page_end=None,
            text=piece,
            keywords=extract_keywords(piece),
        )
        for index, piece in enumerate(_split_long_text(text, MAX_CHUNK_CHARS, CHUNK_OVERLAP_CHARS))
    ]


def _split_long_text(text: str, max_chars: int, overlap: int) -> list[str]:
    clean = text.strip()
    if len(clean) <= max_chars:
        return [clean] if clean else []

    chunks: list[str] = []
    start = 0
    while start < len(clean):
        end = min(len(clean), start + max_chars)
        if end < len(clean):
            boundary = max(clean.rfind("\n\n", start, end), clean.rfind(". ", start, end))
            if boundary > start + max_chars // 2:
                end = boundary + 1
        piece = clean[start:end].strip()
        if piece:
            chunks.append(piece)
        if end >= len(clean):
            break
        start = max(end - overlap, start + 1)
    return chunks


def _score_chunk(
    chunk: LessonUploadChunk,
    *,
    prompt_norm: str,
    prompt_tokens: set[str],
    requested_lessons: set[str],
    requested_sessions: set[str],
    requested_pages: set[int],
) -> RankedLessonChunk:
    score = 0.0
    reasons: list[str] = []
    chunk_norm = _norm(f"{chunk.title or ''}\n{chunk.text}")
    chunk_tokens = set(_tokens(f"{chunk.title or ''}\n{chunk.text}"))

    if requested_lessons and chunk.lesson_no:
        normalized_lesson_no = chunk.lesson_no.lstrip("0") or chunk.lesson_no
        if normalized_lesson_no in requested_lessons or chunk.lesson_no in requested_lessons:
            score += 8.0
            reasons.append(f"Khớp bài {chunk.lesson_no}")

    session_score = _session_match_score(chunk_norm, requested_sessions)
    if session_score > 0:
        score += session_score
        reasons.append("Khop tiet hoc")
    elif session_score < 0:
        score += session_score

    if requested_pages and chunk.page_start and chunk.page_start in requested_pages:
        score += 8.0
        reasons.append(f"Khớp trang {chunk.page_start}")

    title_norm = _norm(chunk.title or "")
    if title_norm and title_norm in prompt_norm:
        score += 5.0
        reasons.append("Khớp tiêu đề")

    overlap = prompt_tokens & chunk_tokens
    keyword_hits = overlap - _STOPWORDS
    if keyword_hits:
        score += min(6.0, len(keyword_hits) * 0.8)
        reasons.append("Trùng từ khóa: " + ", ".join(sorted(keyword_hits)[:6]))

    for keyword in chunk.keywords_json or []:
        if keyword and keyword in prompt_norm:
            score += 0.8

    if chunk.chunk_index == 0:
        score += 0.6
        reasons.append("Đoạn đầu tài liệu")
    elif chunk.chunk_index <= 2:
        score += 0.3

    if not reasons:
        reasons.append("Fallback theo vị trí tài liệu")
    return RankedLessonChunk(chunk=chunk, score=score, reasons=reasons)


def _score_draft_chunk(
    draft: LessonChunkDraft,
    *,
    prompt_norm: str,
    prompt_tokens: set[str],
    requested_lessons: set[str],
    requested_sessions: set[str],
    requested_pages: set[int],
) -> RankedSourceTextChunk:
    score = 0.0
    reasons: list[str] = []
    chunk_norm = _norm(f"{draft.title or ''}\n{draft.text}")
    chunk_tokens = set(_tokens(f"{draft.title or ''}\n{draft.text}"))

    if requested_lessons and draft.lesson_no:
        normalized_lesson_no = draft.lesson_no.lstrip("0") or draft.lesson_no
        if normalized_lesson_no in requested_lessons or draft.lesson_no in requested_lessons:
            score += 8.0
            reasons.append(f"Khớp bài {draft.lesson_no}")

    session_score = _session_match_score(chunk_norm, requested_sessions)
    if session_score > 0:
        score += session_score
        reasons.append("Khop tiet hoc")
    elif session_score < 0:
        score += session_score

    if requested_pages and draft.page_start and draft.page_start in requested_pages:
        score += 8.0
        reasons.append(f"Khớp trang {draft.page_start}")

    title_norm = _norm(draft.title or "")
    if title_norm and title_norm in prompt_norm:
        score += 5.0
        reasons.append("Khớp tiêu đề")

    overlap = prompt_tokens & chunk_tokens
    keyword_hits = overlap - _STOPWORDS
    if keyword_hits:
        score += min(6.0, len(keyword_hits) * 0.8)
        reasons.append("Trùng từ khóa: " + ", ".join(sorted(keyword_hits)[:6]))

    for keyword in draft.keywords or []:
        if keyword and keyword in prompt_norm:
            score += 0.8

    if draft.chunk_index == 0:
        score += 0.6
        reasons.append("Đoạn đầu tài liệu")
    elif draft.chunk_index <= 2:
        score += 0.3

    if not reasons:
        reasons.append("Fallback theo vị trí tài liệu")
    return RankedSourceTextChunk(draft=draft, score=score, reasons=reasons)


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(_norm(text))


def _norm(text: str) -> str:
    decomposed = unicodedata.normalize("NFD", text.lower())
    without_marks = "".join(ch for ch in decomposed if unicodedata.category(ch) != "Mn")
    return without_marks.replace("đ", "d")


def _extract_lesson_numbers(text: str) -> list[str]:
    numbers = []
    for match in re.finditer(r"(?i)\b(?:bai|bài|tiet|tiết)\s*([0-9]{1,3}|[ivxlcdm]+)\b", text):
        value = match.group(1).lower()
        numbers.append(value.lstrip("0") or value)
    return numbers


def _extract_page_numbers(text: str) -> list[int]:
    pages = []
    for match in re.finditer(r"(?i)\b(?:trang|page)\s*(\d{1,4})\b", text):
        pages.append(int(match.group(1)))
    return pages


def _first_nonempty_line(text: str) -> str | None:
    for line in text.splitlines():
        stripped = line.strip()
        if stripped:
            return stripped[:180]
    return None


def _parse_int(value: str | int | None) -> int | None:
    if isinstance(value, int):
        return value
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def _extract_lesson_numbers(text: str) -> list[str]:
    normalized = _norm(text)
    numbers = []
    for match in re.finditer(r"\bbai\s*([0-9]{1,3}|[ivxlcdm]+)\b", normalized):
        value = match.group(1).lower()
        numbers.append(value.lstrip("0") or value)
    return numbers


def _extract_session_numbers(text: str) -> list[str]:
    normalized = _norm(text)
    numbers = []
    for match in re.finditer(r"\b(?:tiet|t)\s*([0-9]{1,3}|[ivxlcdm]+)\b", normalized):
        value = match.group(1).lower()
        numbers.append(value.lstrip("0") or value)
    return numbers


def _session_match_score(chunk_norm: str, requested_sessions: set[str]) -> float:
    if not requested_sessions:
        return 0.0
    known_sessions = set(_extract_session_numbers(chunk_norm))
    if not known_sessions:
        return 0.0
    if known_sessions & requested_sessions:
        return 4.0
    return -4.0
