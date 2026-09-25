import pytest
from fastapi import HTTPException

from app.routers.customer import _infer_image_ext


def test_infer_extension_from_magic_bytes_when_filename_missing():
    jpeg = b"\xff\xd8\xff" + b"x" * 64
    assert _infer_image_ext("", "application/octet-stream", jpeg) == ".jpg"


def test_infer_extension_from_content_type():
    png = b"\x89PNG\r\n\x1a\n" + b"x" * 64
    assert _infer_image_ext("upload", "image/png", png) == ".png"


def test_rejects_unknown_binary():
    with pytest.raises(HTTPException) as exc:
        _infer_image_ext("", "", b"not-an-image")
    assert exc.value.status_code == 400
