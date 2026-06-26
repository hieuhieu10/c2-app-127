from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ROOT = Path(__file__).resolve().parents[2]
_ENV_FILE = _ROOT / ".env"
_ENV_EXAMPLE_FILE = _ROOT / ".env.example"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE if _ENV_FILE.exists() else _ENV_EXAMPLE_FILE),
        extra="ignore",
    )

    app_name: str = "BE_Web"
    database_url: str = Field(..., description="PostgreSQL connection URL for BE_Web.")
    be_ai_base_url: str = Field(..., description="Base URL for the BE_AI service.")
    be_ai_timeout_seconds: float = 30.0
    api_debug: bool = False
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:3000"])
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    upload_dir: str = str(_ROOT / "uploads")
    max_avatar_size_bytes: int = 2 * 1024 * 1024


settings = Settings()
