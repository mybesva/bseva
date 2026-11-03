"""Cashfree config guards, signatures and id formats (no network, no database)."""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import uuid

import pytest

from app.config import Settings, insecure_settings_problems
from app.payments import cashfree_pg
from app.payments.service import _refund_id, normalize_phone, order_id_for
from app.payouts import cashfree_payouts
from app.payouts.service import _instrument, _transfer_id


def _settings(**kw):
    return Settings(database_url="postgresql://x/y", jwt_secret="x" * 40, **kw)


@pytest.mark.parametrize("field,env_field", [("cashfree_pg_app_id", "cashfree_pg_env"), ("cashfree_payout_client_id", "cashfree_payout_env")])
def test_live_gateway_refused_outside_production(field, env_field):
    probs = insecure_settings_problems(_settings(environment="qa", **{env_field: "production"}), env={})
    assert any("production" in p for p in probs)


def test_production_key_refused_in_sandbox_mode_without_echoing_it():
    probs = insecure_settings_problems(_settings(environment="qa", cashfree_pg_app_id="PROD_live_key_123"), env={})
    assert any("production key" in p for p in probs)
    assert "PROD_live_key_123" not in " ".join(probs)


def test_sandbox_test_keys_allowed_on_qa():
    assert insecure_settings_problems(_settings(environment="qa", cashfree_pg_app_id="TEST_abc"), env={}) == []


def test_pg_webhook_signature_matches_cashfree_formula(monkeypatch):
    monkeypatch.setattr(cashfree_pg.settings, "cashfree_pg_secret_key", "s3cret")
    body, ts = b'{"type":"PAYMENT_SUCCESS_WEBHOOK"}', "1730000000000"
    expected = base64.b64encode(hmac.new(b"s3cret", ts.encode() + body, hashlib.sha256).digest()).decode()
    assert cashfree_pg.verify_webhook(ts, expected, body)
    assert not cashfree_pg.verify_webhook(ts, expected, body + b" ")
    assert not cashfree_pg.verify_webhook("1730000000001", expected, body)
    assert not cashfree_pg.verify_webhook(ts, None, body)
    assert cashfree_pg.webhook_signature_variant(ts, expected, body) == "plain"
    dotted = base64.b64encode(hmac.new(b"s3cret", ts.encode() + b"." + body, hashlib.sha256).digest()).decode()
    assert cashfree_pg.webhook_signature_variant(ts, dotted, body) == "dot"
    wrong_key = base64.b64encode(hmac.new(b"other", ts.encode() + body, hashlib.sha256).digest()).decode()
    assert cashfree_pg.webhook_signature_variant(ts, wrong_key, body) is None


def test_payout_2fa_signature_encrypts_client_id_and_epoch():
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding, rsa

    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    pem = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo)
    sig = cashfree_payouts.signature("CF_CLIENT", pem, now=1730000000)
    plain = key.decrypt(
        base64.b64decode(sig), padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None)
    )
    assert plain == b"CF_CLIENT.1730000000"


def test_ids_fit_cashfree_rules():
    pid = str(uuid.uuid4())
    assert re.fullmatch(r"[A-Za-z0-9_-]{3,45}", order_id_for("BSV-261103-ABCDEF12", 12))
    for kind in ("cancellation", "duplicate_payment", "late_payment", "manual"):
        rid = _refund_id(pid, kind, 3)
        assert re.fullmatch(r"[A-Za-z0-9]{3,40}", rid), rid
    assert len({_refund_id(pid, "cancellation", n) for n in range(3)}) == 3
    assert re.fullmatch(r"[A-Za-z0-9_]{1,40}", _transfer_id(pid, 9))


def test_amount_conversion_is_exact():
    assert cashfree_pg.rupees(123456) == 1234.56
    assert cashfree_pg.paise(1234.56) == 123456
    assert cashfree_pg.paise("0.29") == 29


@pytest.mark.parametrize("raw,out", [("9876543210", "9876543210"), ("+91 98765 43210", "9876543210"), ("12345", None), (None, None)])
def test_phone_normalised_for_checkout(raw, out):
    assert normalize_phone(raw) == out


def test_payout_instrument_prefers_bank_and_sanitises_name():
    inst = _instrument({"bank_account_number": "0262 9180 0001191", "bank_ifsc": "yesb0000262", "bank_holder_name": "Sri. R. Sharma-2"})
    assert inst["instrument"] == "bank" and inst["account"] == "026291800001191" and inst["ifsc"] == "YESB0000262"
    assert inst["name"] == "Sri R Sharma" and "1191" in inst["masked"] and "02629180" not in inst["masked"]
    upi = _instrument({"upi_id": "Pandit@okicici", "name": "Pandit"})
    assert upi["instrument"] == "upi" and upi["mode"] == "upi"
    assert _instrument({"name": "No Details"}) is None


def test_payout_remarks_are_cleaned_for_cashfree(monkeypatch):
    seen = {}
    monkeypatch.setattr(cashfree_payouts, "_request", lambda m, p, json=None, params=None: seen.update(json) or {})
    cashfree_payouts.create_transfer(transfer_id="t1", amount_paise=100, beneficiary_id="b", mode="imps", remarks="B-Seva settlement #12")
    assert re.fullmatch(r"[A-Za-z0-9 ]{1,70}", seen["transfer_remarks"]), seen["transfer_remarks"]
