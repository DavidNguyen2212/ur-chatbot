"""
DEPRECATED FEATURES.
WE DID NOT MAINTAIN IT ANYMORE.
"""
# from typing import Any
# from fastapi import APIRouter, Depends, HTTPException, Request, status, Path, Body
# from app.api.v1.dependencies import IndexPreparation, prepare_index
# from sqlalchemy.ext.asyncio import AsyncSession
# from app.core import get_logger, get_config, get_db, AppConfig
# from app.middlewares import require_admin
# from app.services.v1 import IndexService
# from app.dtos import CreateNamespaceDto, SaveNamespaceDto

# logger = get_logger()

# virtual_chatbot_router = APIRouter(
#     prefix="/virtual-chatbot", tags=["virtual-chatbot-tasks"]
# )


# @virtual_chatbot_router.post(
#     "/create/{org_id}",
#     response_model=CreateNamespaceDto,
#     summary="Create a virtual chatbot",
#     description="""
#         Compare chatbots (training virtual chatbot). It will modify the organization id 
#         (e.g. abcd -> abcd_0) and use the operation's result to create a virtual database name. The parameters are the same as /training-chatbot.
#     """,
#     responses={
#         400: {"description": "Invalid file format or metadata structure"},
#         401: {"description": "Unauthorized - Invalid/Missing API Key"},
#         413: {"description": "Request entity too large - File size limit exceeded"},
#         500: {"description": "Internal server error during index creation"},
#     },
# )
# @require_admin()
# async def create_virtual_chatbot(
#     req: Request,
#     org_id: str = Path(..., description="Organization ID"),
#     prep: IndexPreparation = Depends(prepare_index),
#     configService: AppConfig = Depends(get_config),
#     db: AsyncSession = Depends(get_db),
# ):
#     """
#     Create a virtual chatbot for comparison purposes.

#     **Parameters:**
#     - **org_id**: Organization ID
#     - **prep**: Index preparation data

#     **Returns:**
#     - CreateNamespaceDto with virtual index information
#     """
#     try:
#         result = await IndexService.createIndexesFromFilesAndUrls(
#             configService,
#             prep.urls,
#             prep.pdf_files,
#             prep.docx_files,
#             prep.txt_files,
#             prep.pdf_prio,
#             prep.docx_prio,
#             prep.txt_prio,
#             organization_id=org_id,
#             is_virtual=True,
#         )
#         result.message = "Virtual Index created!"
#         return result

#     except HTTPException as http_exc:
#         raise http_exc

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"An unexpected error occurred: {str(e)}",
#         )


# @virtual_chatbot_router.post(
#     "/save/{org_id}",
#     response_model=CreateNamespaceDto,
#     summary="Save the virtual chatbot",
#     responses={
#         401: {"description": "Unauthorized - Invalid/Missing API Key"},
#         500: {"description": "Internal server error during saving virtual chatbot"},
#     },
# )
# async def save_virtual_chatbot(
#     req: Request,
#     org_id: str = Path(..., description="Organization ID"),
#     user_data: SaveNamespaceDto = Body(
#         ..., description="Current namespace of Organization"
#     ),
#     configService: AppConfig = Depends(get_config),
#     db: AsyncSession = Depends(get_db),
# ) -> Any:
#     """
#     Save the virtual chatbot by removing the previous index.

#     **Parameters**:
#     - **org_id**: *str* - Organization ID (required).
#     - **user_data**: *SaveNamespaceDto* - Current namespace of Organization

#     **Returns**:
#     - The result of the operations (including new namespace for virtual bot!)

#     **Raises**:
#     - HTTPException: If an error occurs during saving
#     """
#     try:
#         result = IndexService.saveVirtualIndex(
#             configService,
#             old_namespace=user_data.current_namespace,
#             organization_id=org_id,
#         )
#         return result

#     except HTTPException as http_exc:
#         raise http_exc

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"An unexpected error occurred: {str(e)}",
#         )


# @virtual_chatbot_router.delete(
#     "/dispose/{org_id}",
#     response_model=CreateNamespaceDto,
#     summary="Delete the virtual chatbot",
#     responses={
#         401: {"description": "Unauthorized - Invalid/Missing API Key"},
#         500: {"description": "Internal server error during disposing virtual chatbot"},
#     },
# )
# async def dispose_virtual_chatbot(
#     req: Request,
#     org_id: str = Path(..., description="Organization ID"),
#     user_data: SaveNamespaceDto = Body(
#         ..., description="Current namespace of Organization"
#     ),
#     configService: AppConfig = Depends(get_config),
#     db: AsyncSession = Depends(get_db),
# ) -> Any:
#     """
#     Remove the virtual chatbot index.

#     **Parameters:**
#     - **org_id**: *str*
#         The unique organization ID provided as a path parameter (e.g., "org123").
#     - **user_data**: *SaveNamespaceDto*
#         The current namespace of the organization, provided in the request body.

#     **Returns:**
#     - **CreateNamespaceDto**: An object containing the result of the disposal operation.

#     **Raises:**
#     - **HTTPException**: If an error occurs during the disposal process.
#     """
#     try:
#         result = IndexService.disposeVirtualIndex(
#             configService,
#             old_namespace=user_data.current_namespace,
#             organization_id=org_id,
#         )
#         return result

#     except HTTPException as http_exc:
#         raise http_exc

#     except Exception as e:
#         raise HTTPException(
#             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
#             detail=f"An unexpected error occurred: {str(e)}",
#         )
