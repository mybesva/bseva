"""Payment, refund and payout checks against a real PostgreSQL database.

Run by tests/test_payments_pg.py in a subprocess whose DATABASE_URL points at a throwaway database built by
the real deploy step plus the demo seed, with mail and every gateway credential blanked. The Cashfree HTTP
APIs are replaced in-process by FakeCashfree (MOCKED: no network). Usage: python tests/payments_pg_checks.py <check>
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import sys
import threading
import time
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db import engine  # noqa: E402
from app.mail import senders, smtp_client  # noqa: E402
from app.main import app  # noqa: E402
from app.security import create_access_token  # noqa: E402

SENT: list[dict] = []


def _fake_send(**kw):
    SENT.append(kw)
    return {"ok": True, "status": "sent", "to": kw.get("to")}


smtp_client.send_email = _fake_send
senders.send_email = _fake_send
client = TestClient(app)


def sql(statement: str, **params):
    with engine.begin() as conn:
        return conn.execute(text(statement), params)


def one(statement: str, **params):
    return sql(statement, **params).mappings().first()


def user(email: str) -> dict:
    return dict(one("SELECT * FROM users WHERE email = :e", e=email))


def token(email: str) -> str:
    u = user(email)
    return create_access_token(str(u["id"]), u["role"], u["password_hash"], mfa=u["role"] == "super_admin")


def _reset_booking_limits() -> None:
    # Checks create many bookings for one test customer; the per-customer booking caps (rate_limit.USER_ACTIONS)
    # are covered by their own tests, so they start fresh before each booking here.
    sql(
        "DO $$ BEGIN IF to_regclass('security_rate_limits') IS NOT NULL THEN "
        "DELETE FROM security_rate_limits WHERE bucket IN ('user_booking_hour', 'user_booking_day'); END IF; END $$"
    )


def call(method: str, path: str, email: str | None = None, body: dict | None = None, headers: dict | None = None):
    if method == "POST" and path == "/bookings":
        _reset_booking_limits()
    h = {"x-real-ip": "198.51.100.20", **(headers or {})}
    if email:
        h["Authorization"] = f"Bearer {token(email)}"
    return client.request(method, f"/api/v1{path}", json=body, headers=h)


CUSTOMER = "customer1@bseva.test"
PUJARI = "pujari1@bseva.test"
SUPER = "super@bseva.test"


def service() -> dict:
    return dict(one("SELECT * FROM services WHERE slug = 'rudrabhishek-group'"))


def prepare_catalogue() -> dict:
    """Pujari 1 verified for one priced puja near Indiranagar, so a booking there finds them."""
    svc = service()
    pujari = user(PUJARI)
    sql(
        """
        INSERT INTO pujari_verified_services (pujari_id, service_id) VALUES (CAST(:p AS uuid), CAST(:s AS uuid))
        ON CONFLICT DO NOTHING
        """,
        p=str(pujari["id"]),
        s=str(svc["id"]),
    )
    return svc


def set_wallet(email: str, paise: int) -> None:
    sql("UPDATE wallets SET balance_paise = :b WHERE user_id = CAST(:u AS uuid)", b=paise, u=str(user(email)["id"]))


def wallet(email: str) -> int:
    return int(one("SELECT balance_paise FROM wallets WHERE user_id = CAST(:u AS uuid)", u=str(user(email)["id"]))["balance_paise"])


def booking_body(svc: dict, **extra) -> dict:
    day = date.today() + timedelta(days=5 + (uuid.uuid4().int % 40))
    return {
        "service_id": str(svc["id"]),
        "package_type": "basic",
        "mode": "in_person",
        "booking_date": day.isoformat(),
        "start_time": "10:00",
        "location_label": "Indiranagar, Bengaluru",
        "address": "12 Test Street, Indiranagar",
        "city": "Bengaluru",
        "latitude": 12.9784,
        "longitude": 77.6408,
        "terms_accepted": True,
        **extra,
    }


def expect(cond: bool, message: str) -> None:
    if not cond:
        raise AssertionError(message)


# ---------------------------------------------------------------- wallet (existing behaviour)


def check_wallet_booking_unchanged():
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    before = wallet(CUSTOMER)
    key = f"wallet-{uuid.uuid4().hex}"
    body = booking_body(svc, idempotency_key=key)
    r = call("POST", "/bookings", CUSTOMER, body, {"Idempotency-Key": key})
    expect(r.status_code == 200, f"wallet booking failed: {r.status_code} {r.text[:400]}")
    out = r.json()
    expect(out["status"] == "confirmed", f"status {out['status']}")
    total = int(out["total_paise"])
    expect(wallet(CUSTOMER) == before - total, "wallet not debited exactly once")
    b = one("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)", id=out["id"])
    expect(b["payment_status"] == "paid" and b["status"] == "pending_acceptance", f"booking {b['status']}/{b['payment_status']}")
    pays = sql("SELECT provider, status, amount_paise FROM payments WHERE booking_id = CAST(:id AS uuid)", id=out["id"]).mappings().all()
    expect(len(pays) == 1 and pays[0]["provider"] == "wallet" and pays[0]["status"] == "successful", f"payments {pays}")
    expect(int(pays[0]["amount_paise"]) == total, "payment amount")
    offers = one("SELECT COUNT(*) AS n FROM booking_pujari_offers WHERE booking_id = CAST(:id AS uuid)", id=out["id"])["n"]
    expect(offers >= 1, "no pujari offer created for a paid wallet booking")
    replay = call("POST", "/bookings", CUSTOMER, body, {"Idempotency-Key": key})
    expect(replay.status_code == 200 and replay.json()["id"] == out["id"], "idempotent replay changed")
    expect(wallet(CUSTOMER) == before - total, "replay debited the wallet again")


def check_wallet_insufficient_balance():
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 100)
    r = call("POST", "/bookings", CUSTOMER, booking_body(svc))
    expect(r.status_code == 400 and "Insufficient" in r.text, f"expected insufficient balance, got {r.status_code} {r.text[:200]}")


def check_wallet_cancel_refunds_to_wallet():
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    out = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()
    after_booking = wallet(CUSTOMER)
    r = call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER)
    expect(r.status_code == 200, f"cancel failed {r.status_code} {r.text[:300]}")
    refund = int(r.json()["refund_paise"])
    expect(refund > 0, "expected a refund")
    expect(wallet(CUSTOMER) == after_booking + refund, "wallet refund amount")
    again = call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER)
    expect(again.status_code == 400, "second cancel accepted")
    expect(wallet(CUSTOMER) == after_booking + refund, "second cancel refunded again")


# ---------------------------------------------------------------- MOCKED Cashfree (PG + Payouts)

import httpx  # noqa: E402

from app.config import settings  # noqa: E402
from app.payments import cashfree_pg  # noqa: E402
from app.payments import service as pay_service  # noqa: E402
from app.payouts import cashfree_payouts  # noqa: E402

PG_SECRET = "fake-pg-secret-for-local-tests"
PAYOUT_SECRET = "fake-payout-secret-for-local-tests"


class FakeCashfree:
    """In-memory Cashfree PG and Payouts. Knobs: `timeouts` (endpoint keys that time out once, after doing the
    work if `timeout_after_work`), transfer/refund outcomes per id."""

    def __init__(self):
        self.lock = threading.Lock()
        self.orders: dict[str, dict] = {}
        self.payments: dict[str, list[dict]] = {}
        self.refunds: dict[tuple[str, str], dict] = {}
        self.refund_creates = 0
        self.beneficiaries: dict[str, dict] = {}
        self.transfers: dict[str, dict] = {}
        self.transfer_creates = 0
        self.timeouts: set[str] = set()
        self.timeout_after_work = False
        self.next_transfer_status = "SUCCESS"
        self.refund_status = "SUCCESS"

    def _maybe_timeout(self, key: str, before: bool):
        if key in self.timeouts and self.timeout_after_work != before:
            self.timeouts.discard(key)
            raise httpx.ReadTimeout("simulated timeout")

    def handler(self, request: httpx.Request) -> httpx.Response:
        with self.lock:
            return self._handle(request)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        path, method = request.url.path, request.method
        body = json.loads(request.content or b"{}") if request.content else {}
        parts = path.strip("/").split("/")
        if parts[0] == "pg":
            assert request.headers.get("x-client-secret") == PG_SECRET
            if parts[1:] == ["orders"] and method == "POST":
                oid = body["order_id"]
                if oid in self.orders:
                    return httpx.Response(409, json={"code": "order_already_exists", "message": "exists"})
                self.orders[oid] = {**body, "order_status": "ACTIVE", "cf_order_id": f"cf{len(self.orders) + 1}",
                                    "payment_session_id": f"session_{oid}"}
                self.payments[oid] = []
                return httpx.Response(200, json=self.orders[oid])
            if parts[1] == "orders" and len(parts) == 3:
                oid = parts[2]
                if oid not in self.orders:
                    return httpx.Response(404, json={"message": "order not found"})
                if method == "PATCH":
                    if self.orders[oid]["order_status"] == "ACTIVE":
                        self.orders[oid]["order_status"] = "TERMINATED"
                return httpx.Response(200, json=self.orders[oid])
            if parts[1] == "orders" and parts[3:] == ["payments"]:
                # Like Cashfree: newest attempt first.
                return httpx.Response(200, json=list(reversed(self.payments.get(parts[2], []))))
            if parts[1] == "orders" and parts[3] == "refunds":
                oid = parts[2]
                if method == "POST":
                    self._maybe_timeout("refund", before=True)
                    key = (oid, body["refund_id"])
                    if key in self.refunds:
                        return httpx.Response(409, json={"code": "refund_already_exists", "message": "exists"})
                    paid = sum(int(round(p["payment_amount"] * 100)) for p in self.payments[oid] if p["payment_status"] == "SUCCESS")
                    done = sum(int(round(r["refund_amount"] * 100)) for (o, _), r in self.refunds.items() if o == oid)
                    if int(round(body["refund_amount"] * 100)) + done > paid:
                        return httpx.Response(400, json={"code": "refund_amount_invalid", "message": "exceeds"})
                    self.refunds[key] = {**body, "order_id": oid, "refund_status": self.refund_status,
                                         "cf_refund_id": f"cfr{len(self.refunds) + 1}"}
                    self.refund_creates += 1
                    self._maybe_timeout("refund", before=False)
                    return httpx.Response(200, json=self.refunds[key])
                key = (oid, parts[4])
                if key not in self.refunds:
                    return httpx.Response(404, json={"message": "refund not found"})
                return httpx.Response(200, json=self.refunds[key])
            if parts[1] == "eligibility":
                return httpx.Response(200, json=[{"entity_value": "upi", "eligibility": True, "entity_type": "payment_methods"}])
        if parts[0] == "payout":
            assert request.headers.get("x-client-secret") == PAYOUT_SECRET
            if parts[1] == "beneficiary":
                if method == "POST":
                    bid = body["beneficiary_id"]
                    if bid in self.beneficiaries:
                        return httpx.Response(409, json={"message": "exists"})
                    # Like the real sandbox: one beneficiary per bank account + IFSC, whatever the id.
                    inst = body.get("beneficiary_instrument_details") or {}
                    if inst.get("bank_account_number") and any(
                        (b.get("beneficiary_instrument_details") or {}) == inst for b in self.beneficiaries.values()
                    ):
                        return httpx.Response(409, json={"code": "conflict_with_existing_beneficiary", "message": "exists"})
                    self.beneficiaries[bid] = {**body, "beneficiary_status": "VERIFIED"}
                    return httpx.Response(201, json=self.beneficiaries[bid])
                q = request.url.params
                if q.get("bank_account_number"):
                    want = {"bank_account_number": q["bank_account_number"], "bank_ifsc": q.get("bank_ifsc")}
                    hit = [b for b in self.beneficiaries.values() if b.get("beneficiary_instrument_details") == want]
                    return httpx.Response(200, json=hit[0]) if hit else httpx.Response(404, json={})
                bid = q.get("beneficiary_id")
                return httpx.Response(200, json=self.beneficiaries[bid]) if bid in self.beneficiaries else httpx.Response(404, json={})
            if parts[1] == "transfers":
                if method == "POST":
                    self._maybe_timeout("transfer", before=True)
                    tid = body["transfer_id"]
                    if not re.fullmatch(r"[A-Za-z0-9 ]{1,70}", body.get("transfer_remarks") or ""):
                        return httpx.Response(400, json={"code": "transfer_remarks_invalid", "message": "invalid remarks"})
                    if tid in self.transfers:
                        return httpx.Response(409, json={"code": "DUPLICATE_TRANSFER", "message": "duplicate"})
                    self.transfers[tid] = {**body, "status": self.next_transfer_status, "cf_transfer_id": f"cft{len(self.transfers) + 1}",
                                           "transfer_utr": f"UTR{len(self.transfers) + 1:08d}" if self.next_transfer_status == "SUCCESS" else None}
                    self.transfer_creates += 1
                    self._maybe_timeout("transfer", before=False)
                    return httpx.Response(200, json=self.transfers[tid])
                tid = request.url.params.get("transfer_id")
                return httpx.Response(200, json=self.transfers[tid]) if tid in self.transfers else httpx.Response(404, json={"message": "not found"})
        return httpx.Response(404, json={"message": f"fake: no route {method} {path}"})

    # Simulated customer / bank actions
    def pay(self, order_id: str, status: str = "SUCCESS", amount: float | None = None, currency: str | None = None):
        with self.lock:
            o = self.orders[order_id]
            n = len(self.payments[order_id]) + 1
            self.payments[order_id].append({
                "cf_payment_id": f"{order_id}-p{n}", "payment_status": status,
                "payment_amount": o["order_amount"] if amount is None else amount,
                "payment_currency": currency or o["order_currency"], "payment_group": "upi",
                "payment_message": "simulated",
                "payment_time": (datetime(2026, 1, 1) + timedelta(seconds=time.time() % 86400 + n)).isoformat(),
            })
            if status == "SUCCESS":
                o["order_status"] = "PAID"

    def set_payment(self, order_id: str, index: int, status: str):
        with self.lock:
            self.payments[order_id][index]["payment_status"] = status
            if status == "SUCCESS":
                self.orders[order_id]["order_status"] = "PAID"

    def expire(self, order_id: str):
        with self.lock:
            if self.orders[order_id]["order_status"] == "ACTIVE":
                self.orders[order_id]["order_status"] = "EXPIRED"


FAKE = FakeCashfree()


def enable_cashfree(fake: FakeCashfree | None = None) -> FakeCashfree:
    global FAKE
    FAKE = fake or FakeCashfree()
    transport = httpx.MockTransport(FAKE.handler)
    cashfree_pg.transport = transport
    cashfree_payouts.transport = transport
    settings.payment_gateway = "cashfree"
    settings.cashfree_pg_env = "sandbox"
    settings.cashfree_pg_app_id = "TEST_fake_app"
    settings.cashfree_pg_secret_key = PG_SECRET
    settings.cashfree_payout_env = "sandbox"
    settings.cashfree_payout_client_id = "TEST_fake_payout"
    settings.cashfree_payout_client_secret = PAYOUT_SECRET
    settings.cashfree_payout_public_key = ""
    settings.cashfree_payout_public_key_file = ""
    sql("UPDATE users SET phone = '9000000003' WHERE email = :e AND (phone IS NULL OR phone = '')", e=CUSTOMER)
    return FAKE


def webhook(order_id: str, event: str = "PAYMENT_SUCCESS_WEBHOOK", *, secret: str = PG_SECRET, stamp: str | None = None,
            extra: dict | None = None, path: str = "/payments/webhooks/cashfree"):
    payload = {"type": event, "event_time": datetime.utcnow().isoformat(), "data": {"order": {"order_id": order_id}, **(extra or {})}}
    raw = json.dumps(payload).encode()
    ts = stamp or str(int(time.time() * 1000))
    sig = base64.b64encode(hmac.new(secret.encode(), ts.encode() + raw, hashlib.sha256).digest()).decode()
    return client.post(f"/api/v1{path}", content=raw, headers={"x-webhook-timestamp": ts, "x-webhook-signature": sig,
                                                             "content-type": "application/json"})


def online_booking(svc: dict | None = None, **extra) -> dict:
    svc = svc or prepare_catalogue()
    r = call("POST", "/bookings", CUSTOMER, booking_body(svc, payment_method="cashfree", **extra))
    expect(r.status_code == 200, f"online booking failed: {r.status_code} {r.text[:400]}")
    return r.json()


def bk(booking_id: str) -> dict:
    return dict(one("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)", id=booking_id))


def count(statement: str, **params) -> int:
    return int(sql(statement, **params).scalar() or 0)


def offers(booking_id: str) -> int:
    return count("SELECT COUNT(*) FROM booking_pujari_offers WHERE booking_id = CAST(:id AS uuid)", id=booking_id)


def created_notices(booking_id: str) -> int:
    return count(
        "SELECT COUNT(*) FROM notifications WHERE title = 'Booking Created' AND link LIKE '%' || :id || '%'", id=booking_id
    )


# ---------------------------------------------------------------- gateway checkout (MOCKED Cashfree)


def check_online_booking_waits_for_payment():
    enable_cashfree()
    set_wallet(CUSTOMER, 0)
    out = online_booking()
    expect(out["status"] == "awaiting_payment" and out["payment_required"], f"response {out['status']}")
    sess = out["payment"]
    expect(sess["payment_session_id"] and sess["environment"] == "sandbox", "no checkout session")
    order = FAKE.orders[sess["order_id"]]
    expect(int(round(order["order_amount"] * 100)) == int(out["total_paise"]) and order["order_currency"] == "INR", "order amount")
    expect(order["order_meta"]["return_url"].startswith("https://bseva.example/payment/return?booking_id="), "return url")
    expect(order["order_meta"]["notify_url"] == "https://bseva.example/api/v1/payments/webhooks/cashfree", "notify url")
    b = bk(out["id"])
    expect(b["status"] == "awaiting_payment" and b["payment_status"] == "pending" and b["finalized_at"] is None, "booking state")
    expect(offers(out["id"]) == 0 and created_notices(out["id"]) == 0, "offers/notices sent before payment")
    expect(wallet(CUSTOMER) == 0, "wallet touched")
    expect(count("SELECT COUNT(*) FROM invoices WHERE booking_id = CAST(:id AS uuid)", id=out["id"]) == 0
           if one("SELECT to_regclass('invoices') AS t")["t"] else True, "invoice before payment")
    # A client-side "success" is not trusted: the status endpoint asks Cashfree, which says not paid.
    st = call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER).json()
    expect(not st["paid"] and st["booking_status"] == "awaiting_payment", f"status {st}")
    # Pujari list does not show it.
    pl = call("GET", "/bookings", PUJARI)
    expect(out["id"] not in pl.text, "pujari can see an unpaid booking")


def check_verified_webhook_confirms_exactly_once():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    first = webhook(oid)
    expect(first.status_code == 200 and first.json()["outcome"] == "confirmed", f"webhook {first.status_code} {first.text}")
    b = bk(out["id"])
    expect(b["payment_status"] == "paid" and b["status"] == "pending_acceptance" and b["finalized_at"], "not confirmed")
    n_offers = offers(out["id"])
    expect(n_offers >= 1 and created_notices(out["id"]) == 1, f"offers {n_offers} notices {created_notices(out['id'])}")
    stamp = first.request.headers["x-webhook-timestamp"]
    dup = webhook(oid, stamp=stamp)
    expect(dup.status_code == 200, "redelivery refused")
    again = webhook(oid)  # new delivery id, same payment
    expect(again.status_code == 200 and again.json()["outcome"] == "unchanged", f"second event {again.text}")
    call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER)
    pay_service.reconcile_open_payments(__import__("app.db", fromlist=["SessionLocal"]).SessionLocal())
    expect(offers(out["id"]) == n_offers and created_notices(out["id"]) == 1, "side effects repeated")
    pays = sql("SELECT status, provider, provider_payment_id FROM payments WHERE booking_id = CAST(:id AS uuid)", id=out["id"]).mappings().all()
    expect(len(pays) == 1 and pays[0]["status"] == "successful" and pays[0]["provider"] == "cashfree", f"payments {pays}")


def check_invalid_or_forged_webhooks_change_nothing():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    bad = webhook(oid, secret="wrong-secret")
    expect(bad.status_code == 401, f"bad signature accepted {bad.status_code}")
    tampered = client.post("/api/v1/payments/webhooks/cashfree", content=b'{"type":"PAYMENT_SUCCESS_WEBHOOK"}',
                           headers={"x-webhook-timestamp": "1", "x-webhook-signature": "abc"})
    expect(tampered.status_code == 401, "unsigned accepted")
    expect(bk(out["id"])["payment_status"] == "pending", "invalid webhook changed the booking")
    # Validly signed, but Cashfree itself says the order is unpaid: the payload is not trusted.
    out2 = online_booking()
    claim = webhook(out2["payment"]["order_id"], extra={"payment": {"payment_status": "SUCCESS", "payment_amount": 1}})
    expect(claim.status_code == 200 and bk(out2["id"])["payment_status"] == "pending", "payload trusted over API")
    unknown = webhook("BSV-NOT-OURS-1")
    expect(unknown.status_code == 200 and unknown.json()["outcome"] == "unknown_order", "unknown order")


def check_amount_and_currency_mismatch_never_confirm():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS", amount=1.00)
    webhook(oid)
    b = bk(out["id"])
    p = one("SELECT status, failure_reason FROM payments WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    expect(b["payment_status"] == "pending" and p["status"] == "processing" and "mismatch" in p["failure_reason"], f"{p}")
    out2 = online_booking()
    oid2 = out2["payment"]["order_id"]
    FAKE.pay(oid2, "SUCCESS", currency="USD")
    webhook(oid2)
    expect(bk(out2["id"])["payment_status"] == "pending", "currency mismatch confirmed")
    expect(offers(out["id"]) == 0 and offers(out2["id"]) == 0, "offers sent for mismatched payment")


def check_concurrent_confirmation_runs_side_effects_once():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    results: list[int] = []

    def hit(i: int):
        c = TestClient(app)
        if i % 2:
            r = c.get(f"/api/v1/payments/bookings/{out['id']}/status", headers={"Authorization": f"Bearer {token(CUSTOMER)}"})
        else:
            payload = json.dumps({"type": "PAYMENT_SUCCESS_WEBHOOK", "data": {"order": {"order_id": oid}}, "n": i}).encode()
            ts = str(1000 + i)
            sig = base64.b64encode(hmac.new(PG_SECRET.encode(), ts.encode() + payload, hashlib.sha256).digest()).decode()
            r = c.post("/api/v1/payments/webhooks/cashfree", content=payload, headers={"x-webhook-timestamp": ts, "x-webhook-signature": sig})
        results.append(r.status_code)

    threads = [threading.Thread(target=hit, args=(i,)) for i in range(10)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    expect(all(s == 200 for s in results), f"statuses {results}")
    expect(bk(out["id"])["payment_status"] == "paid", "not paid")
    expect(created_notices(out["id"]) == 1, f"notices {created_notices(out['id'])}")
    expect(count("SELECT COUNT(*) FROM notifications WHERE category = 'payment' AND link LIKE '%' || :id || '%'", id=out["id"]) == 1, "payment notices")


def check_failed_attempt_retry_then_success():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "FAILED")
    st = call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER).json()
    expect(not st["paid"] and st["attempt"]["provider_status"] == "FAILED", f"status {st}")
    same = call("POST", f"/payments/bookings/{out['id']}/checkout", CUSTOMER).json()
    expect(same["order_id"] == oid, "active order should be reused for a retry")
    FAKE.expire(oid)
    new = call("POST", f"/payments/bookings/{out['id']}/checkout", CUSTOMER)
    expect(new.status_code == 200 and new.json()["order_id"] != oid, f"no second attempt {new.text}")
    FAKE.pay(new.json()["order_id"], "SUCCESS")
    st = call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER).json()
    expect(st["paid"] and st["attempt"]["attempt_no"] == 2, f"retry not confirmed {st}")
    rows = sql("SELECT attempt_no, status FROM payments WHERE booking_id = CAST(:id AS uuid) ORDER BY attempt_no", id=out["id"]).all()
    expect([tuple(r) for r in rows] == [(1, "expired"), (2, "successful")], f"attempts {rows}")
    expect(call("POST", f"/payments/bookings/{out['id']}/checkout", CUSTOMER).status_code == 409, "checkout after paid")


def check_latest_attempt_decides_after_switching_method():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "PENDING")   # UPI QR opened, never paid
    FAKE.pay(oid, "FAILED")    # then a card that failed
    st = call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER).json()
    expect(not st["paid"] and st["attempt"]["status"] == "pending" and st["attempt"]["provider_status"] == "FAILED",
           f"stale pending hid the failure {st['attempt']}")
    FAKE.pay(oid, "SUCCESS")   # retry on the same order
    st = call("GET", f"/payments/bookings/{out['id']}/status", CUSTOMER).json()
    expect(st["paid"] and created_notices(out["id"]) >= 0 and count(
        "SELECT COUNT(*) FROM payments WHERE booking_id = CAST(:id AS uuid) AND status = 'successful'", id=out["id"]) == 1, f"retry {st}")


def check_account_deletion_closes_unpaid_online_bookings():
    enable_cashfree()
    svc = prepare_catalogue()
    who = "customer2@bseva.test"   # its own customer: requesting deletion deactivates the account
    sql("UPDATE users SET phone = COALESCE(NULLIF(phone, ''), '9000007701'), account_state = 'active' WHERE email = :e", e=who)
    set_wallet(who, 0)   # a wallet balance would be listed as blocking for its own reason
    # Fixed dates outside the 5-45 day range other checks pick at random, so no slot is ever already taken.
    day = lambda n: (date.today() + timedelta(days=n)).isoformat()  # noqa: E731
    unpaid = call("POST", "/bookings", who, booking_body(svc, payment_method="cashfree", booking_date=day(50))).json()
    paid = call("POST", "/bookings", who, booking_body(svc, payment_method="cashfree", booking_date=day(51))).json()
    expect("payment" in unpaid and "payment" in paid, f"online bookings not created {unpaid} {paid}")
    FAKE.pay(paid["payment"]["order_id"], "SUCCESS")   # paid at Cashfree, not yet seen by B-Seva (no webhook)
    from app import account_lifecycle

    db = _db()
    preview = account_lifecycle.obligations(db, dict(user(who)))
    kinds = {b["id"]: (b["kind"], b.get("action")) for b in preview["bookings"]}
    expect(kinds.get(unpaid["id"]) == ("unpaid", "close") and kinds.get(paid["id"]) == ("unpaid", "close"), f"preview {kinds}")
    expect(not preview["blocking"], f"unpaid bookings must not block deletion {preview['blocking']}")
    out = account_lifecycle.create_request(db, dict(user(who)), reason="no_longer_using", explanation="", source="test")
    db.close()
    expect(not out.get("already"), f"request {out}")
    # Never paid: closed, Cashfree order terminated, nothing charged or refunded.
    b = bk(unpaid["id"])
    expect(b["status"] == "cancelled" and b["cancel_policy"] == "payment_abandoned" and int(b["refund_paise"] or 0) == 0,
           f"unpaid {b['status']} {b['cancel_policy']}")
    expect(FAKE.orders[unpaid["payment"]["order_id"]]["order_status"] == "TERMINATED", "order still open at Cashfree")
    # Paid at Cashfree: verified, never closed as unpaid; cancelled under the normal policy with a gateway refund.
    pb = bk(paid["id"])
    expect(pb["status"] == "cancelled" and pb["cancel_policy"] != "payment_abandoned", f"paid booking {pb['status']} {pb['cancel_policy']}")
    r = one("SELECT kind, amount_paise FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=paid["id"])
    expect(r is not None and r["kind"] == "cancellation" and int(r["amount_paise"]) == int(pb["refund_paise"]), f"refund {r and dict(r)}")
    # A payment that still lands on the closed order is refunded in full, never revived for a deleted account.
    FAKE.pay(unpaid["payment"]["order_id"], "SUCCESS")
    res = webhook(unpaid["payment"]["order_id"]).json()
    late = one("SELECT kind, amount_paise FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=unpaid["id"])
    expect(res["outcome"] == "late_success_refunded" and bk(unpaid["id"])["status"] == "cancelled"
           and late and late["kind"] == "late_payment" and int(late["amount_paise"]) == int(unpaid["total_paise"]),
           f"late payment {res} {late and dict(late)}")
    sql("UPDATE users SET account_state = 'active', sessions_revoked_at = NULL WHERE email = :e", e=who)


def _db():
    from app.db import SessionLocal

    return SessionLocal()


def check_expiry_pending_grace_and_late_success():
    enable_cashfree()
    # 1. Nothing attempted: expires and is cancelled.
    out = online_booking()
    sql("UPDATE bookings SET payment_expires_at = NOW() - INTERVAL '1 minute' WHERE id = CAST(:id AS uuid)", id=out["id"])
    FAKE.expire(out["payment"]["order_id"])
    pay_service.expire_unpaid_bookings(_db())
    b = bk(out["id"])
    expect(b["status"] == "cancelled" and b["cancel_policy"] == "payment_expired" and b["payment_status"] == "failed", f"{b['status']}")
    # 2. UPI still pending at Cashfree: kept during the grace period.
    out2 = online_booking()
    oid2 = out2["payment"]["order_id"]
    FAKE.pay(oid2, "PENDING")
    sql("UPDATE bookings SET payment_expires_at = NOW() - INTERVAL '5 minutes' WHERE id = CAST(:id AS uuid)", id=out2["id"])
    pay_service.expire_unpaid_bookings(_db())
    expect(bk(out2["id"])["status"] == "awaiting_payment", "pending payment cancelled inside grace")
    sql("UPDATE bookings SET payment_expires_at = NOW() - INTERVAL '40 minutes' WHERE id = CAST(:id AS uuid)", id=out2["id"])
    pay_service.expire_unpaid_bookings(_db())
    expect(bk(out2["id"])["status"] == "cancelled", "not cancelled after grace")
    # 3. The pending UPI then succeeds (late success): the puja is days away, so the booking is revived once.
    FAKE.set_payment(oid2, 0, "SUCCESS")
    sql("UPDATE payments SET last_checked_at = NULL, created_at = NOW() - INTERVAL '5 minutes' WHERE booking_id = CAST(:id AS uuid)", id=out2["id"])
    res = pay_service.reconcile_open_payments(_db())
    b2 = bk(out2["id"])
    expect(b2["status"] == "pending_acceptance" and b2["payment_status"] == "paid" and b2["finalized_at"], f"late success {res} {b2['status']}")
    expect(created_notices(out2["id"]) == 1, "late success notices")


def check_late_success_after_abandon_is_refunded():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    r = call("POST", f"/payments/bookings/{out['id']}/abandon", CUSTOMER)
    expect(r.status_code == 200 and bk(out["id"])["cancel_policy"] == "payment_abandoned", f"abandon {r.text}")
    FAKE.pay(oid, "SUCCESS")  # bank completed a payment started before the customer left
    webhook(oid)
    b = bk(out["id"])
    expect(b["status"] == "cancelled" and offers(out["id"]) == 0, "abandoned booking was revived")
    refunds = sql("SELECT kind, status, amount_paise FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"]).mappings().all()
    expect(len(refunds) == 1 and refunds[0]["kind"] == "late_payment" and refunds[0]["status"] == "successful", f"{refunds}")
    expect(int(refunds[0]["amount_paise"]) == int(out["total_paise"]) and FAKE.refund_creates == 1, "refund amount/count")


def check_two_successful_attempts_refund_the_second():
    enable_cashfree()
    out = online_booking()
    oid1 = out["payment"]["order_id"]
    FAKE.pay(oid1, "PENDING")
    FAKE.expire(oid1)  # order expired with an in-flight attempt
    sql("UPDATE payments SET status = 'expired', verified_at = NOW() WHERE provider_order_id = :o", o=oid1)
    second = call("POST", f"/payments/bookings/{out['id']}/checkout", CUSTOMER).json()
    FAKE.pay(second["order_id"], "SUCCESS")
    webhook(second["order_id"])
    FAKE.set_payment(oid1, 0, "SUCCESS")  # the first one completes as well
    webhook(oid1)
    refunds = sql("SELECT kind, status FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"]).mappings().all()
    expect([(r["kind"], r["status"]) for r in refunds] == [("duplicate_payment", "successful")], f"{refunds}")
    expect(bk(out["id"])["payment_status"] == "paid" and created_notices(out["id"]) == 1, "booking state after duplicate")


def check_cancel_refunds_to_original_method_once():
    enable_cashfree()
    set_wallet(CUSTOMER, 0)
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    webhook(oid)
    FAKE.refund_status = "PENDING"
    r = call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER)
    expect(r.status_code == 200 and r.json()["refund_method"] == "cashfree", f"cancel {r.text[:300]}")
    refund = int(r.json()["refund_paise"])
    expect(wallet(CUSTOMER) == 0, "gateway booking refunded to the wallet")
    row = one("SELECT * FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    expect(row["status"] == "processing" and int(row["amount_paise"]) == refund and FAKE.refund_creates == 1, f"{row['status']}")
    expect(bk(out["id"])["payment_status"] == "refund_pending", "booking not refund_pending")
    expect(call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER).status_code == 400, "double cancel")
    FAKE.refunds[(oid, row["refund_id"])]["refund_status"] = "SUCCESS"
    wh = webhook(oid, "REFUND_STATUS_WEBHOOK", extra={"refund": {"order_id": oid, "refund_id": row["refund_id"]}})
    expect(wh.status_code == 200 and wh.json()["outcome"] == "refund_successful", f"refund webhook {wh.text}")
    final = bk(out["id"])["payment_status"]
    expect(final == ("refunded" if refund == int(out["total_paise"]) else "partial_refund"), f"payment_status {final}")
    expect(FAKE.refund_creates == 1, "refund sent twice")


def check_refund_on_hold_alerts_ops_once_and_stays_open():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    webhook(oid)
    FAKE.refund_status = "ONHOLD"
    expect(call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER).status_code == 200, "cancel")
    row = one("SELECT * FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    FAKE.refunds[(oid, row["refund_id"])]["status_description"] = "Refund on hold because of insufficient account balance"
    rid = row["refund_id"]
    seen = []
    for _ in range(3):
        sql("UPDATE refunds SET last_attempt_at = NULL WHERE refund_id = :r", r=rid)
        pay_service.submit_open_refunds(_db())
        seen.append(count("SELECT COUNT(*) FROM notifications WHERE title = 'Refund on hold' AND body LIKE '%' || :r || '%'", r=rid))
    row = one("SELECT status, provider_status FROM refunds WHERE refund_id = :r", r=rid)
    expect(row["status"] == "processing" and row["provider_status"] == "ONHOLD" and bk(out["id"])["payment_status"] == "refund_pending", f"{dict(row)}")
    expect(seen[0] > 0 and seen[0] == seen[1] == seen[2], f"on-hold alerts per check {seen} (want once)")


def check_refund_timeout_retries_with_same_id():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    webhook(oid)
    FAKE.timeouts.add("refund")
    FAKE.timeout_after_work = True  # Cashfree created it, but our client timed out
    r = call("POST", f"/bookings/{out['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER)
    expect(r.status_code == 200, r.text[:200])
    row = one("SELECT * FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    if row["status"] == "pending":
        sql("UPDATE refunds SET last_attempt_at = NOW() - INTERVAL '2 hours' WHERE id = :id", id=row["id"])
        pay_service.submit_open_refunds(_db())
        row = one("SELECT * FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    expect(row["status"] == "successful" and FAKE.refund_creates == 1, f"refund {row['status']} creates {FAKE.refund_creates}")


def check_historical_payments_route_by_stored_provider():
    enable_cashfree()
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    wallet_booking = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()  # wallet, while Cashfree is selected
    online = online_booking(svc)
    FAKE.pay(online["payment"]["order_id"], "SUCCESS")
    webhook(online["payment"]["order_id"])
    settings.payment_gateway = ""  # Cashfree switched off for new checkouts
    expect(call("POST", "/bookings", CUSTOMER, booking_body(svc, payment_method="cashfree")).status_code == 503, "checkout while off")
    before = wallet(CUSTOMER)
    r1 = call("POST", f"/bookings/{wallet_booking['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER).json()
    expect(r1["refund_method"] == "wallet" and wallet(CUSTOMER) == before + int(r1["refund_paise"]), "wallet booking refund")
    r2 = call("POST", f"/bookings/{online['id']}/cancel?reason=Plans%20changed%20for%20family", CUSTOMER).json()
    expect(r2["refund_method"] == "cashfree" and wallet(CUSTOMER) == before + int(r1["refund_paise"]), "online booking refund route")
    expect(FAKE.refund_creates == 1, "gateway refund not sent")


# ---------------------------------------------------------------- pujari payouts (MOCKED Cashfree Payouts)

MPIN = "802413"
OTP = "246810"


def _reset_otp_limits() -> None:
    # OTP send logs and rate limits differ between schema versions: clear whichever exist. Earlier Super Admin
    # action OTPs go too, so each check starts outside the resend cooldown.
    for table in ("otp_send_events", "security_rate_limits"):
        sql(f"DO $$ BEGIN IF to_regclass('{table}') IS NOT NULL THEN EXECUTE 'TRUNCATE {table}'; END IF; END $$")
    sql("DELETE FROM otp_codes WHERE purpose = 'sensitive_action'")


def _completed_settlement(amount: int = 150_000) -> dict:
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    out = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()
    pujari = user(PUJARI)
    sql(
        """
        UPDATE bookings SET pujari_id = CAST(:p AS uuid), status = 'completed', completed_at = NOW(), settlement_status = 'pending'
        WHERE id = CAST(:id AS uuid)
        """,
        p=str(pujari["id"]),
        id=out["id"],
    )
    return dict(
        one(
            """
            INSERT INTO settlements (booking_id, pujari_id, customer_payment_paise, base_puja_paise, platform_fee_paise,
              pujari_payable_paise, settlement_amount_paise, due_date, status)
            VALUES (CAST(:b AS uuid), CAST(:p AS uuid), :amt, :amt, 0, :amt, :amt, CURRENT_DATE - 1, 'pending')
            RETURNING *
            """,
            b=out["id"],
            p=str(pujari["id"]),
            amt=amount,
        )
    )


def _payout_ready(mode: str = "bank") -> None:
    from app.security import hash_password

    sql("INSERT INTO platform_settings (key, value) VALUES ('settlement_payout_mode', CAST(:v AS jsonb)) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", v=json.dumps(mode))
    sql(
        """
        UPDATE pujari_profiles SET bank_account_number = '026291800001191', bank_ifsc = 'YESB0000262',
          bank_holder_name = 'Pandit Test', upi_id = NULL
        WHERE user_id = (SELECT id FROM users WHERE email = :e)
        """,
        e=PUJARI,
    )
    su = user(SUPER)
    sql(
        """
        INSERT INTO admin_mpins (user_id, mpin_hash) VALUES (CAST(:u AS uuid), :h)
        ON CONFLICT (user_id) DO UPDATE SET mpin_hash = EXCLUDED.mpin_hash, failed_attempts = 0, locked_until = NULL
        """,
        u=str(su["id"]),
        h=hash_password(MPIN),
    )
    _reset_otp_limits()
    set_wallet(PUJARI, 0)


def _approve_payout(settlement_id: str):
    _reset_otp_limits()
    sql("UPDATE security_challenges SET consumed_at = NOW() WHERE consumed_at IS NULL")
    ch = call("POST", "/admin/security/challenge", SUPER, {"action": "settlement_payout", "settlement_id": settlement_id})
    if ch.status_code != 200:
        return ch  # refused before any OTP was sent (e.g. settled or a payout already in progress)
    return call("POST", f"/admin/payouts/settlements/{settlement_id}", SUPER,
                {"challenge_id": ch.json()["challenge_id"], "otp": OTP, "mpin": MPIN})


def check_bank_mode_sweep_never_credits_wallet():
    enable_cashfree()
    _payout_ready("bank")
    s = _completed_settlement()
    before = wallet(PUJARI)
    from app.settlement_cycle import run_due_settlements

    db = _db()
    out = run_due_settlements(db)
    db.commit()
    expect(out.get("mode") == "bank" and wallet(PUJARI) == before, f"wallet credited in bank mode {out}")
    expect(one("SELECT status FROM settlements WHERE id = :id", id=s["id"])["status"] == "eligible", "not eligible")
    _payout_ready("wallet")
    s2 = _completed_settlement(120_000)
    db = _db()
    run_due_settlements(db)
    db.commit()
    # Back in wallet mode, every due settlement (including the one left eligible above) goes to the wallet once.
    expect(wallet(PUJARI) == before + 150_000 + 120_000, "wallet mode no longer credits the wallet")
    db = _db()
    run_due_settlements(db)
    db.commit()
    expect(wallet(PUJARI) == before + 150_000 + 120_000, "a second sweep credited again")
    expect(_approve_payout(str(s2["id"])).status_code in (400, 409), "payout allowed in wallet mode / after settle")


def check_payout_success_needs_mpin_otp_and_pays_once():
    enable_cashfree()
    _payout_ready("bank")
    s = _completed_settlement()
    before = wallet(PUJARI)
    wrong = call("POST", f"/admin/payouts/settlements/{s['id']}", SUPER,
                 {"challenge_id": str(uuid.uuid4()), "otp": OTP, "mpin": MPIN})
    expect(wrong.status_code == 400 and FAKE.transfer_creates == 0, "payout without a valid challenge")
    FAKE.next_transfer_status = "PENDING"
    r = _approve_payout(str(s["id"]))
    expect(r.status_code == 200 and r.json()["status"] == "pending", f"payout {r.status_code} {r.text[:300]}")
    st = one("SELECT status FROM settlements WHERE id = :id", id=s["id"])["status"]
    expect(st == "processing", f"settlement {st} while payout pending (must not show paid)")
    expect(_approve_payout(str(s["id"])).status_code == 400 and FAKE.transfer_creates == 1, "second payout started")
    tid = one("SELECT transfer_id FROM payouts WHERE settlement_id = :id", id=s["id"])["transfer_id"]
    FAKE.transfers[tid]["status"] = "SUCCESS"
    FAKE.transfers[tid]["transfer_utr"] = "UTR00000042"
    wh = webhook("", path="/payouts/webhooks/cashfree", secret=PAYOUT_SECRET, extra={"transfer_id": tid})
    expect(wh.status_code == 200 and wh.json()["outcome"] == "successful", f"payout webhook {wh.text}")
    s_row = one("SELECT status, payment_reference FROM settlements WHERE id = :id", id=s["id"])
    expect(s_row["status"] == "settled" and s_row["payment_reference"] == "UTR00000042", f"{dict(s_row)}")
    expect(wallet(PUJARI) == before, "payout also credited the wallet")
    actions = [r[0] for r in sql("SELECT action FROM security_audit_log WHERE settlement_id = CAST(:id AS uuid) ORDER BY created_at", id=s["id"]).all()]
    expect("approved" in actions and "payout_initiated" in actions and "settled" in actions, f"audit {actions}")
    bad = webhook("", path="/payouts/webhooks/cashfree", secret="nope", extra={"transfer_id": tid})
    expect(bad.status_code == 401, "unsigned payout webhook accepted")


def check_concurrent_payout_requests_create_one_transfer():
    enable_cashfree()
    _payout_ready("bank")
    s = _completed_settlement()
    from app.payouts import service as payout_service

    results: list[str] = []

    def go():
        db = _db()
        try:
            results.append(payout_service.initiate_payout(db, user(SUPER), str(s["id"]), ip=None)["status"])
        except Exception as e:  # noqa: BLE001
            results.append(type(e).__name__)
        finally:
            db.close()

    threads = [threading.Thread(target=go) for _ in range(6)]
    [t.start() for t in threads]
    [t.join() for t in threads]
    expect(FAKE.transfer_creates == 1 and count("SELECT COUNT(*) FROM payouts WHERE settlement_id = CAST(:id AS uuid)", id=s["id"]) == 1,
           f"transfers {FAKE.transfer_creates} results {results}")


def check_payout_failure_reversal_and_timeout_recovery():
    enable_cashfree()
    _payout_ready("bank")
    from app.payouts import service as payout_service

    # Failure returns the settlement to eligible; a new approved attempt then succeeds.
    s = _completed_settlement()
    FAKE.next_transfer_status = "FAILED"
    r = _approve_payout(str(s["id"]))
    expect(r.json()["status"] == "failed", r.text)
    expect(one("SELECT status FROM settlements WHERE id = :id", id=s["id"])["status"] == "eligible", "not eligible after failure")
    FAKE.next_transfer_status = "SUCCESS"
    expect(_approve_payout(str(s["id"])).json()["status"] == "successful", "retry failed")
    # Reversal after success re-opens the settlement and is audited.
    tid = one("SELECT transfer_id FROM payouts WHERE settlement_id = :id AND status = 'successful'", id=s["id"])["transfer_id"]
    FAKE.transfers[tid]["status"] = "REVERSED"
    payout_service.refresh_payout(_db(), payout_service.payout_by_transfer(_db(), tid))
    expect(one("SELECT status FROM settlements WHERE id = :id", id=s["id"])["status"] == "eligible", "reversal not applied")
    expect(count("SELECT COUNT(*) FROM security_audit_log WHERE action = 'payout_reversed' AND settlement_id = CAST(:id AS uuid)", id=s["id"]) == 1, "reversal audit")
    # Timeout before Cashfree saw it: stays initiated, recovery resends the same transfer id once.
    s2 = _completed_settlement(90_000)
    FAKE.timeouts.add("transfer")
    FAKE.timeout_after_work = False
    r2 = _approve_payout(str(s2["id"]))
    expect(r2.json()["status"] == "initiated" and FAKE.transfers == {k: v for k, v in FAKE.transfers.items()}, r2.text)
    creates = FAKE.transfer_creates
    sql("UPDATE payouts SET created_at = NOW() - INTERVAL '5 minutes', last_checked_at = NULL WHERE settlement_id = :id", id=s2["id"])
    payout_service.recover_payouts(_db())
    p2 = one("SELECT status, transfer_id FROM payouts WHERE settlement_id = :id", id=s2["id"])
    expect(p2["status"] == "successful" and FAKE.transfer_creates == creates + 1, f"recovery {p2['status']}")
    # Timeout after Cashfree accepted it: recovery reads it back, never sends a second transfer.
    s3 = _completed_settlement(80_000)
    FAKE.timeouts.add("transfer")
    FAKE.timeout_after_work = True
    expect(_approve_payout(str(s3["id"])).json()["status"] == "initiated", "timeout state")
    creates = FAKE.transfer_creates
    sql("UPDATE payouts SET created_at = NOW() - INTERVAL '5 minutes', last_checked_at = NULL WHERE settlement_id = :id", id=s3["id"])
    payout_service.recover_payouts(_db())
    expect(one("SELECT status FROM payouts WHERE settlement_id = :id", id=s3["id"])["status"] == "successful"
           and FAKE.transfer_creates == creates, "duplicate transfer after timeout")


def check_payout_otp_bound_to_bank_details_and_override_blocked():
    enable_cashfree()
    _payout_ready("bank")
    s = _completed_settlement()
    _reset_otp_limits()
    ch = call("POST", "/admin/security/challenge", SUPER, {"action": "settlement_payout", "settlement_id": str(s["id"])}).json()
    sql("UPDATE pujari_profiles SET bank_account_number = '1233943142', bank_ifsc = 'ICIC0000009' WHERE user_id = (SELECT id FROM users WHERE email = :e)", e=PUJARI)
    r = call("POST", f"/admin/payouts/settlements/{s['id']}", SUPER, {"challenge_id": ch["challenge_id"], "otp": OTP, "mpin": MPIN})
    expect(r.status_code == 400 and "changed" in r.text and FAKE.transfer_creates == 0, f"details change not caught {r.text}")
    FAKE.next_transfer_status = "PENDING"
    expect(_approve_payout(str(s["id"])).json()["status"] == "pending", "payout")
    _reset_otp_limits()
    ov = call("POST", "/admin/security/challenge", SUPER, {"action": "settlement_override", "settlement_id": str(s["id"])})
    expect(ov.status_code == 400 and "in progress" in ov.text, f"override allowed during payout {ov.text}")


def check_payout_reuses_cashfree_beneficiary_for_same_bank_account():
    enable_cashfree()
    _payout_ready("bank")
    # Cashfree already holds this account under another id (e.g. an earlier registration): reused, paid once,
    # and the id Cashfree uses replaces the one stored on an older, superseded row for the same details.
    sql("UPDATE payout_beneficiaries SET status = 'superseded' WHERE pujari_id = (SELECT id FROM users WHERE email = :e)", e=PUJARI)
    FAKE.beneficiaries["EARLIER_ID"] = {
        "beneficiary_id": "EARLIER_ID", "beneficiary_status": "VERIFIED",
        "beneficiary_instrument_details": {"bank_account_number": "026291800001191", "bank_ifsc": "YESB0000262"},
    }
    s = _completed_settlement()
    r = _approve_payout(str(s["id"]))
    expect(r.status_code == 200 and r.json()["status"] == "successful", f"payout {r.status_code} {r.text[:300]}")
    tr = next(iter(FAKE.transfers.values()))
    expect(tr["beneficiary_details"]["beneficiary_id"] == "EARLIER_ID" and FAKE.transfer_creates == 1, "existing beneficiary not reused")
    stored = one("SELECT beneficiary_id FROM payout_beneficiaries WHERE status = 'active' AND pujari_id = (SELECT id FROM users WHERE email = :e)", e=PUJARI)
    expect(stored["beneficiary_id"] == "EARLIER_ID", f"stored beneficiary {stored}")
    # A second pujari with the same bank account is refused before any transfer.
    other = one("SELECT u.id FROM users u JOIN pujari_profiles p ON p.user_id = u.id WHERE u.email <> :e ORDER BY u.email LIMIT 1", e=PUJARI)
    sql("UPDATE pujari_profiles SET bank_account_number = '026291800001191', bank_ifsc = 'YESB0000262', bank_holder_name = 'Other' "
        "WHERE user_id = CAST(:u AS uuid)", u=str(other["id"]))
    s2 = _completed_settlement(90_000)
    sql("UPDATE settlements SET pujari_id = CAST(:u AS uuid) WHERE id = CAST(:id AS uuid)", u=str(other["id"]), id=s2["id"])
    sql("UPDATE bookings SET pujari_id = CAST(:u AS uuid) WHERE id = CAST(:b AS uuid)", u=str(other["id"]), b=s2["booking_id"])
    r2 = _approve_payout(str(s2["id"]))
    expect(r2.status_code == 409 and "another pujari" in r2.text and FAKE.transfer_creates == 1, f"shared account paid {r2.status_code} {r2.text[:200]}")
    st = one("SELECT status FROM settlements WHERE id = :id", id=s2["id"])["status"]
    expect(st in ("pending", "eligible"), f"settlement left {st} after refusal")


def check_penalty_kept_back_once_across_pending_payouts():
    enable_cashfree()
    _payout_ready("bank")
    set_wallet(PUJARI, -20_000)
    FAKE.next_transfer_status = "PENDING"
    s1 = _completed_settlement(120_000)
    expect(_approve_payout(str(s1["id"])).json()["status"] == "pending", "first payout")
    expect(one("SELECT penalty_recovered_paise FROM payouts WHERE settlement_id = :id", id=s1["id"])["penalty_recovered_paise"] == 20_000, "first keeps the debt")
    FAKE.next_transfer_status = "SUCCESS"
    s2 = _completed_settlement(100_000)
    expect(_approve_payout(str(s2["id"])).json()["status"] == "successful", "second payout")
    p2 = one("SELECT amount_paise, penalty_recovered_paise FROM payouts WHERE settlement_id = :id", id=s2["id"])
    expect(p2["penalty_recovered_paise"] == 0 and p2["amount_paise"] == 100_000, f"debt kept back twice {dict(p2)}")
    from app.payouts import service as payout_service
    tid = one("SELECT transfer_id FROM payouts WHERE settlement_id = :id", id=s1["id"])["transfer_id"]
    FAKE.transfers[tid]["status"] = "SUCCESS"
    payout_service.refresh_payout(_db(), payout_service.payout_by_transfer(_db(), tid))
    expect(wallet(PUJARI) == 0, f"wallet {wallet(PUJARI)} after both payouts (debt repaid exactly once)")


# ---------------------------------------------------------------- follow-up rules


def _set_setting(key: str, value) -> None:
    sql("INSERT INTO platform_settings (key, value) VALUES (:k, CAST(:v AS jsonb)) "
        "ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value", k=key, v=json.dumps(value))


def check_gateway_fee_setting_applies_to_new_bookings_only():
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    _set_setting("payment_gateway_name", "Razorpay")
    _set_setting("payment_gateway_fee_percent", 2)
    old = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()
    from app.invoice_docs import issue_paid_booking_invoice

    db = _db()
    issue_paid_booking_invoice(db, dict(bk(old["id"])))
    db.close()
    inv_before = one("SELECT snapshot, total_paise FROM invoices WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'", id=old["id"])
    expect(inv_before is not None, "invoice not issued")
    # Super Admin changes the fee (any value; nothing in code assumes Cashfree's rate).
    expect(call("PUT", "/admin/config", SUPER, {"key": "payment_gateway_fee_percent", "value": 1.75}).status_code == 200, "fee update")
    expect(call("PUT", "/admin/config", SUPER, {"key": "payment_gateway_name", "value": "Cashfree"}).status_code == 200, "name update")
    quote = call("GET", f"/quote?service_id={svc['id']}&package_type=basic&city=Bengaluru", CUSTOMER).json()
    expect(float(quote["gatewayFeePercent"]) == 1.75 and quote["gatewayName"] == "Cashfree", f"quote {quote.get('gatewayFeePercent')}")
    new = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()
    nb, ob = bk(new["id"]), bk(old["id"])
    expect(float(nb["gateway_fee_percent"]) == 1.75 and nb["gateway_name"] == "Cashfree", "new booking ignored the setting")
    expect(float(ob["gateway_fee_percent"]) == 2 and ob["gateway_name"] == "Razorpay", "old booking snapshot changed")
    inv_after = one("SELECT snapshot, total_paise FROM invoices WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'", id=old["id"])
    expect(inv_after["snapshot"] == inv_before["snapshot"] and inv_after["total_paise"] == inv_before["total_paise"], "old invoice changed")
    expect(inv_before["snapshot"]["fees"]["gateway_name"] == "Razorpay", "invoice fee snapshot")
    _set_setting("payment_gateway_name", "Razorpay")
    _set_setting("payment_gateway_fee_percent", 2)


def _expired_online_booking() -> tuple[dict, str]:
    out = online_booking()
    oid = out["payment"]["order_id"]
    sql("UPDATE bookings SET payment_expires_at = NOW() - INTERVAL '1 minute' WHERE id = CAST(:id AS uuid)", id=out["id"])
    FAKE.expire(oid)
    pay_service.expire_unpaid_bookings(_db())
    expect(bk(out["id"])["cancel_policy"] == "payment_expired", "not expired")
    return out, oid


def check_late_success_revives_only_if_still_eligible():
    enable_cashfree()
    svc = prepare_catalogue()
    # 1. No eligible pujari covers the address any more: refunded, not revived.
    out, oid = _expired_online_booking()
    sql("DELETE FROM pujari_verified_services WHERE service_id = CAST(:s AS uuid)", s=str(svc["id"]))
    FAKE.set_payment(oid, 0, "SUCCESS") if FAKE.payments[oid] else FAKE.pay(oid, "SUCCESS")
    res = webhook(oid).json()
    b = bk(out["id"])
    expect(b["status"] == "cancelled" and res["outcome"] == "late_success_refunded", f"revived without a pujari {res}")
    r = one("SELECT kind, status, reason FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out["id"])
    expect(r["kind"] == "late_payment" and "no_eligible_pujari_in_area" in r["reason"], f"refund {dict(r)}")
    prepare_catalogue()
    # 2. Now inside the puja's booking notice: refunded.
    out2, oid2 = _expired_online_booking()
    sql("UPDATE bookings SET booking_date = CURRENT_DATE + 1 WHERE id = CAST(:id AS uuid)", id=out2["id"])
    FAKE.pay(oid2, "SUCCESS")
    webhook(oid2)
    r2 = one("SELECT reason FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out2["id"])
    expect(bk(out2["id"])["status"] == "cancelled" and "booking_notice" in r2["reason"], f"revived inside notice {r2}")
    # 3. Everything still holds: revived once, with offers.
    out3, oid3 = _expired_online_booking()
    FAKE.pay(oid3, "SUCCESS")
    res3 = webhook(oid3).json()
    expect(res3["outcome"] == "late_success_confirmed" and bk(out3["id"])["payment_status"] == "paid", f"{res3}")
    expect(offers(out3["id"]) >= 1 and count("SELECT COUNT(*) FROM refunds WHERE booking_id = CAST(:id AS uuid)", id=out3["id"]) == 0, "revival")


def check_payout_nets_penalty_without_double_counting():
    enable_cashfree()
    _payout_ready("bank")
    s = _completed_settlement(150_000)
    set_wallet(PUJARI, -30_000)  # a cancel / no-show penalty the pujari still owes
    pv = call("GET", f"/admin/payouts/settlements/{s['id']}/preview", SUPER).json()
    expect((pv["gross_paise"], pv["penalty_recovered_paise"], pv["net_paise"]) == (150_000, 30_000, 120_000), f"preview {pv}")
    FAKE.next_transfer_status = "SUCCESS"
    r = _approve_payout(str(s["id"]))
    expect(r.status_code == 200 and r.json()["status"] == "successful", r.text)
    po = one("SELECT * FROM payouts WHERE settlement_id = :id", id=s["id"])
    sent = int(round(FAKE.transfers[po["transfer_id"]]["transfer_amount"] * 100))
    expect(sent == 120_000 and po["penalty_recovered_paise"] == 30_000, f"bank got {sent}")
    expect(wallet(PUJARI) == 0, f"wallet {wallet(PUJARI)} after recovery (expected 0)")
    from app.payouts import service as payout_service

    for _ in range(2):  # repeated status checks / webhooks never credit again
        payout_service.refresh_payout(_db(), payout_service.payout_by_transfer(_db(), po["transfer_id"]))
        webhook("", path="/payouts/webhooks/cashfree", secret=PAYOUT_SECRET, extra={"transfer_id": po["transfer_id"]})
    expect(wallet(PUJARI) == 0, "penalty recovery credited twice")
    # Reversal undoes the recovery; the next payout recomputes and recovers once more.
    FAKE.transfers[po["transfer_id"]]["status"] = "REVERSED"
    payout_service.refresh_payout(_db(), payout_service.payout_by_transfer(_db(), po["transfer_id"]))
    expect(wallet(PUJARI) == -30_000, f"reversal wallet {wallet(PUJARI)}")
    expect(_approve_payout(str(s["id"])).json()["status"] == "successful" and wallet(PUJARI) == 0, "re-payout")
    expect(count("SELECT COUNT(*) FROM payouts WHERE settlement_id = CAST(:id AS uuid) AND status = 'successful'", id=s["id"]) == 1, "two live payouts")
    # Penalty bigger than the settlement: no transfer, the whole settlement pays the penalty down.
    s2 = _completed_settlement(50_000)
    set_wallet(PUJARI, -80_000)
    creates = FAKE.transfer_creates
    r2 = _approve_payout(str(s2["id"]))
    expect(r2.json()["status"] == "settled_to_penalty" and FAKE.transfer_creates == creates, r2.text)
    expect(wallet(PUJARI) == -30_000 and one("SELECT status FROM settlements WHERE id = :id", id=s2["id"])["status"] == "settled", "offset")
    # A new penalty after the OTP voids it.
    s3 = _completed_settlement(70_000)
    set_wallet(PUJARI, 0)
    _reset_otp_limits()
    ch = call("POST", "/admin/security/challenge", SUPER, {"action": "settlement_payout", "settlement_id": str(s3["id"])}).json()
    set_wallet(PUJARI, -5_000)
    r3 = call("POST", f"/admin/payouts/settlements/{s3['id']}", SUPER, {"challenge_id": ch["challenge_id"], "otp": OTP, "mpin": MPIN})
    expect(r3.status_code == 400 and count("SELECT COUNT(*) FROM payouts WHERE settlement_id = CAST(:id AS uuid)", id=s3["id"]) == 0, r3.text)


def _effects(booking_id: str) -> dict[str, tuple[str, int]]:
    rows = sql("SELECT effect, status, attempts FROM booking_side_effects WHERE booking_id = CAST(:id AS uuid)", id=booking_id).all()
    return {r[0]: (r[1], int(r[2])) for r in rows}


def _age_effects(booking_id: str) -> None:
    sql("UPDATE booking_side_effects SET next_attempt_at = NOW(), created_at = NOW() - INTERVAL '5 minutes' "
        "WHERE booking_id = CAST(:id AS uuid) AND status = 'pending'", id=booking_id)


def _customer_mail() -> int:
    return sum(1 for m in SENT if m.get("to") == CUSTOMER)


def _offer_notices(booking_id: str) -> int:
    # Titles are stored in the recipient's language: count each invited pujari's notification for this booking.
    return count(
        """
        SELECT COUNT(*) FROM notifications n
        JOIN booking_pujari_offers o ON o.pujari_id = n.user_id AND o.booking_id = CAST(:id AS uuid)
        WHERE n.link LIKE '%' || :id || '%'
        """,
        id=booking_id,
    )


def check_wallet_booking_records_follow_ups_done():
    svc = prepare_catalogue()
    set_wallet(CUSTOMER, 5_000_000)
    out = call("POST", "/bookings", CUSTOMER, booking_body(svc)).json()
    eff = _effects(out["id"])
    expect(set(eff) == {"preparation", "offers", "notifications", "confirmation_email", "invoice"}, f"planned {eff}")
    expect(all(st == "done" and n == 1 for st, n in eff.values()), f"wallet follow-ups {eff}")
    expect(count("SELECT COUNT(*) FROM invoices WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'", id=out["id"]) == 1, "invoice")


def check_failed_offers_are_retried_without_duplicates():
    enable_cashfree()
    import app.booking_offers as offers_mod

    real = offers_mod.create_offers_for_booking
    offers_mod.create_offers_for_booking = lambda *a, **k: (_ for _ in ()).throw(RuntimeError("simulated offer failure"))
    out = online_booking()
    FAKE.pay(out["payment"]["order_id"], "SUCCESS")
    webhook(out["payment"]["order_id"])
    offers_mod.create_offers_for_booking = real
    b = bk(out["id"])
    eff = _effects(out["id"])
    expect(b["payment_status"] == "paid" and eff["offers"] == ("pending", 1), f"after failure {eff}")
    expect(eff["notifications"][0] == "pending" and offers(out["id"]) == 0, "notifications ran before offers")
    for _ in range(3):  # worker passes, including repeats
        _age_effects(out["id"])
        pay_service.run_payment_jobs(_db())
    eff = _effects(out["id"])
    expect(eff["offers"][0] == "done" and eff["notifications"][0] == "done", f"not recovered {eff}")
    n = offers(out["id"])
    expect(n >= 1 and _offer_notices(out["id"]) == n and created_notices(out["id"]) == 1, f"offers {n} notices {_offer_notices(out['id'])}")
    expect(count("SELECT COUNT(*) FROM notifications WHERE title = 'Booking Needs Pujari Assignment' AND body LIKE '%' || :n || '%'",
                 n=b["booking_number"]) == 0, "ops told to assign manually although offers went out")


def check_crash_after_commit_recovers_email_and_invoice_once():
    enable_cashfree()
    import app.booking_finalize as fin

    real = fin.post_commit_side_effects
    fin.post_commit_side_effects = lambda *a, **k: None  # the process dies right after the commit
    out = online_booking()
    FAKE.pay(out["payment"]["order_id"], "SUCCESS")
    webhook(out["payment"]["order_id"])
    fin.post_commit_side_effects = real
    mail_before = _customer_mail()
    eff = _effects(out["id"])
    expect(eff["confirmation_email"][0] == "pending" and eff["invoice"][0] == "pending", f"{eff}")
    expect(count("SELECT COUNT(*) FROM invoices WHERE booking_id = CAST(:id AS uuid)", id=out["id"]) == 0, "invoice too early")
    for _ in range(3):
        _age_effects(out["id"])
        pay_service.run_payment_jobs(_db())
    eff = _effects(out["id"])
    expect(eff["confirmation_email"] == ("done", 1) and eff["invoice"] == ("done", 1), f"{eff}")
    expect(count("SELECT COUNT(*) FROM invoices WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'", id=out["id"]) == 1, "invoices")
    expect(_customer_mail() - mail_before >= 1, "confirmation email not sent")
    sent_after = _customer_mail()
    pay_service.run_payment_jobs(_db())
    real(out["id"])
    expect(_customer_mail() == sent_after, "email sent again after it was done")


def check_crash_before_commit_redoes_the_whole_confirmation():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    db = _db()
    from app.payments.providers import gateway

    pay = pay_service.payment_by_order(db, "cashfree", oid)
    pay_service.apply_order_state(db, pay, gateway("cashfree").fetch_order(oid))
    db.rollback()  # the process dies before the commit: nothing of the confirmation may survive
    db.close()
    expect(bk(out["id"])["status"] == "awaiting_payment" and not _effects(out["id"]) and offers(out["id"]) == 0, "partial confirmation survived")
    sql("UPDATE payments SET created_at = NOW() - INTERVAL '5 minutes', last_checked_at = NULL WHERE provider_order_id = :o", o=oid)
    pay_service.run_payment_jobs(_db())
    eff = _effects(out["id"])
    expect(bk(out["id"])["payment_status"] == "paid" and all(st == "done" for st, _ in eff.values()), f"{eff}")
    expect(created_notices(out["id"]) == 1 and offers(out["id"]) >= 1, "confirmation not redone once")


def check_repeated_failure_is_flagged_and_admin_retry_works():
    enable_cashfree()
    import app.booking_finalize as fin

    real = fin.HANDLERS["invoice"]
    fin.HANDLERS["invoice"] = lambda db, b: (_ for _ in ()).throw(RuntimeError("pdf service down"))
    out = online_booking()
    FAKE.pay(out["payment"]["order_id"], "SUCCESS")
    webhook(out["payment"]["order_id"])
    for _ in range(fin.MAX_ATTEMPTS + 2):
        _age_effects(out["id"])
        pay_service.run_payment_jobs(_db())
    eff = _effects(out["id"])
    expect(eff["invoice"] == ("failed", fin.MAX_ATTEMPTS), f"{eff}")
    expect(count("SELECT COUNT(*) FROM notifications WHERE title = 'Booking follow-up failed' AND body LIKE '%' || :n || '%'",
                 n=bk(out["id"])["booking_number"]) >= 1, "ops not told")
    summary = call("GET", "/admin/payments/summary", SUPER).json()
    expect(summary["needs_review"]["booking_follow_ups_failed"] >= 1, "summary")
    fin.HANDLERS["invoice"] = real
    eid = one("SELECT id FROM booking_side_effects WHERE booking_id = CAST(:id AS uuid) AND effect = 'invoice'", id=out["id"])["id"]
    r = call("POST", f"/admin/payments/follow-ups/{eid}/retry", SUPER)
    expect(r.status_code == 200 and r.json()["status"] == "done", r.text)
    expect(count("SELECT COUNT(*) FROM invoices WHERE booking_id = CAST(:id AS uuid) AND invoice_type = 'customer'", id=out["id"]) == 1, "invoice")
    expect(call("POST", f"/admin/payments/follow-ups/{eid}/retry", SUPER).status_code == 409, "retry of a done task")


def check_dot_form_signature_is_accepted_and_recorded():
    enable_cashfree()
    out = online_booking()
    oid = out["payment"]["order_id"]
    FAKE.pay(oid, "SUCCESS")
    raw = json.dumps({"type": "PAYMENT_SUCCESS_WEBHOOK", "data": {"order": {"order_id": oid}}}).encode()
    ts = "1730000000123"
    sig = base64.b64encode(hmac.new(PG_SECRET.encode(), ts.encode() + b"." + raw, hashlib.sha256).digest()).decode()
    r = client.post("/api/v1/payments/webhooks/cashfree", content=raw, headers={"x-webhook-timestamp": ts, "x-webhook-signature": sig})
    expect(r.status_code == 200 and bk(out["id"])["payment_status"] == "paid", r.text)
    ev = one("SELECT outcome FROM payment_events WHERE reference = :o ORDER BY received_at DESC LIMIT 1", o=oid)
    expect("sig:dot" in ev["outcome"], f"variant not recorded {ev}")


CHECKS = {name[len("check_"):]: fn for name, fn in list(globals().items()) if name.startswith("check_")}

if __name__ == "__main__":
    name = sys.argv[1]
    CHECKS[name]()
    print(f"PASS {name}")
