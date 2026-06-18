# Architecture

This document describes the current project architecture in this branch. The two source diagrams live in `docs/statics/` and are embedded below for PR review.

## Visual Architecture Diagram

![Architecture diagram](statics/architecture_diagram.svg)

The architecture has three runtime layers:

- **FE - Next.js**: teacher UI, game creation chat, recommendation selection, validation/review screens, and playable shells.
- **BE_AI - FastAPI agent backend**: guardrails, GDPT retrieval, teacher-context extraction, difficulty/scope assessment, game recommendation, streaming generation, validation, and repair.
- **BE_Web - FastAPI**: authentication, app persistence, saved games, teacher edits, approval/publish workflow, avatar upload, and static game serving.

Supporting systems:

- **DB**: SQLite locally or PostgreSQL in deployment.
- **GDPT 2018 JSON KB**: file-backed curriculum authority for primary Mathematics.
- **LLM provider**: OpenAI, DeepSeek, or Anthropic.

## Component Diagram Fallback

```mermaid
flowchart LR
    Teacher[Teacher Browser]
    FE[FE - Next.js app]
    BEW[BE_Web - FastAPI]
    DB[(SQLite / PostgreSQL)]
    BEAI[BE_AI - FastAPI agent workflow]
    KB[(GDPT 2018 JSON KB)]
    LLM[LLM Provider<br/>OpenAI / DeepSeek / Anthropic]
    Static[Static Battleship assets]

    Teacher --> FE
    FE -->|REST /recommend/games, /generate/stream| BEAI
    FE -->|REST /api/auth, /api/games| BEW
    BEW --> DB
    BEW -->|GET /static/battleship.html| BEAI
    BEAI --> KB
    BEAI --> LLM
    BEAI --> Static
```

## Data Flow Diagram

![Data flow diagram](statics/dataFlow.png)

The data-flow diagram shows the persisted BE_Web path. The current game-creation UI also has a newer direct BE_AI streaming path described below.

## Current FE Game Creation Flow

```mermaid
sequenceDiagram
    participant T as Teacher
    participant FE as Next.js FE
    participant AI as BE_AI

    T->>FE: enter subject, grade, difficulty, prompt, source text
    FE->>AI: POST /recommend/games
    AI->>AI: guardrail + curriculum-aware game recommendation
    AI-->>FE: ranked playable game recommendations
    T->>FE: choose a recommended game
    FE->>AI: POST /generate/stream with override_template
    AI-->>FE: SSE stage events + safety report + generated content
    FE->>FE: show review/editor and playable shell preview
```

Current FE source:

- `FE/app/dashboard/game/new/page.tsx`
- `FE/src/features/game-creation/ai-api.ts`

Current BE_AI endpoints:

- `POST /recommend/games`
- `POST /generate/stream`
- `POST /generate/full`
- `POST /generate`

## Runtime Components

| Component | Path | Responsibility |
|---|---|---|
| FE | `FE/` | Teacher UI, game creation chat, recommendation selection, validation/review workspace, game shells. |
| BE_Web | `BE_Web/` | Auth, persistence, saved games, teacher review APIs, avatar upload, and static game serving. |
| BE_AI | `backend/` | Guardrails, GDPT retrieval, teacher-context extraction, game recommendation, streaming generation, schema validation, repair. |
| Runtime KB | `backend/data/gdpt_2018/` | JSON objectives loaded into BE_AI memory at startup/request runtime. |
| Canonical KB | `knowledge_base/gdpt_2018/` | Reviewable source documents and curated objectives for Toan grade 1-5. |
| DB | `BE_Web/be_web.db` by default | Users, lessons, games, game items, review events. |
| LLM Provider | external API | OpenAI, DeepSeek, or Anthropic tool-call generation. |

## BE_AI Agent Flow

```mermaid
flowchart TD
    A[LessonRequest] --> B[Retrieve GDPT context]
    B --> C[Extract teacher lesson/slide context]
    C --> D[Assess scope and difficulty]
    D --> E[Recommend content template]
    E --> F[Generate content with LLM]
    F --> G[Schema validation]
    G -->|valid| H[GameResponse ok=true]
    G -->|invalid| I[Repair with LLM]
    I --> G
    G -->|repair exhausted| J[GameResponse ok=false]
```

Relevant code:

- `backend/app/retrieval/context.py`
- `backend/app/agents/graph.py`
- `backend/app/agents/recommender.py`
- `backend/app/agents/generator.py`
- `backend/app/validation/validator.py`

## Knowledge Base Retrieval Flow

```mermaid
flowchart TD
    A[prompt + source_text] --> B[normalize Vietnamese text]
    B --> C[filter objectives by grade]
    C --> D[score topic/objective_text/search_aliases/skills]
    D --> E[pick highest score objective]
    E --> F[build curriculum_context]
    F --> G[scope_status + difficulty_assessment]
```

The retrieval provider does not use vector search and does not ask an LLM to read all JSON files. It loads objectives from JSON into Python memory and uses heuristic matching.

Current scoring code:

```text
backend/app/retrieval/context.py::_match_objective()
```

Scoring signals:

- Exact phrase match in prompt/source text.
- Token overlap between query and objective fields.
- Alias/topic subset match.
- Direct `objective_id` match bypasses scoring and returns confidence `1.0`.

## BE_Web Saved-Game Review Flow

```mermaid
sequenceDiagram
    participant T as Teacher
    participant FE as Next.js FE
    participant WEB as BE_Web
    participant DB as DB

    T->>FE: open saved game from dashboard
    FE->>WEB: GET /api/games or GET /api/games/{game_id}
    WEB->>DB: load user's saved Lesson/Game/GameItems
    WEB-->>FE: saved game payload
    FE->>WEB: PATCH item edits / approve / publish
    WEB->>DB: persist review event and status
```

Current BE_Web behavior in this branch:

- It does not generate new games.
- It owns authentication, saved games, teacher edits, review events, approval, publishing, avatar upload, and static upload serving.
- Current FE game creation uses BE_AI `/recommend/games` and `/generate/stream`.

## Teacher Review Flow

```mermaid
flowchart LR
    A[Generated draft] --> B[Validation page]
    B --> C[Teacher edits item]
    C --> D[PATCH /api/games/{game_id}/items/{item_id}]
    D --> E[Recheck item]
    E --> F[Approve game]
    F --> G[Publish game]
```

Persistence tables:

- `users`
- `lessons`
- `games`
- `game_items`
- `game_review_events`

## Data Contracts

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

## Deployment Notes

Minimum service topology:

```text
FE -> BE_Web -> BE_AI
BE_Web -> SQLite/PostgreSQL
BE_AI -> LLM provider
BE_AI -> local JSON KB
```

For production, prefer:

- PostgreSQL for BE_Web.
- Strong `JWT_SECRET_KEY`.
- Backend-only storage for uploaded lesson files/slides.
- A real parser pipeline for PDF/DOCX/PPTX to populate `source_text`.
