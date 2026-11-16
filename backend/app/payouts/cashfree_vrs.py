"""Cashfree Secure ID (Verification Suite) HTTP client: checks a pujari's bank account or UPI ID before payouts.

Separate product and keys from the Payment Gateway and Payouts. References:
- Bank account verification v2 (sync): POST {base}/bank-account/sync
  https://www.cashfree.com/docs/api-reference/vrs/v2/bav-v2/bank-account-verification-sync-v2
- UPI penny drop: POST {base}/upi/penny-drop (sends Rs 1 to the VPA; needs the account holder's consent)
  https://www.cashfree.com/docs/api-reference/vrs/v2/upi-penny-drop/create-upi-penny-drop-request
Calls carry the same 2FA signature as Payouts (x-cf-signature) when a Secure ID public key is configured; otherwise
the account must use IP whitelisting. Errors never include keys.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

from app.config import settings
from app.payments.cashfree_pg import CashfreeError
from app.payouts.cashfree_payouts import signature

BASE_URLS = {"sandbox": "https://sandbox.cashfree.com/verification", "production": "https://api.cashfree.com/verification"}
UPI_API_VERSION = "2024-12-01"
TIMEOUT = httpx.Timeout(45.0, connect=10.0)
transport: httpx.BaseTransport | None = None
CONSENT_PURPOSE = "Verify the pujari UPI ID before B-Seva sends settlement payouts"


def _public_key_pem() -> bytes | None:
    inline = (settings.cashfree_vrs_public_key or "").strip()
    if inline:
        return inline.replace("\\n", "\n").encode()
    path = (settings.cashfree_vrs_public_key_file or "").strip()
    if path and Path(path).is_file():
        return Path(path).read_bytes()
    return None


def _request(path: str, body: dict, *, api_version: str | None = None) -> dict[str, Any]:
    if not settings.cashfree_vrs_configured:
        raise CashfreeError("Cashfree Secure ID is not configured", 0, "not_configured")
    client_id = settings.cashfree_vrs_client_id.strip()
    headers = {
        "x-client-id": client_id,
        "x-client-secret": settings.cashfree_vrs_client_secret.strip(),
        "content-type": "application/json",
        "accept": "application/json",
    }
    if api_version:
        headers["x-api-version"] = api_version
    pem = _public_key_pem()
    if pem:
        headers["x-cf-signature"] = signature(client_id, pem)
    env = (settings.cashfree_vrs_env or "sandbox").strip().lower()
    try:
        with httpx.Client(base_url=BASE_URLS[env], timeout=TIMEOUT, transport=transport, headers=headers) as c:
            r = c.post(path, json=body)
    except httpx.TimeoutException as e:
        raise CashfreeError("Cashfree Secure ID did not respond in time", 0, "timeout") from e
    except httpx.HTTPError as e:
        raise CashfreeError(f"Could not reach Cashfree Secure ID ({type(e).__name__})", 0, "network") from e
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400:
        code = data.get("code") if isinstance(data, dict) else None
        message = data.get("message") if isinstance(data, dict) else None
        raise CashfreeError(str(message or f"Cashfree Secure ID returned HTTP {r.status_code}")[:300], r.status_code, code)
    return data if isinstance(data, dict) else {}


def verify_bank_account(*, account: str, ifsc: str, name: str, phone: str | None) -> dict[str, Any]:
    body: dict[str, Any] = {"bank_account": account, "ifsc": ifsc, "name": name[:100]}
    digits = "".join(ch for ch in str(phone or "") if ch.isdigit())
    if 8 <= len(digits) <= 13:
        body["phone"] = digits
    return _request("/bank-account/sync", body)


def verify_upi(*, verification_id: str, vpa: str, name: str, consent_at: datetime) -> dict[str, Any]:
    """Rs 1 penny drop to the VPA. `consent_at` is when the pujari agreed; Cashfree wants the consent timestamp
    close to the request, so the request time is sent and the stored consent is what authorises it."""
    return _request(
        "/upi/penny-drop",
        {
            "verification_id": verification_id[:50],
            "vpa": vpa,
            "name": name[:100],
            "user_consent": {
                "obtained": True,
                "type": "EXPLICIT",
                "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
                "purpose": CONSENT_PURPOSE,
            },
        },
        api_version=UPI_API_VERSION,
    )
