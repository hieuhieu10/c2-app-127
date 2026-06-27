"""Application settings, loaded from environment / .env."""

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

    # Supported values: auto, anthropic, openai, deepseek.
    llm_provider: str = "auto"

    anthropic_api_key: str = ""
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    deepseek_base_url: str = "https://api.deepseek.com"

    # If unset, app.agents.llm resolves a provider-specific default.
    default_model: str = ""

    # Max worker re-generation attempts when content fails schema validation.
    max_repairs: int = 2
    # Tokens budget for a single generation call.
    max_tokens: int = 4096
    # Log API request/response bodies for local debugging. Do not enable in prod.
    api_debug: bool = False

    # Retrieval provider: file, hybrid, or weaviate.
    # - file: scan local GDPT JSON objectives.
    # - hybrid: use Weaviate vector retrieval when available, fallback to file.
    # - weaviate: require Weaviate vector retrieval.
    retrieval_provider: str = "file"
    weaviate_url: str = "http://localhost:8080"
    weaviate_collection: str = "CurriculumObjective"
    embedding_model: str = "BAAI/bge-m3"
    embedding_device: str = ""
    embedding_batch_size: int = 16

    @property
    def provider(self) -> str:
        configured = self.llm_provider.strip().lower()
        if configured != "auto":
            return configured
        if self.deepseek_api_key:
            return "deepseek"
        if self.openai_api_key:
            return "openai"
        if self.anthropic_api_key:
            return "anthropic"
        return "anthropic"

    @property
    def has_api_key(self) -> bool:
        if self.provider == "anthropic":
            return bool(self.anthropic_api_key)
        if self.provider == "openai":
            return bool(self.openai_api_key)
        if self.provider == "deepseek":
            return bool(self.deepseek_api_key)
        return False


settings = Settings()
