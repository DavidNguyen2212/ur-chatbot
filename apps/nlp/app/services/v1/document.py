import datetime
from io import BytesIO
from typing import Any, Dict, List, Tuple
from uuid import UUID, uuid4
import aiohttp
from fastapi import Depends, HTTPException, Request, UploadFile, status
from sqlalchemy import func
from app.enums.document import DocumentAllowedTypes, DocumentTypeEnum, PriorityEnum, TrainingStatusEnum
from app.core import UnitOfWork, AppConfig, get_config, get_db, get_logger
from app.generated.user_service_p2p import UserName
from app.infra.kafka import KafkaManager, get_kafka
from app.consumers.registry import CONSUMER_REGISTRY
from app.consumers.settings import ConsumerName
from app.infra.s3 import upload_fileobj, generate_presigned_url, generate_download_url
from app.schemas.document import (
    DocumentUpdateItem,
    DocumentUpdateResponse,
    PresignedUrlFile,
    URLUploadRequest,
    DocumentResponse,
    DocumentUpdateRequest,
    DocumentUpdateResponse,
)
from app.entities.document import CoolDocument
from app.schemas.event import UrlCrawlEvent
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.concurrency import run_in_threadpool
from app.services.v1.user_service_client import UserServiceManager, get_users_names
from app.utils.file_processing import human_readable_size

logger = get_logger()

