import secrets  # Bổ sung import thư viện secrets
from typing import Annotated, Any, Literal
from pydantic import AnyUrl, BeforeValidator, HttpUrl, computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict
from dotenv import load_dotenv
import yaml
from functools import lru_cache

load_dotenv(".env")

def parse_cors(v: Any) -> list[str] | str:
    if v == "*":
        return ["*"]
    elif isinstance(v, str) and not v.startswith("["):
        return [i.strip() for i in v.split(",")]
    elif isinstance(v, list | str):
        return v
    raise ValueError(v)

class LoggerConfig(BaseSettings):
    level: str = "INFO"
    format: str = "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    log_file: str = "logs/app.log"
    rotation: str = "1 day"
    retention: str = "7 days"
    compression: str = "zip"
    serialize: bool = False

class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_ignore_empty=True, extra="ignore")

    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET: str = secrets.token_urlsafe(32)
    INDEX_NAME: str = "default-index"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = []

    @computed_field
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [self.FRONTEND_HOST]

    PROJECT_NAME: str = "FastAPI Chatbots"
    SENTRY_DSN: HttpUrl | None = None

    MONGO_URI: str
    MONGO_DATABASE: str
    DATABASE_URL: str

    OPENAI_API_KEY: str
    PINECONE_API_KEY: str
    AI_SERVICE_API_KEY: str
    FIRECRAWL_API_KEY: str
    GOOGLE_AI_API_KEY: str

    logger: LoggerConfig = LoggerConfig()


def LoadConfig(yaml_path: str = "app/configs/local.yaml") -> AppConfig:
    print(f"Loading config from: {yaml_path}")
    
    try:
        with open(yaml_path, "r") as f:
            yaml_data = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"YAML file not found: {yaml_path}, using empty config")
        yaml_data = {}
    except Exception as e:
        print(f"Error reading YAML file: {e}")
        yaml_data = {}

    try:
        # Override YAML with environment variables
        config = AppConfig(**yaml_data)
        print(f"Config created successfully")
        return config
    except Exception as e:
        print(f"Error creating AppConfig: {e}")
        raise

@lru_cache()
def get_config() -> AppConfig:
    return LoadConfig()