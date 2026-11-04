"""WhatsApp webhook and client checks against a real PostgreSQL database.

Run by tests/test_whatsapp_pg.py in a subprocess whose DATABASE_URL points at a throwaway database built by the
real deploy step (so migration 042 is included). Meta is never contacted: the client's HTTP transport is
replaced in-process. Usage: python tests/whatsapp_pg_checks.py <check-name>
"""
from __future__ import annotations

import hashlib
import hmac
import io
import json
import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402

from app.config import settings  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.whatsapp import client as wa_client  # noqa: E402
from app.whatsapp import store  # noqa: E402

SECRET = settings.whatsapp_app_secret
URL = "/api/v1/webhooks/whatsapp"
OTP = "482913"
TO = "919800000001"
http = TestClient(app)
LOG = io.StringIO()
_handler = logging.StreamHandler(LOG)
_handler.setLevel(logging.DEBUG)
logging.getLogger("bseva.whatsapp").addHandler(_handler)
logging.getLogger("bseva.whatsapp").setLevel(logging.DEBUG)
wa_client.sleep = lambda _s: None


def sql(statement: str, **params):
    with engine.begin() as conn:
        return conn.execute(text(statement), params)


def reset():
    sql("TRUNCATE whatsapp_messages, whatsapp_webhook_events")
    LOG.seek(0)
    LOG.truncate()


def post(payload: dict | bytes):
    body = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(SECRET.encode(), body, hashlib.sha256).hexdigest()
    return http.post(URL, content=body, headers={"x-hub-signature-256": sig, "content-type": "application/json"})


def statuses(*items: dict) -> dict:
    return {
        "object": "whatsapp_business_account",
        "entry": [{"id": "100000000000001", "changes": [{"field": "messages", "value": {
            "messaging_product": "whatsapp",
            "metadata": {"display_phone_number": "15550000000", "phone_number_id": "123456789012345"},
            "statuses": list(items),
        }}]}],
    }


def status(wamid: str, value: str, ts: int = 1762250000, **extra) -> dict:
    return {"id": wamid, "status": value, "timestamp": str(ts), "recipient_id": TO, **extra}


def message_row(wamid: str) -> dict:
    row = sql("SELECT * FROM whatsapp_messages WHERE wamid = :w", w=wamid).mappings().first()
    assert row, f"no row for {wamid}"
    return dict(row)


def fake_meta(wamid: str):
    wa_client.http_client_factory = lambda: httpx.Client(
        transport=httpx.MockTransport(lambda req: httpx.Response(200, json={"messages": [{"id": wamid}]}))
    )


def send_otp_template() -> dict:
    with SessionLocal() as db:
        return wa_client.send_template(
            db, to="+91 98000 00001", template_name="bseva_otp", language="en", purpose="otp_test",
            components=[{"type": "body", "parameters": [{"type": "text", "text": OTP}]}],
        )


def everything_stored() -> str:
    rows = sql("SELECT * FROM whatsapp_messages").mappings().all()
    events = sql("SELECT * FROM whatsapp_webhook_events").mappings().all()
    return json.dumps([dict(r) for r in rows] + [dict(e) for e in events], default=str)


# --- checks --------------------------------------------------------------------------------------------------

def check_send_then_delivery_statuses():
    reset()
    fake_meta("wamid.FLOW1")
    out = send_otp_template()
    assert out["ok"] and out["wamid"] == "wamid.FLOW1", out
    row = message_row("wamid.FLOW1")
    assert row["status"] == "accepted" and row["source"] == "outbound" and row["recipient_last4"] == "0001"
    assert row["recipient_hash"] == store.recipient_hash(TO)
    for value in ("sent", "delivered", "read"):
        r = post(statuses(status("wamid.FLOW1", value, pricing={"category": "authentication", "billable": True})))
        assert r.status_code == 200, r.text
    row = message_row("wamid.FLOW1")
    assert row["status"] == "read" and row["sent_at"] and row["delivered_at"] and row["read_at"]
    assert row["pricing_category"] == "authentication"


def check_replayed_event_is_idempotent():
    reset()
    fake_meta("wamid.REPLAY")
    send_otp_template()
    payload = statuses(status("wamid.REPLAY", "delivered", ts=1762250100))
    assert post(payload).status_code == 200
    first = message_row("wamid.REPLAY")
    for _ in range(3):
        r = post(payload)
        assert r.status_code == 200, r.text
    again = message_row("wamid.REPLAY")
    assert again["status"] == "delivered" and again["delivered_at"] == first["delivered_at"]
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events").scalar() == 1
    assert "duplicates=1" in LOG.getvalue()


def check_out_of_order_status_never_moves_backwards():
    reset()
    fake_meta("wamid.ORDER")
    send_otp_template()
    assert post(statuses(status("wamid.ORDER", "read", ts=1762250300))).status_code == 200
    assert post(statuses(status("wamid.ORDER", "delivered", ts=1762250200))).status_code == 200
    assert post(statuses(status("wamid.ORDER", "sent", ts=1762250100))).status_code == 200
    assert post(statuses(status("wamid.ORDER", "failed", errors=[{"code": 131026, "title": "x"}]))).status_code == 200
    row = message_row("wamid.ORDER")
    assert row["status"] == "read" and row["error_code"] is None


