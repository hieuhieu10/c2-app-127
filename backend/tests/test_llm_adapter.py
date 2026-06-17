"""Provider adapter tests without network calls."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

import app.agents.llm as llm
from app.config import Settings


def test_auto_provider_prefers_openai_key():
    settings = Settings(llm_provider="auto", openai_api_key="sk-openai")
    assert settings.provider == "openai"


def test_auto_provider_uses_deepseek_when_only_deepseek_key():
    settings = Settings(llm_provider="auto", openai_api_key="", deepseek_api_key="sk-deepseek")
    assert settings.provider == "deepseek"


def test_model_defaults(monkeypatch):
    monkeypatch.setattr(llm.settings, "default_model", "")
    assert llm._model_for("openai", None) == "gpt-4.1-mini"
    assert llm._model_for("deepseek", None) == "deepseek-chat"
    assert llm._model_for("anthropic", None) == "claude-sonnet-4-6"
    assert llm._model_for("openai", "gpt-test") == "gpt-test"


@pytest.mark.anyio
async def test_openai_compatible_tool_parses_arguments():
    class FakeCompletions:
        async def create(self, **kwargs):
            assert kwargs["tool_choice"]["function"]["name"] == "emit"
            assert kwargs["max_completion_tokens"] == 32
            assert "max_tokens" not in kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            tool_calls=[
                                SimpleNamespace(
                                    function=SimpleNamespace(arguments='{"ok": true, "value": 3}')
                                )
                            ]
                        )
                    )
                ]
            )

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    out = await llm._call_openai_compatible_tool(
        provider="openai",
        system="s",
        user="u",
        tool_name="emit",
        tool_description="Emit data",
        input_schema={"type": "object", "properties": {"ok": {"type": "boolean"}}},
        model="gpt-test",
        max_tokens=32,
        client=fake_client,
    )
    assert out == {"ok": True, "value": 3}


@pytest.mark.anyio
async def test_deepseek_compatible_tool_uses_legacy_max_tokens():
    class FakeCompletions:
        async def create(self, **kwargs):
            assert kwargs["max_tokens"] == 32
            assert "max_completion_tokens" not in kwargs
            return SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            tool_calls=[
                                SimpleNamespace(function=SimpleNamespace(arguments='{"ok": true}'))
                            ]
                        )
                    )
                ]
            )

    fake_client = SimpleNamespace(chat=SimpleNamespace(completions=FakeCompletions()))
    out = await llm._call_openai_compatible_tool(
        provider="deepseek",
        system="s",
        user="u",
        tool_name="emit",
        tool_description="Emit data",
        input_schema={"type": "object"},
        model="deepseek-chat",
        max_tokens=32,
        client=fake_client,
    )
    assert out == {"ok": True}


@pytest.mark.anyio
async def test_unknown_provider_errors(monkeypatch):
    monkeypatch.setattr(llm.settings, "llm_provider", "unknown")
    with pytest.raises(RuntimeError, match="Unsupported LLM_PROVIDER"):
        await llm.call_tool(
            system="s",
            user="u",
            tool_name="emit",
            tool_description="Emit data",
            input_schema={"type": "object"},
        )
