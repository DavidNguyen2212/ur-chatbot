from fastapi import APIRouter, Depends, HTTPException, Request, status
from app.api.v1.dependencies import get_current_user
from app.core import get_logger
from app.schemas import success_response, CoolJwtPayload, SuccessResponse
from app.schemas.index import (
    IndexTrainingResponse,
    ViewTrainingStatusResponse,
    DocumentCountSchema,
)
from app.services.v1 import IndexService, get_index_service
from app.middlewares.role_verify import require_admin

logger = get_logger()

indexing_router = APIRouter(prefix="/indexing", tags=["indexing-task"])

@indexing_router.post(
    "/train",
    response_model=SuccessResponse[IndexTrainingResponse],
    summary="Create a vector database to train the chatbot",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def create_knowledge_database(
    req: Request,
    current_user: CoolJwtPayload = Depends(get_current_user),
    indexService: IndexService = Depends(get_index_service),
):
    try:
        count = await indexService.start_training_for_org(current_user.organization.id)

        return success_response(
            message="Quá trình đào tạo đã bắt đầu thành công",
            data=IndexTrainingResponse(documents_pending=count),
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )


@indexing_router.get(
    "/training-status",
    response_model=None,
    summary="Create a vector database to train the chatbot",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def view_training_status(
    req: Request,
    current_user: CoolJwtPayload = Depends(get_current_user),
    indexService: IndexService = Depends(get_index_service),
):
    training_status, total_docs, untrained_docs, pending_docs, trained_docs = (
        await indexService.get_training_status(current_user.organization.id)
    )

    return success_response(
        message="Get training status sucessfully",
        data=ViewTrainingStatusResponse(
            is_training=training_status.is_training,
            training_started_at=training_status.training_started_at,
            training_completed_at=training_status.training_completed_at,
            document_counts=DocumentCountSchema(
                total=total_docs,
                untrained=untrained_docs,
                pending=pending_docs,
                trained=trained_docs,
            ),
        ),
    )
