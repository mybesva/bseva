"""MSG91 WhatsApp booking notifications (app.whatsapp.msg91). No database and no network: MSG91 is replaced
by an httpx MockTransport and the database pieces by fakes."""
from __future__ import annotations

import json
from datetime import date, time

import httpx
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.config import settings
from app.whatsapp import msg91

AUTHKEY = "unitTestAuthKey0123456789"
TO = "919800000001"
BOOKING_ID = "3f6c2a9e-1b7d-4c5e-9a2f-8d4e6b1c7a90"
BOOKING = {
    "id": BOOKING_ID, "booking_number": "BSV-1001", "service_id": "svc", "booking_date": date(2026, 11, 15),
    "start_time": time(10, 0), "mode": "in_person", "location_label": "12 Temple Street, Madhapur, Hyderabad",
}


class Recorder:
    def __init__(self, status: int = 200, body: dict | None = None, exc: Exception | None = None):
        self.calls: list[httpx.Request] = []
        self.status = status
        self.body = body if body is not None else {
            "status": "success", "hasError": False, "data": "in process", "errors": None, "request_id": "req123",
        }
        self.exc = exc

    def client(self) -> httpx.Client:
        def handler(request: httpx.Request) -> httpx.Response:
            self.calls.append(request)
            if self.exc:
                raise self.exc
            return httpx.Response(self.status, json=self.body)

        return httpx.Client(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "msg91_whatsapp_enabled", True)
    monkeypatch.setattr(settings, "msg91_authkey", AUTHKEY)
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", TO)
    monkeypatch.setattr(settings, "environment", "qa")
    records: list[dict] = []
    monkeypatch.setattr(msg91, "_record", lambda *a: records.append(dict(zip(
        ("digits", "purpose", "template", "status", "request_id", "error"), a))))
    monkeypatch.setattr(msg91, "dispatch", lambda fn: fn())  # run sends inline
    return records


@pytest.fixture
def mock_http(monkeypatch):
    rec = Recorder()
    monkeypatch.setattr(msg91, "http_client_factory", rec.client)
    return rec


# --- template names and values ------------------------------------------------------------------------------

def test_qa_uses_qa_templates_and_production_uses_plain_names(monkeypatch):
    assert msg91.template_name("booking_confirmed") == "qa_bseva_booking_confirmed"
    assert msg91.template_name("pujari_new_booking") == "qa_pujari_new_booking"
    monkeypatch.setattr(settings, "environment", "production")
    assert msg91.template_name("booking_confirmed") == "bseva_booking_confirmed"
    assert msg91.template_name("pujari_booking_rescheduled") == "pujari_booking_rescheduled"


def test_every_event_has_a_template():
    assert set(msg91.TEMPLATES) == msg91.CUSTOMER_EVENTS | {
        "pujari_new_booking", "pujari_booking_reminder", "pujari_location_available",
        "pujari_booking_cancelled", "pujari_booking_rescheduled",
    }


def test_customer_values():
    values, button = msg91.build_values("booking_confirmed", BOOKING, "Raj Kumar", "Satyanarayana Puja")
    assert values == ["Raj Kumar", "Satyanarayana Puja", "15 Nov 2026", "10:00 AM", "BSV-1001"]
    assert button is None


def test_pujari_new_booking_shows_only_the_area_and_qa_link_button(monkeypatch):
    values, button = msg91.build_values("pujari_new_booking", BOOKING, "Sharma ji", "Griha Pravesh")
    assert values == ["Sharma ji", "Griha Pravesh", "15 Nov 2026", "10:00 AM", "Hyderabad"]
    assert "Temple Street" not in json.dumps(values)
    assert button == BOOKING_ID
    monkeypatch.setattr(settings, "environment", "production")
    assert msg91.build_values("pujari_new_booking", BOOKING, "Sharma ji", "Griha Pravesh")[1] is None


def test_virtual_puja_area_is_online():
    values, _ = msg91.build_values("pujari_new_booking", {**BOOKING, "mode": "virtual"}, "Sharma ji", "Homam")
    assert values[4] == "Online"


