# BE_Web

FastAPI backend for the Next.js frontend. The browser calls BE_Web only; BE_Web owns app workflow data, persists game drafts, and calls BE_AI for recommendation/generation.

## Run

```powershell
cd BE_Web
Copy-Item .env.example .env
python -m uvicorn app.main:app --reload --port 8001
```

By default this uses `sqlite:///./be_web.db` for local development. To run with PostgreSQL, edit `BE_Web/.env` and set `DATABASE_URL`, for example:

```text
postgresql+psycopg://user:password@localhost:5432/be_web
```

Set `BE_AI_BASE_URL` to the internal BE_AI service URL. Default: `http://localhost:8000`.

## Create Database Tables

If you want to create PostgreSQL tables manually after setting `DATABASE_URL`, run:

```powershell
cd BE_Web
python scripts\create_tables.py
```

Expected tables:

- `users`
- `lessons`
- `games`
- `game_items`
- `game_review_events`

## Main APIs

- `GET /api/templates`
- `POST /api/games/generate`
- `GET /api/games/{game_id}`
- `PATCH /api/games/{game_id}/items/{item_id}`
- `POST /api/games/{game_id}/items/{item_id}/recheck`
- `POST /api/games/{game_id}/items/{item_id}/regenerate`
- `POST /api/games/{game_id}/approve`
- `POST /api/games/{game_id}/publish`
