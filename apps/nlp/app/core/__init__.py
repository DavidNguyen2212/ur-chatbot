"""
All main configuration here.
"""

from .uow import UnitOfWork
from .config import AppConfig, get_config
from .db import get_db, get_engine
from .logger import setup_logger, get_logger
from .lifespan import lifespan
from .unique import custom_generate_unique_id
from .swagger import custom_openapi
from .concurrency import URL_PROCESSING_SEMAPHORE

__all__ = [
    "UnitOfWork",
    "AppConfig",
    "get_config",
    "get_db",
    "get_logger",
    "setup_logger",
    "get_engine",
    "lifespan",
    "custom_generate_unique_id",
    "custom_openapi",
    "URL_PROCESSING_SEMAPHORE"
]
# package version
__version__ = "1.0.0"
# Constants