def test_values_are_cleaned_and_never_empty():
    values, _ = msg91.build_values(
        "booking_cancelled", {**BOOKING, "booking_number": None, "start_time": time(18, 5)}, "  ", "Puja\n\tname    x"
    )
    assert values == ["Customer", "Puja name x", "15 Nov 2026", "6:05 PM", "-"]
    assert msg91.format_date("2026-01-05") == "5 Jan 2026"
    assert msg91.format_time("09:30:00") == "9:30 AM"


def test_payload_shape_matches_msg91():
    body = msg91.payload(TO, "qa_pujari_new_booking", ["a", "b", "c", "d", "e"], BOOKING_ID)
    assert body["integrated_number"] == "919014654994"
    assert body["content_type"] == "template"
    tpl = body["payload"]["template"]
    assert tpl["name"] == "qa_pujari_new_booking"
    assert tpl["language"] == {"code": "en", "policy": "deterministic"}
    assert tpl["namespace"] == "a95fd426_accf_44f7_b1fe_43fc50769841"
    comps = tpl["to_and_components"][0]
    assert comps["to"] == [TO]
    assert comps["components"]["body_5"] == {"type": "text", "value": "e"}
    assert comps["components"]["button_1"] == {"subtype": "url", "type": "text", "value": BOOKING_ID}


# --- sending ------------------------------------------------------------------------------------------------

def send(**kw):
    args = {"to": TO, "template": "qa_booking_reminder", "values": ["a", "b", "c", "d", "e"], "purpose": "booking_reminder"}
    args.update(kw)
    return msg91.send_template(**args)


def test_send_success_records_request_id(mock_http, configured):
    assert send() == {"ok": True, "status": "accepted", "request_id": "req123"}
    req = mock_http.calls[0]
    assert str(req.url) == msg91.URL and req.method == "POST"
    assert req.headers["authkey"] == AUTHKEY
    assert configured == [{"digits": TO, "purpose": "booking_reminder", "template": "qa_booking_reminder",
                           "status": "accepted", "request_id": "req123", "error": None}]


def test_send_failure_records_error_code_without_retry(monkeypatch, configured):
    rec = Recorder(status=401, body={"status": "fail", "hasError": True, "errors": "Unauthorized", "apiError": "418"})
    monkeypatch.setattr(msg91, "http_client_factory", rec.client)
    out = send()
    assert out["ok"] is False and out["error"] == "http 401 apiError 418"
    assert len(rec.calls) == 1
    assert configured[0]["status"] == "send_failed"


def test_timeout_is_not_retried(monkeypatch, configured):
    rec = Recorder(exc=httpx.ReadTimeout("slow"))
    monkeypatch.setattr(msg91, "http_client_factory", rec.client)
    assert send()["error"] == "ReadTimeout"
    assert len(rec.calls) == 1


def test_off_or_unconfigured_sends_nothing(monkeypatch, mock_http):
    monkeypatch.setattr(settings, "msg91_whatsapp_enabled", False)
    assert send()["status"] == "disabled"
    monkeypatch.setattr(settings, "msg91_whatsapp_enabled", True)
    monkeypatch.setattr(settings, "msg91_authkey", "  ")
    assert send()["status"] == "disabled"
    assert mock_http.calls == []


def test_qa_only_messages_allowlisted_numbers(monkeypatch, mock_http):
    assert send(to="919800000002")["status"] == "not_allowed"
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", "")
    assert send()["status"] == "not_allowed"
    assert mock_http.calls == []


def test_production_without_allowlist_messages_anyone(monkeypatch, mock_http):
    monkeypatch.setattr(settings, "environment", "production")
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", "")
    assert send(to="9876543210", template="booking_reminder")["ok"] is True
    assert json.loads(mock_http.calls[0].content)["payload"]["template"]["to_and_components"][0]["to"] == ["919876543210"]


def test_authkey_and_values_never_logged(mock_http, caplog):
    caplog.set_level("DEBUG", logger="bseva.whatsapp.msg91")
    send(values=["Raj Secret", "b", "c", "d", "e"])
    assert AUTHKEY not in caplog.text and "Raj Secret" not in caplog.text and TO not in caplog.text


