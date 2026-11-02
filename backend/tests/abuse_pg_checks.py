"""Bot / OTP / contact-form protection checks against a real PostgreSQL database.

Run by tests/test_abuse_protection_pg.py in a subprocess whose DATABASE_URL points at a throwaway database
built by the real deploy step, with every SMTP setting blanked. send_email is also replaced in-process, so
no check can send mail. Usage: python tests/abuse_pg_checks.py <check-name>
"""
from __future__ import annotations

import re
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import otp_service  # noqa: E402
from app.config import settings  # noqa: E402
from app.db import SessionLocal, engine  # noqa: E402
from app.mail import senders, smtp_client  # noqa: E402
from app.main import app  # noqa: E402
from app.security import hash_password  # noqa: E402

CODE = "246810"
SENT: list[dict] = []


def _fake_send(**kw):
    SENT.append(kw)
    return {"ok": True, "status": "sent", "to": kw.get("to")}


smtp_client.send_email = _fake_send
senders.send_email = _fake_send
otp_service.generate_otp_code = lambda: CODE
client = TestClient(app)


def sql(statement: str, **params):
    with engine.begin() as conn:
        return conn.execute(text(statement), params)


def reset_state():
    sql("TRUNCATE otp_send_events, security_rate_limits, contact_submissions")
    sql("UPDATE otp_codes SET consumed = TRUE")
    SENT.clear()


