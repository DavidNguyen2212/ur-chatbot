from datetime import datetime
from uuid import UUID
from fastapi import Request
from typing import List, Optional
from pydantic import UUID4, BaseModel, HttpUrl, Field, field_serializer
from app.enums.document import DocumentTypeEnum, PriorityEnum

"""
Do not included special type: HttpUrl, UUID in ..Response type.
We simplify these models by `str` for pydantic to json-serialize easily and avoid validation errors.
Just specify them in ...Request type.
"""

class PresignedUrlFile(BaseModel):
    filename: str | None
    key: str
    url: str


class FilesUrlResponse(BaseModel):
    files: List[PresignedUrlFile] = Field(default_factory=list)


class FileUploadResponse(BaseModel):
    message: str


class TextUploadRequest(BaseModel):
    text_content: str = Field(..., max_length=100_000)


class TextUploadResponse(BaseModel):
    document_id: str
    filename: str


class URLUploadRequest(BaseModel):
    url: HttpUrl = Field(..., max_length=2000, description="URL path")
    title: str = Field(..., max_length=255, description="URL title")
    description: str | None = Field(None, max_length=1000, description="URL short description")


class URLUploadResponse(BaseModel):
    document_id: str


class DocumentResponse(BaseModel):
    id: str
    filename: str
    document_type: str
    content_type: str | None
    size: int | None
    file_size_display: str | None
    priority: str
    training_status: str
    uploader_name: str | None
    uploaded_at: datetime
    updated_at: datetime
    download_url: str | None
    url: str | None
    url_title: str | None
    url_description: str | None
    is_deleted: bool

    # For datetime serialization
    @field_serializer('uploaded_at', 'updated_at')
    def serialize_datetime(self, value: datetime) -> str:
        return value.isoformat()

class DocumentListResponse(BaseModel):
    items: list[DocumentResponse]
    total: int

class TrainingStatusResponse(BaseModel):
    has_untrained: int
    has_deleted: int
    can_train: bool


class DocumentUpdateItem(BaseModel):
    id: UUID4
    priority: PriorityEnum


class DocumentBulkUpdateRequest(BaseModel):
    updates: List[DocumentUpdateItem] = Field(
        ...,
        min_items=1,
        description="List of documents to be updated",
    )

class DocumentBulkUpdateResponse(BaseModel):
    updated_count: int

class DocumentUpdateRequest(BaseModel):
    id: UUID 
    priority: Optional[PriorityEnum] = Field(None)
    url_title: Optional[str] = None
    url_description: Optional[str] = None
    is_deleted: Optional[bool] = None


class DocumentUpdateResponse(BaseModel):
    id: str
    filename: str
    priority: str
    training_status: str
    uploaded_at: datetime
    updated_at: datetime
    download_url: Optional[str] = None
    url: Optional[str] = None
    url_title: Optional[str] = None
    url_description: Optional[str] = None
    is_deleted: bool

    class Config:
        from_attributes = True

    @field_serializer('uploaded_at', 'updated_at')
    def serialize_datetime(self, value: datetime) -> str:
        return value.isoformat()

    @staticmethod
    def from_attributes(obj, request: Request) -> "DocumentUpdateResponse":
        download_url = None
        if obj.document_type == DocumentTypeEnum.URL:
            download_url = obj.url
        elif request and obj.document_type in [DocumentTypeEnum.TEXT, DocumentTypeEnum.FILE]:
            download_url = str(request.url_for("download_document", id=str(obj.id)))

        return DocumentUpdateResponse(
            **{f: getattr(obj, f) for f in DocumentUpdateResponse.model_fields if f not in ["download_url", "id"]},
            download_url=download_url,
            id=str(obj.id)
        )

class DownloadDocumentResponse(BaseModel):
    download_url: str 

class DocumentBulkDeleteRequest(BaseModel):
    ids: List[UUID] = Field(
        ...,
        min_items=1,
        description="List of documents to be deleted",
    )

class DocumentBulkDeleteResponse(BaseModel):
    hard_deleted_count: int
    soft_deleted_count: int 
    not_found_count: int
