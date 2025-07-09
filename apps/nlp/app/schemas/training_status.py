import uuid
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import Boolean, Column, DateTime
from app.schemas import Base


class OrganizationTrainingStatus(Base):
    __tablename__ = "organization_training_status"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    organization_id = Column(UUID(as_uuid=True), unique=True)
    is_training = Column(Boolean, default=False)
    training_started_at = Column(DateTime, nullable=True)
    training_completed_at = Column(DateTime, nullable=True)
