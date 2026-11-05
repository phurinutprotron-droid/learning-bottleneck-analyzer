from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='../.env', extra='ignore', hide_input_in_errors=True)
    database_url: str = 'sqlite:///./lba.db'
    environment: str = 'development'
    cors_origins: list[str] = ['http://localhost:5173', 'http://127.0.0.1:5173']
    ai_provider: str = 'deterministic'
    gemini_api_key: str = ''
    gemini_model: str = ''
    openrouter_api_key: str = ''
    openrouter_model: str = ''
    openrouter_task_models: dict[str, str] = {}
    session_hours: int = 8
    consent_version: str = 'pilot-v1'
    rate_limit_per_minute: int = 120
    password_hash_backend: Literal['scrypt', 'postgres_bcrypt'] = 'scrypt'
    password_pepper: str = ''

    @model_validator(mode='after')
    def validate_password_backend(self):
        if self.password_hash_backend == 'postgres_bcrypt':
            if not self.database_url.startswith('postgresql+') or len(self.password_pepper) < 32:
                raise ValueError('Database password hashing requires PostgreSQL and a private pepper of at least 32 characters')
        return self

    @model_validator(mode='before')
    @classmethod
    def normalize_database_url(cls, values):
        values = dict(values)
        url = values.get('database_url', '')
        for prefix in ('postgres://', 'postgresql://'):
            if url.startswith(prefix):
                values['database_url'] = 'postgresql+psycopg://' + url[len(prefix):]
                break
        return values

    @model_validator(mode='after')
    def validate_production(self):
        if self.environment.casefold() != 'production':
            return self
        if not self.database_url.startswith('postgresql+psycopg://'):
            raise ValueError('Production requires a PostgreSQL psycopg database URL')
        for origin in self.cors_origins:
            url = urlsplit(origin)
            if (url.scheme != 'https' or not url.hostname or url.username or url.password
                    or '*' in origin or origin != f'https://{url.netloc}'):
                raise ValueError('Production CORS requires exact HTTPS origins')
            _ = url.port
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()

