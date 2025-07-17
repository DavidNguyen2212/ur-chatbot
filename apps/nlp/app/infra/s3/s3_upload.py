from pathlib import Path
from app.infra.s3.s3_client import get_s3_client
from typing import Any, Dict, Optional


def generate_presigned_url(
    params: Dict[str, Any], object_action: str = "get_object"
) -> str:
    s3 = get_s3_client()
    return s3.generate_presigned_url(object_action, Params=params, ExpiresIn=3600)


def upload_fileobj(f, bucket_name, s3_key, ExtraArgs: Dict):
    s3 = get_s3_client()
    return s3.upload_fileobj(f, bucket_name, s3_key, ExtraArgs=ExtraArgs)

def generate_download_url(f, params: Dict[str, Any], object_action: str = "get_object"):
    """Generate a pre-signed URL for downloading the document"""
    s3 = get_s3_client()

    # For text files, add the content-type with UTF-8 charset to ensure proper encoding
    if (
        f.content_type == "text/plain; charset=utf-8"
        or f.filename.lower().endswith(".txt")
    ):
        params["ResponseContentType"] = "text/plain; charset=utf-8"

    return s3.generate_presigned_url(object_action, Params=params, ExpiresIn=3600)

def download_from_s3_to_path(s3_key: str, s3_bucket: str, path: Path):
    s3 = get_s3_client()
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as f:
        s3.download_fileobj(s3_bucket, s3_key, f)