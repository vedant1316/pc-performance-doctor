"""Configuration settings for PC Performance Doctor agent."""

from __future__ import annotations

import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment and .env file."""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parent / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- LLM / AI layer ---
    LLM_BASE_URL: str = "https://api.openai.com/v1"
    LLM_API_KEY: str = ""
    LLM_MODEL: str = "gpt-4o-mini"
    LLM_TIMEOUT_SECONDS: int = 15

    # --- Agent behavior ---
    POLLING_INTERVAL_MS: int = 1000
    WEBSOCKET_PORT: int = 8765
    WEBSOCKET_HOST: str = "127.0.0.1"

    # --- Storage ---
    SQLITE_PATH: str = "./data/performance.db"
    SNAPSHOT_RETENTION_DAYS: int = 14

    # --- Diagnostics ---
    RULES_PATH: str = "./diagnostics/rules.yaml"


settings = Settings()
