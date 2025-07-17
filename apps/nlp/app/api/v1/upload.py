from typing import List
from fastapi import (
    APIRouter,
    Body,
    Depends,
    File,
    UploadFile,
)
from app.api.v1.dependencies import get_current_user
from app.core import get_logger
from app.middlewares.role_verify import require_admin
from app.schemas import success_response, SuccessResponse, CoolJwtPayload
from app.schemas.document import (
    FilesUrlResponse,
    TextUploadRequest,
    TextUploadResponse,
    URLUploadRequest,
    URLUploadResponse,
)
from app.services.v1 import DocumentService, get_document_service

logger = get_logger()

upload_router = APIRouter(prefix="/upload", tags=["upload-tasks"])

@upload_router.post(
    "/upload-url",
    response_model=SuccessResponse[FilesUrlResponse],
    summary="Get presigned URLs for doc-file upload",
    responses={
        200: {"description": "Presigned URLs generated successfully."},
        400: {"description": "Invalid file format or metadata structure."},
        401: {"description": "Unauthorized - Invalid/Missing API Key."},
        413: {"description": "Request entity too large - File size limit or number of files exceeded."},
        500: {"description": "Internal server error."},
    },
    description="""
    Generate S3 presigned URLs to allow frontend clients to upload files directly to S3.

    Permissions: Admin required.

    Returns: A list of presigned URLs corresponding to each input file.
    """,
    dependencies=[Depends(require_admin())],
)
async def get_upload_files_presigned_urls(
    current_user: CoolJwtPayload = Depends(get_current_user),
    files: List[UploadFile] = File(...),
    documentService: DocumentService = Depends(get_document_service),
):
    # Save to db
    presigned_list = await documentService.upload_files(files=files, org_id=current_user.organization.id, user_id=current_user.userId)

    return success_response(
        f"{len(files)} files got their presigned url successfully", 
        data=FilesUrlResponse(
            files=presigned_list
        )
    )


@upload_router.post(
    "/text/",
    response_model=SuccessResponse[TextUploadResponse],
    summary="Upload raw text content as a document",
    responses={
        200: {"description": "Text uploaded successfully."},
        400: {"description": "Invalid text format or metadata structure."},
        401: {"description": "Unauthorized - Invalid/Missing API Key."},
        500: {"description": "Internal server error."},
    },
    description="""
    Upload plain text content which will be stored and indexed like an uploaded document.

    Permissions: Admin required.

    Body schema:
    - text_content: The actual text string to be saved.

    Returns: The created document ID and filename.
    """,
    dependencies=[Depends(require_admin())],
)
async def upload_text(
    current_user: CoolJwtPayload = Depends(get_current_user),
    body: TextUploadRequest = Body(...),
    documentService: DocumentService = Depends(get_document_service),
):
    created_doc = await documentService.upload_text(text_content=body.text_content, org_id=current_user.organization.id, user_id=current_user.userId)

    return success_response(
        "Txt file has been uploaded successfully",
        TextUploadResponse(
            document_id=str(created_doc.id),
            filename=created_doc.filename
        ),
    )


@upload_router.post(
    "/url/",
    response_model=SuccessResponse[URLUploadResponse],
    summary="Submit a URL to be crawled and stored",
    responses={
        200: {"description": "URL content fetched and stored successfully."},
        400: {"description": "Invalid file format or metadata structure."},
        401: {"description": "Unauthorized - Invalid/Missing API Key."},
        500: {"description": "Internal server error."},
    },
    description="""
    Submit a URL which will be crawled by the system. The extracted content will be saved as a document and indexed.

    Permissions: Admin required.

    Body schema:
    - url: The website URL to crawl.
    - title: Custom title to assign to the document.
    - description: Custom description to assign to the document.

    Returns: The created document ID.
    """,
    dependencies=[Depends(require_admin())],
)
async def upload_url_document(
    current_user: CoolJwtPayload = Depends(get_current_user),
    body: URLUploadRequest = Body(...),
    documentService: DocumentService = Depends(get_document_service),
):
    doc = await documentService.upload_url_document(
        org_id=current_user.organization.id,
        user_id=current_user.userId,
        data=body
    )

    return success_response(
        "URL source added successfully",
        URLUploadResponse(
            document_id=str(doc.id)
        ),
    )
