"""LLM provider adapter.

The agent workflow forces tool/function calling so the model returns structured
JSON matching the selected game schema. Anthropic uses its native tool API.
OpenAI and DeepSeek use the OpenAI-compatible Chat Completions tool-calling API.
"""

from __future__ import annotations

import json
from functools import lru_cache
from typing import Any

from openai import AsyncOpenAI

from app.config import settings


_DEFAULT_MODELS = {
    "anthropic": "claude-sonnet-4-6",
    "openai": "gpt-4.1-mini",
    "deepseek": "deepseek-chat",
}


def _model_for(provider: str, explicit_model: str | None) -> str:
    if explicit_model:
        return explicit_model
    if settings.default_model:
        return settings.default_model
    return _DEFAULT_MODELS[provider]


@lru_cache(maxsize=1)
def _anthropic_client():
    if not settings.anthropic_api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set. Add it to the repo .env.")
    try:
        from anthropic import AsyncAnthropic
    except ImportError as exc:
        raise RuntimeError("Missing dependency 'anthropic'. Install backend requirements.") from exc
    return AsyncAnthropic(api_key=settings.anthropic_api_key)


@lru_cache(maxsize=1)
def _openai_client():
    if not settings.openai_api_key:
        raise RuntimeError("OPENAI_API_KEY is not set. Add it to the repo .env.")
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise RuntimeError("Missing dependency 'openai'. Install backend requirements.") from exc
    return AsyncOpenAI(api_key=settings.openai_api_key)


@lru_cache(maxsize=1)
def _deepseek_client():
    if not settings.deepseek_api_key:
        raise RuntimeError("DEEPSEEK_API_KEY is not set. Add it to the repo .env.")
    try:
        from openai import AsyncOpenAI
    except ImportError as exc:
        raise RuntimeError("Missing dependency 'openai'. Install backend requirements.") from exc
    return AsyncOpenAI(api_key=settings.deepseek_api_key, base_url=settings.deepseek_base_url)


def _openai_tool_schema(
    *, tool_name: str, tool_description: str, input_schema: dict[str, Any]
) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool_name,
                "description": tool_description,
                "parameters": input_schema,
            },
        }
    ]


async def _call_anthropic_tool(
    *,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, Any],
    model: str | None,
    max_tokens: int | None,
    client: Any | None,
) -> dict[str, Any]:
    client = client or _anthropic_client()
    resp = await client.messages.create(
        model=_model_for("anthropic", model),
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


async def _call_openai_compatible_tool(
    *,
    provider: str,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, Any],
    model: str | None,
    max_tokens: int | None,
    client: Any | None,
) -> dict[str, Any]:
    if provider == "openai":
        client = client or _openai_client()
    elif provider == "deepseek":
        client = client or _deepseek_client()
    else:
        raise RuntimeError(f"Unsupported OpenAI-compatible provider '{provider}'.")

    request: dict[str, Any] = {
        "model": _model_for(provider, model),
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "tools": _openai_tool_schema(
            tool_name=tool_name,
            tool_description=tool_description,
            input_schema=input_schema,
        ),
        "tool_choice": {"type": "function", "function": {"name": tool_name}},
    }
    if provider == "openai":
        request["max_completion_tokens"] = max_tokens or settings.max_tokens
    else:
        request["max_tokens"] = max_tokens or settings.max_tokens

    resp = await client.chat.completions.create(**request)
    message = resp.choices[0].message
    tool_calls = getattr(message, "tool_calls", None) or []
    if not tool_calls:
        raise RuntimeError(f"Model returned no tool call for tool '{tool_name}'.")
    args = tool_calls[0].function.arguments
    if isinstance(args, dict):
        return args
    try:
        return json.loads(args)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Model returned invalid tool arguments for '{tool_name}'.") from exc


async def call_tool(
    *,
    system: str,
    user: str,
    tool_name: str,
    tool_description: str,
    input_schema: dict[str, Any],
    model: str | None = None,
    max_tokens: int | None = None,
    client: Any | None = None,
) -> dict[str, Any]:
    """Call the configured provider forcing a single tool and return its input dict."""
    provider = settings.provider
    if provider == "anthropic":
        return await _call_anthropic_tool(
            system=system,
            user=user,
            tool_name=tool_name,
            tool_description=tool_description,
            input_schema=input_schema,
            model=model,
            max_tokens=max_tokens,
            client=client,
        )
    if provider in {"openai", "deepseek"}:
        return await _call_openai_compatible_tool(
            provider=provider,
            system=system,
            user=user,
            tool_name=tool_name,
            tool_description=tool_description,
            input_schema=input_schema,
            model=model,
            max_tokens=max_tokens,
            client=client,
        )
    raise RuntimeError(
        f"Unsupported LLM_PROVIDER '{settings.llm_provider}'. Use anthropic, openai, or deepseek."
    )