class DocumentService:
    def __init__(self, db: AsyncSession, config: AppConfig, kafka_manager: KafkaManager):
        self.db = db
        self.config = config
        self.kafka_manager = kafka_manager

    async def upload_files(self,
        files: List[UploadFile],
        org_id: UUID,
        user_id: UUID
    ) -> List[PresignedUrlFile]:
        if len(files) > 5:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="Maximum 5 files at once.",
            )

        allowed_extensions = list(DocumentAllowedTypes)
        created_docs: List[PresignedUrlFile] = []

        async with UnitOfWork(self.db) as uow:
            for file in files:
                ext = file.filename.split(".")[-1].lower()

                if ext not in allowed_extensions:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"File '{file.filename}' has invalid format.",
                    )

                content = await file.read()
                if len(content) > 20 * 1024 * 1024:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail=f"File '{file.filename}' exceeded max file size 20MB.",
                    )

                filename = f"{uuid4()}.{ext}"
                s3_key = f"{self.config.UPLOAD_BASE_PATH}/{org_id}/docs/{filename}"

                # Gen presigned URL
                url = await run_in_threadpool( 
                    generate_presigned_url,
                    {
                        "Bucket": self.config.S3_BUCKET,
                        "Key": s3_key,
                        "ContentType": file.content_type or "application/octet-stream",
                    },
                    "put_object",
                )

                # save records
                doc = CoolDocument(
                    document_type=DocumentTypeEnum.FILE,
                    filename=file.filename,
                    content_type=file.content_type or "application/octet-stream",
                    size=len(content),
                    priority=PriorityEnum.MEDIUM,
                    organization_id=org_id,
                    uploader_id=user_id,
                    s3_key=s3_key,
                )

                await uow.documents.add(doc)
                created_docs.append(
                    PresignedUrlFile(filename=filename, key=s3_key, url=url)
                )

        return created_docs


    async def upload_text(self,
        text_content: str,
        org_id: UUID,
        user_id: UUID
    ) -> CoolDocument:
        if not text_content.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Text body cannot be null.",
            )

        filename = f"text_{uuid4().hex[:8]}.txt"
        encoded = text_content.encode("utf-8-sig")
        size = len(encoded)

        # gen s3 key
        # today_postfix = datetime.today().strftime("%Y/%m/%d") # hệ thống nhỏ chưa cần phân hoạch theo ngày
        s3_key = (
            f"{self.config.UPLOAD_BASE_PATH}/{org_id}/txts/{filename}"
        )

        try:
            f = BytesIO(encoded)
            upload_fileobj(
                f,
                self.config.S3_BUCKET,
                s3_key,
                {"ContentType": "text/plain; charset=utf-8"},
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Error during S3 upload: {e}")

        # save record
        async with UnitOfWork(self.db) as uow:
            document = CoolDocument(
                document_type=DocumentTypeEnum.TEXT,
                filename=filename,
                content_type="text/plain; charset=utf-8",
                size=size,
                priority=PriorityEnum.MEDIUM,
                organization_id=org_id,
                uploader_id=user_id,
                s3_key=s3_key,
            )
            await uow.documents.add(document)

        return document


    async def upload_url_document(self,
        org_id: UUID,
        user_id: UUID,
        data: URLUploadRequest,
    ) -> CoolDocument:
        # Validate URL accessible
        try:
            url_str = str(data.url)
            headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
            async with aiohttp.ClientSession() as session:
                async with session.get(url_str, headers=headers, timeout=10) as response:
                    if response.status >= 400: 
                        raise HTTPException(
                            status_code=status.HTTP_400_BAD_REQUEST,
                            detail="Cannot access URL or URL is invalid.",
                        )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot access URL or network error. {str(e)}",
            )

        # Create Document object
        async with UnitOfWork(self.db) as uow:
            doc = CoolDocument(
                document_type=DocumentTypeEnum.URL,
                content_type="text/plain; charset=utf-8",
                filename=f"url_{uuid4().hex[:8]}.txt",
                url=url_str,
                url_title=data.title,
                url_description=data.description or "", 
                priority=PriorityEnum.MEDIUM,
                organization_id=org_id,
                uploader_id=user_id,
                s3_key=None,
                url_expires_at=None,
            )
            await uow.documents.add(doc)

        kafkaTopic = CONSUMER_REGISTRY[ConsumerName.URL_CRAWLER].topics[0]
        await self.kafka_manager.send_message(kafkaTopic, 
            UrlCrawlEvent(
                org_id=org_id,
                doc_id=doc.id,
                url=url_str
            ).model_dump()
        )
        logger.info("[KAFKA_PRODUCER]: Url crawler dispatched")

        return doc


    async def list_documents(self,
        organization_id: UUID,
        filters: Dict,
        page: int,
        limit: int,
    ) -> Tuple[List[DocumentResponse], int]:
        async with UnitOfWork(self.db) as uow:
            conditions = [CoolDocument.organization_id == organization_id] + uow.documents.build_filter_conditions(filters)
            
            result, total = await uow.documents.list_and_count_by_custom_filter(conditions, page, limit)
            items = await self._build_document_responses_batch(result)

        return items, total

    async def _build_document_responses_batch(self, documents: List[CoolDocument]) -> List[DocumentResponse]:
        # Extract unique uploader IDs
        uploader_ids = list(set(str(doc.uploader_id) for doc in documents if doc.uploader_id))
        
        # Batch fetch uploader names
        uploader_names: Dict[str, UserName | str] = {str(uid): str(uid) for uid in uploader_ids or []}
        try:
            # Gọi gRPC lấy tên người upload
            fetched_names = await get_users_names(uploader_ids)
            # Gộp với fallback: nếu không có tên thì vẫn dùng uploader_id
            uploader_names.update(fetched_names)
        except Exception as e:
            logger.error(f"Failed to fetch uploader names: {e}")
        items: List[DocumentResponse] = []
        for doc in documents:
            uploader_name = uploader_names.get(str(doc.uploader_id)).name or str(doc.uploader_id)
            
            size = doc.size or 0
            file_size_display = human_readable_size(size)
            
            items.append(
                DocumentResponse(
                    id=str(doc.id),
                    filename=doc.filename,
                    document_type=doc.document_type,
                    content_type=doc.content_type,
                    size=doc.size,
                    file_size_display=file_size_display,
                    priority=doc.priority,
                    training_status=doc.training_status,
                    uploader_name=uploader_name,  # Now using actual name
                    uploaded_at=doc.uploaded_at,
                    updated_at=doc.updated_at,
                    download_url=(
                        f"{self.config.FRONTEND_HOST}/api/v1/documents/{doc.id}/download/"
                        if doc.document_type in [DocumentTypeEnum.FILE, DocumentTypeEnum.TEXT]
                        else doc.url
                    ),
                    url=doc.url,
                    url_title=doc.url_title,
                    url_description=doc.url_description,
                    is_deleted=doc.is_deleted,
                )
            )
        
        return items

    async def _get_uploader_name_safe(self, uploader_id: str) -> str:
        """Safely get uploader name with fallback"""
        try:
            async with UserServiceManager.get_client() as client:
                user = await client.get_user(uploader_id)
                if user:
                    return user.get("full_name") or user.get("username") or uploader_id
                return uploader_id
        except Exception as e:
            logger.error(f"Failed to get uploader name for {uploader_id}: {e}")
            return uploader_id

    async def get_training_status(self,
        organization_id: UUID,
    ) -> Tuple[int, int]:
        async with UnitOfWork(self.db) as uow:
            docs_untrained_num, docs_deleted_num = await uow.documents.count_untrained_and_deleted_docs(organization_id) 
        
        return docs_untrained_num, docs_deleted_num

    async def bulk_modify_docs(self,
        organization_id: UUID,
        update_data: List[DocumentUpdateItem],
    ) -> int:
        async with UnitOfWork(self.db) as uow:
            document_ids = [item.id for item in update_data]
            priority_map = {item.id: item.priority for item in update_data}
            needed_docs_nums = await uow.documents.get_many_by_ids_and_org_count(document_ids, organization_id)

            if needed_docs_nums != len(document_ids):
                raise HTTPException(
                    status_code=400, detail="One or more documentIDs are invalid"
                )

            affected_rows_num = await uow.documents.bulk_update_priority(
                organization_id,
                priority_map
            )

            if affected_rows_num == 0:
                raise HTTPException(status_code=404, detail="No documents were updated")
            
        return affected_rows_num

    async def update_document(self,
        organization_id: UUID,
        update_data: DocumentUpdateRequest,
        request: Request
    ) -> DocumentUpdateResponse:
        async with UnitOfWork(self.db) as uow:
            # Check existence
            document = await uow.documents.get_by_id_and_org(
                update_data.id, organization_id
            )
            if not document:
                raise HTTPException(status_code=404, detail="Document does not exist.")

            for field, value in update_data.model_dump(exclude_unset=True).items():
                setattr(document, field, value)
            
            document.updated_at = datetime.datetime.now(datetime.UTC)
            await uow.session.flush()
            await uow.session.refresh(document)

            return DocumentUpdateResponse.from_attributes(document, request)

    async def delete_document(self, document_id: UUID, organization_id: UUID):
        async with UnitOfWork(self.db) as uow:
            document = await uow.documents.get_by_id_and_org(
                document_id, organization_id
            )
            if not document:
                raise HTTPException(status_code=404, detail="Document does not exist.")
            
            if document and document.training_status == TrainingStatusEnum.UNTRAINED:
                await uow.documents.delete(document)
            else:
                await uow.documents.soft_delete_one(document_id, organization_id)

    async def restore_document(self, document_id: UUID, organization_id: UUID, request: Request):
        async with UnitOfWork(self.db) as uow:
            document = await uow.documents.get_by_id_and_org(
                document_id, organization_id
            )
            if not document or not document.is_deleted:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document does not exist or was not deleted",
                )
            await uow.documents.soft_delete_one(
                document_id, organization_id, revert_mode=True
            )

            await uow.session.refresh(document)
            return DocumentUpdateResponse.from_attributes(document, request)

    async def download_document(self, document_id: UUID, organization_id: UUID):
        async with UnitOfWork(self.db) as uow:
            document = await uow.documents.get_by_id_and_org(
                document_id, organization_id
            )
            if not document:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Document does not exist or was deleted",
                )
            
            if document.document_type == DocumentTypeEnum.URL:
                return document.url
            elif document.document_type in [
                DocumentTypeEnum.TEXT,
                DocumentTypeEnum.FILE,
            ]:
                url = generate_download_url(document, {
                    "Bucket": self.config.S3_BUCKET,
                    "Key": document.s3_key,
                })
                return url
            else:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Loại tài liệu không hỗ trợ tải xuống",
                )

    async def bulk_delete_documents(self, organization_id: UUID, doc_ids: List[UUID]) -> Tuple[int, int]:
        async with UnitOfWork(self.db) as uow:
            documents, _ = await uow.documents.get_real_many_by_ids_and_org(organization_id, doc_ids)
            hard_delete_ids = []
            soft_delete_ids = []
            for doc in documents:
                if doc.training_status == TrainingStatusEnum.UNTRAINED:
                    hard_delete_ids.append(doc.id)
                else:
                    soft_delete_ids.append(doc.id)

            soft_deleted_count = await uow.documents.soft_delete_many(soft_delete_ids, organization_id)
            hard_deleted_count = await uow.documents.hard_delete_many(hard_delete_ids, organization_id)
            processed_ids = set(hard_delete_ids + soft_delete_ids)
            requested_ids = set(doc_ids)
            not_found_count = len(requested_ids - processed_ids)

            return hard_deleted_count, soft_deleted_count, not_found_count

# Export injector for the service
def get_document_service(
    db = Depends(get_db),
    config = Depends(get_config),
    kafka_manager = Depends(get_kafka)
) -> DocumentService:
    return DocumentService(db=db, config=config, kafka_manager=kafka_manager)


