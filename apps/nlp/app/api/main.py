from fastapi import APIRouter
from app.api.v1 import chats as chats_v1

api_router = APIRouter()
# api_router.include_router(chats.v1_router)
api_router.include_router(chats_v1.v1_router)


# if settings.ENVIRONMENT == "local":
#     api_router.include_router(private.router)
