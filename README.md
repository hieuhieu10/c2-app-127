# LearnGame - GDPT-Aware Learning Game Generator

LearnGame is a teacher-facing game generation system. Teachers create a lesson-game request, review generated questions, edit items, approve the game, and play it through a game shell.

The current MVP focuses on:

- Vietnamese GDPT 2018 curriculum grounding.
- Primary-school Mathematics knowledge base, grade 1-5.
- Teacher review before publishing.
- Treasure Hunt and Trivia Battleship product shells, with BE_Web currently exposing Treasure Hunt in `/api/templates`.

## Architecture

Detailed component and data-flow diagrams are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Short version:

```text
FE Next.js
  -> BE_Web FastAPI + DB
  -> BE_AI FastAPI agent workflow
  -> GDPT 2018 JSON KB + optional LLM provider
```

BE_AI owns curriculum retrieval, template recommendation, content generation, schema validation, and repair. BE_Web owns authentication, persistence, teacher review workflow, and mapping AI content into frontend game items.

## Repository Layout

```text
FE/                         Next.js frontend
BE_Web/                     Teacher-facing FastAPI backend
backend/                    BE_AI agent workflow backend
backend/data/gdpt_2018/     Runtime GDPT 2018 KB used by BE_AI
knowledge_base/gdpt_2018/   Canonical KB sources and reviewed JSON
docs/                       Architecture and evaluation evidence
scripts/                    AI logging / course utility scripts
```

## Prerequisites

- Python 3.11+
- Node.js 20+
- npm
- Optional: PostgreSQL. Local development defaults to SQLite for BE_Web.
- One LLM API key for real generation: OpenAI, DeepSeek, or Anthropic.

Unit tests for retrieval, schemas, validation, and BE_Web API can run without an LLM key.

## Environment Variables

Create root `.env` from `.env.example`:

```powershell
Copy-Item .env.example .env
```

### BE_AI

Loaded by `backend/app/config.py` from the repo root `.env`.

| Variable | Required | Notes |
|---|---:|---|
| `LLM_PROVIDER` | No | `auto`, `openai`, `deepseek`, or `anthropic`; default `auto`. |
| `OPENAI_API_KEY` | For OpenAI | Used when `LLM_PROVIDER=openai` or auto picks OpenAI. |
| `DEEPSEEK_API_KEY` | For DeepSeek | Used when `LLM_PROVIDER=deepseek` or auto picks DeepSeek. |
| `DEEPSEEK_BASE_URL` | No | Default `https://api.deepseek.com`. |
| `ANTHROPIC_API_KEY` | For Anthropic | Used when `LLM_PROVIDER=anthropic` or auto fallback. |
| `DEFAULT_MODEL` | No | If empty, provider default is used. |
| `MAX_REPAIRS` | No | Defaults to `2`. |
| `MAX_TOKENS` | No | Defaults to `4096`. |

Provider priority when `LLM_PROVIDER=auto`:

```text
OpenAI -> DeepSeek -> Anthropic
```

### BE_Web

Loaded by `BE_Web/app/core/settings.py` from `BE_Web/.env` if present, otherwise `BE_Web/.env.example`.

| Variable | Required | Default |
|---|---:|---|
| `DATABASE_URL` | No | `sqlite:///./be_web.db` |
| `BE_AI_BASE_URL` | No | `http://localhost:8000` |
| `BE_AI_TIMEOUT_SECONDS` | No | `30.0` |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` |
| `JWT_SECRET_KEY` | Recommended | `change-me` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | No | 10080 |

### Frontend

| Variable | Required | Default |
|---|---:|---|
| `NEXT_PUBLIC_BE_WEB_URL` | No | `http://localhost:8001` |

## Setup

### 1. Install BE_AI

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt
```

Alternative editable dev install:

```powershell
cd backend
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
```

### 2. Install BE_Web

```powershell
cd BE_Web
python -m venv .venv
.venv\Scripts\python -m pip install -e ".[dev]"
```

Local SQLite works without setup. For PostgreSQL, set:

```text
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/be_web
```

Then create tables through app startup or a local table creation script if available in your branch.

### 3. Install FE

```powershell
cd FE
npm install
```

## Run Locally

Open three terminals.

### Terminal 1 - BE_AI

```powershell
cd backend
.venv\Scripts\uvicorn app.main:app --reload --port 8000
```

Docs:

```text
http://127.0.0.1:8000/docs
```

### Terminal 2 - BE_Web

```powershell
cd BE_Web
.venv\Scripts\uvicorn app.main:app --reload --port 8001
```

Docs:

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

## Sample Queries

### BE_AI Full Generation

Use this when you want BE_AI to retrieve GDPT context, recommend a content template, generate, validate, and repair.

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

### BE_AI Explicit Template Generation

Use `/generate` when the caller already selected a content template.

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

### BE_Web Auth + Generate Draft

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

$gameBody = @{
  title = "Math facts"
  input = "Create a short game for practicing multiplication facts."
  product_template_id = "treasure_hunt"
  subject = "Toan"
  grade = 3
  difficulty = "medium"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://127.0.0.1:8001/api/games/generate" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" `
  -Body $gameBody
```

Current BE_Web behavior: BE_Web stores the requested grade and sends that same `lesson.grade` to BE_AI. It sends the teacher request `input` as both BE_AI `prompt` and `source_text`.

## Tests

```powershell
cd backend
python -m pytest
```

```powershell
cd BE_Web
.venv\Scripts\python -m pytest
```

```powershell
cd FE
npm run build
```

Latest local evidence is recorded in [docs/EVAL_EVIDENCE.md](docs/EVAL_EVIDENCE.md).

## Known Gaps In Current Branch

- FE create page currently sends `title`, `input`, and `product_template_id`; it does not yet send uploaded lesson file context through BE_Web.
- BE_Web currently exposes only Treasure Hunt from `/api/templates`, although Battleship shell code exists.
- BE_Web currently calls BE_AI `/generate` with forced `override_template`, not `/generate/full`.
- FE production build may fail in restricted network environments because `next/font/google` tries to fetch Google Fonts.

## AI Logging

Course AI logging hooks remain under `scripts/`. On Windows:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\setup_hooks.ps1
```

Manual ChatGPT/web logging:

```powershell
scripts\_pyrun.cmd scripts\log_manual.py --tool chatgpt --prompt "<what you did>"
```
