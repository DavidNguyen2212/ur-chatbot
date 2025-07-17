from uuid import UUID
from pinecone import Pinecone, ServerlessSpec
from fastapi import Depends, HTTPException, status
from app.consumers.registry import CONSUMER_REGISTRY
from app.consumers.settings import ConsumerName
from app.core import get_logger, UnitOfWork, AppConfig, get_db, get_config
from app.schemas.event import DocsTrainEvent
from app.schemas.index import CreateNamespaceResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.infra.kafka import get_kafka, KafkaManager
from app.utils.index_utils import generate_org_name


logger = get_logger()


class IndexService:
    def __init__(self, db: AsyncSession, config: AppConfig, kafka_manager: KafkaManager):
        self.db = db
        self.config = config
        self.kafka_manager = kafka_manager

    async def start_training_for_org(self, org_id: UUID) -> int:
        async with UnitOfWork(self.db) as uow:
            training_status = await uow.training_statuses.get_by_org_id(org_id)
            if training_status and training_status.is_training:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Training in progress for this organization",
                )

            # Begin training
            await uow.training_statuses.start_training(org_id)
            _, documents_pending_count = await uow.documents.get_real_many_by_org(
                org_id
            )
            await uow.documents.update_many_by_org(org_id, state="PENDING")

        # Send event to Kafka (out of uow, when transaction was completed)
        kafkaTopic = CONSUMER_REGISTRY[ConsumerName.DOCUMENT_TRAINER].topics[0]
        await self.kafka_manager.send_message(kafkaTopic, 
            DocsTrainEvent(
                org_id=org_id,
            ).model_dump()
        )
        logger.info("[KAFKA_PRODUCER]: Training event dispatched")

        return documents_pending_count

    async def rollback_start_training(self, org_id: UUID):
        async with UnitOfWork(self.db) as uow:
            await uow.training_statuses.reset_training(org_id)
            await uow.documents.update_many_by_org(org_id, state="UNTRAINED")

    async def get_training_status(self, org_id: UUID):
        async with UnitOfWork(self.db) as uow:
            training_status = await uow.training_statuses.get_or_create_by_org_id(
                org_id
            )
            # total_docs = await uow.documents.count_by_state(org_id)
            # untrained_docs = await uow.documents.count_by_state(org_id, "UNTRAINED")
            # pending_docs = await uow.documents.count_by_state(org_id, "PENDING")
            # trained_docs = await uow.documents.count_by_state(org_id, "TRAINED")

            state_counts = await uow.documents.count_grouped_by_state(org_id)
            total_docs = sum(state_counts.values())
            untrained_docs = state_counts.get("UNTRAINED", 0)
            pending_docs = state_counts.get("PENDING", 0)
            trained_docs = state_counts.get("TRAINED", 0)

            return (
                training_status,
                total_docs,
                untrained_docs,
                pending_docs,
                trained_docs,
            )


    @staticmethod
    def saveVirtualIndex(
        configService: AppConfig, old_namespace: str, organization_id: str = "12345xoz"
    ):
        try:
            # --- Check index exists
            shared_index_name = configService.INDEX_NAME
            pc = Pinecone(api_key=configService.PINECONE_API_KEY)
            index = pc.Index(shared_index_name)

            # --- Check namespace exists
            namespace_1 = generate_org_name(
                organization_id=organization_id, prefix=shared_index_name
            )
            namespace_2 = namespace_1 + "-0"
            if old_namespace != namespace_1 and old_namespace != namespace_2:
                raise Exception("Bad organization id entered!")

            if old_namespace.endswith("-0"):
                namespace_to_save = namespace_1
            else:
                namespace_to_save = namespace_2

            index_stats = index.describe_index_stats()
            existing_namespaces = list(index_stats.get("namespaces", {}).keys())
            logger.info(f"List namespace: {existing_namespaces}")
            if old_namespace not in existing_namespaces:
                raise Exception(
                    f"Namespace to delete: '{old_namespace}' did not exists."
                )
            elif namespace_to_save not in existing_namespaces:
                raise Exception(
                    f"Namespace to save: '{namespace_to_save}' did not exists."
                )

            index.delete(delete_all=True, namespace=old_namespace)
            index_url = pc.describe_index(shared_index_name)["host"]

            return CreateNamespaceResponse(
                message="Virtual namespace saving completed successfully.",
                namespace=namespace_to_save,
                index_url=index_url,
            )

        except ValueError as ve:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}",
            )

    @staticmethod
    def disposeVirtualIndex(
        configService: AppConfig, old_namespace: str, organization_id: str = "12345xoz"
    ):
        try:
            # --- Check index exists
            shared_index_name = configService.INDEX_NAME
            pc = Pinecone(api_key=configService.PINECONE_API_KEY)
            index = pc.Index(shared_index_name)

            # --- Check namespace exists
            namespace_1 = generate_org_name(
                organization_id=organization_id, prefix=shared_index_name
            )
            namespace_2 = namespace_1 + "-0"
            if old_namespace != namespace_1 and old_namespace != namespace_2:
                raise Exception("Bad organization id entered!")

            if old_namespace.endswith("-0"):
                namespace_to_delete = namespace_1
            else:
                namespace_to_delete = namespace_2

            index_stats = index.describe_index_stats()
            existing_namespaces = list(index_stats.get("namespaces", {}).keys())
            logger.info(f"List namespace: {existing_namespaces}")
            if old_namespace not in existing_namespaces:
                raise Exception(f"Old namespace: '{old_namespace}' did not exists.")
            elif namespace_to_delete not in existing_namespaces:
                raise Exception(
                    f"Namespace to delete '{namespace_to_delete}' did not exists."
                )

            index.delete(delete_all=True, namespace=namespace_to_delete)

            return CreateNamespaceResponse(
                message="Virtual namespace deleting completed successfully.",
                namespace="",
                index_url="",
            )

        except ValueError as ve:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"An unexpected error occurred: {str(e)}",
            )

# Export injector for the service
async def get_index_service(
    db = Depends(get_db),
    config = Depends(get_config),
    kafka_manager = Depends(get_kafka)
) -> IndexService:
    return IndexService(db=db, config=config, kafka_manager=kafka_manager)