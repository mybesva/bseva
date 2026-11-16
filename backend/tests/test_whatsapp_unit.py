"""WhatsApp Cloud API webhook and client checks that need no database (see tests/test_whatsapp_pg.py for the rest)."""
from __future__ import annotations

import hashlib
import hmac
import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, insecure_settings_problems, settings
from app.main import app
from app.whatsapp import client as wa_client
from app.whatsapp import store, webhook

SECRET = "unit-test-app-secret"
VERIFY = "unit-test-verify-token-0123456789"
URL = "/api/v1/webhooks/whatsapp"
http = TestClient(app)


@pytest.fixture(autouse=True)
def configured(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_webhook_verify_token", VERIFY)
    monkeypatch.setattr(settings, "whatsapp_app_secret", SECRET)
    monkeypatch.setattr(settings, "whatsapp_access_token", "unit-test-access-token")
    monkeypatch.setattr(settings, "whatsapp_phone_number_id", "123456789012345")
    monkeypatch.setattr(settings, "whatsapp_send_enabled", True)
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", "919800000001")
    monkeypatch.setattr(settings, "environment", "qa")
    monkeypatch.setattr(wa_client, "sleep", lambda _s: None)


def sign(body: bytes, secret: str = SECRET) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


# --- GET challenge ------------------------------------------------------------------------------------------

def test_challenge_echoed_for_correct_token():
    r = http.get(URL, params={"hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "1158201444"})
    assert r.status_code == 200 and r.text == "1158201444"
    assert r.headers["content-type"].startswith("text/plain") and r.headers["cache-control"] == "no-store"


@pytest.mark.parametrize(
    "params",
    [
        {"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "1"},
        {"hub.mode": "subscribe", "hub.verify_token": VERIFY[:-1], "hub.challenge": "1"},
        {"hub.mode": "unsubscribe", "hub.verify_token": VERIFY, "hub.challenge": "1"},
        {"hub.mode": "subscribe", "hub.challenge": "1"},
        {"hub.mode": "subscribe", "hub.verify_token": VERIFY},
        {"hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "<script>alert(1)</script>"},
        {"hub.mode": "subscribe", "hub.verify_token": VERIFY, "hub.challenge": "x" * 129},
    ],
)
def test_challenge_refused(params):
    r = http.get(URL, params=params)
    assert r.status_code == 403 and "alert" not in r.text


def test_webhook_hidden_until_configured(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_webhook_verify_token", "")
    monkeypatch.setattr(settings, "whatsapp_app_secret", "")
    assert http.get(URL, params={"hub.mode": "subscribe", "hub.verify_token": "", "hub.challenge": "1"}).status_code == 404
    body = b'{"object":"whatsapp_business_account","entry":[]}'
    assert http.post(URL, content=body, headers={"x-hub-signature-256": sign(body, "")}).status_code == 404


def test_comparisons_are_constant_time(monkeypatch):
    calls = []
    real = hmac.compare_digest
    monkeypatch.setattr(webhook.hmac, "compare_digest", lambda a, b: calls.append(1) or real(a, b))
    webhook.challenge_response("subscribe", VERIFY, "1")
    webhook.signature_valid(b"{}", sign(b"{}"))
    assert len(calls) == 2


# --- POST signature -----------------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "header",
    [None, "", "sha256=", "sha1=abc", "sha256=" + "0" * 64, "sha256=zz", sign(b'{"other":1}'), sign(b"{}", "other-secret")],
)
def test_bad_signature_rejected(header):
    body = b'{"object":"whatsapp_business_account","entry":[]}'
    headers = {"content-type": "application/json"}
    if header is not None:
        headers["x-hub-signature-256"] = header
    r = http.post(URL, content=body, headers=headers)
    assert r.status_code == 401


def test_signature_covers_exact_raw_bytes():
    body = b'{"object": "whatsapp_business_account", "entry": []}'
    reformatted = json.dumps(json.loads(body), separators=(",", ":")).encode()
    assert webhook.signature_valid(body, sign(body))
    assert not webhook.signature_valid(reformatted, sign(body))
    assert webhook.signature_valid(body, sign(body).upper().replace("SHA256=", "sha256="))


@pytest.mark.parametrize("body", [b"not json", b"[1,2]", b'"text"', b'{"entry": {}}', b"\xff\xfe"])
def test_malformed_signed_payload_rejected(body):
    r = http.post(URL, content=body, headers={"x-hub-signature-256": sign(body)})
    assert r.status_code == 400


def test_oversized_body_rejected_before_parsing():
    body = b" " * (webhook.MAX_BODY_BYTES + 1)
    r = http.post(URL, content=body, headers={"x-hub-signature-256": sign(body)})
    assert r.status_code == 413


def test_bad_signature_log_has_no_secret_or_body(caplog):
    body = b'{"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"messages":[{"text":{"body":"OTP 482913"}}]}}]}]}'
    with caplog.at_level(logging.INFO, logger="bseva.whatsapp"):
        http.post(URL, content=body, headers={"x-hub-signature-256": sign(body, "attacker")})
    logged = caplog.text
    assert "WHATSAPP_WEBHOOK_BAD_SIGNATURE" in logged
    assert SECRET not in logged and "482913" not in logged and "attacker" not in logged


# --- recipients and settings ----------------------------------------------------------------------------------

@pytest.mark.parametrize(
    "raw,expected",
    [("9876543210", "919876543210"), ("+91 98765 43210", "919876543210"), ("09876543210", "919876543210"),
     ("919876543210", "919876543210"), ("+1 650 555 0100", "16505550100")],
)
def test_normalize_recipient(raw, expected):
    assert store.normalize_recipient(raw) == expected


@pytest.mark.parametrize("raw", ["", "12345", "0123456789012", "abc", "1" * 16])
def test_normalize_recipient_rejects(raw):
    with pytest.raises(store.InvalidRecipient):
        store.normalize_recipient(raw)


def test_mask_shows_last_four_only():
    assert store.mask("919876543210") == "***3210" and store.mask(None) == "***"


def test_empty_allowlist_blocks_everything_outside_production(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", "")
    for env in ("qa", "development", "test"):
        monkeypatch.setattr(settings, "environment", env)
        assert not wa_client.recipient_allowed("919800000001")
    monkeypatch.setattr(settings, "environment", "production")
    assert wa_client.recipient_allowed("919800000001")


def test_allowlist_matches_normalized_numbers(monkeypatch):
    monkeypatch.setattr(settings, "whatsapp_recipient_allowlist", " +91 98000 00001 , bad-entry ")
    assert wa_client.allowlist() == {"919800000001"}
    assert wa_client.recipient_allowed("919800000001") and not wa_client.recipient_allowed("919800000002")


def test_send_refused_in_production_settings():
    base = dict(database_url="postgresql://x", jwt_secret="p" * 40, environment="production")
    assert any("WHATSAPP_SEND_ENABLED" in p for p in insecure_settings_problems(Settings(**base, whatsapp_send_enabled=True), {}))
    assert not insecure_settings_problems(Settings(**base), {})
    assert not insecure_settings_problems(Settings(**dict(base, environment="qa"), whatsapp_send_enabled=True), {})


def test_whatsapp_defaults_are_off():
    s = Settings(database_url="postgresql://x")
    assert not s.whatsapp_send_enabled and not s.whatsapp_app_secret and not s.whatsapp_webhook_verify_token
    assert s.whatsapp_recipient_allowlist == ""


# --- client (database calls replaced) --------------------------------------------------------------------------

class FakeDb:
    def __init__(self):
        self.commits = 0

    def commit(self):
        self.commits += 1


@pytest.fixture
def recorded(monkeypatch):
    rows: list[dict] = []
    monkeypatch.setattr(store, "record_outbound", lambda db, **kw: rows.append(kw) or "row-id")
    return rows


def use_transport(monkeypatch, handler):
    requests: list[httpx.Request] = []

    def wrapped(request: httpx.Request):
        requests.append(request)
        return handler(request, len(requests))

    monkeypatch.setattr(wa_client, "http_client_factory", lambda: httpx.Client(transport=httpx.MockTransport(wrapped)))
    return requests


OTP_COMPONENTS = [
    {"type": "body", "parameters": [{"type": "text", "text": "482913"}]},
    {"type": "button", "sub_type": "url", "index": "0", "parameters": [{"type": "text", "text": "482913"}]},
]


def send(**kw):
    args = dict(to="+91 98000 00001", template_name="bseva_otp", language="en", components=OTP_COMPONENTS, purpose="otp_test")
    args.update(kw)
    return wa_client.send_template(FakeDb(), **args)


def test_send_success_records_wamid_without_parameters(monkeypatch, recorded, caplog):
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(200, json={"messages": [{"id": "wamid.ABC"}]}))
    with caplog.at_level(logging.INFO, logger="bseva.whatsapp"):
        out = send()
    assert out == {"ok": True, "status": "accepted", "wamid": "wamid.ABC", "attempts": 1}
    req = requests[0]
    assert str(req.url) == "https://graph.facebook.com/v26.0/123456789012345/messages"
    assert req.headers["authorization"] == "Bearer unit-test-access-token"
    sent = json.loads(req.content)
    assert sent["to"] == "919800000001" and sent["type"] == "template" and sent["template"]["name"] == "bseva_otp"
    assert recorded[0]["status"] == "accepted" and recorded[0]["wamid"] == "wamid.ABC"
    assert "482913" not in json.dumps(recorded) and "482913" not in caplog.text
    assert "unit-test-access-token" not in caplog.text and "9800000001" not in caplog.text


def test_graph_api_version_is_configurable(monkeypatch, recorded):
    monkeypatch.setattr(settings, "whatsapp_graph_api_version", "v24.0")
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(200, json={"messages": [{"id": "wamid.V"}]}))
    send()
    assert "/v24.0/" in str(requests[0].url)


@pytest.mark.parametrize(
    "change,status",
    [
        ({"whatsapp_send_enabled": False}, "disabled"),
        ({"whatsapp_access_token": ""}, "not_configured"),
        ({"whatsapp_phone_number_id": ""}, "not_configured"),
        ({"whatsapp_phone_number_id": "12/../me"}, "not_configured"),
        ({"whatsapp_recipient_allowlist": ""}, "not_allowed"),
        ({"whatsapp_recipient_allowlist": "919800000002"}, "not_allowed"),
    ],
)
def test_send_refused_without_calling_meta(monkeypatch, recorded, change, status):
    for key, value in change.items():
        monkeypatch.setattr(settings, key, value)
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(200, json={"messages": [{"id": "x"}]}))
    assert send()["status"] == status
    assert not requests and not recorded


def test_invalid_recipient_never_sent(monkeypatch, recorded):
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(200))
    assert send(to="12")["status"] == "invalid_recipient" and not requests


def test_retries_server_errors_then_succeeds(monkeypatch, recorded):
    responses = [httpx.Response(503), httpx.Response(429, json={"error": {"code": 130429}})]
    requests = use_transport(
        monkeypatch,
        lambda req, n: responses[n - 1] if n <= len(responses) else httpx.Response(200, json={"messages": [{"id": "wamid.R"}]}),
    )
    out = send()
    assert out["ok"] and out["attempts"] == 3 and len(requests) == 3
    assert recorded[-1]["attempts"] == 3


def test_retry_limit_then_records_failure(monkeypatch, recorded):
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(500, json={"error": {"code": 2, "type": "OAuthException"}}))
    out = send()
    assert out == {"ok": False, "status": "send_failed", "error_code": 2, "attempts": 3} and len(requests) == 3
    assert recorded[0]["status"] == "send_failed" and recorded[0]["error_code"] == 2


def test_permanent_error_not_retried(monkeypatch, recorded):
    body = {"error": {"code": 132001, "type": "OAuthException", "error_user_title": "Template name does not exist"}}
    requests = use_transport(monkeypatch, lambda req, n: httpx.Response(400, json=body))
    out = send()
    assert out["status"] == "send_failed" and out["error_code"] == 132001 and len(requests) == 1
    assert recorded[0]["error_title"] == "Template name does not exist"


def test_connection_refused_is_retried(monkeypatch, recorded):
    def handler(req, n):
        if n == 1:
            raise httpx.ConnectError("refused", request=req)
        return httpx.Response(200, json={"messages": [{"id": "wamid.C"}]})

    requests = use_transport(monkeypatch, handler)
    assert send()["ok"] and len(requests) == 2


def test_timeout_after_connecting_is_not_retried(monkeypatch, recorded):
    def handler(req, n):
        raise httpx.ReadTimeout("slow", request=req)

    requests = use_transport(monkeypatch, handler)
    out = send()
    assert out["status"] == "send_failed" and len(requests) == 1
    assert recorded[0]["error_title"] == "ReadTimeout"


def test_unexpected_success_body_is_a_failure(monkeypatch, recorded):
    use_transport(monkeypatch, lambda req, n: httpx.Response(200, text="<html>"))
    assert send()["status"] == "send_failed"


def test_failed_status_error_parsing():
    assert webhook._first_error({"errors": [{"code": 131049, "title": "Per-user limit"}]}) == (131049, "Per-user limit")
    assert webhook._first_error({"errors": "bad"}) == (None, None)


def test_worker_prunes_webhook_events():
    import inspect

    from app import worker

    assert '("whatsapp_webhook_events", "received_at", 30, "")' in inspect.getsource(worker._prune)
