"""FastAPI app for the Team 127 agent workflow (recommend + generate)."""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.routes_generate import router as generate_router

app = FastAPI(
    title="AI Learning-Game Generator — Agent Workflow",
    description="Recommend a game template and generate schema-valid game content.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(generate_router)

_STATIC = Path(__file__).parent.parent / "static"
app.mount("/static", StaticFiles(directory=_STATIC), name="static")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
