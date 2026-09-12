"""Local checks for pujari photo extension sniffing + mobile normalize."""
from __future__ import annotations

import asyncio
import io

from fastapi import HTTPException, UploadFile


def test_store_asset_sniffs_jpeg_without_extension(monkeypatch):
    from app.routers import pujari as pujari_mod

    saved = {}

    def fake_upload(path, data, content_type=None):
        saved["path"] = path
        saved["data"] = data
        return path

    monkeypatch.setattr(pujari_mod, "upload_bytes", fake_upload)

    jpeg = b"\xff\xd8\xff" + b"\x00" * 32
    upload = UploadFile(filename="blob", file=io.BytesIO(jpeg), headers={"content-type": "application/octet-stream"})
    rel = asyncio.run(pujari_mod._store_asset("user-1", upload, "profile"))
    assert rel.endswith(".jpg")
    assert saved["path"].endswith("profile.jpg")


def test_store_asset_rejects_unknown_bytes(monkeypatch):
    from app.routers import pujari as pujari_mod

    monkeypatch.setattr(pujari_mod, "upload_bytes", lambda *a, **k: a[0])
    upload = UploadFile(filename="x.bin", file=io.BytesIO(b"not-an-image"), headers={"content-type": "application/octet-stream"})
    try:
        asyncio.run(pujari_mod._store_asset("user-1", upload, "profile"))
        assert False, "expected HTTPException"
    except HTTPException as ei:
        assert ei.status_code == 400


def test_normalize_mobile_strips_extra_digits():
    from app.validation_rules import normalize_mobile

    assert normalize_mobile("+919876543210") == "9876543210"
    assert normalize_mobile("9000000006") == "9000000006"
    assert normalize_mobile("0000009876543210") == "9876543210"
