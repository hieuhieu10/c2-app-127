from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SAEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.types import JSON

from app.db.session import Base


class GameStatus(str, Enum):
    draft = "draft"
    generation_failed = "generation_failed"
    approved = "approved"
    published = "published"


class ReviewEventType(str, Enum):
    generate = "generate"
    edit = "edit"
    recheck = "recheck"
    regenerate = "regenerate"
    approve = "approve"
    publish = "publish"


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str | None] = mapped_column(String(255))
    password_hash: Mapped[str | None] = mapped_column(String(255))

    lessons: Mapped[list["Lesson"]] = relationship(back_populates="user")


class Lesson(TimestampMixin, Base):
    __tablename__ = "lessons"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(String(255))
    input_text: Mapped[str] = mapped_column(Text)
    subject: Mapped[str] = mapped_column(String(100), default="General")
    grade: Mapped[int] = mapped_column(Integer, default=6)
    difficulty: Mapped[str] = mapped_column(String(20), default="medium")
    objective_id: Mapped[str | None] = mapped_column(String(100))

    user: Mapped[User | None] = relationship(back_populates="lessons")
    games: Mapped[list["Game"]] = relationship(back_populates="lesson", cascade="all, delete-orphan")


class Game(TimestampMixin, Base):
    __tablename__ = "games"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lesson_id: Mapped[int] = mapped_column(ForeignKey("lessons.id"), index=True)
    product_template_id: Mapped[str] = mapped_column(String(100), default="treasure_hunt")
    ai_template_id: Mapped[str] = mapped_column(String(100), default="quiz")
    status: Mapped[GameStatus] = mapped_column(SAEnum(GameStatus), default=GameStatus.draft)
    settings_json: Mapped[dict] = mapped_column(JSON, default=dict)
    ai_raw_response_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    lesson: Mapped[Lesson] = relationship(back_populates="games")
    items: Mapped[list["GameItem"]] = relationship(
        back_populates="game", cascade="all, delete-orphan", order_by="GameItem.order_index"
    )
    review_events: Mapped[list["GameReviewEvent"]] = relationship(back_populates="game", cascade="all, delete-orphan")


class GameItem(TimestampMixin, Base):
    __tablename__ = "game_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    order_index: Mapped[int] = mapped_column(Integer)
    question: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(Text)
    options_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    explanation: Mapped[str | None] = mapped_column(Text)
    hint: Mapped[str | None] = mapped_column(Text)
    validation_status: Mapped[str] = mapped_column(String(50), default="valid")
    validation_errors_json: Mapped[list[str]] = mapped_column(JSON, default=list)
    reviewed_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    game: Mapped[Game] = relationship(back_populates="items")


class GameReviewEvent(TimestampMixin, Base):
    __tablename__ = "game_review_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    game_id: Mapped[int] = mapped_column(ForeignKey("games.id"), index=True)
    item_id: Mapped[int | None] = mapped_column(ForeignKey("game_items.id"), nullable=True)
    event_type: Mapped[ReviewEventType] = mapped_column(SAEnum(ReviewEventType))
    payload_json: Mapped[dict] = mapped_column(JSON, default=dict)

    game: Mapped[Game] = relationship(back_populates="review_events")
