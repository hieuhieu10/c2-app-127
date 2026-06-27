from __future__ import annotations

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.core.settings import settings
from app.db.models import LessonUpload, LessonUploadChunk, User
from app.db.session import get_db
from app.schemas.uploads import LessonUploadResponse
from app.services.lesson_file_parser import (
    LEGACY_DOC_EXTENSION,
    SUPPORTED_LESSON_EXTENSIONS,
    LessonFileParseError,
    build_preview,
    extract_lesson_text,
    safe_extension,
    truncate_source_text,
)
from app.services.lesson_chunking import build_lesson_chunks

router = APIRouter(prefix="/api/uploads", tags=["uploads"])


@router.post("/lesson-file", response_model=LessonUploadResponse)
async def upload_lesson_file(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LessonUploadResponse:
    original_filename = Path(file.filename or "lesson-file").name
    extension = safe_extension(original_filename)
    allowed_for_message = ", ".join(sorted([*SUPPORTED_LESSON_EXTENSIONS, LEGACY_DOC_EXTENSION]))
    if extension not in SUPPORTED_LESSON_EXTENSIONS and extension != LEGACY_DOC_EXTENSION:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Chỉ hỗ trợ file giáo án dạng {allowed_for_message}.",
        )

    content = await file.read()
    if not content:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File giáo án đang trống.")
    if len(content) > settings.max_lesson_upload_size_bytes:
        max_mb = settings.max_lesson_upload_size_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File giáo án phải nhỏ hơn hoặc bằng {max_mb}MB.",
        )

    try:
        extracted_text = extract_lesson_text(content, extension)
    except LessonFileParseError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=exc.message) from exc

    source_text = truncate_source_text(extracted_text, settings.max_lesson_source_chars)
    if len(source_text.strip()) < settings.min_lesson_source_chars:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Không trích xuất đủ nội dung từ file giáo án. Vui lòng thử file khác hoặc nhập prompt trực tiếp.",
        )

    user_dir = Path(settings.upload_dir) / "lesson_files" / str(current_user.id)
    user_dir.mkdir(parents=True, exist_ok=True)
    stored_filename = f"{uuid.uuid4().hex}{extension}"
    stored_path = user_dir / stored_filename
    stored_path.write_bytes(content)

    upload = LessonUpload(
        user_id=current_user.id,
        original_filename=original_filename,
        stored_filename=stored_filename,
        stored_path=str(stored_path),
        mime_type=file.content_type,
        extension=extension,
        size_bytes=len(content),
        char_count=len(source_text),
        parse_status="parsed",
        parse_error=None,
        extracted_text=source_text,
        preview_text=build_preview(source_text),
        retention_policy="session",
    )
    db.add(upload)
    db.flush()

    chunk_drafts = build_lesson_chunks(source_text)
    for draft in chunk_drafts:
        db.add(
            LessonUploadChunk(
                upload_id=upload.id,
                user_id=current_user.id,
                chunk_index=draft.chunk_index,
                chunk_type=draft.chunk_type,
                title=draft.title,
                lesson_no=draft.lesson_no,
                page_start=draft.page_start,
                page_end=draft.page_end,
                text=draft.text,
                keywords_json=draft.keywords,
                char_count=len(draft.text),
            )
        )
    db.commit()
    db.refresh(upload)

    return LessonUploadResponse(
        uploadedFileId=str(upload.id),
        originalFilename=upload.original_filename,
        mimeType=upload.mime_type,
        extension=upload.extension,
        sizeBytes=upload.size_bytes,
        charCount=upload.char_count,
        chunkCount=len(chunk_drafts),
        previewText=upload.preview_text or "",
        parseStatus=upload.parse_status,
        sourceText=upload.extracted_text or "",
        createdAt=upload.created_at,
        retentionPolicy=upload.retention_policy,
        sessionId=upload.session_id,
    )
