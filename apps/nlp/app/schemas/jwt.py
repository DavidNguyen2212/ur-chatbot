from pydantic import BaseModel
from uuid import UUID


class OrganizationPayload(BaseModel):
    id: UUID
    name: str
    role: str


class CoolJwtPayload(BaseModel):
    userId: UUID
    email: str
    organization: OrganizationPayload
    iat: int
    exp: int
