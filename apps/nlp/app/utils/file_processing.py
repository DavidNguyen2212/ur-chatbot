import os
import tempfile
from typing import List, Tuple
from charset_normalizer import detect
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.document_loaders import PyPDFLoader, Docx2txtLoader, TextLoader
from fastapi import UploadFile
from tqdm.asyncio import tqdm_asyncio

from app.enums.document import PriorityEnum


def get_file_type(file: UploadFile) -> str:
    if file.filename.endswith(".pdf") or file.content_type == "application/pdf":
        return "pdf"
    elif (
        file.filename.endswith(".docx")
        or file.content_type
        == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ):
        return "docx"
    elif file.filename.endswith(".txt") or "text/plain" in file.content_type:
        return "txt"
    else:
        return "unsupported"


def detect_file_encoding(file_path: str) -> str:
    """
    Detect the encoding of a text file.

    Args:
        file_path: Path to the file

    Returns:
        str: Detected encoding
    """
    with open(file_path, "rb") as f:
        result = detect(f.read())
        return result["encoding"]


async def process_file(file: UploadFile, priority: int) -> List[Document]:
    """
    Process a single file asynchronously.

    Args:
        file: UploadFile to process
        priority: Priority level for the file

    Returns:
        List[Document]: List of processed documents
    """
    try:
        loader_cls = Docx2txtLoader
        if file.content_type == "application/pdf":
            loader_cls = PyPDFLoader
        elif file.content_type in ["text/plain; charset=utf-8", "text/plain"]:
            loader_cls = TextLoader

        # Save the file temporarily for processing
        with tempfile.NamedTemporaryFile(
            delete=False, suffix=file.filename.split(".")[-1]
        ) as temp_file:
            temp_file.write(await file.read())
            temp_file_path = temp_file.name

        # Load the file using the specified loader
        if loader_cls == TextLoader:
            encoding = detect_file_encoding(temp_file_path)
            loader = loader_cls(temp_file_path, encoding=encoding)
        else:
            loader = loader_cls(temp_file_path)
        documents = loader.load()
        for doc in documents:
            if not doc.metadata:
                doc.metadata = {}
            doc.metadata["priority"] = priority

        # Clean up temporary file
        os.remove(temp_file_path)

        return documents

    except Exception as error:
        print(f"Error processing file {file}: {error}")
        return []


async def load_files_by_type(
    files: List[UploadFile], priorities: List[int]
) -> List[Document]:
    """
    Load files of a specific type and return a list of LangChain Document objects.

    Args:
        files: List of files to process
        priorities: List of priority levels corresponding to files

    Returns:
        List[Document]: A list of LangChain Document objects.
    """
    tasks = [process_file(file, priority) for file, priority in zip(files, priorities)]
    results = await tqdm_asyncio.gather(*tasks, desc="Loading files", unit="file")
    # flatten the list of document lists
    all_documents = [doc for documents in results for doc in documents]

    return all_documents


def set_batch_and_splitter(length: int) -> Tuple[int, RecursiveCharacterTextSplitter]:
    """
    Return the proper batch and TextSplitter with right chunk size & overlap

    Args:
        length: Number of documents to process

    Returns:
        Tuple[int, RecursiveCharacterTextSplitter]: Batch size and configured text splitter
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

def human_readable_size(size: int) -> str:
    for unit in ["B", "KB", "MB", "GB"]:
        if size < 1024:
            return f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"

def priority_to_int(priority: str) -> int:
    if priority == PriorityEnum.HIGH:
        return 4
    elif priority == PriorityEnum.MEDIUM:
        return 3
    elif priority == PriorityEnum.LOW:
        return 2
    else:
        return 1  # NONE hoặc không xác định

def detect_file_encoding(file: str) -> str:
    """
    Detect the encoding of a text file.
    """
    with open(file, "rb") as f:
        result = detect(f.read())
        return result["encoding"]