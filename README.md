# LearnGame - hệ thống tạo trò chơi học tập bám GDPT 2018

LearnGame là hệ thống hỗ trợ giáo viên tạo trò chơi học tập từ yêu cầu tự nhiên, có kiểm tra theo chương trình GDPT 2018. Giáo viên nhập yêu cầu bài học, xem nội dung AI sinh ra, chỉnh sửa câu hỏi, duyệt và đưa vào game shell để chơi trên lớp.

MVP hiện tập trung vào:

- Chuẩn chương trình GDPT 2018.
- Knowledge base môn Toán cấp tiểu học, lớp 1-5.
- Quy trình giáo viên review trước khi sử dụng.
- Game shell Treasure Hunt và Trivia Battleship.
- Luồng tạo game hiện tại gọi BE_AI để đề xuất game và stream quá trình sinh nội dung.

## Kiến Trúc

Tài liệu chi tiết nằm ở [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```text
FE Next.js
  -> BE_AI FastAPI agent workflow cho recommend/generate stream
  -> BE_Web FastAPI + DB cho auth, saved games, review APIs
  -> GDPT 2018 JSON KB + LLM provider tùy chọn
```

BE_AI phụ trách curriculum retrieval, game recommendation, content generation, schema validation, repair và streaming pipeline events. BE_Web phụ trách authentication, persistence, saved-game APIs và teacher review workflow.

## Cấu Trúc Repository

```text
FE/                         Frontend Next.js
BE_Web/                     Backend web-facing cho auth, saved games, review
backend/                    Backend AI agent workflow
backend/data/gdpt_2018/     Runtime GDPT 2018 KB dùng bởi BE_AI
knowledge_base/gdpt_2018/   Canonical KB để review và chỉnh sửa
docs/                       Tài liệu kiến trúc và eval evidence
scripts/                    AI logging / course utility scripts
```

## Yêu Cầu Môi Trường

- Python 3.11+
- `uv` để quản lý môi trường Python backend
- Node.js 20+
- `npm`
- PostgreSQL là tùy chọn. Local development của BE_Web mặc định dùng SQLite.
- Một LLM API key nếu muốn chạy generation thật: OpenAI, DeepSeek hoặc Anthropic.

Các unit test cho retrieval, schema, validation và BE_Web API có thể chạy không cần LLM key.

## Biến Môi Trường

Tạo file `.env` ở repo root từ `.env.example`:

```powershell
Copy-Item .env.example .env
```

### BE_AI

BE_AI đọc `.env` từ repo root qua `backend/app/config.py`.

| Biến | Bắt buộc | Ghi chú |
|---|---:|---|
| `LLM_PROVIDER` | Không | `auto`, `openai`, `deepseek` hoặc `anthropic`; mặc định `auto`. |
| `OPENAI_API_KEY` | Khi dùng OpenAI | Dùng khi `LLM_PROVIDER=openai` hoặc `auto` chọn OpenAI. |
| `DEEPSEEK_API_KEY` | Khi dùng DeepSeek | Dùng khi `LLM_PROVIDER=deepseek` hoặc `auto` chọn DeepSeek. |
| `DEEPSEEK_BASE_URL` | Không | Mặc định `https://api.deepseek.com`. |
| `ANTHROPIC_API_KEY` | Khi dùng Anthropic | Dùng khi `LLM_PROVIDER=anthropic` hoặc `auto` fallback. |
| `DEFAULT_MODEL` | Không | Nếu để trống, hệ thống dùng default model của provider. |
| `MAX_REPAIRS` | Không | Mặc định `2`. |
| `MAX_TOKENS` | Không | Mặc định `4096`. |

Thứ tự ưu tiên khi `LLM_PROVIDER=auto`:

```text
OpenAI -> DeepSeek -> Anthropic
```

### BE_Web

BE_Web đọc `BE_Web/.env` nếu có, nếu không sẽ dùng `BE_Web/.env.example`.

| Biến | Bắt buộc | Mặc định |
|---|---:|---|
| `DATABASE_URL` | Không | `sqlite:///./be_web.db` |
| `BE_AI_BASE_URL` | Không | `http://localhost:8000` |
| `BE_AI_TIMEOUT_SECONDS` | Không | `30.0` |
| `CORS_ORIGINS` | Không | `["http://localhost:3000"]` |
| `JWT_SECRET_KEY` | Nên có | `change-me` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Không | `10080` |

### FE

| Biến | Bắt buộc | Mặc định |
|---|---:|---|
| `NEXT_PUBLIC_BE_WEB_URL` | Không | `http://localhost:8001` |
| `NEXT_PUBLIC_AI_URL` | Không | `http://localhost:8000` |

## Cài Đặt

Nếu chưa có `uv`:

```powershell
python -m pip install uv
```

Hai backend Python đều giữ `requirements.txt` để fallback/export runtime, nhưng local development nên dùng `uv sync --extra dev`.

### 1. Cài BE_AI

```powershell
cd backend
uv sync --extra dev
```

### 2. Cài BE_Web

```powershell
cd BE_Web
uv sync --extra dev
```

SQLite local chạy được ngay. Nếu dùng PostgreSQL, đặt:

```text
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/be_web
```

### 3. Cài FE

```powershell
cd FE
npm install
```

## Chạy Local

Mở ba terminal.

### Terminal 1 - BE_AI

```powershell
cd backend
uv run uvicorn app.main:app --reload --port 8000
```

Swagger UI:

```text
http://127.0.0.1:8000/docs
```

### Terminal 2 - BE_Web

```powershell
cd BE_Web
uv run uvicorn app.main:app --reload --port 8001
```

Swagger UI:

```text
http://127.0.0.1:8001/docs
```

### Terminal 3 - FE

```powershell
cd FE
npm run dev
```

App:

```text
http://localhost:3000
```

## Ví Dụ Gọi API

### BE_AI full generation

Dùng khi muốn BE_AI tự retrieve GDPT context, recommend template, generate, validate và repair.

```powershell
$body = @{
  subject = "Toan"
  grade = 5
  difficulty = "medium"
  prompt = "Tao game ve ti so phan tram va giam gia"
  objective_id = ""
  source_text = ""
  uploaded_file_id = ""
  upload_type = "none"
  num_items = 5
  override_template = ""
} | ConvertTo-Json -Depth 10

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/generate/full" `
  -ContentType "application/json; charset=utf-8" `
  -Body $body
```

### BE_AI explicit template generation

Dùng `/generate` khi caller đã chọn content template.

```json
{
  "subject": "Toan",
  "grade": 3,
  "difficulty": "medium",
  "prompt": "Tao game matching ve phep nhan la phep cong lap",
  "objective_id": "",
  "source_text": "Vi du: 3 gio tao, moi gio 4 qua. Hoat dong 10 phut cuoi gio.",
  "uploaded_file_id": "slide_001",
  "upload_type": "slide",
  "num_items": 8,
  "override_template": "matching"
}
```

### Luồng FE hiện tại

Trang `/dashboard/game/new` gọi `/recommend/games` trước. Sau khi giáo viên chọn game, FE gọi `/generate/stream`.

```powershell
$recommendBody = @{
  subject = "Toan"
  grade = 3
  difficulty = "medium"
  prompt = "Tao game matching ve phep nhan la phep cong lap"
  source_text = "Vi du: 3 gio tao, moi gio 4 qua"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8000/recommend/games" `
  -ContentType "application/json" `
  -Body $recommendBody
```

### BE_Web auth và saved game APIs

```powershell
$signup = Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8001/api/auth/signup" `
  -ContentType "application/json" `
  -Body (@{
    email = "teacher@example.com"
    password = "secret123"
    name = "Teacher"
  } | ConvertTo-Json)

$token = $signup.accessToken

Invoke-RestMethod `
  -Method Get `
  -Uri "http://127.0.0.1:8001/api/games" `
  -Headers @{ Authorization = "Bearer $token" }
```

BE_Web hiện phụ trách auth, saved-game listing, review/edit, approve/publish, avatar upload và battleship play serving. Game creation hiện đi qua BE_AI endpoints do FE gọi.

## Test

```powershell
cd backend
uv run pytest
```

```powershell
cd BE_Web
uv run pytest
```

```powershell
cd FE
npm run build
```

Eval evidence mới nhất nằm ở [docs/EVAL_EVIDENCE.md](docs/EVAL_EVIDENCE.md).

## AI Logging

Course AI logging hooks nằm trong `scripts/`. Trên Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
```

Log thủ công cho ChatGPT/web:

```powershell
scripts\_pyrun.cmd scripts\log_manual.py --tool chatgpt --prompt "<noi dung da lam>"
```
