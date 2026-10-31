"""Super Admin login tokens, MPIN rules and action binding."""
import inspect

import jwt
import pytest
from fastapi import HTTPException

from app import deps, sensitive_auth as sa
from app.config import settings
from app.security import (
    create_access_token,
    create_login_challenge,
    decode_login_challenge,
    decode_token,
    hash_password,
    verify_password,
)


class _Rows:
    def __init__(self, row):
        self.row = row

    def mappings(self):
        return self

    def first(self):
        return self.row


class _Db:
    def __init__(self, row):
        self.row = row

    def execute(self, *_a, **_k):
        return _Rows(self.row)


def _creds(token):
    return type("C", (), {"credentials": token})()


def _super():
    return {"id": "00000000-0000-0000-0000-000000000001", "role": "super_admin", "blocked": False, "password_hash": "h"}


def test_super_admin_session_without_otp_is_refused():
    row = _super()
    token = create_access_token(row["id"], "super_admin", "h")
    with pytest.raises(HTTPException) as e:
        deps.current_user(_creds(token), _Db(row))
    assert e.value.status_code == 401


def test_super_admin_session_with_otp_is_accepted():
    row = _super()
    token = create_access_token(row["id"], "super_admin", "h", mfa=True)
    assert deps.current_user(_creds(token), _Db(row))["id"] == row["id"]


def test_login_challenge_cannot_be_used_as_an_access_token():
    token = create_login_challenge("abc", "h")
    with pytest.raises(ValueError):
        decode_token(token)
    assert decode_login_challenge(token)["sub"] == "abc"


def test_access_token_cannot_be_used_as_a_login_challenge():
    with pytest.raises(ValueError):
        decode_login_challenge(create_access_token("abc", "super_admin", "h", mfa=True))


def test_tampered_challenge_is_refused():
    forged = jwt.encode({"sub": "abc", "aud": "bseva-super-admin-login"}, "wrong-secret-wrong-secret-wrong-secret", algorithm=settings.jwt_algorithm)
    with pytest.raises(ValueError):
        decode_login_challenge(forged)


@pytest.mark.parametrize("mpin", ["12345", "1234567", "12a456", "", "١٢٣٤٥٧", "111111", "123456", "654321"])
def test_weak_or_malformed_mpin_is_refused(mpin):
    with pytest.raises(HTTPException):
        sa.validate_new_mpin(mpin)


@pytest.mark.parametrize("mpin", ["482915", "012359", "112233"])
def test_good_mpin_is_accepted(mpin):
    sa.validate_new_mpin(mpin)


def test_mpin_is_stored_salted():
    one, two = hash_password("482915"), hash_password("482915")
    assert one != two and "482915" not in one
    assert verify_password("482915", one) and not verify_password("482916", one)


@pytest.mark.parametrize(
    "changed",
    [
        ("u2", "settlement_override", "s1", 100, "R"),
        ("u1", "settlement_note", "s1", 100, "R"),
        ("u1", "settlement_override", "s2", 100, "R"),
        ("u1", "settlement_override", "s1", 101, "R"),
        ("u1", "settlement_override", "s1", 100, "R2"),
    ],
)
def test_binding_covers_admin_action_settlement_amount_and_reference(changed):
    assert sa._binding("u1", "settlement_override", "s1", 100, "R") != sa._binding(*changed)


def test_audit_helper_has_no_mpin_or_otp_field():
    names = set(inspect.signature(sa.log_event).parameters)
    assert not names & {"mpin", "otp", "password"}
