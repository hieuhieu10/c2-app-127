from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class LessonUploadResponse(BaseModel):
    ok: bool = True
    uploadedFileId: str
    originalFilename: str
    mimeType: str | None = None
    extension: str
    sizeBytes: int
    charCount: int
    chunkCount: int = 0
    previewText: str
    parseStatus: str
    sourceText: str
    uploadType: str = "lesson_plan"
    retentionPolicy: str = "session"
    sessionId: int | None = None
    createdAt: datetime
