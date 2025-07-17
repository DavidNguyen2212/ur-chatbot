from fastapi import APIRouter
from app.api.v1.upload import upload_router
from app.api.v1.document import document_router
from app.api.v1.index import indexing_router


# Main router for v1
v1_router = APIRouter(prefix="/document")

# Include sub-routers
v1_router.include_router(upload_router)
v1_router.include_router(document_router)
v1_router.include_router(indexing_router)

# Các route chat có thể được thêm ở đây trong tương lai
# @v1_router.put("/new-chat", response_model=Any)
# async def create_new_chat() -> Any:
#     """
#     Create new chat. Use its _id returned field to operate in other routes.
#     """
#     pass

# @v1_router.get("/{id}", response_model=Any)
# async def read_items(id: str = Path(..., description="Chat ID")) -> Any:
#     """
#     Get all info of a specific conversation.
#     """
#     pass

# @v1_router.post("/{id}", response_model=Any)
# async def create_reply_message(
#     id: str = Path(..., description="Chat ID"),
#     user_data: ChatUserDto = Body(..., description="User's Input Query and Chat history")
# ) -> Any:
#     """
#     Get Reply message from the LLM.
#     """
#     pass
