"""Opt-in API debug logging for BE_Web.

Enable with API_DEBUG=true. Sensitive headers/body fields are redacted.
"""

from __future__ import annotations

import json
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from fastapi import FastAPI, Request
from starlette.responses import Response

logger = logging.getLogger("api.debug")

_SENSITIVE_KEYS = {"authorization", "cookie", "set-cookie", "password", "token", "api_key", "secret"}


def install_api_debug_middleware(app: FastAPI, *, enabled: bool) -> None:
    if not enabled:
        return

    logging.basicConfig(level=logging.INFO)
    logger.setLevel(logging.INFO)

    @app.middleware("http")
    async def api_debug_middleware(request: Request, call_next: Callable[[Request], Awaitable[Response]]) -> Response:
        body = await request.body()
        logger.info(
            "[API DEBUG] -> %s %s%s headers=%s body=%s",
            request.method,
            request.url.path,
            f"?{request.url.query}" if request.url.query else "",
            _redact_mapping(dict(request.headers)),
            _format_body(body, request.headers.get("content-type", "")),
        )

        async def receive() -> dict[str, Any]:
            return {"type": "http.request", "body": body, "more_body": False}

        response = await call_next(Request(request.scope, receive))
        content_type = response.headers.get("content-type", "")
        response_body = b""
        async for chunk in response.body_iterator:
            response_body += chunk

        logger.info(
            "[API DEBUG] <- %s %s status=%s content-type=%s body=%s",
            request.method,
            request.url.path,
            response.status_code,
            content_type,
            _format_body(response_body, content_type),
        )
        return Response(
            content=response_body,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.media_type,
            background=response.background,
        )


def _format_body(body: bytes, content_type: str, limit: int = 8000) -> str:
    if not body:
        return "<empty>"
    if "multipart/form-data" in content_type:
        return f"<multipart body; {len(body)} bytes>"
    text = body.decode("utf-8", errors="replace")
    if "application/json" in content_type:
        try:
            return _truncate(json.dumps(_redact_json(json.loads(text)), ensure_ascii=False), limit)
        except json.JSONDecodeError:
            pass
    return _truncate(text, limit)


def _redact_json(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: ("<redacted>" if _is_sensitive(key) else _redact_json(item))
            for key, item in value.items()
        }
    if isinstance(value, list):
        return [_redact_json(item) for item in value]
    return value


def _redact_mapping(value: dict[str, str]) -> dict[str, str]:
    return {key: ("<redacted>" if _is_sensitive(key) else item) for key, item in value.items()}


def _is_sensitive(key: str) -> bool:
    normalized = key.casefold().replace("-", "_")
    return any(part in normalized for part in _SENSITIVE_KEYS)


def _truncate(text: str, limit: int) -> str:
    return text if len(text) <= limit else text[:limit] + f"... <truncated {len(text) - limit} chars>"

