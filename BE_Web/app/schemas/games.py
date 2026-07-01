from __future__ import annotations

from typing import Any, Literal

from datetime import datetime

from pydantic import BaseModel, Field


class GameItemResponse(BaseModel):
    id: int
    orderIndex: int
    question: str
    correctAnswer: str
    options: list[str]
    explanation: str | None = None
    hint: str | None = None
    validationStatus: str
    validationErrors: list[str]


class GameResponse(BaseModel):
    lessonId: int
    gameId: int
    sessionId: int | None = None
    status: str
    productTemplateId: str
    aiTemplateId: str
    title: str
    input: str
    subject: str
    grade: int
    difficulty: Literal["easy", "medium", "hard"]
    objectiveId: str | None = None
    settings: dict[str, Any]
    items: list[GameItemResponse]


class GameSummaryResponse(BaseModel):
    gameId: int
    lessonId: int
    title: str
    input: str
    status: str
    productTemplateId: str
    aiTemplateId: str
    subject: str
    grade: int
    difficulty: Literal["easy", "medium", "hard"]
    itemCount: int
    createdAt: datetime
    updatedAt: datetime


class UpdateGameItemRequest(BaseModel):
    question: str | None = Field(None, min_length=1)
    correctAnswer: str | None = Field(None, min_length=1)
    options: list[str] | None = None
    explanation: str | None = None
    hint: str | None = None


class StatusResponse(BaseModel):
    gameId: int
    status: str
