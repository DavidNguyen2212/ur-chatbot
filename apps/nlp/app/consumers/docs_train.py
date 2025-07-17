import asyncio
import datetime
from tqdm.asyncio import tqdm_asyncio
import os
from pathlib import Path
import shutil
import tempfile
from typing import Any, BinaryIO, Dict, List, Tuple
from uuid import UUID, uuid4
from langchain_openai import OpenAIEmbeddings
from langchain_pinecone import PineconeVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pinecone import Pinecone, ServerlessSpec
from fastapi.concurrency import run_in_threadpool
from fastapi import HTTPException, status
from langchain_core.documents import Document
from tqdm import tqdm
from app.consumers.url import process_url_doc
from app.entities.document import CoolDocument
from app.enums.document import DocumentTypeEnum
from app.infra.s3 import download_from_s3_to_path
from app.schemas.index import CreateNamespaceResponse
from app.core import get_logger, UnitOfWork, get_config, AppConfig
from app.core.db import get_session_maker
from app.schemas.event import DocsTrainEvent
from app.utils.file_processing import detect_file_encoding, priority_to_int
from app.utils.index_utils import generate_org_name
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader

logger = get_logger()

async def train_documents(data: Dict):
    try:
        event = DocsTrainEvent(**data)
    except Exception as e:
        logger.error(f"[Kafka] Invalid docs train event: {e}")
        return

    org_id = event.org_id
    SessionLocal = get_session_maker()
    config = get_config()
    async with SessionLocal() as db:
        async with UnitOfWork(db) as uow:
            # Examine status
            status = await uow.training_statuses.get_by_org_id(org_id)
            if not status:
                logger.error(f"Training status not found for org {org_id}")
                return

            # Hard delete obsoleted docs
            await uow.documents.hard_delete(org_id)

            # prepare metadata
            documents = await uow.documents.get_train_many_by_org(org_id)
            logger.info(f"[KAFKA]: Indexing documents for org: {org_id} started!")

            result = await create_index(config, documents, org_id)

            if result:
                await uow.documents.update_many_by_org(org_id, state="TRAINED")
                await uow.training_statuses.complete_training(org_id)
                logger.info(
                    f"[KAFKA]: Training documents for org: {org_id} finished successfully!"
                )
            else:
                # Roll back
                await uow.documents.update_many_by_org(org_id, "UNTRAINED")
                await uow.training_statuses.reset_training(org_id)
                logger.info(f"[KAFKA]: Training documents for org: {org_id} error")

    return result


async def create_index(
    config: AppConfig,
    documents: List[CoolDocument],
    organization_id: UUID,
    # is_virtual: bool = False,
):
    try:
        if not documents or len(documents) == 0:
            raise ValueError("No training documents available.")
        
        # 1. Tạo file tạm và chuẩn bị files + metadata
        temp_dir = tempfile.mkdtemp()
        files_to_upload, metadata = await prepare_training_files(documents, temp_dir, config, organization_id)

        # --- Check shared index exists
        shared_index_name = config.INDEX_NAME
        pc = Pinecone(api_key=config.PINECONE_API_KEY)
        existing_indexes = [index_info["name"] for index_info in pc.list_indexes()]
        if shared_index_name not in existing_indexes:
            pc.create_index(
                name=shared_index_name,
                dimension=1536,
                metric="cosine",
                spec=ServerlessSpec(cloud="aws", region="us-east-1"),
            )
            logger.info(f"Creating shared index: {shared_index_name}")
            while not pc.describe_index(shared_index_name).status["ready"]:
                await asyncio.sleep(1)
        else:
            logger.info(f"Shared index '{shared_index_name}' existed.")

        # --- Handle org namespace
        org_namespace = generate_org_name(organization_id, prefix=shared_index_name)

        index = pc.Index(shared_index_name)
        index_stats = index.describe_index_stats()
        existing_namespaces = list(index_stats.get("namespaces", {}).keys())
        if org_namespace in existing_namespaces:
            index.delete(delete_all=True, namespace=org_namespace)
        #     if not is_virtual:
        #         index.delete(delete_all=True, namespace=org_namespace)
        #     else:
        #         org_namespace = org_namespace + "-0"
        # elif org_namespace + "-0" in existing_indexes:
        #     if not is_virtual:
        #         # do not raise exception, delete it
        #         index.delete(delete_all=True, namespace=org_namespace + "-0")

        # --- Main code: load and index file
        valid_file_tuples: List[Tuple[str, Tuple[str, BinaryIO, str]]] = [f for f in files_to_upload if f[0] == "files"]
        allDocs: List[Document] = await load_files_by_type(
            files=valid_file_tuples,
            priorities=metadata["files"]
        )

        logger.info(f"Total documents loaded: {len(allDocs)}")

        batch_size, text_splitter = set_batch_and_splitter(len(allDocs))
        embedder = OpenAIEmbeddings(
            model="text-embedding-3-small", api_key=config.OPENAI_API_KEY
        )
        # embedder = GoogleGenerativeAIEmbeddings(
        #     model_name="gemini-embedding-exp-03-07", task_type="RETRIEVAL_DOCUMENT",
        # )

        logger.info("Processing and indexing documents...")
        vector_store = PineconeVectorStore(index=index, embedding=embedder)
        for i in tqdm(
            range(0, len(allDocs), batch_size),
            desc="Processing batches",
            unit="batch",
        ):
            batch = allDocs[i : i + batch_size]
            batch_splits = text_splitter.split_documents(batch)
            await vector_store.aadd_documents(batch_splits, namespace=org_namespace)

        index_url = pc.describe_index(shared_index_name)["host"]
        logger.info("✅ Index creation completed.")
        shutil.rmtree(temp_dir, ignore_errors=True)


        return CreateNamespaceResponse(
            message="Index creation completed successfully.",
            namespace=org_namespace,
            index_url=index_url,
        )

    except Exception as e:
        logger.error(f"An unexpected error occurred: {str(e)}")
        return None
        

