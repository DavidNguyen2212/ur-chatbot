from functools import lru_cache
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import get_config

@lru_cache()
def get_engine():
    config = get_config()
    return create_async_engine(
        config.DATABASE_URL,
        echo=False,
        future=True,
        pool_pre_ping=True,
    )

@lru_cache()
def get_session_maker():
    return async_sessionmaker(
        bind=get_engine(),
        class_=AsyncSession,
        expire_on_commit=False,
    )

async def get_db():
    SessionLocal = get_session_maker()
    async with SessionLocal() as session:
        yield session