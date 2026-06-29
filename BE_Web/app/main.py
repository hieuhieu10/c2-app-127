from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.core.debug import install_api_debug_middleware
from app.api import auth, chat, games, uploads
from app.core.settings import settings
from app.db.schema_compat import ensure_schema_compatibility
from app.db.session import engine

uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
(uploads_dir / "avatars").mkdir(parents=True, exist_ok=True)
(uploads_dir / "lesson_files").mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.app_name, version="0.1.0")


@app.on_event("startup")
def _ensure_schema() -> None:
    # Bring the live DB up to date with the current models (create missing
    # tables, add columns newer branches introduced) before serving requests.
    ensure_schema_compatibility(engine)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
install_api_debug_middleware(app, enabled=settings.api_debug)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(games.router)
app.include_router(uploads.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
