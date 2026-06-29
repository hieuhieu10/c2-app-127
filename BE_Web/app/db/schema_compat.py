from __future__ import annotations

from sqlalchemy import inspect, text
from sqlalchemy.engine import Engine


def ensure_schema_compatibility(engine: Engine) -> None:
    # Local SQLite/dev convenience: create tables added by newer branches before
    # the developer has run Alembic. Existing tables are left untouched.
    from app.db import models  # noqa: F401
    from app.db.session import Base

    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "users" not in table_names:
        return

    user_columns = {column["name"] for column in inspector.get_columns("users")}
    chat_session_columns = (
        {column["name"] for column in inspector.get_columns("chat_sessions")}
        if "chat_sessions" in table_names
        else set()
    )
    lesson_upload_columns = (
        {column["name"] for column in inspector.get_columns("lesson_uploads")}
        if "lesson_uploads" in table_names
        else set()
    )

    statements: list[str] = []
    if "avatar_url" not in user_columns:
        statements.append("ALTER TABLE users ADD COLUMN avatar_url VARCHAR(255)")
    if "uploaded_file_id" not in chat_session_columns:
        statements.append("ALTER TABLE chat_sessions ADD COLUMN uploaded_file_id VARCHAR(100)")
    if "upload_type" not in chat_session_columns:
        statements.append("ALTER TABLE chat_sessions ADD COLUMN upload_type VARCHAR(50)")
    if "attached_file_name" not in chat_session_columns:
        statements.append("ALTER TABLE chat_sessions ADD COLUMN attached_file_name VARCHAR(255)")
    if "retention_policy" not in lesson_upload_columns:
        statements.append("ALTER TABLE lesson_uploads ADD COLUMN retention_policy VARCHAR(50) DEFAULT 'session' NOT NULL")
    if "session_id" not in lesson_upload_columns:
        statements.append("ALTER TABLE lesson_uploads ADD COLUMN session_id INTEGER")
    if "last_used_at" not in lesson_upload_columns:
        statements.append("ALTER TABLE lesson_uploads ADD COLUMN last_used_at DATETIME")
    if "deleted_at" not in lesson_upload_columns:
        statements.append("ALTER TABLE lesson_uploads ADD COLUMN deleted_at DATETIME")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))