async def prepare_training_files(documents: List[CoolDocument], temp_dir: str, config: AppConfig, org_id: UUID) -> List[Tuple[str, Tuple]]:
    files_to_upload = []
    metadata = {"files": {}}
    now = datetime.datetime.now(datetime.UTC)

    # Refresh url
    urls_to_refresh = [
        doc for doc in documents
        if doc.document_type == DocumentTypeEnum.URL and
        (doc.s3_key is None or not doc.url_expires_at or doc.url_expires_at <= now)
    ]
    if len(urls_to_refresh) == 0:
        logger.info(f"All urls are valid and ready to use.")
    else:
        await asyncio.gather(*[process_url_doc(doc, config, org_id) for doc in urls_to_refresh])

    for doc in documents:
        if not doc.s3_key:
            continue
        local_path = Path(temp_dir) / f"{uuid4().hex[:8]}_{doc.filename}" # handling same file name and extension
        try:
            await run_in_threadpool(
                download_from_s3_to_path,
                doc.s3_key,
                config.S3_BUCKET,
                local_path,
            )
            # Ghi metadata
            metadata["files"][doc.filename] = priority_to_int(doc.priority)
            # Thêm vào danh sách files upload
            files_to_upload.append(
                (
                    "files",
                    (
                        doc.filename,
                        open(local_path, "rb"),
                        doc.content_type or "application/octet-stream",
                    ),
                )
            )
        except Exception as e:
            logger.error(f"❌ Error downloading {doc.s3_key}: {e}")
            continue
        
    # metadata_path = Path(temp_dir) / "metadata.json"
    # with open(metadata_path, "w", encoding="utf-8") as f:
    #     json.dump(metadata, f)

    # # Thêm metadata vào files_to_upload
    # files_to_upload.append(
    #     (
    #         "files",
    #         (
    #             "metadata.json",
    #             open(metadata_path, "rb"),
    #             "application/json"
    #         )
    #     )
    # )
    
    return files_to_upload, metadata


async def process_file_from_tuple(
    filename: str,
    fileobj: BinaryIO,
    content_type: str,
    priority: int,
) -> List[Document]:
    """
    Process a file given as (filename, fileobj, content_type)
    """
    try:
        suffix = os.path.splitext(filename)[-1] or ".tmp"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(fileobj.read())
            tmp.flush()
            tmp_path = tmp.name

        # Select loader
        if content_type == "application/pdf":
            loader = PyPDFLoader(tmp_path)
        elif content_type in ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"]:
            loader = Docx2txtLoader(tmp_path)
        elif content_type.startswith("text/plain"):
            encoding = detect_file_encoding(tmp_path)
            loader = TextLoader(tmp_path, encoding=encoding)
        else:
            logger.warning(f"Unsupported file type: {content_type} for {filename}")
            os.remove(tmp_path)
            return []

        docs = loader.load()
        for doc in docs:
            doc.metadata = doc.metadata or {}
            doc.metadata["priority"] = priority
            doc.metadata["filename"] = filename

        os.remove(tmp_path)
        return docs

    except Exception as e:
        logger.error(f"Error processing file {filename}: {e}")
        return []


async def load_files_by_type(
    files: List[Tuple[str, Tuple[str, BinaryIO, str]]],
    priorities: Dict[str, int],
) -> List[Document]:
    """
    Load files from list of (field_name, (filename, fileobj, content_type)) and return LangChain Documents.
    """
    tasks = []
    for _, (filename, fileobj, content_type) in files:
        prio = priorities.get(filename, 1)
        fileobj.seek(0)  # Ensure stream is at beginning
        tasks.append(process_file_from_tuple(filename, fileobj, content_type, prio))

    results = await tqdm_asyncio.gather(*tasks, desc="Loading files", unit="file")
    return [doc for sublist in results for doc in sublist]


def set_batch_and_splitter(length: int) -> Tuple[int, RecursiveCharacterTextSplitter]:
    """
    Return the proper batch and TextSplitter with right chunk size & overlap
    """
    batch_size = 10
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800, chunk_overlap=100, length_function=len, is_separator_regex=False
    )
    if length > 1000:
        batch_size = 50
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=3000,  # Tăng chunk_size để giảm số lượng đoạn
            chunk_overlap=300,  # Tăng chunk_overlap nếu cần ngữ cảnh rộng hơn
            length_function=len,
            is_separator_regex=False,
        )
    elif length > 500:
        batch_size = 20
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1500,  # Increase chunk_size => decrease num of paragraph
            chunk_overlap=200,  # Increase chunk_overlap for larger context
            length_function=len,
            is_separator_regex=False,
        )

    return batch_size, text_splitter