"""add lesson uploads

Revision ID: b7c1e4d9a2f0
Revises: 9f4a8c6d2b11
Create Date: 2026-06-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b7c1e4d9a2f0"
down_revision: Union[str, Sequence[str], None] = "9f4a8c6d2b11"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("chat_sessions", sa.Column("uploaded_file_id", sa.String(length=100), nullable=True))
    op.add_column("chat_sessions", sa.Column("upload_type", sa.String(length=50), nullable=True))
    op.add_column("chat_sessions", sa.Column("attached_file_name", sa.String(length=255), nullable=True))

    op.create_table(
        "lesson_uploads",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("original_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_filename", sa.String(length=255), nullable=False),
        sa.Column("stored_path", sa.String(length=1000), nullable=False),
        sa.Column("mime_type", sa.String(length=255), nullable=True),
        sa.Column("extension", sa.String(length=20), nullable=False),
        sa.Column("size_bytes", sa.Integer(), nullable=False),
        sa.Column("char_count", sa.Integer(), nullable=False),
        sa.Column("parse_status", sa.String(length=50), nullable=False),
        sa.Column("parse_error", sa.Text(), nullable=True),
        sa.Column("extracted_text", sa.Text(), nullable=True),
        sa.Column("preview_text", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_uploads_user_id"), "lesson_uploads", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_lesson_uploads_user_id"), table_name="lesson_uploads")
    op.drop_table("lesson_uploads")
    op.drop_column("chat_sessions", "attached_file_name")
    op.drop_column("chat_sessions", "upload_type")
    op.drop_column("chat_sessions", "uploaded_file_id")