def test_client_forces_ipv4():
    with msg91._make_client() as c:
        pool = c._transport._pool
        assert pool._local_address == "0.0.0.0"


# --- deliver (load + once-only claim + send) ----------------------------------------------------------------

class FakeDB:
    def commit(self):
        pass

    def close(self):
        pass


@pytest.fixture
def fake_db(monkeypatch):
    claimed: set[str] = set()

    def claim(_db, key):
        if key in claimed:
            return False
        claimed.add(key)
        return True

    monkeypatch.setattr(msg91, "session_factory", FakeDB)
    monkeypatch.setattr("app.jobs.dedupe.claim_once", claim)
    monkeypatch.setattr("app.catalog.localized_service_name", lambda _db, _sid, _lang: "Satyanarayana Puja")
    people = {"cust": {"name": "Raj", "phone": TO}, "puj": {"name": "Sharma ji", "phone": "+91 98000 00001"}}
    monkeypatch.setattr(msg91, "_load", lambda _db, _bid, uid, pujari: (dict(BOOKING), people.get(uid)))
    return claimed


def test_deliver_sends_once_per_event_booking_person(fake_db, mock_http):
    assert msg91.deliver("booking_confirmed", BOOKING_ID, "cust")["ok"] is True
    assert msg91.deliver("booking_confirmed", BOOKING_ID, "cust")["status"] == "duplicate"
    assert msg91.deliver("booking_cancelled", BOOKING_ID, "cust")["ok"] is True
    assert len(mock_http.calls) == 2


def test_deliver_pujari_new_booking_has_button(fake_db, mock_http):
    assert msg91.deliver("pujari_new_booking", BOOKING_ID, "puj")["ok"] is True
    comps = json.loads(mock_http.calls[0].content)["payload"]["template"]["to_and_components"][0]
    assert comps["to"] == [TO]
    assert comps["components"]["button_1"]["value"] == BOOKING_ID
    assert comps["components"]["body_5"]["value"] == "Hyderabad"


def test_deliver_without_phone_sends_nothing(fake_db, mock_http, monkeypatch):
    monkeypatch.setattr(msg91, "_load", lambda *_a, **_k: (dict(BOOKING), {"name": "Raj", "phone": None}))
    assert msg91.deliver("booking_reminder", BOOKING_ID, "cust")["status"] == "no_phone"
    assert mock_http.calls == []


# --- notify: queued until the caller commits ----------------------------------------------------------------

@pytest.fixture
def sent(monkeypatch):
    out: list[tuple] = []
    monkeypatch.setattr(msg91, "deliver", lambda e, b, u: out.append((e, b, u)))
    return out


def sqlite_session() -> Session:
    s = Session(bind=create_engine("sqlite://"))
    s.execute(text("SELECT 1"))  # open a transaction like a real request would
    return s


def test_notify_sends_after_commit(sent):
    s = sqlite_session()
    msg91.notify(s, "booking_cancelled", BOOKING_ID, "cust")
    msg91.notify(s, "booking_cancelled", BOOKING_ID, "cust")  # same message queued twice -> once
    assert sent == []
    s.commit()
    assert sent == [("booking_cancelled", BOOKING_ID, "cust")]
    s.execute(text("SELECT 1"))
    s.commit()
    assert len(sent) == 1


def test_notify_dropped_on_rollback(sent):
    s = sqlite_session()
    msg91.notify(s, "booking_rescheduled", BOOKING_ID, "cust")
    s.rollback()
    s.execute(text("SELECT 1"))
    s.commit()
    assert sent == []


def test_notify_ignores_unknown_events_and_when_off(sent, monkeypatch):
    s = sqlite_session()
    msg91.notify(s, "pujari_assigned", BOOKING_ID, "cust")
    monkeypatch.setattr(settings, "msg91_whatsapp_enabled", False)
    msg91.notify(s, "booking_confirmed", BOOKING_ID, "cust")
    s.commit()
    assert sent == []
