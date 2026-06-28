from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.security import get_current_user
from app.db.models import (
    ChatMessage,
    ChatMessageStatus,
    ChatMessageType,
    ChatRole,
    ChatSession,
    LessonUpload,
    User,
)
from app.db.session import get_db
from app.schemas.chat import (
    ChatGenerateRequest,
    ChatMessageResponse,
    ChatRecommendRequest,
    ChatRecommendResponse,
    ChatSessionCreateResponse,
    ChatSessionDetailResponse,
    ChatSessionSummaryResponse,
)
from app.services.ai_gateway import BeAiGatewayError, recommend_games, stream_generate
from app.services.game_generation import GameMappingError, create_game_from_generation
from app.services.lesson_chunking import (
    format_ranked_chunks_for_source_text,
    format_ranked_source_chunks_for_source_text,
    rank_lesson_chunks,
    rank_source_text_chunks,
    selected_chunks_payload,
    selected_source_chunks_payload,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("/sessions", response_model=ChatSessionCreateResponse)
def create_session(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionCreateResponse:
    session = ChatSession(user_id=current_user.id)
    db.add(session)
    db.commit()
    db.refresh(session)
    return session_to_response(session)


@router.get("/sessions", response_model=list[ChatSessionSummaryResponse])
def list_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ChatSessionSummaryResponse]:
    sessions = db.scalars(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc(), ChatSession.created_at.desc(), ChatSession.id.desc())
    ).all()
    return [session_to_summary_response(session) for session in sessions]


@router.get("/sessions/{session_id}", response_model=ChatSessionDetailResponse)
def get_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatSessionDetailResponse:
    session = get_session_or_404(db, session_id, current_user.id)
    return session_to_detail_response(session)


