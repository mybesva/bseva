"""Regression tests for QA findings (validation + storage auth headers)."""

from __future__ import annotations

import pytest
from datetime import date
from fastapi import HTTPException

from app.validation_rules import (
    is_uuid,
    normalize_mobile,
    validate_address_fields,
    validate_bank_fields,
    validate_cancel_reason,
    validate_pujari_dob,
    validate_support_text,
)
from app.storage import _supabase_auth_headers
from app import storage as storage_mod
from app.config import settings


def test_normalize_mobile_accepts_10_digit():
    assert normalize_mobile("9876543210") == "9876543210"
    assert normalize_mobile("+91 98765 43210") == "9876543210"


def test_normalize_mobile_rejects_invalid():
    with pytest.raises(HTTPException):
        normalize_mobile("123")
    with pytest.raises(HTTPException):
        normalize_mobile("12345678901234")


def test_pujari_dob_min_age():
    too_young = date(date.today().year - 2, 1, 1)
    with pytest.raises(HTTPException):
        validate_pujari_dob(too_young)
    ok = date(date.today().year - 25, 6, 15)
    assert validate_pujari_dob(ok) == ok


def test_address_rejects_junk_and_bad_pin():
    with pytest.raises(HTTPException):
        validate_address_fields(
            address_line1="@@@",
            city="x",
            district="y",
            state="z",
            pincode="abc",
            require_all=True,
        )
    out = validate_address_fields(
        address_line1="12 MG Road",
        city="Hyderabad",
        district="Hyderabad",
        state="Telangana",
        pincode="500001",
        require_all=True,
    )
    assert out["pincode"] == "500001"


def test_bank_requires_all_fields():
    with pytest.raises(HTTPException):
        validate_bank_fields(holder="", ifsc="", last4="", require_all=True)
    out = validate_bank_fields(holder="Ram Kumar", ifsc="SBIN0001234", last4="1234", require_all=True)
    assert out["bank_ifsc"] == "SBIN0001234"


def test_support_text_min_meaningful():
    with pytest.raises(HTTPException):
        validate_support_text("aaa", "---")
    s, d = validate_support_text("Payment issue", "Wallet debit failed after booking")
    assert len(s) >= 5 and len(d) >= 10


def test_cancel_reason_required():
    with pytest.raises(HTTPException):
        validate_cancel_reason("N", required=True)
    assert validate_cancel_reason("Schedule conflict", required=True) == "Schedule conflict"


def test_is_uuid():
    assert is_uuid("550e8400-e29b-41d4-a716-446655440000")
    assert not is_uuid("2")


def test_storage_headers_jwt_uses_bearer(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xx.yy")
    h = _supabase_auth_headers()
    assert h["Authorization"].startswith("Bearer eyJ")
    assert h["apikey"].startswith("eyJ")


def test_storage_headers_sb_secret_no_bearer(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "sb_secret_abc123xyz")
    h = _supabase_auth_headers()
    assert "Authorization" not in h
    assert h["apikey"] == "sb_secret_abc123xyz"


def test_storage_headers_reject_placeholder(monkeypatch):
    monkeypatch.setattr(settings, "supabase_service_role_key", "changeme")
    with pytest.raises(HTTPException):
        _supabase_auth_headers()
