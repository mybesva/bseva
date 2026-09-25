"""Object storage helper — Supabase Storage when configured, else local disk (dev)."""

from __future__ import annotations

import json
import mimetypes
import os
import re
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


def _service_role_key() -> str:
    return (settings.supabase_service_role_key or "").strip()


def storage_configured() -> bool:
    key = _service_role_key()
    return bool(
        settings.supabase_url
        and key
        and key.lower() not in _PLACEHOLDER_KEYS
        and settings.storage_bucket
    )


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


def upload_bytes(object_path: str, data: bytes, content_type: str | None = None) -> str:
    """
    Store bytes at object_path (e.g. `{user_id}/profile.jpg`).
    Returns the same relative path for DB storage_path columns.
    """
    object_path = object_path.lstrip("/")
    ct = content_type or content_type_for(object_path)

    if storage_configured():
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
            "Object storage is not configured on the server. Set SUPABASE_URL, "
            "SUPABASE_SERVICE_ROLE_KEY (eyJ… JWT), and STORAGE_BUCKET, then redeploy.",
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
    object_path = object_path.lstrip("/")
    ct = content_type_for(object_path)

    if storage_configured():
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
    object_path = object_path.lstrip("/")
    if storage_configured():
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
