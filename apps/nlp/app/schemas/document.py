import uuid
import datetime
from sqlalchemy import (
    Column, String, Boolean, Integer, Enum, DateTime, Text
)
from sqlalchemy.dialects.postgresql import UUID
from app.schemas import Base
from app.schemas.enum import DocumentTypeEnum, PriorityEnum, TrainingStatusEnum


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    document_type = Column(Enum(DocumentTypeEnum), default=DocumentTypeEnum.FILE)
    filename = Column(String(255))
    priority = Column(Enum(PriorityEnum), default=PriorityEnum.NONE)
    training_status = Column(Enum(TrainingStatusEnum), default=TrainingStatusEnum.UNTRAINED)
    is_deleted = Column(Boolean, default=False)

    file_path = Column(String, nullable=True)
    content_type = Column(String(100), nullable=True)
    size = Column(Integer, nullable=True)

    url = Column(String(2000), nullable=True)
    url_title = Column(String(255), nullable=True)
    url_description = Column(Text, nullable=True)

    organization_id = Column(UUID(as_uuid=True))
    uploader_id = Column(UUID(as_uuid=True))

    uploaded_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC))
    updated_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.UTC), onupdate=lambda: datetime.datetime.now(datetime.UTC))