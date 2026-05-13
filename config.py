import os
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # LLM API Keys
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")

    # Default provider
    DEFAULT_LLM_PROVIDER: str = os.getenv("DEFAULT_LLM_PROVIDER", "groq")

    # Models
    GROQ_MODEL: str = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "google/gemma-4-31b-it:free")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")

    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-to-a-random-secret")

    # Workspace
    WORKSPACE_DIR: Path = Path(os.getenv("WORKSPACE_DIR", "./workspaces"))
    DOCKER_ENABLED: bool = os.getenv("DOCKER_ENABLED", "false").lower() == "true"


settings = Settings()
