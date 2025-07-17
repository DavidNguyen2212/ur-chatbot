from uuid import UUID
from fastapi import APIRouter, Body, Depends, Query, Request, Response, status, Path
from app.api.v1.dependencies import get_current_user
from app.core import get_logger
from app.schemas import CoolJwtPayload, success_response, SuccessResponse
from app.schemas.document import (
    DocumentBulkDeleteRequest,
    DocumentBulkDeleteResponse,
    DocumentListResponse,
    DownloadDocumentResponse,
    DocumentBulkUpdateResponse,
    DocumentBulkUpdateRequest,
    DocumentUpdateRequest,
    DocumentUpdateResponse,
    TrainingStatusResponse,
)
from app.services.v1 import DocumentService, get_document_service
from app.middlewares.role_verify import require_admin, require_agent

logger = get_logger()

document_router = APIRouter(prefix="", tags=["document-task"])

@document_router.get(
    "/",
    response_model=SuccessResponse[DocumentListResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_agent())],
)
async def list_documents(
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
    # Filter params
    search: str | None = Query(None),
    priority: str | None = Query(None),
    document_type: str | None = Query(None),
    training_status: str | None = Query(None),
    is_deleted: bool | None = Query(None),
    exclude_deleted: bool = Query(False),
    # Pagination
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
):
    # List here
    items, total = await documentService.list_documents(
            organization_id=current_user.organization.id,
            filters={
                "search": search,
                "priority": priority,
                "document_type": document_type,
                "training_status": training_status,
                "is_deleted": is_deleted,
                "exclude_deleted": exclude_deleted,
            },
            page=page,
            limit=limit,
        )
    return success_response(
        f"Got user's files successfully", 
        data=DocumentListResponse(
            items=items,
            total=total
        )
    )

@document_router.get(
    "/training-status",
    response_model=SuccessResponse[TrainingStatusResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_agent())],
)
async def get_training_status(
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
):
    # List here
    docs_untrained_num, docs_deleted_num = await documentService.get_training_status(organization_id=current_user.organization.id)
    return success_response(
        f"Got user's files successfully", 
        data=TrainingStatusResponse(
            has_untrained=docs_untrained_num,
            has_deleted=docs_deleted_num,
            can_train=bool(docs_untrained_num or docs_deleted_num)
        )
    )

@document_router.patch(
    "/bulk-update",
    response_model=SuccessResponse[DocumentBulkUpdateResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def bulk_update_documents(
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
    body: DocumentBulkUpdateRequest = Body(...),
):
    updated_counts = await documentService.bulk_modify_docs(organization_id=current_user.organization.id, update_data=body.updates)

    return success_response(
        "Documents are updated successfully",
        DocumentBulkUpdateResponse(
            updated_count=updated_counts,
        ),
    )

@document_router.patch(
    "/",
    response_model=SuccessResponse[DocumentUpdateResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def update_document(
    request: Request,
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
    body: DocumentUpdateRequest = Body(...),
):
    result = await documentService.update_document(
        organization_id=current_user.organization.id,
        update_data=body,
        request=request
    )

    return success_response(
        message="Update document successfully", 
        data=result
    )


@document_router.delete(
    "/{id}",
    response_model=None,
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def delete_document(
    id: UUID = Path(..., description="Document ID"),
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
):
    await documentService.delete_document(
        document_id=id,
        organization_id=current_user.organization.id,
    )

    return Response(status_code=status.HTTP_204_NO_CONTENT)

@document_router.post(
    "/bulk-delete",
    response_model=SuccessResponse[DocumentBulkDeleteResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def bulk_delete_document(
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
    body: DocumentBulkDeleteRequest = Body(...)
):
    hard_deleted_count, soft_deleted_count, not_found_count = await documentService.bulk_delete_documents(
        doc_ids=body.ids,
        organization_id=current_user.organization.id,
    )

    return success_response(
        message="Deleted documents",
        data=DocumentBulkDeleteResponse(
            hard_deleted_count=hard_deleted_count,
            soft_deleted_count=soft_deleted_count,
            not_found_count=not_found_count
        )
    )


@document_router.patch(
    "/{id}/restore",
    response_model=SuccessResponse[DocumentUpdateResponse],
    summary="Upload files to S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def restore_document(
    request: Request,
    id: UUID = Path(..., description="Document ID"),
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
):
    result = await documentService.restore_document(id, current_user.organization.id, request)

    return success_response(
        message="Restore document successfully",
        data=result,
    )


@document_router.get(
    "/{id}/download",
    response_model=SuccessResponse[DownloadDocumentResponse],
    summary="Download files from S3",
    responses={
        400: {"description": "Invalid file format or metadata structure"},
        401: {"description": "Unauthorized - Invalid/Missing API Key"},
        413: {"description": "Request entity too large - File size limit exceeded"},
        500: {"description": "Internal server error during index creation"},
    },
    dependencies=[Depends(require_admin())],
)
async def download_document(
    id: UUID = Path(..., description="Document ID"),
    current_user: CoolJwtPayload = Depends(get_current_user),
    documentService: DocumentService = Depends(get_document_service),
):
    url = await documentService.download_document(id, current_user.organization.id)
    return success_response(
        message="Get link download document successfully",
        data=DownloadDocumentResponse(download_url=url),
    )
