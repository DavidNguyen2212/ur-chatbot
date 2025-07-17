import asyncio
from io import BytesIO
from typing import Dict, List
from uuid import UUID, uuid4
from fastapi import HTTPException, status
from fastapi.concurrency import run_in_threadpool
from app.entities.document import CoolDocument
from app.infra.s3.s3_upload import upload_fileobj
from app.core import get_logger, UnitOfWork, get_config, AppConfig
from app.core.db import get_session_maker
from app.integrations.firecrawl.loader import CoolFireCrawlLoader
from app.schemas.event import UrlCrawlEvent

logger = get_logger()

async def process_url_doc(url_doc: CoolDocument, config: AppConfig, org_id: UUID):
    from app.core import URL_PROCESSING_SEMAPHORE

    async with URL_PROCESSING_SEMAPHORE:
        try:
            SessionLocal = get_session_maker()
            async with SessionLocal() as db:
                async with UnitOfWork(db) as uow:
                    loader = CoolFireCrawlLoader(
                        api_key=config.FIRECRAWL_API_KEY, url=url_doc.url, mode="scrape"
                    )
                    loaded_docs = await loader.aload()

                    if not loaded_docs:
                        logger.warning(f"[Crawl] No content found for {url_doc.url}")
                        return

                    content = "\n\n".join([d.page_content for d in loaded_docs]).strip()
                    if not content:
                        logger.warning(f"[Crawl] Empty content for {url_doc.url}")
                        return

                    encoded = content.encode("utf-8-sig")
                    filename = url_doc.filename or f"url_{uuid4().hex[:8]}.txt"
                    s3_key = (
                        url_doc.s3_key or f"{config.UPLOAD_BASE_PATH}/{org_id}/urls/{filename}"
                    )
                    await run_in_threadpool(
                        upload_fileobj,
                        BytesIO(encoded),
                        config.S3_BUCKET,
                        s3_key,
                        {"ContentType": "text/plain; charset=utf-8"},
                    )
                    logger.info("Uploaded text to s3 successfully")

                    await uow.documents.update_url_doc_extension(url_doc.id, org_id, s3_key)
                    logger.info("Updated text records to db successfully")

        except Exception as e:
            logger.error(f"[FireCrawler] Failed to crawl {url_doc.url}: {e}")


"""
Parralel 3 crawling with asyncio and semaphore now.
Can update to 100+ requests with batch processing with TaskGroup!
"""
async def crawl_site(data: Dict):
    try:
        event = UrlCrawlEvent(**data)
    except Exception as e:
        logger.error(f"[Kafka] Invalid docs train event: {e}")
        return

    org_id = event.org_id
    SessionLocal = get_session_maker()
    config = get_config()

    try:
        async with SessionLocal() as db:
            async with UnitOfWork(db) as uow:
                url_document = (
                    # await uow.documents.get_url_documents_to_refresh(org_id)
                    await uow.documents.get_by_id_and_org(event.doc_id, org_id)
                )
                if not url_document:
                    logger.error(f"[FireCrawler] Document {event.doc_id} not found for org {org_id}")
                    return
                logger.info(f"[FireCrawler] Ready to crawl url.")

        await process_url_doc(url_document, config, org_id)

    except Exception as e:
        logger.error(f"[FireCrawler] Failed to process crawl event: {e}")
    # tasks = [
    #     process_url_doc(url_doc, config, org_id)
    #     for url_doc in url_documents
    # ]

    # await asyncio.gather(*tasks)
