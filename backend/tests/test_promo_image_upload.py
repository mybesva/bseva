"""Local checks for promo image upload sniffing and filename gating."""
from __future__ import annotations

import asyncio
import io

from fastapi import HTTPException, UploadFile


def test_store_promo_image_sniffs_jpeg_without_extension(monkeypatch):
    from app.routers import promos as promo_mod

    saved = {}

    def fake_upload(path, data, content_type=None):
        saved["path"] = path
        saved["data"] = data
        return path

    monkeypatch.setattr(promo_mod, "upload_bytes", fake_upload)

    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    upload = UploadFile(filename="blob", file=io.BytesIO(jpeg), headers={"content-type": "application/octet-stream"})
    rel, url = asyncio.run(promo_mod.store_promo_image(upload))
    assert rel.startswith("promos/")
    assert rel.endswith(".jpg")
    assert url.startswith("/api/v1/promos/media/")
    assert url.endswith(".jpg")
    assert saved["path"] == rel


def test_store_promo_image_rejects_unknown_bytes(monkeypatch):
    from app.routers import promos as promo_mod

    monkeypatch.setattr(promo_mod, "upload_bytes", lambda *a, **k: a[0])
    upload = UploadFile(filename="x.bin", file=io.BytesIO(b"not-an-image"), headers={"content-type": "application/octet-stream"})
    try:
        asyncio.run(promo_mod.store_promo_image(upload))
        assert False, "expected HTTPException"
    except HTTPException as ei:
        assert ei.status_code == 400


def test_get_promo_media_rejects_path_traversal():
    from app.routers import promos as promo_mod

    try:
        promo_mod.get_promo_media("../secret.jpg")
        assert False, "expected HTTPException"
    except HTTPException as ei:
        assert ei.status_code == 400


def test_new_banner_and_popup_default_to_draft():
    from app.routers.promos import BannerIn, PopupIn

    assert BannerIn(title="Spring offer").active is False
    assert PopupIn(title="Ugadi").active is False


def test_is_festival_day_ekadashi_and_purnima():
    from datetime import date
    from app.panchang import is_festival_day, _lunar_tithi_index

    found = False
    for i in range(30):
        day = date(2000, 1, 1 + i)
        if _lunar_tithi_index(day) in (10, 14):
            assert is_festival_day(day) is True
            found = True
            break
    assert found
    assert is_festival_day(date(2000, 1, 1)) is (_lunar_tithi_index(date(2000, 1, 1)) in (10, 14))


def test_blank_to_none_and_viewer_audience():
    from app.routers.promos import _blank_to_none, _viewer_audience

    assert _blank_to_none("") is None
    assert _blank_to_none("  ") is None
    assert _blank_to_none("x") == "x"
    assert _viewer_audience({"role": "customer"}) == "customer"
    assert _viewer_audience({"role": "pujari"}) == "pujari"
    assert _viewer_audience({"role": "head_pujari"}) == "pujari"
    assert _viewer_audience({"role": "admin"}) == "admin"
