"""Cashfree Payouts V2 HTTP client (separate product and keys from the Payment Gateway).

Reference: https://www.cashfree.com/docs/api-reference/payouts/v2 (x-api-version 2024-01-01). Calls carry the
2FA signature x-cf-signature = Base64(RSA-OAEP(SHA-1)("<clientId>.<epochSeconds>", public key)) when a public key
is configured; otherwise the account must use IP whitelisting. Errors never include keys.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import time
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.payments.cashfree_pg import CashfreeError, paise, rupees

BASE_URLS = {"sandbox": "https://sandbox.cashfree.com/payout", "production": "https://api.cashfree.com/payout"}
TIMEOUT = httpx.Timeout(30.0, connect=10.0)
transport: httpx.BaseTransport | None = None

TRANSFER_STATUS = {
    "RECEIVED": "pending",
    "QUEUED": "pending",
    "APPROVAL_PENDING": "pending",
    "PENDING": "pending",
    "SUCCESS": "successful",
    "FAILED": "failed",
    "REJECTED": "failed",
    "REVERSED": "reversed",
}


def _public_key_pem() -> bytes | None:
    inline = (settings.cashfree_payout_public_key or "").strip()
    if inline:
        return inline.replace("\\n", "\n").encode()
    path = (settings.cashfree_payout_public_key_file or "").strip()
    if path and Path(path).is_file():
        return Path(path).read_bytes()
    return None


def signature(client_id: str, pem: bytes, now: int | None = None) -> str:
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding

    key = serialization.load_pem_public_key(pem)
    message = f"{client_id}.{int(now if now is not None else time.time())}".encode()
    encrypted = key.encrypt(
        message, padding.OAEP(mgf=padding.MGF1(algorithm=hashes.SHA1()), algorithm=hashes.SHA1(), label=None)
    )
    return base64.b64encode(encrypted).decode()


def _request(method: str, path: str, *, json: dict | None = None, params: dict | None = None) -> Any:
    if not settings.cashfree_payouts_configured:
        raise CashfreeError("Cashfree Payouts is not configured", 0, "not_configured")
    client_id = settings.cashfree_payout_client_id.strip()
    headers = {
        "x-client-id": client_id,
        "x-client-secret": settings.cashfree_payout_client_secret.strip(),
        "x-api-version": settings.cashfree_payout_api_version,
        "content-type": "application/json",
        "accept": "application/json",
    }
    pem = _public_key_pem()
    if pem:
        headers["x-cf-signature"] = signature(client_id, pem)
    env = (settings.cashfree_payout_env or "sandbox").strip().lower()
    try:
        with httpx.Client(base_url=BASE_URLS[env], timeout=TIMEOUT, transport=transport, headers=headers) as c:
            r = c.request(method, path, json=json, params=params)
    except httpx.TimeoutException as e:
        raise CashfreeError("Cashfree Payouts did not respond in time", 0, "timeout") from e
    except httpx.HTTPError as e:
        raise CashfreeError(f"Could not reach Cashfree Payouts ({type(e).__name__})", 0, "network") from e
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400:
        code = data.get("code") if isinstance(data, dict) else None
        message = data.get("message") if isinstance(data, dict) else None
        raise CashfreeError(str(message or f"Cashfree Payouts returned HTTP {r.status_code}")[:300], r.status_code, code)
    return data


def create_beneficiary(
    *, beneficiary_id: str, name: str, account: str | None, ifsc: str | None, vpa: str | None,
    phone: str | None, email: str | None,
) -> dict:
    instrument: dict[str, str] = {}
    if account and ifsc:
        instrument = {"bank_account_number": account, "bank_ifsc": ifsc}
    elif vpa:
        instrument = {"vpa": vpa}
    contact: dict[str, str] = {}
    if phone:
        contact["beneficiary_phone"] = phone
        contact["beneficiary_country_code"] = "+91"
    if email:
        contact["beneficiary_email"] = email
    body: dict[str, Any] = {
        "beneficiary_id": beneficiary_id,
        "beneficiary_name": name,
        "beneficiary_instrument_details": instrument,
    }
    if contact:
        body["beneficiary_contact_details"] = contact
    return _request("POST", "/beneficiary", json=body)


def get_beneficiary(beneficiary_id: str) -> dict:
    return _request("GET", "/beneficiary", params={"beneficiary_id": beneficiary_id})


def find_beneficiary_by_bank(account: str, ifsc: str) -> dict:
    return _request("GET", "/beneficiary", params={"bank_account_number": account, "bank_ifsc": ifsc})


def create_transfer(*, transfer_id: str, amount_paise: int, beneficiary_id: str, mode: str, remarks: str) -> dict:
    body = {
        "transfer_id": transfer_id,
        "transfer_amount": rupees(amount_paise),
        "transfer_currency": "INR",
        "transfer_mode": mode,
        "beneficiary_details": {"beneficiary_id": beneficiary_id},
        # Cashfree accepts only letters, digits and spaces here ("B-Seva" is rejected as invalid).
        "transfer_remarks": (re.sub(r"[^A-Za-z0-9 ]+", " ", remarks).strip()[:70] or "Settlement"),
    }
    return _request("POST", "/transfers", json=body)


def get_transfer(transfer_id: str) -> dict:
    return _request("GET", "/transfers", params={"transfer_id": transfer_id})


def normalise_transfer(data: dict) -> dict:
    raw = str(data.get("status") or "").upper()
    return {
        "status": TRANSFER_STATUS.get(raw, "pending"),
        "raw_status": raw or None,
        "status_code": data.get("status_code"),
        "detail": data.get("status_description") or data.get("status_code"),
        "cf_transfer_id": str(data.get("cf_transfer_id") or "") or None,
        "utr": data.get("transfer_utr") or None,
        "amount_paise": paise(data["transfer_amount"]) if data.get("transfer_amount") is not None else None,
        "mode": data.get("transfer_mode"),
    }


def verify_webhook(timestamp: str | None, sig: str | None, raw_body: bytes) -> bool:
    """Payouts V2 webhooks: Base64(HMAC-SHA256(timestamp + raw body)) keyed with the Payouts client secret."""
    secret = settings.cashfree_payout_client_secret.strip()
    if not (secret and timestamp and sig):
        return False
    mac = base64.b64encode(hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()).decode()
    return hmac.compare_digest(mac, sig.strip())
