from typing import Optional
from uuid import UUID
from pydantic import UUID4, BaseModel, EmailStr


class EmailSendEvent(BaseModel):
    to: EmailStr
    subject: str
    html: Optional[str] = None
    text: Optional[str] = None


class DocsTrainEvent(BaseModel):
    org_id: UUID


class UrlCrawlEvent(BaseModel):
    org_id: UUID4
    doc_id: UUID4
    url: str
