from fastapi import APIRouter
from app.api.v1 import v1_router

# Include v1, maybe v2 in future
api_router = APIRouter()
api_router.include_router(v1_router)

# if settings.ENVIRONMENT == "local":
#     api_router.include_router(private.router)
