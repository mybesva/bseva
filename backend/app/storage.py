"""Object storage helper — Supabase Storage when configured, else local disk (dev)."""

from __future__ import annotations

import mimetypes
import re
from pathlib import Path

import httpx
from fastapi import HTTPException
from fastapi.responses import Response

from app.config import settings

DOC_ROOT = Path(__file__).resolve().parent / "data" / "documents"


def storage_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key and settings.storage_bucket)


def _safe_segment(name: str) -> str:
    base = Path(name).name
    return re.sub(r"[^A-Za-z0-9._-]", "_", base)[:80] or "file"


def content_type_for(filename: str) -> str:
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def upload_bytes(object_path: str, data: bytes, content_type: str | None = None) -> str:
    """
    Store bytes at object_path (e.g. `{user_id}/profile.jpg`).
    Returns the same relative path for DB storage_path columns.
    """
    object_path = object_path.lstrip("/")
    ct = content_type or content_type_for(object_path)

    if storage_configured():
        url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.storage_bucket}/{object_path}"
        )
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
            "Content-Type": ct,
            "x-upsert": "true",
        }
        with httpx.Client(timeout=60.0) as client:
            res = client.post(url, content=data, headers=headers)
            if res.status_code not in (200, 201):
                # retry as PUT for some Storage API versions
                res = client.put(url, content=data, headers=headers)
            if res.status_code not in (200, 201):
                raise HTTPException(502, f"Storage upload failed: {res.text[:200]}")
        return object_path

    # Local fallback for uvicorn/dev without Supabase Storage
    dest = DOC_ROOT / object_path
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)
    return object_path


def fetch_bytes(object_path: str) -> tuple[bytes, str]:
    object_path = object_path.lstrip("/")
    ct = content_type_for(object_path)

    if storage_configured():
        url = (
            f"{settings.supabase_url.rstrip('/')}/storage/v1/object/"
            f"{settings.storage_bucket}/{object_path}"
        )
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }
        with httpx.Client(timeout=60.0) as client:
            res = client.get(url, headers=headers)
        if res.status_code == 404:
            raise HTTPException(404, "File missing")
        if res.status_code >= 400:
            raise HTTPException(502, f"Storage download failed: {res.text[:200]}")
        return res.content, res.headers.get("content-type", ct)

    path = DOC_ROOT / object_path
    if not path.exists():
        raise HTTPException(404, "File missing")
    return path.read_bytes(), ct


def file_response(object_path: str, filename: str | None = None):
    data, ct = fetch_bytes(object_path)
    headers = {}
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
        headers = {
            "Authorization": f"Bearer {settings.supabase_service_role_key}",
            "apikey": settings.supabase_service_role_key,
        }
        with httpx.Client(timeout=30.0) as client:
            client.delete(url, headers=headers)
        return
    path = DOC_ROOT / object_path
    if path.exists():
        path.unlink()
