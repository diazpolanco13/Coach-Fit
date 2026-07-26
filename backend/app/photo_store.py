from __future__ import annotations

import io
import os
from functools import lru_cache
from urllib.parse import urlparse

from minio import Minio

from . import db

DEFAULT_BUCKET = "coachfit-photos"


def _bool_env(name: str, default: bool) -> bool:
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _required_env(name: str) -> str:
    # database_url() ya carga backend/.env; acá hace falta igual porque
    # photo_store puede usarse sin haber tocado aún el pool de Postgres.
    db._load_env_file()
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"{name} es obligatoria para subir fotos de medición")
    return value


@lru_cache(maxsize=1)
def _client() -> Minio:
    endpoint = _required_env("MINIO_ENDPOINT")
    secure = _bool_env("MINIO_SECURE", True)
    if "://" in endpoint:
        parsed = urlparse(endpoint)
        secure = parsed.scheme == "https"
        endpoint = parsed.netloc
    return Minio(
        endpoint,
        access_key=_required_env("MINIO_ACCESS_KEY"),
        secret_key=_required_env("MINIO_SECRET_KEY"),
        secure=secure,
    )


def bucket_name() -> str:
    return os.environ.get("MINIO_BUCKET") or DEFAULT_BUCKET


def ensure_ready() -> None:
    client = _client()
    bucket = bucket_name()
    if not client.bucket_exists(bucket):
        raise RuntimeError(f"El bucket MinIO {bucket!r} no existe")


def put_photo(object_key: str, data: bytes, content_type: str) -> None:
    _client().put_object(
        bucket_name(),
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type,
    )


def get_photo(object_key: str) -> bytes:
    response = _client().get_object(bucket_name(), object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()


def delete_photo(object_key: str) -> None:
    _client().remove_object(bucket_name(), object_key)
