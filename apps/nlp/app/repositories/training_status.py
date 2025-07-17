import datetime
from uuid import uuid4
from sqlalchemy import select
from app.entities import OrganizationTrainingStatus
from app.repositories.base import BaseRepository
from sqlalchemy.ext.asyncio import AsyncSession


class TrainingStatusRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    def add(self, status: OrganizationTrainingStatus):
        self.session.add(status)

    async def delete(self, status: OrganizationTrainingStatus):
        await self.session.delete(status)

    async def get_by_org_id(self, org_id):
        result = await self.session.execute(
            select(OrganizationTrainingStatus).where(
                OrganizationTrainingStatus.organization_id == org_id
            )
        )
        return result.scalar_one_or_none()

    async def get_or_create_by_org_id(self, org_id):
        # Get
        status = await self.get_by_org_id(org_id)
        if status:
            return status

        # Or Create
        status = OrganizationTrainingStatus(
            id=uuid4(),
            organization_id=org_id,
            is_training=False,
            training_started_at=None,
            training_completed_at=None,
        )

        self.add(status)
        await self.session.flush()
        return status

    async def start_training(self, org_id):
        status = await self.get_or_create_by_org_id(org_id)
        status.is_training = True
        status.training_started_at = datetime.datetime.now(datetime.UTC)
        status.training_completed_at = None
        await self.session.flush()
        return status

    async def complete_training(self, org_id):
        status = await self.get_by_org_id(org_id)
        if not status:
            raise ValueError(f"No training status found for org_id: {org_id}")
        status.is_training = False
        status.training_completed_at = datetime.datetime.now(datetime.UTC)
        await self.session.flush()
        return status

    async def reset_training(self, org_id):
        status = await self.get_by_org_id(org_id)
        if not status:
            raise ValueError(f"No training status found for org_id: {org_id}")
        status.is_training = False
        status.training_started_at = None
        status.training_completed_at = None
        await self.session.flush()
        return status
