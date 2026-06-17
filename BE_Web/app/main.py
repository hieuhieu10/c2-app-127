from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api import auth, games, templates
from app.core.settings import settings
from app.db import models  # noqa: F401
from app.db.schema_compat import ensure_schema_compatibility
from app.db.session import Base, engine

ensure_schema_compatibility(engine)
Base.metadata.create_all(bind=engine)

uploads_dir = Path(settings.upload_dir)
uploads_dir.mkdir(parents=True, exist_ok=True)
(uploads_dir / "avatars").mkdir(parents=True, exist_ok=True)

app = FastAPI(title=settings.app_name, version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=str(uploads_dir)), name="uploads")

app.include_router(auth.router)
app.include_router(templates.router)
app.include_router(games.router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
