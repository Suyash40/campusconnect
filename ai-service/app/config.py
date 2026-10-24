from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables. See .env.example."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Shared secret the core API sends as a Bearer token. Empty disables the check (local dev only).
    service_token: str = ""
    # Optional OpenAI-compatible chat endpoint. When unset the rule-based extractor is used.
    llm_base_url: str = ""
    llm_api_key: str = ""
    llm_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 20.0
    # Used to resolve dates that omit a year. Set per academic year.
    reference_year: int = 2026
    max_input_chars: int = 20000


@lru_cache
def get_settings() -> Settings:
    return Settings()
