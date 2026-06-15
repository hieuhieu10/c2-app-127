"""FastAPI app for the Team 127 agent workflow (recommend + generate)."""

from __future__ import annotations

from fastapi import FastAPI

from app.api.routes_generate import router as generate_router

app = FastAPI(
    title="AI Learning-Game Generator — Agent Workflow",
    description="Recommend a game template and generate schema-valid game content.",
    version="0.1.0",
)

app.include_router(generate_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
