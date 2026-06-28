"""attach uploads to chat sessions

Revision ID: e7a9c2d5f1b3
Revises: d2f6a1c9b4e8
Create Date: 2026-06-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "e7a9c2d5f1b3"
down_revision: Union[str, Sequence[str], None] = "d2f6a1c9b4e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        "lesson_uploads",
        sa.Column("retention_policy", sa.String(length=50), nullable=False, server_default="session"),
    )
    op.add_column("lesson_uploads", sa.Column("session_id", sa.Integer(), nullable=True))
    op.add_column("lesson_uploads", sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("lesson_uploads", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index(op.f("ix_lesson_uploads_session_id"), "lesson_uploads", ["session_id"], unique=False)
    op.create_foreign_key(
        op.f("fk_lesson_uploads_session_id_chat_sessions"),
        "lesson_uploads",
        "chat_sessions",
        ["session_id"],
        ["id"],
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint(op.f("fk_lesson_uploads_session_id_chat_sessions"), "lesson_uploads", type_="foreignkey")
    op.drop_index(op.f("ix_lesson_uploads_session_id"), table_name="lesson_uploads")
    op.drop_column("lesson_uploads", "deleted_at")
    op.drop_column("lesson_uploads", "last_used_at")
    op.drop_column("lesson_uploads", "session_id")
    op.drop_column("lesson_uploads", "retention_policy")
