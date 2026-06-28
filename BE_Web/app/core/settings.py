from __future__ import annotations

import json
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
    database_url: str = "sqlite:///./be_web.db"
    be_ai_base_url: str = "http://localhost:8000"
    be_ai_timeout_seconds: float = 30.0
    api_debug: bool = False
    cors_origins_raw: str = Field(
        default='["http://localhost:3000"]',
        validation_alias="CORS_ORIGINS",
    )
    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7
    upload_dir: str = str(_ROOT / "uploads")
    max_avatar_size_bytes: int = 2 * 1024 * 1024
    max_lesson_upload_size_bytes: int = 10 * 1024 * 1024
    max_lesson_source_chars: int = 20_000
    min_lesson_source_chars: int = 20

    @property
    def cors_origins(self) -> list[str]:
        value = (self.cors_origins_raw or "").strip()
        if not value:
            return ["http://localhost:3000"]

        if value.startswith("["):
            try:
                parsed = json.loads(value)
            except json.JSONDecodeError:
                parsed = None
            if isinstance(parsed, list):
                origins = [str(item).strip() for item in parsed if str(item).strip()]
                if origins:
                    return origins

        origins = [
            part.strip().strip('"').strip("'")
            for part in value.split(",")
            if part.strip()
        ]
        return origins or ["http://localhost:3000"]


settings = Settings()
