"""Object storage helper — Amazon S3 when S3_BUCKET is set (AWS), else Supabase Storage when
configured (Vercel), else local disk (dev). Object keys are identical across backends."""

from __future__ import annotations

import json
import logging
import mimetypes
import os
import re
from functools import lru_cache
from pathlib import Path

import httpx
from fastapi import HTTPException
from fastapi.responses import Response

from app.config import settings

DOC_ROOT = Path(__file__).resolve().parent / "data" / "documents"

# Placeholders / non-keys that must never be sent to Supabase (cause Invalid Compact JWS).
_PLACEHOLDER_KEYS = {
    "",
    "your-service-role-key",
    "service_role_key",
    "supabase_service_role_key",
    "changeme",
    "replace-me",
}

_JWT_HINT = (
    "SUPABASE_SERVICE_ROLE_KEY must be the legacy service_role JWT "
    "(starts with eyJ…) from Supabase → Project Settings → API. "
    "Do not use sb_publishable_… or sb_secret_… for Storage uploads — "
    "Storage requires a real JWT in the Authorization header."
)


logger = logging.getLogger("bseva.storage")


def _service_role_key() -> str:
    return (settings.supabase_service_role_key or "").strip()


def _s3_bucket() -> str:
    return (os.environ.get("S3_BUCKET") or "").strip()


@lru_cache(maxsize=1)
def _s3_client():
    import boto3
    from botocore.config import Config

    # Credentials come from the instance role (no access keys in the environment).
    region = (os.environ.get("AWS_REGION") or os.environ.get("AWS_DEFAULT_REGION") or "ap-south-1").strip()
    return boto3.client("s3", region_name=region, config=Config(retries={"max_attempts": 3, "mode": "standard"}))


def _supabase_configured() -> bool:
    key = _service_role_key()
    return bool(
        settings.supabase_url
        and key
        and key.lower() not in _PLACEHOLDER_KEYS
        and settings.storage_bucket
    )


def storage_configured() -> bool:
    return bool(_s3_bucket()) or _supabase_configured()


def _s3_error(exc: Exception, action: str) -> HTTPException:
    code = getattr(exc, "response", {}).get("Error", {}).get("Code", "") if hasattr(exc, "response") else ""
    if code in ("NoSuchKey", "404", "NotFound"):
        return HTTPException(404, "File missing")
    logger.error("S3_%s_FAILED code=%s", action.upper(), code or type(exc).__name__)
    return HTTPException(502, f"Storage {action} failed")


def _safe_segment(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80] or "file"


def content_type_for(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _require_storage_jwt() -> str:
    """
    Supabase Storage requires Authorization: Bearer <JWT>.
    Opaque keys (sb_secret_ / sb_publishable_) are not JWTs and cause:
      - missing Authorization, or
      - Invalid Compact JWS when forced as Bearer.
    """
    key = _service_role_key()
    if not key or key.lower() in _PLACEHOLDER_KEYS:
        raise HTTPException(
            503,
            "Object storage is not configured. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (eyJ… JWT), and STORAGE_BUCKET.",
        )
    if not key.startswith("eyJ"):
        raise HTTPException(503, _JWT_HINT)
    return key


def _supabase_auth_headers(extra: dict | None = None) -> dict[str, str]:
    """Build Supabase Storage auth headers (JWT service_role only)."""
    key = _require_storage_jwt()
    headers: dict[str, str] = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }
    if extra:
        headers.update(extra)
    return headers


def _storage_error_detail(res: httpx.Response) -> str:
    detail = (res.text or "").strip()
    try:
        payload = json.loads(detail)
        detail = (
            payload.get("message")
            or payload.get("error")
            or payload.get("msg")
            or detail
        )
    except Exception:
        pass
    text = str(detail)
    if "Invalid Compact JWS" in text or "authorization" in text.lower():
        return _JWT_HINT
    return text[:240]


_UNSAFE_KEY = re.compile(r"[\\?#\x00-\x1f]|%2e|%2f|%5c", re.I)


