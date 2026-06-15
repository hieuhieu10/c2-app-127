"""Application settings, loaded from environment / .env.

The repo's root .env already carries ANTHROPIC_API_KEY and DEFAULT_MODEL. We read
those, but default the model to a *current* id rather than the outdated value pinned
in .env, so generation works even if .env is stale.
"""

from __future__ import annotations

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

# Repo root .env (backend/ -> repo root). Falls back gracefully if absent.
_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ROOT_ENV),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    anthropic_api_key: str = ""
    # Current Claude model id; .env may pin an older one — env still overrides if set.
    default_model: str = "claude-sonnet-4-6"
    # Max worker re-generation attempts when content fails schema validation.
    max_repairs: int = 2
    # Tokens budget for a single generation call.
    max_tokens: int = 4096

    @property
    def has_api_key(self) -> bool:
        return bool(self.anthropic_api_key and self.anthropic_api_key.startswith("sk-"))


settings = Settings()
