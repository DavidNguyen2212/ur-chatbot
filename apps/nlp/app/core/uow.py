from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories import DocumentRepository, TrainingStatusRepository


class UnitOfWork:
    def __init__(self, session: AsyncSession):
        self.session = session
        self._documents = DocumentRepository(session) 
        self._training_statuses = TrainingStatusRepository(session)

    @property
    def documents(self) -> DocumentRepository:
        return self._documents 

    @property
    def training_statuses(self) -> TrainingStatusRepository:
        return self._training_statuses

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if exc_type:
            await self.session.rollback()
        else:
            await self.session.commit()
        await self.session.close()
