from __future__ import annotations

from typing import Any, Literal

from datetime import datetime

from pydantic import BaseModel, Field


class ProductTemplate(BaseModel):
    id: str
    name: str
    description: str
    ai_template_id: str


class GenerateGameRequest(BaseModel):
    title: str = Field(..., min_length=1)
    input: str = Field(..., min_length=1)
    product_template_id: str = "treasure_hunt"
    num_items: int = Field(10, ge=1, le=20)
    subject: str = "General"
    grade: int = Field(6, ge=1, le=12)
    difficulty: Literal["easy", "medium", "hard"] = "medium"
    objective_id: str | None = None


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