@router.post("/sessions/{session_id}/recommend", response_model=ChatRecommendResponse)
async def recommend_for_session(
    session_id: int,
    request: ChatRecommendRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ChatRecommendResponse:
    session = get_session_or_404(db, session_id, current_user.id)
    prompt_text = request.prompt.strip()
    if not prompt_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Prompt is required")

    ranked_chunks = rank_lesson_chunks(
        db,
        upload_id=request.uploadedFileId,
        user_id=current_user.id,
        prompt=prompt_text,
    )
    selected_source_text = format_ranked_chunks_for_source_text(ranked_chunks)
    selected_chunks = selected_chunks_payload(ranked_chunks)
    if not selected_source_text and request.sourceText:
        fallback_chunks = rank_source_text_chunks(request.sourceText, prompt=prompt_text)
        selected_source_text = format_ranked_source_chunks_for_source_text(fallback_chunks)
        selected_chunks = selected_source_chunks_payload(fallback_chunks)
    if not selected_source_text:
        selected_source_text = request.sourceText
    attached_upload = attach_lesson_upload_to_session(
        db,
        uploaded_file_id=request.uploadedFileId,
        user_id=current_user.id,
        session_id=session.id,
    )

    user_message = ChatMessage(
        session_id=session.id,
        role=ChatRole.user,
        message_type=ChatMessageType.user_prompt,
        content=prompt_text,
        payload_json={
            "subject": request.subject,
            "grade": request.grade,
            "difficulty": request.difficulty,
            "numItems": request.numItems,
            "sourceText": selected_source_text,
            "uploadedFileId": request.uploadedFileId,
            "uploadType": request.uploadType,
            "attachedFileName": request.attachedFileName,
            "uploadRetentionPolicy": attached_upload.retention_policy if attached_upload else None,
            "uploadSessionId": attached_upload.session_id if attached_upload else None,
            "selectedTeacherChunks": selected_chunks,
        },
        status=ChatMessageStatus.done,
    )
    db.add(user_message)

    session.subject = request.subject
    session.grade = request.grade
    session.difficulty = request.difficulty
    session.num_items = request.numItems
    session.source_text = selected_source_text
    session.uploaded_file_id = request.uploadedFileId
    session.upload_type = request.uploadType
    session.attached_file_name = request.attachedFileName
    if not session.title:
        session.title = prompt_text[:255]
    db.add(session)
    db.flush()

    try:
        recommend_payload = {
            "subject": request.subject,
            "grade": request.grade,
            "difficulty": request.difficulty,
            "prompt": prompt_text,
            "source_text": selected_source_text,
            "uploaded_file_id": request.uploadedFileId or "",
            "upload_type": request.uploadType or "none",
        }
        if request.numItems is not None:
            recommend_payload["num_items"] = request.numItems

        ai_response = await recommend_games(recommend_payload)
    except BeAiGatewayError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc

    blocked = bool(ai_response.get("blocked"))
    assistant_payload: dict[str, Any] = {
        "promptMessageId": user_message.id,
        "blocked": blocked,
        "selectedTeacherChunks": selected_chunks,
    }
    if blocked:
        assistant_payload.update(
            {
                "message": ai_response.get("message") or "Yêu cầu không hợp lệ.",
                "suggestion": ai_response.get("suggestion") or "Vui lòng điều chỉnh yêu cầu và thử lại.",
            }
        )
        assistant_content = assistant_payload["message"]
        message_type = ChatMessageType.guardrail
    else:
        # Recommendations come back best-first; show only the top 3 in chat.
        assistant_payload["recommendations"] = (ai_response.get("recommendations") or [])[:3]
        assistant_content = "Đã đề xuất trò chơi phù hợp."
        message_type = ChatMessageType.recommendations

    assistant_message = ChatMessage(
        session_id=session.id,
        role=ChatRole.assistant,
        message_type=message_type,
        content=assistant_content,
        payload_json=assistant_payload,
        status=ChatMessageStatus.done,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(session)
    db.refresh(user_message)
    db.refresh(assistant_message)

    return ChatRecommendResponse(
        userMessage=message_to_response(user_message),
        assistantMessage=message_to_response(assistant_message),
        session=session_to_response(session),
    )


@router.post("/sessions/{session_id}/generate")
async def generate_for_session(
    session_id: int,
    request: ChatGenerateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    session = get_session_or_404(db, session_id, current_user.id)
    prompt_message = resolve_prompt_message(session, request.promptMessageId)

    assistant_message = ChatMessage(
        session_id=session.id,
        role=ChatRole.assistant,
        message_type=ChatMessageType.generation_result,
        content="Đang tạo trò chơi...",
        payload_json={
            "promptMessageId": prompt_message.id,
            "recommendationMessageId": request.recommendationMessageId,
            "selectedTemplate": {"template_id": request.templateId},
        },
        status=ChatMessageStatus.running,
    )
    db.add(assistant_message)
    db.commit()
    db.refresh(assistant_message)

    payload = {
        "subject": session.subject,
        "grade": session.grade,
        "difficulty": session.difficulty,
        "prompt": prompt_message.content,
        "source_text": session.source_text,
        "uploaded_file_id": session.uploaded_file_id or "",
        "upload_type": session.upload_type or "none",
        "override_template": request.templateId,
    }
    if session.num_items is not None:
        payload["num_items"] = session.num_items

    if not payload["subject"] or not payload["grade"] or not payload["difficulty"]:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session is missing lesson context")

    return StreamingResponse(
        stream_session_generation(
            db,
            current_user,
            session.id,
            assistant_message.id,
            request.templateId,
            payload,
        ),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


async def stream_session_generation(
    db: Session,
    current_user: User,
    session_id: int,
    assistant_message_id: int,
    template_id: str,
    payload: dict[str, Any],
) -> AsyncGenerator[str, None]:
    final_safety_report: dict[str, Any] | None = None

    def to_sse(data: dict[str, Any]) -> str:
        return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"

    try:
        async for event in stream_generate(payload):
            event_type = event.get("type")
            if event_type == "safety":
                final_safety_report = event.get("report")
                yield to_sse(event)
                continue

            if event_type == "complete":
                reloaded_session = get_session_or_404(db, session_id, current_user.id)
                assistant_message = db.get(ChatMessage, assistant_message_id)
                if not assistant_message:
                    raise HTTPException(status_code=500, detail="Assistant message disappeared during generation")

                lesson, game = create_game_from_generation(
                    db,
                    current_user=current_user,
                    session=reloaded_session,
                    template_id=template_id,
                    content=event.get("content") or {},
                    safety_report=(event.get("safety_report") or final_safety_report),
                    elapsed_ms=event.get("elapsed_ms"),
                )
                assistant_message.content = "Trò chơi đã sẵn sàng."
                assistant_message.payload_json = {
                    **(assistant_message.payload_json or {}),
                    "selectedTemplate": {
                        "template_id": event.get("template_id"),
                        "name": event.get("template_name"),
                    },
                    "result": {
                        **event,
                        "gameId": game.id,
                        "lessonId": lesson.id,
                    },
                }
                assistant_message.status = ChatMessageStatus.done
                db.add(assistant_message)
                db.commit()
                db.refresh(assistant_message)

                yield to_sse(
                    {
                        **event,
                        "assistantMessageId": assistant_message.id,
                        "gameId": game.id,
                        "lessonId": lesson.id,
                    }
                )
                continue

            if event_type == "blocked":
                assistant_message = db.get(ChatMessage, assistant_message_id)
                if assistant_message:
                    assistant_message.content = str((event.get("guardrail") or {}).get("message") or "Generation blocked")
                    assistant_message.payload_json = {
                        **(assistant_message.payload_json or {}),
                        "guardrail": event.get("guardrail"),
                    }
                    assistant_message.status = ChatMessageStatus.error
                    db.add(assistant_message)
                    db.commit()
                yield to_sse(
                    {
                        "type": "error",
                        "message": str((event.get("guardrail") or {}).get("message") or "Generation blocked"),
                    }
                )
                return

            if event_type == "error":
                assistant_message = db.get(ChatMessage, assistant_message_id)
                if assistant_message:
                    assistant_message.content = str(event.get("message") or "Generation failed")
                    assistant_message.payload_json = {
                        **(assistant_message.payload_json or {}),
                        "error": event.get("message"),
                    }
                    assistant_message.status = ChatMessageStatus.error
                    db.add(assistant_message)
                    db.commit()
                yield to_sse(event)
                return

            yield to_sse(event)
    except (BeAiGatewayError, GameMappingError) as exc:
        assistant_message = db.get(ChatMessage, assistant_message_id)
        if assistant_message:
            assistant_message.content = str(exc)
            assistant_message.payload_json = {
                **(assistant_message.payload_json or {}),
                "error": str(exc),
            }
            assistant_message.status = ChatMessageStatus.error
            db.add(assistant_message)
            db.commit()
        yield to_sse({"type": "error", "message": str(exc)})


def get_session_or_404(db: Session, session_id: int, user_id: int) -> ChatSession:
    session = db.scalar(
        select(ChatSession)
        .options(selectinload(ChatSession.messages))
        .where(ChatSession.id == session_id, ChatSession.user_id == user_id)
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat session not found")
    return session


def resolve_prompt_message(session: ChatSession, prompt_message_id: int | None) -> ChatMessage:
    if prompt_message_id is not None:
        for message in session.messages:
            if message.id == prompt_message_id and message.role == ChatRole.user:
                return message
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt message not found")

    for message in reversed(session.messages):
        if message.role == ChatRole.user and message.message_type == ChatMessageType.user_prompt:
            return message
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Session has no user prompt to generate from")


def attach_lesson_upload_to_session(
    db: Session,
    *,
    uploaded_file_id: str | None,
    user_id: int,
    session_id: int,
) -> LessonUpload | None:
    upload_id = parse_int(uploaded_file_id)
    if upload_id is None:
        return None
    upload = db.scalar(
        select(LessonUpload).where(
            LessonUpload.id == upload_id,
            LessonUpload.user_id == user_id,
            LessonUpload.deleted_at.is_(None),
        )
    )
    if upload is None:
        return None
    upload.retention_policy = "session"
    upload.session_id = session_id
    upload.last_used_at = datetime.now(timezone.utc)
    db.add(upload)
    return upload


def parse_int(value: str | int | None) -> int | None:
    if isinstance(value, int):
        return value
    if not value:
        return None
    try:
        return int(value)
    except ValueError:
        return None


def session_to_detail_response(session: ChatSession) -> ChatSessionDetailResponse:
    base = session_to_response(session)
    return ChatSessionDetailResponse(
        **base.model_dump(),
        messages=[message_to_response(message) for message in session.messages],
    )


def session_to_response(session: ChatSession) -> ChatSessionCreateResponse:
    return ChatSessionCreateResponse(
        id=session.id,
        title=session.title,
        subject=session.subject,
        grade=session.grade,
        difficulty=session.difficulty,
        numItems=session.num_items,
        sourceText=session.source_text,
        uploadedFileId=session.uploaded_file_id,
        uploadType=session.upload_type,
        attachedFileName=session.attached_file_name,
        createdAt=session.created_at,
        updatedAt=session.updated_at,
    )


def session_to_summary_response(session: ChatSession) -> ChatSessionSummaryResponse:
    base = session_to_response(session)
    last_message_preview = None
    if session.messages:
        last_message = max(
            session.messages,
            key=lambda message: (message.updated_at, message.created_at, message.id),
        )
        preview = last_message.content.strip()
        last_message_preview = preview[:140] if preview else None
    return ChatSessionSummaryResponse(
        **base.model_dump(),
        messageCount=len(session.messages),
        lastMessagePreview=last_message_preview,
    )


def message_to_response(message: ChatMessage) -> ChatMessageResponse:
    return ChatMessageResponse(
        id=message.id,
        sessionId=message.session_id,
        role=message.role.value,
        messageType=message.message_type.value,
        content=message.content,
        payloadJson=message.payload_json,
        status=message.status.value,
        createdAt=message.created_at,
        updatedAt=message.updated_at,
    )