def post(path: str, body: dict, ip: str = "198.51.100.10", token: str | None = None):
    headers = {"x-real-ip": ip, "user-agent": "abuse-check/1.0"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return client.post(f"/api/v1{path}", json=body, headers=headers)


def skip_cooldown():
    sql("UPDATE otp_send_events SET created_at = created_at - INTERVAL '61 seconds'")


def otp_mails(to: str) -> list[dict]:
    return [m for m in SENT if m.get("to") == to and "OTP" in (m.get("text_body") or "") + (m.get("subject") or "")]


def register(account_type: str, email: str, phone: str, name: str) -> dict:
    r = post("/auth/otp/request", {"email": email, "purpose": "register"}, ip="198.51.100.200")
    assert r.status_code == 200, r.text
    assert r.json()["expires_in_minutes"] == 5
    body = {
        "account_type": account_type,
        "name": name,
        "email": email,
        "phone": phone,
        "password": "Str0ng!pass",
        "otp": CODE,
        "registration_consent": True,
    }
    r = post("/auth/register", body, ip="198.51.100.200")
    assert r.status_code == 200, r.text
    return r.json()


# ------------------------------------------------------------------------------------------------- OTP


def check_otp_five_then_sixth():
    reset_state()
    email = "five@example.org"
    for i in range(5):
        r = post("/auth/otp/request", {"email": email, "purpose": "register"}, ip=f"198.51.100.{20 + i}")
        assert r.status_code == 200, (i, r.text)
        skip_cooldown()
    r = post("/auth/otp/request", {"email": email, "purpose": "register"}, ip="198.51.100.40")
    assert r.status_code == 429, r.text
    assert r.json()["detail"]["code"] == "OTP_DAILY_LIMIT"
    assert len(otp_mails(email)) == 5
    # Per purpose: the same address can still verify an email today.
    assert post("/auth/otp/request", {"email": email, "purpose": "verify"}, ip="198.51.100.41").status_code == 200


def check_otp_cooldown():
    reset_state()
    email = "cool@example.org"
    assert post("/auth/otp/request", {"email": email, "purpose": "register"}).status_code == 200
    r = post("/auth/otp/request", {"email": email, "purpose": "register"}, ip="198.51.100.99")
    assert r.status_code == 429 and "wait" in r.text.lower(), r.text
    assert len(otp_mails(email)) == 1


def check_otp_rolling_reset():
    reset_state()
    email = "rolling@example.org"
    for _ in range(5):
        assert post("/auth/otp/request", {"email": email, "purpose": "register"}).status_code == 200
        sql("UPDATE otp_send_events SET created_at = created_at - INTERVAL '2 hours'")
    assert post("/auth/otp/request", {"email": email, "purpose": "register"}).status_code == 429
    # Only the oldest send leaves the rolling 24 hours: exactly one more is allowed, then refused again.
    sql(
        "UPDATE otp_send_events SET created_at = NOW() - INTERVAL '24 hours 1 minute' "
        "WHERE id = (SELECT MIN(id) FROM otp_send_events)"
    )
    assert post("/auth/otp/request", {"email": email, "purpose": "register"}).status_code == 200
    skip_cooldown()
    assert post("/auth/otp/request", {"email": email, "purpose": "register"}).status_code == 429


def _race(n: int, fn) -> list:
    barrier, results = threading.Barrier(n), []
    lock = threading.Lock()

    def run():
        db = SessionLocal()
        try:
            barrier.wait()
            out = fn(db)
        finally:
            db.close()
        with lock:
            results.append(out)

    threads = [threading.Thread(target=run) for _ in range(n)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    return results


def check_otp_concurrency():
    reset_state()
    no_cooldown = _race(
        20, lambda db: otp_service.reserve_otp_send(db, email="race@example.org", scope="register", cooldown_seconds=0)
    )
    assert sum(1 for r in no_cooldown if r["allowed"]) == 5, no_cooldown
    with_cooldown = _race(20, lambda db: otp_service.reserve_otp_send(db, email="race2@example.org", scope="register"))
    assert sum(1 for r in with_cooldown if r["allowed"]) == 1, with_cooldown
    rows = sql("SELECT COUNT(*) FROM otp_send_events").scalar()
    assert rows == 6, rows


def check_otp_invalid_lockout_expiry_replay():
    reset_state()
    email = "lock@example.org"
    register("customer", email, "9000000001", "Lock Tester")
    skip_cooldown()
    assert post("/auth/otp/request", {"email": email, "purpose": "login"}).status_code == 200
    statuses = [
        post("/auth/login/otp", {"email": email, "code": "000000", "purpose": "login"}, ip=f"198.51.100.{60 + i}").status_code
        for i in range(5)
    ]
    assert statuses == [401, 401, 401, 401, 429], statuses
    # The real code is burned too.
    assert post("/auth/login/otp", {"email": email, "code": CODE, "purpose": "login"}, ip="198.51.100.70").status_code == 401

    skip_cooldown()
    assert post("/auth/otp/request", {"email": email, "purpose": "login"}).status_code == 200
    sql("UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE consumed = FALSE")
    assert post("/auth/login/otp", {"email": email, "code": CODE, "purpose": "login"}, ip="198.51.100.71").status_code == 401

    skip_cooldown()
    assert post("/auth/otp/request", {"email": email, "purpose": "login"}).status_code == 200
    expiry = sql(
        "SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) FROM otp_codes WHERE consumed = FALSE ORDER BY created_at DESC LIMIT 1"
    ).scalar()
    assert 299 <= float(expiry) <= 301, expiry
    assert post("/auth/login/otp", {"email": email, "code": CODE, "purpose": "login"}, ip="198.51.100.72").status_code == 200
    assert post("/auth/login/otp", {"email": email, "code": CODE, "purpose": "login"}, ip="198.51.100.73").status_code == 401

    # Concurrent use of one valid code: exactly one succeeds.
    skip_cooldown()
    assert post("/auth/otp/request", {"email": email, "purpose": "login"}).status_code == 200
    wins = _race(8, lambda db: otp_service.verify_email_otp(db, email=email, code=CODE, purpose="login")["ok"])
    assert wins.count(True) == 1, wins


def check_otp_no_enumeration():
    reset_state()
    known = "known@example.org"
    register("customer", known, "9000000002", "Known Person")
    reset_state()
    unknown = "nobody-here@example.org"
    seq = {}
    for email in (known, unknown):
        out = []
        for i in range(7):
            r = post("/auth/otp/request", {"email": email, "purpose": "login"}, ip=f"198.51.100.{100 + i}")
            # Wait times can differ by a second between the two runs; everything else must match.
            out.append((r.status_code, re.sub(r"\d+s\)", "Ns)", r.text)))
            if i != 1:
                skip_cooldown()
        seq[email] = out
    assert seq[known] == seq[unknown], seq
    assert [s for s, _ in seq[known]] == [200, 200, 429, 200, 200, 200, 429]
    assert len(otp_mails(known)) == 5 and otp_mails(unknown) == []


def check_ip_limit():
    reset_state()
    codes = [
        post("/auth/otp/request", {"email": f"ip{i}@example.org", "purpose": "register"}, ip="198.51.100.150").status_code
        for i in range(21)
    ]
    assert codes[:20] == [200] * 20 and codes[20] == 429, codes


def check_global_otp_breaker():
    reset_state()
    settings.otp_public_emails_per_hour = 3
    codes = [
        post("/auth/otp/request", {"email": f"g{i}@example.org", "purpose": "register"}, ip=f"198.51.100.{i + 1}").status_code
        for i in range(5)
    ]
    assert codes == [200, 200, 200, 503, 503], codes
    assert len(SENT) == 3


def check_registration_customer_and_pujari():
    reset_state()
    c = register("customer", "newcust@example.org", "9000000003", "New Customer")
    assert c["user"]["role"] == "customer"
    p = register("pujari", "newpujari@example.org", "9000000004", "Ravi Kumar Sharma")
    assert p["user"]["role"] == "pujari"


def check_register_no_enumeration():
    reset_state()
    register("customer", "taken@example.org", "9000000006", "Taken Person")
    body = {
        "account_type": "customer", "name": "Someone Else", "email": "taken@example.org", "phone": "9000000007",
        "password": "Str0ng!pass", "otp": "999999", "registration_consent": True,
    }
    # Without the emailed code, an existing address looks exactly like any other: wrong code, not "exists".
    r = post("/auth/register", body, ip="198.51.100.210")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "INVALID_OTP", r.text
    r = post("/auth/register", dict(body, email="fresh@example.org", phone="9000000006"), ip="198.51.100.211")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "INVALID_OTP", r.text
    # Whoever holds the mailbox's code is told the account exists.
    skip_cooldown()
    assert post("/auth/otp/request", {"email": "taken@example.org", "purpose": "register"}, ip="198.51.100.212").status_code == 200
    r = post("/auth/register", dict(body, otp=CODE), ip="198.51.100.212")
    assert r.status_code == 409, r.text
    cfg = client.get("/api/v1/config/public").json()
    assert cfg["email_delivery"] == {"configured": False}, cfg["email_delivery"]


def _super_admin(email: str) -> None:
    sql(
        """
        INSERT INTO users (id, name, email, phone, password_hash, role)
        VALUES (gen_random_uuid(), 'Super Admin', :e, '9000000099', :pw, 'super_admin')
        ON CONFLICT DO NOTHING
        """,
        e=email,
        pw=hash_password("Sup3r!admin"),
    )


def check_super_admin_two_factor_preserved():
    reset_state()
    email = "root@example.org"
    _super_admin(email)
    # Public OTP requests for the Super Admin's address send nothing and do not use up its own sends.
    for i in range(6):
        post("/auth/otp/request", {"email": email, "purpose": "login"}, ip=f"198.51.100.{170 + i}")
        skip_cooldown()
    assert otp_mails(email) == []
    r = post("/auth/login", {"identifier": email, "password": "Sup3r!admin"})
    assert r.status_code == 200 and r.json()["otp_required"] is True, r.text
    assert r.json()["expires_in_minutes"] == 5
    challenge = r.json()["challenge_token"]
    assert post("/auth/login/otp/complete", {"challenge_token": challenge, "code": "111111"}).status_code == 401
    r = post("/auth/login/otp/complete", {"challenge_token": challenge, "code": CODE})
    assert r.status_code == 200, r.text
    assert r.json()["user"]["role"] == "super_admin"
    # The emailed code alone (no password step) never signs a Super Admin in.
    assert post("/auth/login/otp", {"email": email, "code": CODE, "purpose": "login"}).status_code == 401
    # Super Admin login is not subject to the public daily cap: 6 logins in a day all get their OTP.
    for _ in range(6):
        skip_cooldown()
        assert post("/auth/login", {"identifier": email, "password": "Sup3r!admin"}).status_code == 200
    assert len(otp_mails(email)) == 7


def check_sensitive_action_not_capped_daily():
    reset_state()
    for _ in range(8):
        db = SessionLocal()
        try:
            out = otp_service.issue_email_otp(
                db, email="money@example.org", purpose="sensitive_action", daily_limit=None, hourly_limit=20, cooldown_seconds=30
            )
        finally:
            db.close()
        assert out["ok"], out
        skip_cooldown()


# ------------------------------------------------------------------------------------------------- contact

CONTACT = {
    "name": "Asha Rao",
    "email": "asha@example.org",
    "country_code": "+91",
    "phone": "9876543210",
    "subject": "Custom puja request",
    "message": "Please arrange a Satyanarayan puja next month at our home.",
    "elapsed_ms": 25000,
}


def _contact_rows():
    return [dict(r._mapping) for r in sql("SELECT * FROM contact_submissions ORDER BY created_at")]


def check_contact_accepted_and_duplicate():
    reset_state()
    r = post("/support/contact", CONTACT)
    assert r.status_code == 200 and r.json() == {"ok": True, "message": "Thank you. Your message has been received. We will get back to you soon."}, r.text
    rows = _contact_rows()
    assert [x["status"] for x in rows] == ["accepted"] and rows[0]["team_emailed_at"] is not None
    assert rows[0]["client_ip"] == "198.51.100.10" and rows[0]["user_agent"] == "abuse-check/1.0"
    team = [m for m in SENT if m["to"] != CONTACT["email"]]
    ack = [m for m in SENT if m["to"] == CONTACT["email"]]
    assert team and len(ack) == 1
    assert team[0]["subject"] == "BSeva Admin — Website contact: Custom puja request"
    sent_before = len(SENT)
    # Same person, same text, from another address and with spacing changed: stored as duplicate, no mail.
    dup = dict(CONTACT, message="  Please arrange a Satyanarayan   puja next month at our home. ")
    r = post("/support/contact", dup, ip="198.51.100.11")
    assert r.status_code == 200
    assert [x["status"] for x in _contact_rows()] == ["accepted", "duplicate"]
    assert len(SENT) == sent_before


def check_contact_bot_signals():
    reset_state()
    honeypot = dict(CONTACT, website="http://spam.example", message="Buy cheap things now from our shop today")
    fast = dict(CONTACT, email="fast@example.org", elapsed_ms=400, message="Another quick message here please")
    links = dict(
        CONTACT,
        email="links@example.org",
        message=" ".join(f"https://spam{i}.example" for i in range(6)),
    )
    for i, body in enumerate((honeypot, fast, links)):
        r = post("/support/contact", body, ip=f"198.51.100.{30 + i}")
        assert r.status_code == 200, r.text
    rows = _contact_rows()
    assert [(x["status"], x["spam_reason"]) for x in rows] == [
        ("spam", "honeypot"), ("spam", "too_fast"), ("spam", "too_many_links"),
    ], rows
    assert SENT == []


def check_contact_injection():
    reset_state()
    payload = dict(
        CONTACT,
        email="inject@example.org",
        subject="Hello\r\nBcc: victim@example.net",
        message='<script>alert(1)</script><a href="https://phish.example">Claim your prize</a> please call us',
    )
    r = post("/support/contact", payload)
    assert r.status_code == 200, r.text
    team = [m for m in SENT if m["to"] != "inject@example.org"]
    ack = [m for m in SENT if m["to"] == "inject@example.org"]
    assert team and ack
    assert "\n" not in team[0]["subject"] and "\r" not in team[0]["subject"]
    assert "<script>" not in team[0]["html_body"] and "&lt;script&gt;" in team[0]["html_body"]
    assert '<a href="https://phish.example"' not in team[0]["html_body"]
    for part in ("html_body", "text_body", "subject"):
        assert "phish" not in ack[0][part] and "script" not in ack[0][part] and "Bcc" not in ack[0][part], ack[0][part]
    for bad_name in ("<b>Asha</b>", "Visit www.spam.example", "asha@example.org"):
        assert post("/support/contact", dict(CONTACT, name=bad_name)).status_code == 400


def check_contact_limits():
    reset_state()
    codes = [
        post(
            "/support/contact",
            dict(CONTACT, email=f"p{i}@example.org", phone=f"90000001{i:02d}", message=f"Message number {i} for the team"),
            ip="198.51.100.77",
        ).status_code
        for i in range(6)
    ]
    assert codes == [200] * 5 + [429], codes
    reset_state()
    codes = [
        post("/support/contact", dict(CONTACT, message=f"Same email message {i} here"), ip=f"198.51.100.{80 + i}").status_code
        for i in range(4)
    ]
    assert codes == [200, 200, 200, 429], codes
    assert len(_contact_rows()) == 3


def check_contact_global_cap():
    reset_state()
    settings.contact_team_emails_per_hour = 2
    for i in range(4):
        body = dict(CONTACT, email=f"vol{i}@example.org", phone=f"90000002{i:02d}", message=f"Volume message {i} for the team")
        assert post("/support/contact", body, ip=f"198.51.100.{90 + i}").status_code == 200
    assert [x["status"] for x in _contact_rows()] == ["accepted", "accepted", "held", "held"]
    alerts = [m for m in SENT if "volume alert" in m["subject"].lower()]
    acks = [m for m in SENT if m["to"].startswith("vol")]
    assert alerts and len({m["to"] for m in alerts}) == len(alerts), alerts  # one alert per inbox, once
    assert len(acks) == 2


def check_datastore_failure_fails_closed():
    reset_state()
    sql("ALTER TABLE security_rate_limits RENAME TO security_rate_limits_off")
    try:
        r = post("/support/contact", CONTACT)
        assert r.status_code == 503, r.text
        r = post("/auth/otp/request", {"email": "down@example.org", "purpose": "register"})
        assert r.status_code == 503, r.text
        assert SENT == []
        # Password sign-in keeps working (its counters fail open by design).
        r = post("/auth/login", {"identifier": "nobody@example.org", "password": "whatever1"})
        assert r.status_code == 401, r.text
    finally:
        sql("ALTER TABLE security_rate_limits_off RENAME TO security_rate_limits")
    assert _contact_rows() == []
    sql("ALTER TABLE otp_send_events RENAME TO otp_send_events_off")
    try:
        r = post("/auth/otp/request", {"email": "down2@example.org", "purpose": "register"})
        assert r.status_code == 503, r.text
        assert SENT == []
    finally:
        sql("ALTER TABLE otp_send_events_off RENAME TO otp_send_events")


def check_bot_check_modes():
    from app import bot_check

    reset_state()
    calls = []

    def fake_verify(token, *, ip, action):
        calls.append((token, action))
        return (token == "good"), ("ok" if token == "good" else "rejected:invalid-input-response")

    bot_check.verify_turnstile = fake_verify
    settings.turnstile_secret_key = "test-secret"
    settings.turnstile_site_key = "test-site"
    settings.contact_bot_check = "enforce"
    r = post("/support/contact", dict(CONTACT, bot_token="bad"))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "BOT_CHECK_FAILED", r.text
    assert _contact_rows() == [] and SENT == []
    assert post("/support/contact", dict(CONTACT, bot_token="good"), ip="198.51.100.12").status_code == 200
    # Signed-in app users have no Turnstile and are not asked for it.
    token = register("customer", "appuser@example.org", "9000000005", "App User")["access_token"]
    body = dict(CONTACT, email="appuser@example.org", message="Message from the mobile app please")
    body.pop("elapsed_ms")
    r = post("/support/contact", body, ip="198.51.100.13", token=token)
    assert r.status_code == 200, r.text
    assert _contact_rows()[-1]["user_id"] is not None
    # OTP requests stay in monitor mode: no token (the mobile apps) still works.
    settings.otp_bot_check = "monitor"
    assert post("/auth/otp/request", {"email": "mon@example.org", "purpose": "register"}, ip="198.51.100.14").status_code == 200
    cfg = client.get("/api/v1/config/public").json()
    assert cfg["turnstile_site_key"] == "test-site" and cfg["contact_bot_check"] == "enforce"
    assert "turnstile_secret_key" not in cfg and "test-secret" not in str(cfg)


CHECKS = {name[len("check_"):]: fn for name, fn in globals().items() if name.startswith("check_")}

if __name__ == "__main__":
    assert settings.environment == "development", settings.environment
    assert "127.0.0.1" in settings.database_url or "localhost" in settings.database_url, "loopback test DB only"
    from app.mail.smtp_client import smtp_configured

    assert not smtp_configured(), "SMTP must be blank for these checks"
    CHECKS[sys.argv[1]]()
    print("PASS", sys.argv[1])
