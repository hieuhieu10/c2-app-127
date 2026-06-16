"""Anthropic client + a forced tool-use helper.

Forcing tool use (``tool_choice`` = a specific tool whose ``input_schema`` is the target
JSON Schema) makes Claude emit schema-shaped JSON directly, instead of free text we'd have
to parse and repair. The helper returns the tool's input dict.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Any

from anthropic import AsyncAnthropic

from app.config import settings


@lru_cache(maxsize=1)
def get_client() -> AsyncAnthropic:
    if not settings.has_api_key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set/valid. Set it in the repo .env before calling the LLM."
        )
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


async def call_tool(
    *,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, Any],
    model: str | None = None,
    max_tokens: int | None = None,
    client: AsyncAnthropic | None = None,
) -> dict[str, Any]:
    """Call Claude forcing a single tool and return the tool input (a dict).

    Raises RuntimeError if the model returns no tool_use block.
    """
    client = client or get_client()
    resp = await client.messages.create(
        model=model or settings.default_model,
        max_tokens=max_tokens or settings.max_tokens,
        system=system,
        tools=[
            {
                "name": tool_name,
                "description": tool_description,
                "input_schema": input_schema,
            }
        ],
        tool_choice={"type": "tool", "name": tool_name},
        messages=[{"role": "user", "content": user}],
    )
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            return dict(block.input)
    raise RuntimeError(f"Model returned no tool_use block for tool '{tool_name}'.")
