import os
from typing import List, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )

    PROJECT_NAME: str = "CipherFlow Cloud Sync API"
    API_V1_STR: str = "/api/v1"
    ENVIRONMENT: str = "development"
    SECRET_KEY: str = "development_only_secret_key_change_in_production_32bytes!"

    # Database Configuration:
    # SQLite is used for development / test only (zero-config local run).
    # PostgreSQL (e.g. postgresql://user:password@localhost:5432/cipherflow) is the production target.
    DATABASE_URL: str = "sqlite:///./cipherflow_dev.db"

    # CORS
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ]

    # Limits
    MAX_PAYLOAD_BYTES: int = 10485760  # 10 MB

settings = Settings()
