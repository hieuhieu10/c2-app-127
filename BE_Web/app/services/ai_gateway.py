from __future__ import annotations

import json
from collections.abc import AsyncGenerator
from typing import Any

import httpx

from app.core.settings import settings


class BeAiGatewayError(RuntimeError):
    pass


async def recommend_games(payload: dict[str, Any]) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(
            base_url=settings.be_ai_base_url,
            timeout=settings.be_ai_timeout_seconds,
        ) as client:
            response = await client.post("/recommend/games", json=payload)
            response.raise_for_status()
            return response.json()
    except httpx.HTTPStatusError as exc:
        detail = _extract_detail(exc.response)
        raise BeAiGatewayError(detail) from exc
    except httpx.HTTPError as exc:
        raise BeAiGatewayError(f"Could not reach BE_AI recommend endpoint: {exc}") from exc


async def stream_generate(payload: dict[str, Any]) -> AsyncGenerator[dict[str, Any], None]:
    try:
        async with httpx.AsyncClient(
            base_url=settings.be_ai_base_url,
            timeout=None,
        ) as client:
            async with client.stream("POST", "/generate/stream", json=payload) as response:
                response.raise_for_status()
                buffer = ""
                async for chunk in response.aiter_text():
                    buffer += chunk
                    parts = buffer.split("\n\n")
                    buffer = parts.pop() or ""
                    for part in parts:
                        line = part.strip()
                        if not line.startswith("data: "):
                            continue
                        try:
                            yield json.loads(line[6:])
                        except json.JSONDecodeError:
                            continue
    except httpx.HTTPStatusError as exc:
        detail = _extract_detail(exc.response)
        raise BeAiGatewayError(detail) from exc
    except httpx.HTTPError as exc:
        raise BeAiGatewayError(f"Could not reach BE_AI generate endpoint: {exc}") from exc


def _extract_detail(response: httpx.Response) -> str:
    try:
        body = response.json()
    except ValueError:
        return f"BE_AI request failed with {response.status_code}"
    detail = body.get("detail")
    if isinstance(detail, dict):
        return str(detail.get("message") or detail)
    if isinstance(detail, str):
        return detail
    return f"BE_AI request failed with {response.status_code}"
