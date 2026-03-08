from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    # App
    app_name: str = "Quill"
    secret_key: str = "dev-secret-change-in-production"
    debug: bool = True

    # Database
    database_url: str = "postgresql+psycopg://quill:quill_dev@localhost:5433/quill"

    # Frontend URL — used for post-OAuth redirects back to the UI
    # Dev: http://127.0.0.1:5174  |  Prod: https://yourdomain.com
    frontend_url: str = "http://127.0.0.1:5174"

    # Clio OAuth
    clio_client_id: str = ""
    clio_client_secret: str = ""
    clio_redirect_uri: str = "http://127.0.0.1:8001/api/auth/clio/callback"
    clio_auth_url: str = "https://app.clio.com/oauth/authorize"
    clio_token_url: str = "https://app.clio.com/oauth/token"
    clio_api_base: str = "https://app.clio.com/api/v4"

    # AI
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://host.docker.internal:11434"
    ollama_model: str = "llama3.2"

    # Paths
    templates_dir: str = os.path.join(os.path.dirname(__file__), "templates_docx")
    output_dir: str = "/data/output"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache
def get_settings() -> Settings:
    return Settings()
