from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


class ChatSessionCreateResponse(BaseModel):
    id: int
    title: str | None
    subject: str | None
    grade: int | None
    difficulty: Literal["easy", "medium", "hard"] | None = None
    numItems: int | None
    sourceText: str | None
    uploadedFileId: str | None = None
    uploadType: str | None = None
    attachedFileName: str | None = None
    createdAt: datetime
    updatedAt: datetime


class ChatSessionSummaryResponse(ChatSessionCreateResponse):
    messageCount: int
    lastMessagePreview: str | None


class ChatMessageResponse(BaseModel):
    id: int
    sessionId: int
    role: Literal["user", "assistant", "system"]
    messageType: str
    content: str
    payloadJson: dict[str, Any] | None = None
    status: Literal["pending", "running", "done", "error"]
    createdAt: datetime
    updatedAt: datetime


class ChatSessionDetailResponse(ChatSessionCreateResponse):
    messages: list[ChatMessageResponse]


class ChatRecommendRequest(BaseModel):
    subject: str = Field(..., min_length=1)
    grade: int = Field(..., ge=1, le=12)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    prompt: str = Field(..., min_length=1)
    numItems: int | None = Field(None, ge=1, le=20)
    sourceText: str | None = None
    uploadedFileId: str | None = None
    uploadType: Literal["none", "lesson_plan", "slide"] = "none"
    attachedFileName: str | None = None


class ChatRecommendResponse(BaseModel):
    userMessage: ChatMessageResponse
    assistantMessage: ChatMessageResponse
    session: ChatSessionCreateResponse


class ChatGenerateRequest(BaseModel):
    templateId: str = Field(..., min_length=1)
    numItems: int | None = Field(None, ge=1, le=20)
    promptMessageId: int | None = None
    recommendationMessageId: int | None = None
