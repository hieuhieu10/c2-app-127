"""add lesson upload chunks

Revision ID: d2f6a1c9b4e8
Revises: b7c1e4d9a2f0
Create Date: 2026-06-27 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "d2f6a1c9b4e8"
down_revision: Union[str, Sequence[str], None] = "b7c1e4d9a2f0"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        "lesson_upload_chunks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("upload_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("chunk_index", sa.Integer(), nullable=False),
        sa.Column("chunk_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("lesson_no", sa.String(length=50), nullable=True),
        sa.Column("page_start", sa.Integer(), nullable=True),
        sa.Column("page_end", sa.Integer(), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("keywords_json", sa.JSON(), nullable=False),
        sa.Column("char_count", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("(CURRENT_TIMESTAMP)"), nullable=False),
        sa.ForeignKeyConstraint(["upload_id"], ["lesson_uploads.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_lesson_upload_chunks_upload_id"), "lesson_upload_chunks", ["upload_id"], unique=False)
    op.create_index(op.f("ix_lesson_upload_chunks_user_id"), "lesson_upload_chunks", ["user_id"], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f("ix_lesson_upload_chunks_user_id"), table_name="lesson_upload_chunks")
    op.drop_index(op.f("ix_lesson_upload_chunks_upload_id"), table_name="lesson_upload_chunks")
    op.drop_table("lesson_upload_chunks")
