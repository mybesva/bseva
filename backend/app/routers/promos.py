"""Promo banners and seasonal popups (req #89, #103, #104)."""
from __future__ import annotations

import re
import time
from datetime import datetime
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import row_dict
from app.storage import content_type_for, file_response, upload_bytes

router = APIRouter(tags=["promos"])

_PROMO_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
_PROMO_MEDIA_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|jpeg|png|webp|gif)$",
    re.I,
)


class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = None
    image_url: str | None = None
    target_url: str | None = None
    audience: str = "customer"
    placement: str = "post_login"
    start_at: datetime | None = None
    end_at: datetime | None = None
    active: bool = False
    display_order: int = 100
    is_third_party: bool = False
    advertiser: str | None = None


class PopupIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str | None = None
    image_url: str | None = None
    service_id: str | None = None
    cta_label: str | None = None
    cta_url: str | None = None
    languages: str = "en,hi,te"
    audience: str = "customer"
    start_at: datetime | None = None
    end_at: datetime | None = None
    active: bool = False


def _blank_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped or None


def _viewer_audience(user: dict) -> str:
    if user["role"] in ("pujari", "head_pujari"):
        return "pujari"
    if user["role"] in ("admin", "super_admin"):
        return "admin"
    return "customer"


def _active_window_sql(alias: str = "t") -> str:
    return f"""
      {alias}.active = TRUE
      AND ({alias}.start_at IS NULL OR {alias}.start_at <= NOW())
      AND ({alias}.end_at IS NULL OR {alias}.end_at >= NOW())
    """


async def store_promo_image(file: UploadFile) -> tuple[str, str]:
    """Save an uploaded promo image. Returns (storage_path, public_image_url)."""
    raw_name = (file.filename or "").strip()
    ext = Path(raw_name).suffix.lower()
    ctype = (file.content_type or "").lower().split(";")[0].strip()
    ctype_ext = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/pjpeg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/gif": ".gif",
    }
    if ext not in _PROMO_EXTS:
        ext = ctype_ext.get(ctype, "")

    data = await file.read()
    if not data:
        raise HTTPException(400, "Empty file — choose an image and try again")
    if len(data) > 8 * 1024 * 1024:
        raise HTTPException(400, "Image must be under 8MB")

    if ext not in _PROMO_EXTS:
        if data[:3] == b"\xff\xd8\xff":
            ext = ".jpg"
        elif data[:8] == b"\x89PNG\r\n\x1a\n":
            ext = ".png"
        elif len(data) >= 12 and data[:4] == b"RIFF" and data[8:12] == b"WEBP":
            ext = ".webp"
        elif data[:6] in (b"GIF87a", b"GIF89a"):
            ext = ".gif"
        else:
            raise HTTPException(400, "Use jpg, png, webp, or gif")

    if ext == ".jpeg":
        ext = ".jpg"
    image_id = str(uuid4())
    stored = f"{image_id}{ext}"
    rel = f"promos/{stored}"
    upload_bytes(rel, data, content_type_for(raw_name or stored))
    return rel, f"/api/v1/promos/media/{stored}"


@router.post("/admin/promos/images")
async def admin_upload_promo_image(
    file: UploadFile = File(...),
    user=Depends(require_roles("admin", "super_admin")),
):
    _rel, image_url = await store_promo_image(file)
    return {
        "ok": True,
        "image_url": image_url,
        "preview_url": f"{image_url}?v={int(time.time())}",
    }


@router.get("/promos/media/{filename}")
def get_promo_media(filename: str):
    """Public promo/banner image for uploaded storage objects."""
    if not _PROMO_MEDIA_RE.match(filename or ""):
        raise HTTPException(400, "Invalid image")
    return file_response(f"promos/{filename}", filename=filename)


