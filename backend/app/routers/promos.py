"""Promo banners and seasonal popups (req #89, #103, #104)."""
from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import row_dict

router = APIRouter(tags=["promos"])


class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = None
    image_url: str | None = None
    target_url: str | None = None
    audience: str = "customer"
    placement: str = "post_login"
    start_at: datetime | None = None
    end_at: datetime | None = None
    active: bool = True
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
    start_at: datetime | None = None
    end_at: datetime | None = None
    active: bool = True


def _active_window_sql(alias: str = "t") -> str:
    return f"""
      {alias}.active = TRUE
      AND ({alias}.start_at IS NULL OR {alias}.start_at <= NOW())
      AND ({alias}.end_at IS NULL OR {alias}.end_at >= NOW())
    """


@router.get("/promos/banners")
def list_active_banners(
    placement: str = "post_login",
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    audience = "customer"
    if user["role"] in ("pujari", "head_pujari"):
        audience = "pujari"
    elif user["role"] in ("admin", "super_admin"):
        audience = "admin"
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
    rows = db.execute(
        text(
            f"""
            SELECT * FROM seasonal_popups t
            WHERE {_active_window_sql()}
              AND (languages IS NULL OR languages ILIKE :lang)
            ORDER BY created_at DESC
            LIMIT 5
            """
        ),
        {"lang": f"%{lang}%"},
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
            "sub": body.subtitle,
            "img": body.image_url,
            "url": body.target_url,
            "aud": body.audience,
            "place": body.placement,
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
            "ord": body.display_order,
            "tp": body.is_third_party,
            "adv": body.advertiser,
        },
    )
    db.commit()
    return {"id": bid, "ok": True}


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
              title=:title, image_url=:img, target_url=:url, audience=:aud, placement=:place,
              start_at=:start, end_at=:end, active=:active, display_order=:ord, is_third_party=:tp,
              updated_at=NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {
            "id": banner_id,
            "title": body.title,
            "img": body.image_url,
            "url": body.target_url,
            "aud": body.audience,
            "place": body.placement,
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
            "ord": body.display_order,
            "tp": body.is_third_party,
        },
    )
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
              (id, title, description, image_url, service_id, cta_label, cta_url, languages, start_at, end_at, active)
            VALUES (
              CAST(:id AS uuid), :title, :desc, :img,
              CASE WHEN :sid IS NULL THEN NULL ELSE CAST(:sid AS uuid) END,
              :cta, :curl, :langs, :start, :end, :active
            )
            """
        ),
        {
            "id": pid,
            "title": body.title,
            "desc": body.description,
            "img": body.image_url,
            "sid": body.service_id,
            "cta": body.cta_label,
            "curl": body.cta_url,
            "langs": body.languages,
            "start": body.start_at,
            "end": body.end_at,
            "active": body.active,
        },
    )
    db.commit()
    return {"id": pid, "ok": True}