def check_failed_status_recorded_safely():
    reset()
    fake_meta("wamid.FAIL")
    send_otp_template()
    item = status("wamid.FAIL", "failed", errors=[{"code": 131049, "title": "This message was not delivered to maintain healthy ecosystem engagement."}])
    assert post(statuses(item)).status_code == 200
    row = message_row("wamid.FAIL")
    assert row["status"] == "failed" and row["error_code"] == 131049 and row["failed_at"]
    log = LOG.getvalue()
    assert "WHATSAPP_MESSAGE_FAILED" in log and "error_code=131049" in log and "***0001" in log
    assert TO not in log and "9800000001" not in log


def check_unknown_message_status_creates_webhook_row():
    reset()
    assert post(statuses(status("wamid.DASHBOARD", "delivered"))).status_code == 200
    row = message_row("wamid.DASHBOARD")
    assert row["source"] == "webhook" and row["status"] == "delivered" and row["recipient_last4"] == "0001"


def check_inbound_message_content_never_stored_or_logged():
    reset()
    payload = statuses()
    payload["entry"][0]["changes"][0]["value"]["messages"] = [
        {"from": TO, "id": "wamid.IN1", "timestamp": "1762250000", "type": "text", "text": {"body": f"my code is {OTP}"}}
    ]
    assert post(payload).status_code == 200
    assert post(payload).status_code == 200
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events WHERE kind = 'message'").scalar() == 1
    assert OTP not in everything_stored() and OTP not in LOG.getvalue() and TO not in LOG.getvalue()


def check_otp_never_stored_or_logged():
    reset()
    fake_meta("wamid.SECRET")
    send_otp_template()
    stored = everything_stored()
    assert OTP not in stored and TO not in stored, stored
    assert OTP not in LOG.getvalue() and settings.whatsapp_access_token not in LOG.getvalue()


def check_send_failure_recorded():
    reset()
    wa_client.http_client_factory = lambda: httpx.Client(transport=httpx.MockTransport(
        lambda req: httpx.Response(400, json={"error": {"code": 132001, "error_user_title": "Template name does not exist"}})
    ))
    out = send_otp_template()
    assert out["status"] == "send_failed"
    row = sql("SELECT * FROM whatsapp_messages").mappings().one()
    assert row["status"] == "send_failed" and row["wamid"] is None and row["error_code"] == 132001 and row["attempts"] == 1


def check_other_fields_deduplicated():
    reset()
    payload = {"object": "whatsapp_business_account", "entry": [{"id": "1", "changes": [
        {"field": "message_template_status_update", "value": {"event": "APPROVED", "message_template_name": "bseva_otp"}}
    ]}]}
    assert post(payload).status_code == 200 and post(payload).status_code == 200
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events WHERE kind = 'message_template_status_update'").scalar() == 1


def check_other_objects_acknowledged_and_ignored():
    reset()
    assert post({"object": "page", "entry": []}).status_code == 200
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events").scalar() == 0


def check_malformed_event_rolls_back_whole_delivery():
    reset()
    fake_meta("wamid.PART")
    send_otp_template()
    payload = statuses(status("wamid.PART", "delivered"), {"status": "read"})  # second status has no id
    assert post(payload).status_code == 400
    assert message_row("wamid.PART")["status"] == "accepted"
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events").scalar() == 0


def check_store_failure_returns_503_and_retry_succeeds():
    reset()
    fake_meta("wamid.RETRY")
    send_otp_template()
    payload = statuses(status("wamid.RETRY", "delivered"))
    real = store.apply_status

    def broken(*a, **kw):
        raise OperationalError("UPDATE whatsapp_messages", {}, Exception("connection lost"))

    store.apply_status = broken
    try:
        r = post(payload)
    finally:
        store.apply_status = real
    assert r.status_code == 503 and r.headers.get("retry-after") == "60", r.text
    # The claim was rolled back with the failure, so Meta's retry is processed rather than skipped as a duplicate.
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events").scalar() == 0
    assert post(payload).status_code == 200
    assert message_row("wamid.RETRY")["status"] == "delivered"


def check_bad_signature_changes_nothing():
    reset()
    body = json.dumps(statuses(status("wamid.FORGED", "delivered"))).encode()
    r = http.post(URL, content=body, headers={"x-hub-signature-256": "sha256=" + "0" * 64})
    assert r.status_code == 401
    assert sql("SELECT COUNT(*) FROM whatsapp_messages").scalar() == 0
    assert sql("SELECT COUNT(*) FROM whatsapp_webhook_events").scalar() == 0


def check_worker_prunes_old_events():
    reset()
    sql("INSERT INTO whatsapp_webhook_events (event_key, kind, received_at) VALUES ('old', 'status', NOW() - INTERVAL '31 days'), ('new', 'status', NOW())")
    from app import worker

    with SessionLocal() as db:
        out = worker._prune(db)
        db.commit()
    assert out.get("whatsapp_webhook_events") == 1, out
    assert [r[0] for r in sql("SELECT event_key FROM whatsapp_webhook_events").all()] == ["new"]


if __name__ == "__main__":
    name = sys.argv[1]
    globals()[f"check_{name}"]()
    print(f"PASS {name}")
