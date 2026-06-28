"""LLM provider adapter.

The agent workflow forces tool/function calling so the model returns structured
JSON matching the selected game schema. Anthropic uses its native tool API.
OpenAI and DeepSeek use the OpenAI-compatible Chat Completions tool-calling API.
"""

from __future__ import annotations

import asyncio
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


def _get_attr_or_key(value: Any, name: str, default: Any = None) -> Any:
    if isinstance(value, dict):
        return value.get(name, default)
    return getattr(value, name, default)


def _strip_markdown_json_fence(text: str) -> str:
    cleaned = text.strip()
    if not cleaned.startswith("```"):
        return cleaned

    lines = cleaned.splitlines()
    if len(lines) >= 2 and lines[0].strip().startswith("```"):
        if lines[-1].strip() == "```":
            lines = lines[1:-1]
        else:
            lines = lines[1:]
    return "\n".join(lines).strip()


def _parse_json_object(raw: Any, *, tool_name: str) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if raw is None:
        raise RuntimeError(f"Model returned empty tool arguments for '{tool_name}'.")
    if not isinstance(raw, str):
        raise RuntimeError(f"Model returned unsupported tool arguments for '{tool_name}'.")

    text = _strip_markdown_json_fence(raw)
    try:
        parsed = json.loads(text)
    except json.JSONDecodeError:
        # DeepSeek can occasionally append explanatory text after a valid JSON
        # object. raw_decode stops after the first JSON value and ignores the
        # trailing text, while still rejecting a non-JSON prefix.
        try:
            parsed, _ = json.JSONDecoder().raw_decode(text)
        except json.JSONDecodeError as exc:
            raise RuntimeError(f"Model returned invalid tool arguments for '{tool_name}'.") from exc

    if not isinstance(parsed, dict):
        raise RuntimeError(f"Model returned non-object tool arguments for '{tool_name}'.")
    return parsed


def _message_content_text(message: Any) -> str:
    content = _get_attr_or_key(message, "content", "")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            elif hasattr(item, "text") and isinstance(getattr(item, "text"), str):
                parts.append(getattr(item, "text"))
        return "\n".join(parts)
    return ""


def _extract_openai_compatible_tool_args(
    message: Any, *, tool_name: str, provider: str, finish_reason: str | None = None
) -> dict[str, Any]:
    tool_calls = _get_attr_or_key(message, "tool_calls", None) or []
    if tool_calls:
        for tool_call in tool_calls:
            function = _get_attr_or_key(tool_call, "function", None)
            call_name = _get_attr_or_key(function, "name", None)
            if call_name and call_name != tool_name:
                continue
            return _parse_json_object(_get_attr_or_key(function, "arguments", None), tool_name=tool_name)

    # DeepSeek is OpenAI-compatible but may occasionally return the JSON object
    # in message.content instead of emitting a formal tool call, especially when
    # prompts are long. Keep OpenAI strict, but accept this fallback for DeepSeek.
    if provider == "deepseek":
        content = _message_content_text(message)
        if content:
            return _parse_json_object(content, tool_name=tool_name)

    # A 'thinking' model (e.g. deepseek-v4-flash) can spend the whole max_tokens
    # budget on reasoning_content and stop with finish_reason='length' before
    # emitting the tool call, leaving both tool_calls and content empty. Surface
    # an actionable error instead of the generic "no tool call".
    if finish_reason == "length":
        raise RuntimeError(
            f"Model hit the max_tokens limit before emitting tool '{tool_name}' "
            f"(finish_reason='length'). A 'thinking' model such as deepseek-v4-flash "
            f"likely spent the token budget on reasoning. Use a non-thinking model "
            f"like deepseek-chat (DEFAULT_MODEL), or raise MAX_TOKENS."
        )
    raise RuntimeError(f"Model returned no tool call for tool '{tool_name}'.")


def _is_deepseek_tool_choice_error(exc: Exception) -> bool:
    text = str(exc).lower()
    return "tool_choice" in text and ("thinking mode" in text or "not support" in text or "does not support" in text)


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
    }
    request["tool_choice"] = {"type": "function", "function": {"name": tool_name}}
    # DeepSeek hybrid models (e.g. deepseek-v4-flash) default to a 'thinking' mode that
    # both rejects a forced tool_choice ("Thinking mode does not support this tool_choice")
    # and spends the max_tokens budget on reasoning_content — which can truncate before the
    # tool call is emitted (finish_reason='length' -> "no tool call"). Disabling thinking lets
    # us force the tool call deterministically, exactly like OpenAI. Harmless on deepseek-chat.
    if provider == "deepseek":
        request["extra_body"] = {"thinking": {"type": "disabled"}}
    if provider == "openai":
        request["max_completion_tokens"] = max_tokens or settings.max_tokens
    else:
        request["max_tokens"] = max_tokens or settings.max_tokens

    try:
        resp = await client.chat.completions.create(**request)
    except Exception as exc:
        # Some DeepSeek models / modes reject forced tool_choice with:
        # "Thinking mode does not support this tool_choice". In that case we
        # retry with tools still provided but let the model decide whether to
        # emit a tool call. If it returns JSON in content instead, the parser
        # below handles that DeepSeek-only fallback.
        if provider == "deepseek" and _is_deepseek_tool_choice_error(exc):
            retry_request = dict(request)
            retry_request.pop("tool_choice", None)
            resp = await client.chat.completions.create(**retry_request)
        else:
            raise
    choice = resp.choices[0]
    return _extract_openai_compatible_tool_args(
        choice.message,
        tool_name=tool_name,
        provider=provider,
        finish_reason=getattr(choice, "finish_reason", None),
    )


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
    timeout: float = 30.0,
) -> dict[str, Any]:
    """Call the configured provider forcing a single tool and return its input dict.

    Raises ``asyncio.TimeoutError`` if the provider does not respond within
    ``timeout`` seconds (default 30 s), so callers are never left hanging.
    """
    provider = settings.provider

    async def _call() -> dict[str, Any]:
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

    return await asyncio.wait_for(_call(), timeout=timeout)
