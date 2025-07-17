from collections import defaultdict
from typing import Any, Dict, List, Tuple, Sequence
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete, func, or_, select, text, update
from app.entities import CoolDocument
import datetime
from app.enums.document import DocumentTypeEnum, PriorityEnum, TrainingStatusEnum
from app.repositories.base import BaseRepository


class DocumentRepository(BaseRepository):
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_all(self):
        result = await self.session.execute(select(CoolDocument))
        return result.scalars().all()

    async def get_by_id(self, doc_id):
        result = await self.session.execute(
            select(CoolDocument).where(CoolDocument.id == doc_id)
        )
        return result.scalar_one_or_none()

    async def add(self, document: CoolDocument):
        self.session.add(document)

    async def delete(self, document: CoolDocument):
        await self.session.delete(document)

    # Use revert_mode = true to restore one / many
    async def soft_delete_one(
        self, document_id: UUID, organization_id: UUID, revert_mode: bool = False
    ):
        stmt = (
            update(CoolDocument)
            .where(
                CoolDocument.id == document_id,
                CoolDocument.organization_id == organization_id,
            )
            .values(
                is_deleted=not revert_mode,
                updated_at=datetime.datetime.now(datetime.UTC),
            )
        )
        await self.session.execute(stmt)

    async def soft_delete_many(
        self, document_ids: List[UUID], organization_id: UUID, revert_mode: bool = False
    ):
        if not document_ids:
            return 0

        stmt = (
            update(CoolDocument)
            .where(
                CoolDocument.id.in_(document_ids),
                CoolDocument.organization_id == organization_id,
            )
            .values(
                is_deleted=not revert_mode,
                updated_at=datetime.datetime.now(datetime.UTC),
            )
        )

        result = await self.session.execute(stmt)
        return result.rowcount

    async def hard_delete(self, organization_id: UUID):
        stmt = delete(CoolDocument).where(
            CoolDocument.organization_id == organization_id,
            CoolDocument.is_deleted == True,
        )
        await self.session.execute(stmt)

    async def hard_delete_many(
        self, document_ids: List[UUID], organization_id: UUID
    ):
        if not document_ids:
            return 0

        stmt = (
            delete(CoolDocument)
            .where(
                CoolDocument.id.in_(document_ids),
                CoolDocument.organization_id == organization_id,
            )
        )

        result = await self.session.execute(stmt)
        return result.rowcount

    async def get_by_id_and_org(
        self, document_id: UUID, organization_id: UUID
    ) -> CoolDocument | None:
        result = await self.session.execute(
            select(CoolDocument).where(
                CoolDocument.id == document_id,
                CoolDocument.organization_id == organization_id,
            )
        )
        return result.scalar_one_or_none()

    async def get_many_by_ids_and_org_count(
        self, ids: List[UUID], org_id: UUID
    ) -> int:  
        count_stmt = (
            select(func.count())
            .select_from(CoolDocument)
            .where(
                CoolDocument.id.in_(ids), CoolDocument.organization_id == org_id
            )
        )
        count_result = await self.session.execute(count_stmt)
        count = count_result.scalar_one()
        return count

    async def get_many_by_ids_and_org(
        self, ids: List[UUID], org_id: UUID
    ) -> Tuple[List[CoolDocument], int]:
        stmt = select(CoolDocument).where(
            CoolDocument.id.in_(ids), CoolDocument.organization_id == org_id
        )
        result = await self.session.execute(stmt)
        docs = result.scalars().all()
        return docs, len(docs)

    async def update_priority(self, document_id: UUID, priority: str):
        stmt = (
            update(CoolDocument)
            .where(CoolDocument.id == document_id)
            .values(priority=priority, updated_at=datetime.datetime.now(datetime.UTC))
        )
        await self.session.execute(stmt)

    async def get_real_many_by_org(
        self, org_id: UUID
    ) -> Tuple[List[CoolDocument], int]:
        stmt = select(CoolDocument).where(
            CoolDocument.is_deleted == False, CoolDocument.organization_id == org_id
        )
        result = await self.session.execute(stmt)
        documents = result.scalars().all()

        count_stmt = (
            select(func.count())
            .select_from(CoolDocument)
            .where(
                CoolDocument.is_deleted == False, CoolDocument.organization_id == org_id,
            )
        )
        count_result = await self.session.execute(count_stmt)
        count = count_result.scalar_one()

        return documents, count
    
    async def get_real_many_by_ids_and_org(
        self, org_id: UUID, ids: List[UUID]
    ) -> Tuple[List[CoolDocument], int]:
        stmt = select(CoolDocument).where(
            CoolDocument.is_deleted == False, CoolDocument.organization_id == org_id,
                CoolDocument.id.in_(ids)
        )
        result = await self.session.execute(stmt)
        documents = result.scalars().all()

        count_stmt = (
            select(func.count())
            .select_from(CoolDocument)
            .where(
                CoolDocument.is_deleted == False, CoolDocument.organization_id == org_id
            )
        )
        count_result = await self.session.execute(count_stmt)
        count = count_result.scalar_one()

        return documents, count

    async def update_many_by_org(
        self, org_id: UUID, state: str = "PENDING"
    ) -> List[CoolDocument]:
        stmt = (
            update(CoolDocument)
            .where(
                CoolDocument.is_deleted == False, CoolDocument.organization_id == org_id
            )
            .values(
                training_status=state, updated_at=datetime.datetime.now(datetime.UTC)
            )
            .returning(CoolDocument)
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def count_by_state(self, org_id: UUID, state: str | None = None) -> int:
        conditions = [CoolDocument.organization_id == org_id]
        if state is not None:
            conditions.append(CoolDocument.training_status == state)

        count_stmt = select(func.count()).select_from(CoolDocument).where(*conditions)
        result = await self.session.execute(count_stmt)
        return result.scalar_one()

    # Ưu điểm
    # 🔥 1 query duy nhất
    # ✅ Hiệu suất cao hơn nhiều nếu DB lớn
    async def count_grouped_by_state(self, org_id: UUID) -> dict[str, int]:
        stmt = (
            select(CoolDocument.training_status, func.count())
            .where(
                CoolDocument.organization_id == org_id, CoolDocument.is_deleted == False
            )
            .group_by(CoolDocument.training_status)
        )

        result = await self.session.execute(stmt)
        rows = result.all()

        # COnvert to dict
        counts = defaultdict(int)
        for state, count in rows:
            counts[state] = count

        return dict(counts)

    async def get_train_many_by_org(self, org_id: UUID) -> Sequence[CoolDocument]:
        stmt = select(CoolDocument).where(
            CoolDocument.is_deleted == False,
            CoolDocument.organization_id == org_id,
            CoolDocument.training_status == "PENDING",
        )
        result = await self.session.execute(stmt)
        documents = result.scalars().all()
        return documents

    async def get_url_documents_to_refresh(self, org_id: UUID) -> List[CoolDocument]:
        stmt = select(CoolDocument).where(
            CoolDocument.organization_id == org_id,
            CoolDocument.document_type == DocumentTypeEnum.URL,
            CoolDocument.is_deleted == False,
            or_(
                CoolDocument.url_expires_at == None,
                CoolDocument.url_expires_at < datetime.datetime.now(datetime.UTC),
            ),
        )
        result = await self.session.execute(stmt)
        return result.scalars().all()

    async def update_url_doc_extension(self, document_id: UUID, organization_id: UUID, s3_key: str):
        stmt = (
            update(CoolDocument)
            .where(
                CoolDocument.id == document_id,
                CoolDocument.organization_id == organization_id,
            )
            .values(
                url_expires_at=func.now() + datetime.timedelta(days=7), 
                updated_at=func.now(), 
                s3_key=s3_key
            )
        )
        await self.session.execute(stmt)

    def build_filter_conditions(self, filters: Dict) -> List[Any]:
        conditions = []

        if filters.get("exclude_deleted"):
            conditions.append(CoolDocument.is_deleted == False)

        if filters.get("priority"):
            conditions.append(CoolDocument.priority == filters["priority"])

        if filters.get("document_type"):
            conditions.append(CoolDocument.document_type == filters["document_type"])

        if filters.get("training_status"):
            conditions.append(CoolDocument.training_status == filters["training_status"])

        if filters.get("is_deleted") is not None:
            conditions.append(CoolDocument.is_deleted == filters["is_deleted"])

        if filters.get("search"):
            keyword = f"%{filters['search']}%"
            conditions.append(
                or_(
                    CoolDocument.filename.ilike(keyword),
                    CoolDocument.url_title.ilike(keyword),
                )
            )

        return conditions
    
    async def count_untrained_and_deleted_docs(self, org_id: UUID) -> Tuple[int, int]:
        docs_untrained_num = (await self.session.execute(
            select(func.count())
            .select_from(CoolDocument).where(
                CoolDocument.organization_id == org_id,
                CoolDocument.training_status == TrainingStatusEnum.UNTRAINED,
            )
        )).scalar_one()

        docs_deleted_num = (await self.session.execute(
            select(func.count())
            .select_from(CoolDocument).where(
                CoolDocument.organization_id == org_id,
                CoolDocument.is_deleted == True,
            )
        )).scalar_one()

        return docs_untrained_num, docs_deleted_num
    
    async def list_and_count_by_custom_filter(self, conditions: List[Any], page: int, limit: int) -> Tuple[List[CoolDocument], int]:
        offset = (page - 1) * limit
        stmt = select(CoolDocument).where(*conditions)
        # count
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total = await self.session.scalar(count_stmt)

        # pagination
        stmt = stmt.offset(offset).limit(limit).order_by(CoolDocument.uploaded_at.desc())
        result = (await self.session.execute(stmt)).scalars().all()

        return result, total
    
    async def bulk_update_priority(self, org_id: UUID, priority_map: Dict[UUID, PriorityEnum]) -> int:
        if not priority_map:
            return 0

        values_clause = ", ".join([
            f"('{doc_id}'::uuid, '{priority.value}'::priorityenum)"  # <-- ép kiểu rõ ràng
            for doc_id, priority in priority_map.items()
        ])

        stmt = text(f"""
            UPDATE documents AS d SET
                priority = v.priority
            FROM (VALUES
                {values_clause}
            ) AS v(id, priority)
            WHERE d.id = v.id AND d.organization_id = :org_id
        """)

        result = await self.session.execute(stmt, {"org_id": str(org_id)})
        return result.rowcount
