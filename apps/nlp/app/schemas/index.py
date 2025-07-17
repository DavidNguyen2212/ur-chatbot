from datetime import datetime
from typing import Any, Dict, List, Optional
from fastapi import UploadFile
from pydantic import BaseModel, field_serializer


class CreateIndexDto(BaseModel):
    message: str
    index_name: str
    index_url: str

class IndexTrainingResponse(BaseModel):
    documents_pending: int


class SaveIndexDto(BaseModel):
    old_index_name: str


class SaveNamespaceDto(BaseModel):
    current_namespace: str


class CreateNamespaceResponse(BaseModel):
    message: str
    namespace: str
    index_url: str


class DocumentCountSchema(BaseModel):
    total: int
    untrained: int
    pending: int
    trained: int


class ViewTrainingStatusResponse(BaseModel):
    is_training: bool
    training_started_at: Optional[datetime]
    training_completed_at: Optional[datetime]
    document_counts: DocumentCountSchema

    @field_serializer('training_started_at', 'training_completed_at')
    def serialize_datetime(self, value: datetime) -> str:
        return value.isoformat()


class Metadata(BaseModel):
    files: Dict[str, int]
    urls: List[Dict[str, Any]] = []


class IndexPreparation(BaseModel):
    pdf_files: List[UploadFile]
    docx_files: List[UploadFile]
    txt_files: List[UploadFile]
    pdf_prio: List[int]
    docx_prio: List[int]
    txt_prio: List[int]
    urls: List[Dict[str, Any]]
