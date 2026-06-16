"""Live smoke test: run the full workflow against the real Claude API for one fixture objective.

Usage:
    cd backend && .venv/bin/python -m scripts.smoke_generate
Requires a valid ANTHROPIC_API_KEY in the repo .env.
"""

from __future__ import annotations

import asyncio
import json

from app.agents.graph import run_workflow
from app.config import settings


async def main() -> int:
    if not settings.has_api_key:
        print("SKIP: no valid ANTHROPIC_API_KEY in .env")
        return 0

    print(f"Model: {settings.default_model}")
    state = await run_workflow(
        subject="Lịch sử",
        grade=8,
        difficulty="medium",
        prompt="Tạo trò chơi về phong trào Cần Vương cho học sinh lớp 8.",
        objective_id="ls8-phongtrao-canvuong",
        num_items=4,
    )

    print(f"\nRecommended template: {state.get('template_id')}")
    print(f"Rationale: {state.get('rationale')}")
    print(f"OK: {state.get('ok')}  repair_attempts: {state.get('repair_attempts', 0)}")
    if state.get("ok"):
        print("\nContent:")
        print(json.dumps(state["content"], ensure_ascii=False, indent=2))
        return 0
    print(f"\nFAILED: {state.get('error')}")
    print(f"Validation errors: {state.get('validation_errors')}")
    return 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
