from fastapi.exceptions import RequestValidationError
import sentry_sdk
from fastapi import FastAPI, HTTPException
from starlette.middleware.cors import CORSMiddleware
from app.api import api_router
from app.core import (
    get_config,
    setup_logger,
    custom_generate_unique_id,
    lifespan,
    custom_openapi,
)
from app.middlewares.auth import AuthMiddleware
from app.middlewares.trace import TraceMiddleware
from app.middlewares.error import (
    custom_exception_handler,
    database_exception_handler,
    general_exception_handler,
    http_exception_handler,
    validation_exception_handler,
)
from sqlalchemy.exc import SQLAlchemyError
from app.schemas.exceptions import BaseCustomException


# Config and Logger
config = get_config()
setup_logger(config)

if config.SENTRY_DSN and config.ENVIRONMENT != "local":
    sentry_sdk.init(dsn=str(config.SENTRY_DSN), enable_tracing=True)

# Initilize app
app = FastAPI(
    title=config.PROJECT_NAME,
    openapi_url="/openapi.json",
    generate_unique_id_function=custom_generate_unique_id,
    lifespan=lifespan,
)

# Register exception handlers
app.add_exception_handler(BaseCustomException, custom_exception_handler)
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(SQLAlchemyError, database_exception_handler)
app.add_exception_handler(Exception, general_exception_handler)

# Middleware setup
if config.BACKEND_CORS_ORIGINS == ["*"]:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=config.all_cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
app.add_middleware(TraceMiddleware)
app.add_middleware(AuthMiddleware)

# Router
app.include_router(api_router)

# Swagger setup here
app.openapi = custom_openapi(app)
