# BE_Web

BE_Web là FastAPI backend phục vụ authentication, chat history, saved games, teacher review/edit APIs, approval/publish state, avatar upload, lesson-file upload và static upload serving.

Trong luồng tạo game hiện tại, FE gọi BE_Web trước để tạo/lưu chat session. BE_Web sau đó gọi BE_AI qua `BE_AI_BASE_URL` để recommend game và stream generation. BE_AI không lưu lịch sử chat.

## Yêu Cầu

- Python 3.11+
- `uv`
- PostgreSQL cho database runtime của BE_Web
- BE_AI đang chạy ở `http://localhost:8000` khi dùng luồng recommend/generate thật

Nếu chưa có `uv`:

```powershell
python -m pip install uv
```

## Cài Đặt

```powershell
cd BE_Web
Copy-Item .env.example .env
uv sync --extra dev
```

`requirements.txt` được giữ để fallback/export runtime. Local development nên dùng `uv`.

## Biến Môi Trường

File cấu hình local là `BE_Web/.env`.

```env
APP_NAME=BE_Web
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/learngame_AI
BE_AI_BASE_URL=http://localhost:8000
BE_AI_TIMEOUT_SECONDS=30
API_DEBUG=false
CORS_ORIGINS=http://localhost:3000
MAX_LESSON_UPLOAD_SIZE_BYTES=10485760
MAX_LESSON_SOURCE_CHARS=20000
```

`BE_AI_BASE_URL` là bắt buộc. Khi chạy bằng Docker Compose, đặt giá trị này theo tên service nội bộ, ví dụ `http://be-ai:8000`.

Không bật `API_DEBUG=true` ở môi trường production vì middleware sẽ log request/response body.

## Database

BE_Web yêu cầu `DATABASE_URL` trỏ tới PostgreSQL. Nếu thiếu biến này, app sẽ lỗi cấu hình thay vì fallback sang SQLite.

Ví dụ:

```env
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/learngame_AI
```

Khi thay đổi model DB, dùng Alembic để tạo và áp migration:

```powershell
cd BE_Web
$env:PYTHONPATH='.'
uv run alembic revision --autogenerate -m "describe schema change"
uv run alembic upgrade head
```

SQLite chỉ còn được dùng trong test in-memory để chạy nhanh và không cần PostgreSQL thật.

## Chạy Server

```powershell
cd BE_Web
uv run uvicorn app.main:app --reload --port 8001
```

Swagger UI:

```text
http://127.0.0.1:8001/docs
```

Health check:

```text
http://127.0.0.1:8001/health
```

## Bảng Dữ Liệu Chính

- `users`
- `chat_sessions`
- `chat_messages`
- `lesson_uploads`
- `lessons`
- `games`
- `game_items`
- `game_review_events`

## API Chính

Auth:

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `POST /api/auth/me/avatar`

Uploads:

- `POST /api/uploads/lesson-file`

Chat/game creation:

- `POST /api/chat/sessions`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/{session_id}`
- `POST /api/chat/sessions/{session_id}/recommend`
- `POST /api/chat/sessions/{session_id}/generate`

Saved games/review:

- `GET /api/games`
- `GET /api/games/{game_id}`
- `PATCH /api/games/{game_id}/items/{item_id}`
- `POST /api/games/{game_id}/items/{item_id}/recheck`
- `POST /api/games/{game_id}/items/{item_id}/regenerate`
- `POST /api/games/{game_id}/approve`
- `POST /api/games/{game_id}/publish`
- `GET /api/games/{game_id}/play`

## Luồng Chat Tạo Game

```text
Prompt-only:
FE tạo chat session
-> FE gửi prompt recommend
-> BE_Web lưu user message
-> BE_Web gọi BE_AI /recommend/games với upload_type="none"
-> FE chọn game
-> BE_Web gọi BE_AI /generate/stream
-> BE_Web lưu generation result, Lesson, Game và GameItems khi complete

Prompt + giáo án:
FE upload PDF/TXT/DOCX qua /api/uploads/lesson-file
-> BE_Web lưu file raw, parse thành source_text và chia thành lesson chunks
-> FE gửi prompt recommend kèm uploadedFileId, uploadType="lesson_plan", sourceText
-> BE_Web chọn các chunk liên quan nhất với prompt, ví dụ khớp Bài 01 / Trang 6 / từ khóa
-> BE_Web gọi BE_AI với uploaded_file_id, upload_type và source_text đã lọc theo chunk
-> BE_AI dùng source_text đã lọc làm teacher context, còn GDPT/RAG vẫn quyết định scope
-> Các bước chọn game/generate/lưu DB giống prompt-only
```

Endpoint upload giáo án trả về:

```json
{
  "ok": true,
  "uploadedFileId": "1",
  "originalFilename": "giao_an_toan_3.docx",
  "extension": ".docx",
  "charCount": 5380,
  "chunkCount": 4,
  "previewText": "Tên bài: Phép nhân là phép cộng lặp...",
  "sourceText": "...",
  "uploadType": "lesson_plan",
  "retentionPolicy": "session",
  "sessionId": null
}
```

Ghi chú:

- Hỗ trợ chính: `.pdf`, `.txt`, `.docx`.
- `.doc` legacy chưa parse ổn định; giáo viên nên lưu lại thành `.docx`, `.pdf` hoặc `.txt`.
- BE_Web không gửi binary file sang BE_AI.
- File upload không được coi là knowledge base lâu dài. Mặc định `retentionPolicy="session"`.
- File có thể upload trước khi có chat session. Khi giáo viên submit prompt, BE_Web gắn upload vào `chat_sessions.id` qua `lesson_uploads.session_id` và cập nhật `last_used_at`.
- BE_Web lưu chunks ở bảng `lesson_upload_chunks`. Khi recommend/generate, BE_Web gửi sang BE_AI các chunk liên quan nhất, không gửi toàn bộ giáo án dài nếu đã tìm được chunk phù hợp.
- Nếu upload cũ chưa có chunks trong DB, BE_Web sẽ chunk tạm từ `sourceText` gửi lên để tránh fallback thẳng về toàn bộ tài liệu.
- BE_AI guardrail vẫn kiểm tra scope trên prompt + teacher context đã lọc. Guardrail có rule tránh nhầm cụm "thứ tự số" thành "tử số" sau bước bỏ dấu tiếng Việt.

## Test

```powershell
cd BE_Web
$env:PYTHONPATH='.'
uv run pytest
```
