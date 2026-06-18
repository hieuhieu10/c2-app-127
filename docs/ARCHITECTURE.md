# Kiến Trúc LearnGame

Tài liệu này mô tả kiến trúc hiện tại của LearnGame theo hai sơ đồ mới trong `docs/statics/`:

- `learngame_architecture_diagram.svg`
- `dataflow_diagram.png`

## Sơ Đồ Architecture

![LearnGame architecture diagram](statics/learngame_architecture_diagram.svg)

Architecture hiện tại có các nhóm component chính:

- **Giáo viên / Trình duyệt**: nơi giáo viên nhập yêu cầu tạo game, chọn game, review và publish.
- **FE - Next.js**: giao diện tạo game dạng chat, chọn game recommendation, preview/edit/publish và render game shell.
- **Game Library / Game Shells**: nơi FE chọn game shell theo `template_id`, hiện có Treasure Hunt và Trivia Battleship.
- **Browser Storage**: FE dùng `sessionStorage` để truyền preview payload và `localStorage` để lưu game publish từ chat-flow.
- **BE_AI - FastAPI**: agent backend cho guardrails, GDPT retrieval, teacher context extraction, scope/difficulty assessment, game recommendation, streaming generation và schema validation.
- **GDPT 2018 JSON KB**: curriculum authority cho Toán tiểu học lớp 1-5.
- **LLM Provider**: OpenAI, DeepSeek hoặc Anthropic.
- **BE_Web - FastAPI**: auth, saved games, teacher review APIs, approve/publish, avatar upload và static serving.
- **DB**: SQLite khi chạy local hoặc PostgreSQL khi production.

## Sơ Đồ Data Flow

![LearnGame data flow diagram](statics/dataflow_diagram.png)

Data flow hiện tại có hai luồng chính.

## Flow A - Luồng Tạo Game Mới

Luồng tạo game mới đi trực tiếp từ FE sang BE_AI.

```text
Giáo viên -> FE -> BE_AI -> GDPT KB / LLM -> FE -> Game Library -> Browser Storage
```

Các bước chính:

1. Giáo viên nhập `subject`, `grade`, `difficulty`, `prompt` và `source_text` nếu có giáo án/slide.
2. FE gửi `POST /recommend/games` đến BE_AI.
3. BE_AI chạy guardrail, GDPT objective retrieval, teacher context extraction, scope check, difficulty assessment và game recommendation.
4. Nếu guardrail block hoặc scope không phù hợp, BE_AI trả thông tin để FE hiển thị cảnh báo/chỉnh prompt.
5. Nếu hợp lệ, BE_AI trả danh sách game recommendation gồm `template_id`, `game name`, `intro` và `recommended flag`.
6. Giáo viên chọn game.
7. FE gửi `POST /generate/stream` đến BE_AI với `override_template`.
8. BE_AI stream SSE events gồm parse/teacher context, retrieval, recommend, generate, schema validation, safety report và complete.
9. FE hiển thị pipeline động theo từng stage.
10. FE đưa generated content sang preview bằng `sessionStorage`.
11. FE dùng `template_id` để chọn game shell trong Game Library.
12. Giáo viên preview, chơi thử, chỉnh sửa và publish.
13. Với chat-flow hiện tại, game publish được lưu trong browser `localStorage`.

Ghi chú quan trọng:

- Chat-flow generated games hiện **chưa sync vào BE_Web DB**.
- BE_Web **không tạo game mới** trong Flow A.
- Teacher uploaded lesson/slide chỉ là teaching context, không thay thế GDPT 2018.

## Flow B - Luồng Saved Game / Review Qua BE_Web

Luồng saved game/review đi từ FE sang BE_Web và DB.

```text
Giáo viên -> FE -> BE_Web -> DB
```

Các bước chính:

1. Giáo viên mở game cũ từ dashboard hoặc sidebar.
2. FE gọi `GET /api/games` hoặc `GET /api/games/{game_id}` đến BE_Web.
3. BE_Web đọc DB gồm `users`, `lessons`, `games`, `game_items` và `game_review_events`.
4. FE hiển thị validate/review screen.
5. Giáo viên sửa item.
6. FE gọi `PATCH /api/games/{game_id}/items/{item_id}`.
7. Giáo viên approve game.
8. FE gọi `POST /api/games/{game_id}/approve`.
9. Giáo viên publish game.
10. FE gọi `POST /api/games/{game_id}/publish`.
11. BE_Web lưu status và review events vào DB.

Ghi chú quan trọng:

- BE_Web không còn endpoint tạo game mới `/api/games/generate`.
- BE_Web hiện phục vụ auth, saved games, teacher review/edit APIs, approve/publish và static serving.

## Runtime Components

| Thành phần | Đường dẫn | Trách nhiệm |
|---|---|---|
| FE | `FE/` | UI giáo viên, game creation chat, recommendation selection, preview/review, game shell rendering. |
| Game Library | `FE/src/features/game-shells/` | Treasure Hunt, Trivia Battleship và các game shell/template active khác. |
| BE_AI | `backend/` | Guardrails, GDPT retrieval, teacher context, game recommendation, streaming generation, validation, repair. |
| BE_Web | `BE_Web/` | Auth, saved games, teacher review APIs, approve/publish, avatar upload, static serving. |
| Runtime KB | `backend/data/gdpt_2018/` | JSON objectives được BE_AI load khi chạy. |
| Canonical KB | `knowledge_base/gdpt_2018/` | Source documents và curated objectives để review/chỉnh sửa. |
| Browser Storage | `sessionStorage` / `localStorage` | Preview payload và local published games của chat-flow. |
| DB | `BE_Web/be_web.db` mặc định | `users`, `lessons`, `games`, `game_items`, `game_review_events`. |
| LLM Provider | API bên ngoài | OpenAI, DeepSeek hoặc Anthropic. |

## Luồng Retrieval Knowledge Base

BE_AI hiện không dùng vector search và không gọi LLM để đọc toàn bộ JSON. Hệ thống load objectives từ JSON vào Python memory và dùng heuristic matching.

Code tính score:

```text
backend/app/retrieval/context.py::_match_objective()
```

Các tín hiệu scoring:

- Exact phrase match trong `prompt` hoặc `source_text`.
- Token overlap giữa query và objective fields.
- Alias/topic subset match.
- `objective_id` nếu được truyền trực tiếp sẽ bypass scoring và trả confidence `1.0`.

## Data Contracts Chính

### BE_AI `LessonRequest`

```json
{
  "subject": "Toan",
  "grade": 3,
  "difficulty": "medium",
  "prompt": "Tao game matching ve phep nhan la phep cong lap",
  "objective_id": "",
  "source_text": "Vi du: 3 gio tao, moi gio 4 qua",
  "uploaded_file_id": "slide_001",
  "upload_type": "slide",
  "num_items": 8,
  "override_template": "matching"
}
```

### BE_AI `GameResponse`

```json
{
  "ok": true,
  "template_id": "matching",
  "rationale": "...",
  "content": {},
  "objective_id": "math_3_multiplication_repeated_addition",
  "validation_errors": [],
  "repair_attempts": 0,
  "error": null
}
```

## Ghi Chú Production

Khi production, nên ưu tiên:

- PostgreSQL cho BE_Web.
- `JWT_SECRET_KEY` mạnh.
- Backend-only storage cho giáo án/slide upload.
- Parser pipeline thật cho PDF/DOCX/PPTX để tạo `source_text`.
- Đồng bộ chat-flow generated games vào BE_Web DB nếu muốn lưu lịch sử trên nhiều thiết bị.
