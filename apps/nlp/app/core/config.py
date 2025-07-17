import secrets
import sys
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
    format: str = (
        "<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>"
    )
    log_file: str = "logs/app.log"
    rotation: str = "1 day"
    retention: str = "7 days"
    compression: str = "zip"
    serialize: bool = False


class KafkaConfig(BaseSettings):
    broker: str = "localhost:9092"
    client_id: str = "nlp-service"


class AppConfig(BaseSettings):
    model_config = SettingsConfigDict(env_ignore_empty=True, extra="ignore")

    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = secrets.token_urlsafe(32)
    JWT_SECRET: str = secrets.token_urlsafe(32)
    INDEX_NAME: str = "default-index"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 8
    FRONTEND_HOST: str = "http://localhost:5173"
    ENVIRONMENT: Literal["local", "staging", "production"] = "local"

    BACKEND_CORS_ORIGINS: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = (
        []
    )

    @computed_field
    @property
    def all_cors_origins(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGINS] + [
            self.FRONTEND_HOST
        ]

    PROJECT_NAME: str = "NLP Service"
    SENTRY_DSN: HttpUrl | None = None

    DATABASE_URL: str

    OPENAI_API_KEY: str
    PINECONE_API_KEY: str
    AI_SERVICE_API_KEY: str
    FIRECRAWL_API_KEY: str
    GOOGLE_AI_API_KEY: str

    AWS_ACCESS_KEY_ID: str
    AWS_SECRET_ACCESS_KEY: str
    AWS_REGION: str
    SES_FROM_ADDRESS: str
    SES_EXAMPLE_USER: str
    S3_BUCKET: str
    UPLOAD_BASE_PATH: str

    USER_SERVICE_HOST: str
    USER_SERVICE_PORT: str

    # --- Kafka
    kafka: KafkaConfig = KafkaConfig()
    logger: LoggerConfig = LoggerConfig()


def LoadConfig(yaml_path: str = "app/configs/local.yaml") -> AppConfig:
    try:
        with open(yaml_path, "r") as f:
            yaml_data = yaml.safe_load(f)
    except FileNotFoundError:
        print(f"YAML file not found: {yaml_path}, using empty config")
        sys.exit(1)
    except Exception as e:
        print(f"Error reading YAML file: {e}")
        sys.exit(1)

    try:
        # Override YAML with environment variables
        config = AppConfig(**yaml_data)
        return config
    except Exception as e:
        print(f"Error creating AppConfig: {e}")
        sys.exit(1)


@lru_cache()
def get_config() -> AppConfig:
    return LoadConfig()
