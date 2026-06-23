# BE_Web

BE_Web là FastAPI backend phục vụ authentication, saved games, teacher review/edit APIs, approval/publish state, avatar upload và static upload serving.

Luồng tạo game hiện tại gọi BE_AI trực tiếp từ FE để recommend và stream generation. BE_Web không còn sở hữu endpoint tạo draft cũ `/api/games/generate`.

## Cài Đặt Và Chạy

```powershell
cd BE_Web
Copy-Item .env.example .env
uv sync --extra dev
uv run uvicorn app.main:app --reload --port 8001
```

`requirements.txt` được giữ để fallback/export runtime. Local development nên dùng `uv`.

Mặc định BE_Web dùng SQLite:

```text
sqlite:///./be_web.db
```

Nếu dùng PostgreSQL, sửa `BE_Web/.env`:

```text
DATABASE_URL=postgresql+psycopg://user:password@localhost:5432/be_web
```

`BE_AI_BASE_URL` là URL nội bộ của BE_AI, dùng khi cần battleship play endpoint. Mặc định:

```text
http://localhost:8000
```

Để xem request/response BE_Web trong terminal khi debug local, đặt trong `BE_Web/.env`:

```env
API_DEBUG=true
```

Không bật chế độ này ở môi trường production.

## Bảng Dữ Liệu

- `users`
- `lessons`
- `games`
- `game_items`
- `game_review_events`

## API Chính

- `GET /api/games`
- `GET /api/games/{game_id}`
- `PATCH /api/games/{game_id}/items/{item_id}`
- `POST /api/games/{game_id}/items/{item_id}/recheck`
- `POST /api/games/{game_id}/items/{item_id}/regenerate`
- `POST /api/games/{game_id}/approve`
- `POST /api/games/{game_id}/publish`
- `GET /api/games/{game_id}/play`
- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/me`
- `POST /api/auth/me/avatar`

## Test

```powershell
cd BE_Web
uv run pytest
```