@router.get("/promos/banners")
def list_active_banners(
    placement: str = "post_login",
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    audience = _viewer_audience(user)
    rows = db.execute(
        text(
            f"""
            SELECT * FROM promo_banners t
            WHERE {_active_window_sql()}
              AND (audience = :aud OR audience = 'all')
              AND placement = :placement
            ORDER BY display_order ASC, created_at DESC
            LIMIT 20
            """
        ),
        {"aud": audience, "placement": placement},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/promos/popups")
def list_active_popups(lang: str = "en", user=Depends(current_user), db: Session = Depends(get_db)):
    audience = _viewer_audience(user)
    rows = db.execute(
        text(
            f"""
            SELECT * FROM seasonal_popups t
            WHERE {_active_window_sql()}
              AND (audience = :aud OR audience = 'all')
              AND (languages IS NULL OR languages ILIKE :lang)
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        {"lang": f"%{lang}%", "aud": audience},
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/admin/promos/banners")
def admin_list_banners(user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM promo_banners ORDER BY display_order, created_at DESC")).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/promos/banners")
def admin_create_banner(body: BannerIn, user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    bid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO promo_banners
              (id, title, subtitle, image_url, target_url, audience, placement, start_at, end_at, active, display_order, is_third_party, advertiser)
            VALUES (CAST(:id AS uuid), :title, :sub, :img, :url, :aud, :place, :start, :end, :active, :ord, :tp, :adv)
            """
        ),
        {
            "id": bid,
            "title": body.title,
            "sub": _blank_to_none(body.subtitle),
            "img": _blank_to_none(body.image_url),
            "url": _blank_to_none(body.target_url),
            "aud": body.audience or "customer",
            "place": body.placement,
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
            "ord": body.display_order,
            "tp": body.is_third_party,
            "adv": _blank_to_none(body.advertiser),
        },
    )
    db.commit()
    return {"id": bid, "ok": True, "active": body.active}


@router.patch("/admin/promos/banners/{banner_id}")
def admin_patch_banner(
    banner_id: str,
    body: BannerIn,
    user=Depends(require_roles("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    exists = db.execute(text("SELECT id FROM promo_banners WHERE id = CAST(:id AS uuid)"), {"id": banner_id}).first()
    if not exists:
        raise HTTPException(404, "Banner not found")
    db.execute(
        text(
            """
            UPDATE promo_banners SET
              title=:title, subtitle=:sub, image_url=:img, target_url=:url, audience=:aud, placement=:place,
              start_at=:start, end_at=:end, active=:active, display_order=:ord, is_third_party=:tp,
              advertiser=:adv, updated_at=NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "id": banner_id,
            "title": body.title,
            "sub": _blank_to_none(body.subtitle),
            "img": _blank_to_none(body.image_url),
            "url": _blank_to_none(body.target_url),
            "aud": body.audience or "customer",
            "place": body.placement,
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
            "ord": body.display_order,
            "tp": body.is_third_party,
            "adv": _blank_to_none(body.advertiser),
        },
    )
    db.commit()
    return {"ok": True, "active": body.active}


@router.delete("/admin/promos/banners/{banner_id}")
def admin_delete_banner(
    banner_id: str,
    user=Depends(require_roles("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text("DELETE FROM promo_banners WHERE id = CAST(:id AS uuid) RETURNING id"),
        {"id": banner_id},
    ).first()
    if not result:
        raise HTTPException(404, "Banner not found")
    db.commit()
    return {"ok": True}


@router.get("/admin/promos/popups")
def admin_list_popups(user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM seasonal_popups ORDER BY created_at DESC")).mappings().all()
    return [row_dict(r) for r in rows]


@router.post("/admin/promos/popups")
def admin_create_popup(body: PopupIn, user=Depends(require_roles("admin", "super_admin")), db: Session = Depends(get_db)):
    pid = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO seasonal_popups
              (id, title, description, image_url, service_id, cta_label, cta_url, languages, audience, start_at, end_at, active)
            VALUES (
              CAST(:id AS uuid), :title, :desc, :img,
              CASE WHEN :sid IS NULL THEN NULL ELSE CAST(:sid AS uuid) END,
              :cta, :curl, :langs, :aud, :start, :end, :active
            )
            """
        ),
        {
            "id": pid,
            "title": body.title,
            "desc": _blank_to_none(body.description),
            "img": _blank_to_none(body.image_url),
            "sid": _blank_to_none(body.service_id),
            "cta": _blank_to_none(body.cta_label),
            "curl": _blank_to_none(body.cta_url),
            "langs": body.languages or "en,hi,te",
            "aud": body.audience or "customer",
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
        },
    )
    db.commit()
    return {"id": pid, "ok": True, "active": body.active}


@router.patch("/admin/promos/popups/{popup_id}")
def admin_patch_popup(
    popup_id: str,
    body: PopupIn,
    user=Depends(require_roles("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    exists = db.execute(text("SELECT id FROM seasonal_popups WHERE id = CAST(:id AS uuid)"), {"id": popup_id}).first()
    if not exists:
        raise HTTPException(404, "Popup not found")
    db.execute(
        text(
            """
            UPDATE seasonal_popups SET
              title=:title, description=:desc, image_url=:img,
              service_id=CASE WHEN :sid IS NULL THEN NULL ELSE CAST(:sid AS uuid) END,
              cta_label=:cta, cta_url=:curl, languages=:langs, audience=:aud,
              start_at=:start, end_at=:end, active=:active
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "id": popup_id,
            "title": body.title,
            "desc": _blank_to_none(body.description),
            "img": _blank_to_none(body.image_url),
            "sid": _blank_to_none(body.service_id),
            "cta": _blank_to_none(body.cta_label),
            "curl": _blank_to_none(body.cta_url),
            "langs": body.languages or "en,hi,te",
            "aud": body.audience or "customer",
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
        },
    )
    db.commit()
    return {"ok": True, "active": body.active}


@router.delete("/admin/promos/popups/{popup_id}")
def admin_delete_popup(
    popup_id: str,
    user=Depends(require_roles("admin", "super_admin")),
    db: Session = Depends(get_db),
):
    result = db.execute(
        text("DELETE FROM seasonal_popups WHERE id = CAST(:id AS uuid) RETURNING id"),
        {"id": popup_id},
    ).first()
    if not result:
        raise HTTPException(404, "Popup not found")
    db.commit()
    return {"ok": True}