def clean_object_path(object_path: str | None) -> str:
    """Bucket-relative key with no traversal: rejects `..`/`.`/empty segments, backslashes,
    encoded separators, query/fragment characters and control characters."""
    path = str(object_path or "").strip().lstrip("/")
    if not path or len(path) > 512 or _UNSAFE_KEY.search(path):
        raise HTTPException(400, "Invalid file path")
    if any(part in ("", ".", "..") for part in path.split("/")):
        raise HTTPException(400, "Invalid file path")
    return path


def upload_bytes(object_path: str, data: bytes, content_type: str | None = None) -> str:
    """
    Store bytes at object_path (e.g. `{user_id}/profile.jpg`).
    Returns the same relative path for DB storage_path columns.
    """
    object_path = clean_object_path(object_path)
    ct = content_type or content_type_for(object_path)

    bucket = _s3_bucket()
    if bucket:
        try:
            _s3_client().put_object(Bucket=bucket, Key=object_path, Body=data, ContentType=ct)
        except Exception as exc:  # botocore ClientError / connection errors
            raise _s3_error(exc, "upload") from exc
        return object_path

    if _supabase_configured():
        # Fail fast with a clear message if the key cannot authorize Storage
        _require_storage_jwt()
        url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.storage_bucket}/{object_path}"
        )
        headers = _supabase_auth_headers({"Content-Type": ct, "x-upsert": "true"})
        with httpx.Client(timeout=60.0) as client:
            res = client.post(url, content=data, headers=headers)
            if res.status_code not in (200, 201):
                # retry as PUT for some Storage API versions
                res = client.put(url, content=data, headers=headers)
            if res.status_code not in (200, 201):
                raise HTTPException(502, f"Storage upload failed: {_storage_error_detail(res)}")
        return object_path

    # Serverless (Vercel) has a read-only filesystem — never fall back to local disk there.
    if os.environ.get("VERCEL") == "1" or (settings.environment or "").lower() == "production":
        raise HTTPException(
            503,
            "Object storage is not configured on the server. Set S3_BUCKET (AWS) or SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY (eyJ… JWT) and STORAGE_BUCKET (Vercel), then redeploy.",
        )

    # Local fallback for uvicorn/dev without Supabase Storage
    try:
        dest = DOC_ROOT / object_path
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(data)
    except OSError as exc:
        raise HTTPException(
            503,
            "Object storage is not writable. Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY "
            f"(eyJ… JWT), and STORAGE_BUCKET. ({exc})",
        ) from exc
    return object_path


def fetch_bytes(object_path: str) -> tuple[bytes, str]:
    object_path = clean_object_path(object_path)
    ct = content_type_for(object_path)

    bucket = _s3_bucket()
    if bucket:
        try:
            obj = _s3_client().get_object(Bucket=bucket, Key=object_path)
        except Exception as exc:
            raise _s3_error(exc, "download") from exc
        return obj["Body"].read(), obj.get("ContentType") or ct

    if _supabase_configured():
        url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.storage_bucket}/{object_path}"
        )
        headers = _supabase_auth_headers()
        with httpx.Client(timeout=60.0) as client:
            res = client.get(url, headers=headers)
        if res.status_code == 404:
            raise HTTPException(404, "File missing")
        if res.status_code >= 400:
            raise HTTPException(502, f"Storage download failed: {_storage_error_detail(res)}")
        return res.content, res.headers.get("content-type", ct)

    path = DOC_ROOT / object_path
    if not path.exists():
        raise HTTPException(404, "File missing")
    return path.read_bytes(), ct


def file_response(object_path: str, filename: str | None = None):
    data, ct = fetch_bytes(object_path)
    headers = {"Cache-Control": "no-store, max-age=0"}
    if filename:
        headers["Content-Disposition"] = f'inline; filename="{_safe_segment(filename)}"'
    return Response(content=data, media_type=ct, headers=headers)


def delete_object(object_path: str) -> None:
    object_path = clean_object_path(object_path)
    bucket = _s3_bucket()
    if bucket:
        try:
            _s3_client().delete_object(Bucket=bucket, Key=object_path)
        except Exception as exc:
            raise _s3_error(exc, "delete") from exc
        return
    if _supabase_configured():
        url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.storage_bucket}/{object_path}"
        )
        headers = _supabase_auth_headers()
        with httpx.Client(timeout=30.0) as client:
            client.delete(url, headers=headers)
        return
    path = DOC_ROOT / object_path
    if path.exists():
        path.unlink()
