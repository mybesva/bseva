"""Cashfree Payment Gateway (PG) HTTP client: orders, payments, refunds and webhook signatures.

Reference: https://www.cashfree.com/docs/api-reference/payments/latest (x-api-version 2026-01-01).
Amounts cross this boundary in paise; Cashfree takes rupees with two decimals. Errors never include keys.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
from typing import Any

import httpx

from app.config import settings

BASE_URLS = {"sandbox": "https://sandbox.cashfree.com/pg", "production": "https://api.cashfree.com/pg"}
TIMEOUT = httpx.Timeout(20.0, connect=10.0)
# Tests swap this for an httpx.MockTransport; None means the real network.
transport: httpx.BaseTransport | None = None


class CashfreeError(RuntimeError):
    """A Cashfree call failed. `status` is the HTTP status (0 = no response, e.g. timeout)."""

    def __init__(self, message: str, status: int = 0, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.code = code

    @property
    def retryable(self) -> bool:
        return self.status == 0 or self.status >= 500 or self.status == 429


def rupees(paise: int) -> float:
    return round(int(paise) / 100, 2)


def paise(amount: Any) -> int:
    return int(round(float(amount) * 100))


def _client() -> httpx.Client:
    if not settings.cashfree_pg_configured:
        raise CashfreeError("Cashfree Payment Gateway is not configured", 0, "not_configured")
    env = (settings.cashfree_pg_env or "sandbox").strip().lower()
    return httpx.Client(
        base_url=BASE_URLS[env],
        timeout=TIMEOUT,
        transport=transport,
        headers={
            "x-client-id": settings.cashfree_pg_app_id.strip(),
            "x-client-secret": settings.cashfree_pg_secret_key.strip(),
            "x-api-version": settings.cashfree_pg_api_version,
            "content-type": "application/json",
            "accept": "application/json",
        },
    )


def _request(method: str, path: str, *, json: dict | None = None) -> Any:
    try:
        with _client() as c:
            r = c.request(method, path, json=json)
    except httpx.TimeoutException as e:
        raise CashfreeError("Cashfree did not respond in time", 0, "timeout") from e
    except httpx.HTTPError as e:
        raise CashfreeError(f"Could not reach Cashfree ({type(e).__name__})", 0, "network") from e
    try:
        data = r.json()
    except ValueError:
        data = {}
    if r.status_code >= 400:
        code = data.get("code") if isinstance(data, dict) else None
        message = data.get("message") if isinstance(data, dict) else None
        raise CashfreeError(str(message or f"Cashfree returned HTTP {r.status_code}")[:300], r.status_code, code)
    return data


def create_order(
    *,
    order_id: str,
    amount_paise: int,
    currency: str,
    customer_id: str,
    customer_phone: str,
    customer_email: str | None,
    customer_name: str | None,
    return_url: str,
    notify_url: str | None,
    expiry_iso: str,
    note: str,
    tags: dict[str, str],
) -> dict:
    customer: dict[str, Any] = {"customer_id": customer_id, "customer_phone": customer_phone}
    if customer_email:
        customer["customer_email"] = customer_email
    if customer_name and len(customer_name.strip()) >= 3:
        customer["customer_name"] = customer_name.strip()[:100]
    meta: dict[str, Any] = {"return_url": return_url}
    if notify_url:
        meta["notify_url"] = notify_url
    body = {
        "order_id": order_id,
        "order_amount": rupees(amount_paise),
        "order_currency": currency,
        "customer_details": customer,
        "order_meta": meta,
        "order_expiry_time": expiry_iso,
        "order_note": note[:200],
        "order_tags": tags,
    }
    # order_id is unique at Cashfree, so a retried create can never open a second order for one attempt.
    return _request("POST", "/orders", json=body)


def get_order(order_id: str) -> dict:
    return _request("GET", f"/orders/{order_id}")


def get_order_payments(order_id: str) -> list[dict]:
    data = _request("GET", f"/orders/{order_id}/payments")
    return data if isinstance(data, list) else []


def terminate_order(order_id: str) -> dict:
    return _request("PATCH", f"/orders/{order_id}", json={"order_status": "TERMINATED"})


def create_refund(*, order_id: str, refund_id: str, amount_paise: int, note: str) -> dict:
    body = {"refund_amount": rupees(amount_paise), "refund_id": refund_id, "refund_note": note[:100] or "Refund"}
    return _request("POST", f"/orders/{order_id}/refunds", json=body)


def get_refund(order_id: str, refund_id: str) -> dict:
    return _request("GET", f"/orders/{order_id}/refunds/{refund_id}")


def eligible_payment_methods(amount_paise: int) -> list[dict]:
    data = _request("POST", "/eligibility/payment_methods", json={"queries": {"amount": rupees(amount_paise)}})
    return data if isinstance(data, list) else []


def webhook_signature(timestamp: str, raw_body: bytes, secret: str) -> str:
    mac = hmac.new(secret.encode(), timestamp.encode() + raw_body, hashlib.sha256).digest()
    return base64.b64encode(mac).decode()


def webhook_signature_variant(timestamp: str | None, signature: str | None, raw_body: bytes) -> str | None:
    """Which documented form the signature matches, or None when it matches neither.

    Cashfree's page gives Base64(HMAC-SHA256(timestamp + raw body)) keyed with the PG secret in every code
    sample ("plain"), but its pseudocode joins them with "." ("dot"). Both need our secret, so accepting either
    is no weaker; the matched form is logged so real sandbox deliveries settle which one Cashfree sends."""
    secret = settings.cashfree_pg_secret_key.strip()
    if not (secret and timestamp and signature):
        return None
    given = signature.strip()
    if hmac.compare_digest(webhook_signature(timestamp, raw_body, secret), given):
        return "plain"
    if hmac.compare_digest(webhook_signature(timestamp + ".", raw_body, secret), given):
        return "dot"
    return None


def verify_webhook(timestamp: str | None, signature: str | None, raw_body: bytes) -> bool:
    return webhook_signature_variant(timestamp, signature, raw_body) is not None
