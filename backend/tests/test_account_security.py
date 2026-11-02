"""Session revocation, account-state enforcement, deletion form rules and field encryption."""
from datetime import datetime, timezone

import pytest
from cryptography.fernet import Fernet
from fastapi import HTTPException

from app import account_lifecycle as al
from app import deps, field_crypto


def test_tokens_issued_before_revocation_are_refused():
    revoked = datetime(2026, 11, 2, 10, 0, 0, tzinfo=timezone.utc)
    row = {"sessions_revoked_at": revoked}
    assert deps._revoked(row, {"iat": int(revoked.timestamp()) - 1})
    assert deps._revoked(row, {"iatm": int(revoked.timestamp() * 1000) - 1})
    assert not deps._revoked(row, {"iatm": int(revoked.timestamp() * 1000) + 1})
    # Tokens from before iat existed are refused once sessions were revoked, accepted otherwise.
    assert deps._revoked(row, {})
    assert not deps._revoked({"sessions_revoked_at": None}, {})


@pytest.mark.parametrize("state, blocked", [("active", False), ("deletion_requested", True), ("deleted", True)])
def test_only_active_accounts_may_use_the_api(state, blocked):
    err = deps.account_state_error({"account_state": state})
    assert (err is not None) == blocked
    if err:
        assert err.status_code == 403 and err.detail["code"] == "ACCOUNT_DELETION_PENDING"


def test_deletion_form_needs_a_listed_reason_and_a_real_explanation():
    assert al.validate_request_fields("privacy", " I do not use the app any more ") == (
        "privacy",
        "I do not use the app any more",
    )
    with pytest.raises(HTTPException):
        al.validate_request_fields("bored", "I do not use the app any more")
    with pytest.raises(HTTPException):
        al.validate_request_fields("privacy", "too short")
    with pytest.raises(HTTPException):
        al.validate_request_fields("privacy", "x" * 501)


def test_bank_numbers_round_trip_and_never_double_encrypt(monkeypatch):
    monkeypatch.setenv("DATA_ENCRYPTION_KEY", Fernet.generate_key().decode())
    field_crypto._fernet.cache_clear()
    stored = field_crypto.encrypt_value("123456789012")
    assert stored.startswith(field_crypto.PREFIX) and "123456789012" not in stored
    assert field_crypto.encrypt_value(stored) == stored
    assert field_crypto.decrypt_value(stored) == "123456789012"
    assert field_crypto.decrypt_value("998877") == "998877"  # legacy plaintext still reads
    field_crypto._fernet.cache_clear()


def test_without_a_key_values_are_left_as_they_were(monkeypatch):
    monkeypatch.delenv("DATA_ENCRYPTION_KEY", raising=False)
    field_crypto._fernet.cache_clear()
    assert field_crypto.encrypt_value("123456789012") == "123456789012"
    field_crypto._fernet.cache_clear()


def test_request_status_message_matches_the_required_wording():
    req = {
        "id": "r1", "state": "requested", "reason": "privacy", "explanation": "x" * 10,
        "requested_at": None, "deadline_at": None,
    }
    assert al.request_public(req)["message"].startswith("Your account has been deactivated.")
