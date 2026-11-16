from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec

from app.services import apns_push, firebase_notifications

IOS_TOKEN = "a1" * 32
FCM_TOKEN = "dQw4w9WgXcQ:APA91bH-abc_def" + "x" * 120


class FakeResp:
    def __init__(self, status, reason=""):
        self.status_code = status
        self._reason = reason

    def json(self):
        return {"reason": self._reason} if self._reason else {}


class FakeClient:
    """Accepts only one (host, topic) route; everything else answers like APNs would."""

    def __init__(self, ok_host, ok_topic, gone=False):
        self.ok_host, self.ok_topic, self.gone = ok_host, ok_topic, gone
        self.calls = []

    def post(self, url, content, headers):
        host = url.split("/3/device/")[0]
        topic = headers["apns-topic"]
        self.calls.append((host, topic))
        if self.gone:
            return FakeResp(410, "Unregistered")
        if host != self.ok_host:
            return FakeResp(400, "BadDeviceToken")
        if topic != self.ok_topic:
            return FakeResp(400, "DeviceTokenNotForTopic")
        return FakeResp(200)


def _configure(monkeypatch):
    key = ec.generate_private_key(ec.SECP256R1())
    pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()).decode()
    monkeypatch.setenv("APNS_KEY_ID", "TESTKEY123")
    monkeypatch.setenv("APNS_TEAM_ID", "TEAM123456")
    monkeypatch.setenv("APNS_AUTH_KEY", pem.replace("\n", "\\n"))
    monkeypatch.delenv("APNS_TOPICS", raising=False)
    monkeypatch.setattr(apns_push, "_jwt_cache", None)
    apns_push._route_cache.clear()


def test_token_shapes():
    assert apns_push.is_apns_token(IOS_TOKEN)
    assert not apns_push.is_apns_token(FCM_TOKEN)
    assert not apns_push.is_apns_token("")


def test_payload_puts_data_under_body_for_expo():
    p = apns_push.build_payload("Hi", "There", {"link": "/pujari/bookings"})
    assert p["aps"]["alert"] == {"title": "Hi", "body": "There"}
    assert p["body"] == {"link": "/pujari/bookings"}


def test_finds_pujari_topic_and_remembers_it(monkeypatch):
    _configure(monkeypatch)
    client = FakeClient(apns_push.PRODUCTION_HOST, "com.bseva.pujari")
    assert apns_push.send_apns(client, [IOS_TOKEN], title="t", body="b", data={}) == (1, 0, [])
    assert client.calls[-1] == (apns_push.PRODUCTION_HOST, "com.bseva.pujari")
    client.calls.clear()
    apns_push.send_apns(client, [IOS_TOKEN], title="t", body="b", data={})
    assert client.calls == [(apns_push.PRODUCTION_HOST, "com.bseva.pujari")]


def test_falls_back_to_sandbox_for_debug_builds(monkeypatch):
    _configure(monkeypatch)
    client = FakeClient(apns_push.SANDBOX_HOST, "com.bseva.app")
    assert apns_push.send_apns(client, [IOS_TOKEN], title="t", body="b", data={}) == (1, 0, [])


def test_unregistered_token_is_reported_dead(monkeypatch):
    _configure(monkeypatch)
    client = FakeClient(apns_push.PRODUCTION_HOST, "com.bseva.app", gone=True)
    assert apns_push.send_apns(client, [IOS_TOKEN], title="t", body="b", data={}) == (0, 1, [IOS_TOKEN])


def test_ios_tokens_never_go_to_firebase(monkeypatch):
    _configure(monkeypatch)
    sent = {}

    def fake_apns(tokens, **kw):
        sent["apns"] = tokens
        return len(tokens), 0, []

    monkeypatch.setattr(apns_push, "send_to_apns_tokens", fake_apns)
    monkeypatch.setattr(firebase_notifications, "firebase_ready", lambda: False)
    result = firebase_notifications.send_to_tokens([IOS_TOKEN], title="t", body="b", data={"link": "/x"})
    assert sent["apns"] == [IOS_TOKEN]
    assert result.success == 1 and result.invalid_tokens == [] and result.skipped_reason is None


def test_ios_tokens_kept_when_apns_not_configured(monkeypatch):
    for name in ("APNS_KEY_ID", "APNS_TEAM_ID", "APNS_AUTH_KEY", "APNS_AUTH_KEY_FILE"):
        monkeypatch.setenv(name, "")
    monkeypatch.setattr(firebase_notifications, "firebase_ready", lambda: False)
    result = firebase_notifications.send_to_tokens([IOS_TOKEN], title="t", body="b")
    assert result.invalid_tokens == []
    assert result.skipped_reason == "apns_not_configured"
