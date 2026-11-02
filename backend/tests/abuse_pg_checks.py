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

from fastapi import HTTPException  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app import captcha, otp_service  # noqa: E402
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
# Every CAPTCHA in these checks shows this answer, so a check can solve it like a person would.
CAPTCHA_ANSWER = "K7M4P"
REAL_NEW_ANSWER = captcha._new_answer
captcha._new_answer = lambda: CAPTCHA_ANSWER
client = TestClient(app)


def sql(statement: str, **params):
    with engine.begin() as conn:
        return conn.execute(text(statement), params)


def reset_state():
    sql("TRUNCATE otp_send_events, security_rate_limits, contact_submissions, captcha_challenges")
    sql("UPDATE otp_codes SET consumed = TRUE")
    SENT.clear()


def new_captcha(purpose: str, ip: str = "198.51.100.10", replaces: str | None = None):
    return client.post(
        "/api/v1/captcha", json={"purpose": purpose, "replaces": replaces}, headers={"x-real-ip": ip, "user-agent": "abuse-check/1.0"}
    )


def solved(purpose: str, ip: str = "198.51.100.10", answer: str = CAPTCHA_ANSWER) -> dict:
    r = new_captcha(purpose, ip)
    assert r.status_code == 200, r.text
    return {"captcha_id": r.json()["captcha_id"], "captcha_answer": answer}


def post(path: str, body: dict, ip: str = "198.51.100.10", token: str | None = None):
    # Anonymous contact submissions answer the CAPTCHA the way the web form does, unless a check sets its own.
    if path == "/support/contact" and not token and "captcha_id" not in body:
        r = new_captcha("contact", ip)
        if r.status_code == 200:
            body = dict(body, captcha_id=r.json()["captcha_id"], captcha_answer=CAPTCHA_ANSWER)
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


# ------------------------------------------------------------------------------------- account codes
# Forgot password, account deletion and cancel deletion email a code from app.routers.account and must be
# held to the same limits as /auth/otp/request.

ACCOUNT_CODE_ENDPOINTS = (
    ("/auth/password/forgot", "reset"),
    ("/account/deletion/public/request-otp", "delete_account"),
)


def mails_to(to: str) -> list[dict]:
    return [m for m in SENT if m.get("to") == to]


def check_account_codes_five_then_sixth_and_cooldown():
    reset_state()
    email = "reset5@example.org"
    register("customer", email, "9000000010", "Reset Five")
    for path, _purpose in ACCOUNT_CODE_ENDPOINTS:
        reset_state()
        assert post(path, {"email": email}, ip="198.51.100.30").status_code == 200
        # Cooldown: a second request within a minute is refused and sends nothing.
        r = post(path, {"email": email}, ip="198.51.100.31")
        assert r.status_code == 429 and r.json()["detail"]["code"] == "OTP_RATE_LIMITED", (path, r.text)
        for i in range(4):
            skip_cooldown()
            assert post(path, {"email": email}, ip=f"198.51.100.{32 + i}").status_code == 200, (path, i)
        skip_cooldown()
        r = post(path, {"email": email}, ip="198.51.100.39")
        assert r.status_code == 429, (path, r.text)
        assert len(mails_to(email)) == 5, (path, len(mails_to(email)))


def check_account_codes_no_enumeration():
    reset_state()
    known = "resetknown@example.org"
    register("customer", known, "9000000011", "Reset Known")
    for path, _purpose in ACCOUNT_CODE_ENDPOINTS:
        seq = {}
        for email in (known, "reset-nobody@example.org"):
            reset_state()
            out = []
            for i in range(7):
                r = post(path, {"email": email}, ip=f"198.51.100.{110 + i}")
                out.append((r.status_code, re.sub(r'"retry_after_seconds":\d+', "N", r.text)))
                if i != 1:
                    skip_cooldown()
            seq[email] = out
        assert seq[known] == seq["reset-nobody@example.org"], (path, seq)
        assert [s for s, _ in seq[known]] == [200, 200, 429, 200, 200, 200, 429], (path, seq[known])


def check_account_codes_ip_limits():
    reset_state()
    # Hourly: 20 code requests per client address across every code endpoint, then refused.
    codes = [
        post(ACCOUNT_CODE_ENDPOINTS[i % 2][0], {"email": f"ipr{i}@example.org"}, ip="198.51.100.160").status_code
        for i in range(21)
    ]
    assert codes[:20] == [200] * 20 and codes[20] == 429, codes
    # The same client counter as /auth/otp/request.
    assert post("/auth/otp/request", {"email": "ipr-x@example.org", "purpose": "register"}, ip="198.51.100.160").status_code == 429
    # Daily: the per-day cap applies to these endpoints as well.
    reset_state()
    settings.otp_requests_per_ip_per_day = 3
    codes = [
        post("/auth/password/forgot", {"email": f"ipd{i}@example.org"}, ip="198.51.100.161").status_code for i in range(4)
    ]
    assert codes == [200, 200, 200, 429], codes


def check_account_codes_global_breaker():
    reset_state()
    for i in range(4):
        register("customer", f"gr{i}@example.org", f"90000001{i:02d}", f"Global Reset {i}")
    reset_state()
    settings.otp_public_emails_per_hour = 3
    codes = [
        post("/auth/password/forgot", {"email": f"gr{i}@example.org"}, ip=f"198.51.100.{180 + i}").status_code
        for i in range(4)
    ]
    assert codes == [200, 200, 200, 503], codes
    assert len(SENT) == 3
    # The cap is shared with /auth/otp/request and the deletion endpoints.
    assert post("/account/deletion/public/request-otp", {"email": "gr0@example.org"}, ip="198.51.100.190").status_code == 503
    assert post("/auth/otp/request", {"email": "gr-new@example.org", "purpose": "register"}, ip="198.51.100.191").status_code == 503


def check_account_codes_fail_closed():
    reset_state()
    register("customer", "resetdown@example.org", "9000000012", "Reset Down")
    reset_state()
    for table in ("security_rate_limits", "otp_send_events"):
        sql(f"ALTER TABLE {table} RENAME TO {table}_off")
        try:
            for path, _purpose in ACCOUNT_CODE_ENDPOINTS:
                r = post(path, {"email": "resetdown@example.org"})
                assert r.status_code == 503, (table, path, r.text)
            assert SENT == [], table
        finally:
            sql(f"ALTER TABLE {table}_off RENAME TO {table}")


def check_password_reset_customer_and_pujari():
    reset_state()
    for kind, email, phone in (("customer", "rc@example.org", "9000000013"), ("pujari", "rp@example.org", "9000000014")):
        token = register(kind, email, phone, f"Reset {kind.title()} Person")["access_token"]
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 200
        skip_cooldown()
        before = len(mails_to(email))
        assert post("/auth/password/forgot", {"email": email}, ip="198.51.100.80").status_code == 200
        assert len(mails_to(email)) == before + 1
        bad = post("/auth/password/reset", {"email": email, "code": "111111", "new_password": "N3w!password"}, ip="198.51.100.81")
        assert bad.status_code == 400 and bad.json()["detail"]["code"] == "INVALID_CODE", bad.text
        ok = post("/auth/password/reset", {"email": email, "code": CODE, "new_password": "N3w!password"}, ip="198.51.100.82")
        assert ok.status_code == 200, ok.text
        # Every earlier session ends; the old password stops working; the new one signs in.
        assert client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401
        assert post("/auth/login", {"identifier": email, "password": "Str0ng!pass"}, ip="198.51.100.83").status_code == 401
        assert post("/auth/login", {"identifier": email, "password": "N3w!password"}, ip="198.51.100.84").status_code == 200
        # Replay: the used code cannot reset the password again.
        again = post("/auth/password/reset", {"email": email, "code": CODE, "new_password": "An0ther!pass"}, ip="198.51.100.85")
        assert again.status_code == 400, again.text


def check_password_reset_expiry_and_attempts():
    reset_state()
    email = "rexp@example.org"
    register("customer", email, "9000000015", "Reset Expiry")
    skip_cooldown()
    assert post("/auth/password/forgot", {"email": email}).status_code == 200
    expiry = sql(
        "SELECT EXTRACT(EPOCH FROM (expires_at - created_at)) FROM otp_codes WHERE consumed = FALSE ORDER BY created_at DESC LIMIT 1"
    ).scalar()
    assert 299 <= float(expiry) <= 301, expiry
    sql("UPDATE otp_codes SET expires_at = NOW() - INTERVAL '1 second' WHERE consumed = FALSE")
    r = post("/auth/password/reset", {"email": email, "code": CODE, "new_password": "N3w!password"}, ip="198.51.100.86")
    assert r.status_code == 400, r.text
    # Five wrong guesses burn the code: the right code is then refused too.
    skip_cooldown()
    assert post("/auth/password/forgot", {"email": email}).status_code == 200
    statuses = [
        post("/auth/password/reset", {"email": email, "code": "000000", "new_password": "N3w!password"}, ip=f"198.51.100.{90 + i}").status_code
        for i in range(5)
    ]
    assert statuses[:4] == [400] * 4 and statuses[4] == 429, statuses
    r = post("/auth/password/reset", {"email": email, "code": CODE, "new_password": "N3w!password"}, ip="198.51.100.96")
    assert r.status_code == 400, r.text


def check_password_reset_not_for_admins():
    reset_state()
    for email, phone, role, password in (
        ("root-reset@example.org", "9000000097", "super_admin", "Sup3r!admin"),
        ("ops-reset@example.org", "9000000098", "admin", "Adm1n!pass"),
    ):
        sql(
            """
            INSERT INTO users (id, name, email, phone, password_hash, role)
            VALUES (gen_random_uuid(), 'Reset Admin', :e, :ph, :pw, :role)
            """,
            e=email, ph=phone, pw=hash_password(password), role=role,
        )
    for email in ("root-reset@example.org", "ops-reset@example.org"):
        r = post("/auth/password/forgot", {"email": email}, ip="198.51.100.120")
        assert r.status_code == 200, r.text
        assert mails_to(email) == []
        r = post("/auth/password/reset", {"email": email, "code": CODE, "new_password": "Hijack!pass1"}, ip="198.51.100.121")
        assert r.status_code == 400, r.text
        skip_cooldown()
    # Admin passwords are unchanged and Super Admin sign-in still needs its emailed code.
    r = post("/auth/login", {"identifier": "root-reset@example.org", "password": "Sup3r!admin"}, ip="198.51.100.122")
    assert r.status_code == 200 and r.json()["otp_required"] is True, r.text
    r = post("/auth/login", {"identifier": "ops-reset@example.org", "password": "Adm1n!pass"}, ip="198.51.100.123")
    assert r.status_code == 200 and r.json()["access_token"], r.text


def check_deletion_and_cancel_codes():
    reset_state()
    email = "delc@example.org"
    token = register("customer", email, "9000000016", "Delete Cancel")["access_token"]
    auth = {"Authorization": f"Bearer {token}"}
    skip_cooldown()
    body = {"reason": "privacy", "explanation": "Testing the deletion code limits"}
    r = client.post("/api/v1/account/deletion/request-otp", json=body, headers={**auth, "x-real-ip": "198.51.100.130"})
    assert r.status_code == 200, r.text
    r = client.post(
        "/api/v1/account/deletion/confirm", json={**body, "code": CODE, "acknowledge": True},
        headers={**auth, "x-real-ip": "198.51.100.131"},
    )
    assert r.status_code == 200, r.text
    assert sql("SELECT account_state FROM users WHERE email = :e", e=email).scalar() == "deletion_requested"
    # Cancel: same per-address limits (cooldown) and the same reply for an address with no request.
    assert post("/account/deletion/cancel/request-otp", {"email": email}, ip="198.51.100.132").status_code == 200
    assert post("/account/deletion/cancel/request-otp", {"email": email}, ip="198.51.100.133").status_code == 429
    other = post("/account/deletion/cancel/request-otp", {"email": "no-request@example.org"}, ip="198.51.100.134")
    assert other.status_code == 200 and other.json()["message"] == post(
        "/account/deletion/cancel/request-otp", {"email": "no-request2@example.org"}, ip="198.51.100.135"
    ).json()["message"]
    r = post("/account/deletion/cancel", {"email": email, "code": CODE}, ip="198.51.100.136")
    assert r.status_code == 200, r.text
    assert sql("SELECT account_state FROM users WHERE email = :e", e=email).scalar() == "active"


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


# ------------------------------------------------------------------------------------------------- captcha


def check_captcha_contact_enforced():
    reset_state()
    # Missing: a direct API call without a CAPTCHA is refused and nothing is stored or sent.
    r = post("/support/contact", dict(CONTACT, captcha_id=None))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", r.text
    # Wrong answer: refused.
    r = post("/support/contact", dict(CONTACT, **solved("contact", answer="ZZZZZ")))
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_INVALID", r.text
    assert _contact_rows() == [] and SENT == []
    # Correct answer, typed in lower case with spaces: accepted, stored and sent.
    r = post("/support/contact", dict(CONTACT, **solved("contact", answer=" k7m 4p ")))
    assert r.status_code == 200, r.text
    assert [x["status"] for x in _contact_rows()] == ["accepted"]
    # Signed-in users (the mobile apps) are not asked.
    token = register("customer", "appuser@example.org", "9000000005", "App User")["access_token"]
    body = dict(CONTACT, email="appuser@example.org", message="Message from the mobile app please")
    body.pop("elapsed_ms")
    r = post("/support/contact", body, ip="198.51.100.13", token=token)
    assert r.status_code == 200, r.text
    assert _contact_rows()[-1]["user_id"] is not None


def check_captcha_answer_never_exposed():
    reset_state()
    r = new_captcha("contact")
    assert r.status_code == 200 and r.headers.get("cache-control") == "no-store", r.headers
    out = r.json()
    assert set(out) == {"captcha_id", "image", "length", "expires_in_seconds"}, out
    assert out["image"].startswith("data:image/png;base64,") and out["length"] == 5 and out["expires_in_seconds"] == 300
    assert CAPTCHA_ANSWER not in r.text.upper()
    row = sql("SELECT * FROM captcha_challenges").mappings().one()
    assert out["captcha_id"] not in str(dict(row)) and CAPTCHA_ANSWER not in str(dict(row)), row
    assert (row["expires_at"] - row["created_at"]).total_seconds() == 300
    # Real answers use only unambiguous characters.
    answers = [REAL_NEW_ANSWER() for _ in range(200)]
    assert all(len(a) == 5 and a.isalnum() and a == a.upper() and not set(a) & set("O0I1L") for a in answers), answers
    assert len(set(answers)) > 190  # unpredictable, not a fixed list
    cfg = client.get("/api/v1/config/public").json()
    assert cfg["captcha"]["contact"] is True and cfg["captcha"]["custom_puja"] is True, cfg["captcha"]
    for gone in ("turnstile_site_key", "contact_bot_check", "otp_bot_check", "recaptcha_site_key", "registration_captcha_enabled"):
        assert gone not in cfg, gone


def check_captcha_single_use_expiry_refresh_tamper():
    reset_state()
    n = iter(range(200, 255))

    def send(extra: dict, *, email: str | None = None):
        # A fresh client address and sender each time, so the form's own rate limits never interfere.
        i = next(n)
        body = dict(
            CONTACT, email=email or f"cap{i}@example.org", phone=f"98765{i:05d}", message=f"Captcha check message number {i}", **extra
        )
        return post("/support/contact", body, ip=f"198.51.101.{i}")

    used = solved("contact", ip="198.51.101.1")
    assert send(used).status_code == 200
    # Reused: the same solved challenge cannot be sent again.
    r = send(used)
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_INVALID", r.text
    # Expired.
    expired = solved("contact", ip="198.51.101.2")
    sql("UPDATE captcha_challenges SET expires_at = NOW() - INTERVAL '1 second' WHERE used_at IS NULL")
    assert send(expired).status_code == 400
    # Refresh: the replaced challenge stops working, the new one works.
    old = new_captcha("contact", ip="198.51.101.3").json()["captcha_id"]
    new = new_captcha("contact", ip="198.51.101.3", replaces=old).json()["captcha_id"]
    assert send({"captcha_id": old, "captcha_answer": CAPTCHA_ANSWER}).status_code == 400
    assert send({"captcha_id": new, "captcha_answer": CAPTCHA_ANSWER}).status_code == 200
    # Modified requests: an invented id, an id for another form, or a truncated id are all refused.
    for bad_id in ("x" * 43, solved("register", ip="198.51.101.4")["captcha_id"], solved("contact", ip="198.51.101.5")["captcha_id"][:-2]):
        r = send({"captcha_id": bad_id, "captcha_answer": CAPTCHA_ANSWER})
        assert r.status_code == 400, (bad_id, r.text)
    # Three wrong answers burn a challenge: the right answer is then refused too.
    burn = solved("contact", ip="198.51.101.6")["captcha_id"]
    for _ in range(3):
        assert send({"captcha_id": burn, "captcha_answer": "ZZZZZ"}).status_code == 400
    assert send({"captcha_id": burn, "captcha_answer": CAPTCHA_ANSWER}).status_code == 400
    assert len([x for x in _contact_rows() if x["status"] == "accepted"]) == 2


def check_captcha_concurrent_use():
    reset_state()
    cid = solved("contact")["captcha_id"]
    wins = _race(10, lambda db: captcha._consume(db, cid, CAPTCHA_ANSWER, "contact"))
    assert wins.count(True) == 1, wins


def check_captcha_rate_limits():
    reset_state()
    codes = [new_captcha("contact", ip="198.51.100.140").status_code for _ in range(31)]
    assert codes[:30] == [200] * 30 and codes[30] == 429, codes
    # Too many wrong answers from one client: refused even when the next answer is right.
    reset_state()
    db = SessionLocal()
    try:
        for i in range(20):
            cid = solved("contact", ip=f"198.51.101.{i + 10}")["captcha_id"]
            try:
                captcha.require(db, cid, "ZZZZZ", purpose="contact", ip="198.51.100.141")
                raise AssertionError("wrong answer accepted")
            except HTTPException as exc:
                assert exc.status_code == 400, exc.detail
        cid = solved("contact", ip="198.51.101.40")["captcha_id"]
        try:
            captcha.require(db, cid, CAPTCHA_ANSWER, purpose="contact", ip="198.51.100.141")
            raise AssertionError("blocked client accepted")
        except HTTPException as exc:
            assert exc.status_code == 429, exc.detail
    finally:
        db.close()
    assert new_captcha("nonsense").status_code in (400, 422)


def check_captcha_fails_closed():
    reset_state()
    sql("ALTER TABLE captcha_challenges RENAME TO captcha_challenges_off")
    try:
        assert new_captcha("contact").status_code == 503
        r = post("/support/contact", dict(CONTACT, captcha_id="x" * 43, captcha_answer=CAPTCHA_ANSWER))
        assert r.status_code == 503, r.text
    finally:
        sql("ALTER TABLE captcha_challenges_off RENAME TO captcha_challenges")
    assert _contact_rows() == [] and SENT == []


def _token(email: str) -> str:
    """A signed-in session for an existing account (a Super Admin's carries its completed second step)."""
    from app.security import create_access_token

    row = sql("SELECT id, role, password_hash FROM users WHERE email = :e", e=email).mappings().one()
    return create_access_token(str(row["id"]), row["role"], row["password_hash"], mfa=row["role"] == "super_admin")


def _staff(email: str, role: str, phone: str) -> str:
    sql(
        "INSERT INTO users (id, name, email, phone, password_hash, role) "
        "VALUES (gen_random_uuid(), :n, :e, :p, :pw, :r) ON CONFLICT DO NOTHING",
        n=f"Captcha {role}", e=email, p=phone, pw=hash_password("Sup3r!admin"), r=role,
    )
    return _token(email)


def _switch(token: str, feature: str, enabled: bool):
    return client.put(
        f"/api/v1/admin/security/captcha/{feature}", json={"enabled": enabled},
        headers={"Authorization": f"Bearer {token}", "x-real-ip": "198.51.100.230"},
    )


def _all_switches_on():
    sql("UPDATE captcha_settings SET enabled = TRUE, updated_by = NULL, updated_by_name = NULL")


def check_captcha_settings_default_on_and_rollout_switch():
    reset_state()
    _all_switches_on()
    root = _staff("root-cs1@example.org", "super_admin", "9000000081")
    view = client.get("/api/v1/admin/security/captcha", headers={"Authorization": f"Bearer {root}"}).json()
    assert [(x["feature"], x["enabled"], x["locked"]) for x in view["mandatory"]] == [
        ("contact", True, True), ("custom_puja", True, True)
    ], view
    assert [(x["feature"], x["enabled"]) for x in view["configurable"]] == [
        ("customer_register", True), ("pujari_register", True), ("customer_login", True), ("pujari_login", True)
    ], view
    # Saved ON, but not enforced until the deployment turns enforcement on (older app builds send no CAPTCHA).
    assert view["enforcement_active"] is False
    off = {"contact": True, "custom_puja": True, "customer_register": False, "pujari_register": False,
           "customer_login": False, "pujari_login": False}
    assert client.get("/api/v1/config/public").json()["captcha"] == off
    assert post("/auth/otp/request", {"email": "old-app@example.org", "purpose": "register"}).status_code == 200
    settings.captcha_settings_enforcement = True
    assert client.get("/api/v1/config/public").json()["captcha"] == {k: True for k in off}
    r = post("/auth/otp/request", {"email": "old-app2@example.org", "purpose": "register"}, ip="198.51.100.231")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", r.text
    # A store that cannot be read counts every switch as ON.
    sql("ALTER TABLE captcha_settings RENAME TO captcha_settings_off")
    try:
        assert client.get("/api/v1/config/public").json()["captcha"] == {k: True for k in off}
    finally:
        sql("ALTER TABLE captcha_settings_off RENAME TO captcha_settings")


def check_captcha_mandatory_cannot_be_disabled():
    reset_state()
    _all_switches_on()
    root = _staff("root-cs2@example.org", "super_admin", "9000000082")
    # API: no switch exists for Contact Us or Custom Puja.
    for feature in ("contact", "custom_puja", "contact_us", "custompuja"):
        r = _switch(root, feature, False)
        assert r.status_code == 422, (feature, r.status_code, r.text)
    # Database: the settings table cannot hold a row for them, and look-alike platform settings are ignored.
    for feature in ("contact", "custom_puja"):
        try:
            sql("INSERT INTO captcha_settings (feature, enabled) VALUES (:f, FALSE)", f=feature)
            raise AssertionError(f"{feature} row accepted")
        except Exception as exc:  # noqa: BLE001
            assert "check" in str(exc).lower(), exc
    for key in ("contact_captcha", "custom_puja_captcha", "captcha_contact", "registration_captcha_enabled"):
        sql(
            "INSERT INTO platform_settings (key, value) VALUES (:k, 'false'::jsonb) "
            "ON CONFLICT (key) DO UPDATE SET value = 'false'::jsonb", k=key,
        )
    # Every switchable CAPTCHA off, enforcement off and on: both forms still ask signed-out visitors.
    for feature in ("customer_register", "pujari_register", "customer_login", "pujari_login"):
        assert _switch(root, feature, False).status_code == 200
    for enforcement in (False, True):
        settings.captcha_settings_enforcement = enforcement
        for i, subject in enumerate(("General question", "custom_puja", "Custom puja request")):
            body = dict(
                CONTACT, subject=subject, email=f"m{i}{int(enforcement)}@example.org",
                phone=f"9876{i}{int(enforcement)}0000", captcha_id=None,
            )
            r = post("/support/contact", body, ip=f"198.51.100.{240 + i + 3 * int(enforcement)}")
            assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", (subject, r.text)
        cfg = client.get("/api/v1/config/public").json()["captcha"]
        assert cfg["contact"] is True and cfg["custom_puja"] is True, cfg
    assert _contact_rows() == [] and SENT == []
    # With the answer it is accepted; signed-in users keep their exemption.
    assert post("/support/contact", dict(CONTACT, subject="custom_puja"), ip="198.51.100.250").status_code == 200
    token = register("customer", "signedin-cs@example.org", "9000000083", "Signed In")["access_token"]
    body = dict(CONTACT, subject="custom_puja", email="signedin-cs@example.org", message="Custom puja from the app please")
    assert post("/support/contact", body, ip="198.51.100.251", token=token).status_code == 200
    sql("DELETE FROM platform_settings WHERE key IN ('contact_captcha', 'custom_puja_captcha', 'captcha_contact', 'registration_captcha_enabled')")
    _all_switches_on()


def check_captcha_switches_super_admin_only_and_audited():
    reset_state()
    _all_switches_on()
    root = _staff("root-cs3@example.org", "super_admin", "9000000084")
    admin = _staff("admin-cs3@example.org", "admin", "9000000085")
    assert _switch(admin, "customer_login", False).status_code == 403
    assert client.get("/api/v1/admin/security/captcha", headers={"Authorization": f"Bearer {admin}"}).status_code == 403
    assert client.put("/api/v1/admin/security/captcha/customer_login", json={"enabled": False}).status_code == 401
    before = sql("SELECT count(*) FROM security_audit_log WHERE action = 'captcha_setting_change'").scalar()
    view = _switch(root, "pujari_register", False).json()
    row = {x["feature"]: x for x in view["configurable"]}["pujari_register"]
    assert row["enabled"] is False and row["updated_by_name"] == "Captcha super_admin" and row["updated_at"], row
    # Saved in the database (survives a restart), and only that one switch changed.
    assert dict(sql("SELECT feature, enabled FROM captcha_settings").all()) == {
        "customer_register": True, "pujari_register": False, "customer_login": True, "pujari_login": True
    }
    _switch(root, "pujari_register", True)
    audit = sql(
        "SELECT actor_name, actor_email, reason, status, ip FROM security_audit_log "
        "WHERE action = 'captcha_setting_change' ORDER BY created_at"
    ).mappings().all()[before:]
    assert [(a["actor_email"], a["reason"], a["status"], a["ip"]) for a in audit] == [
        ("root-cs3@example.org", "Pujari Registration: ON -> OFF", "success", "198.51.100.230"),
        ("root-cs3@example.org", "Pujari Registration: OFF -> ON", "success", "198.51.100.230"),
    ], audit
    view = client.get("/api/v1/admin/security/captcha", headers={"Authorization": f"Bearer {root}"}).json()
    assert view["history"][0]["reason"] == "Pujari Registration: OFF -> ON", view["history"]
    assert _switch(admin, "customer_login", True).status_code == 403 and len(view["history"]) == len(audit) + before


def _register_with(account_type: str, email: str, phone: str, *, captcha_for: str | None, ip: str, code_type: str | None = None):
    """Request a registration code (as the web and apps do), then register; returns both responses."""
    body = {"email": email, "purpose": "register", "account_type": code_type or account_type}
    if captcha_for:
        body.update(solved(captcha_for, ip=ip))
    first = post("/auth/otp/request", body, ip=ip)
    if first.status_code != 200:
        return first, None
    name = "Ravi Kumar Sharma" if account_type == "pujari" else "Reg Person"
    second = post(
        "/auth/register",
        {"account_type": account_type, "name": name, "email": email, "phone": phone, "password": "Str0ng!pass",
         "otp": CODE, "registration_consent": True},
        ip=ip,
    )
    return first, second


def check_captcha_registration_switches():
    reset_state()
    _all_switches_on()
    settings.captcha_settings_enforcement = True
    root = _staff("root-cs4@example.org", "super_admin", "9000000086")
    # Both ON: each account type needs a registration CAPTCHA, then registers.
    for n, kind in enumerate(("customer", "pujari")):
        first, _ = _register_with(kind, f"r{n}@example.org", f"90000003{n}0", captcha_for=None, ip=f"198.51.102.{n}")
        assert first.status_code == 400 and first.json()["detail"]["code"] == "CAPTCHA_REQUIRED", first.text
        first, second = _register_with(kind, f"r{n}@example.org", f"90000003{n}0", captcha_for="register", ip=f"198.51.102.{10 + n}")
        assert first.status_code == 200 and second.status_code == 200 and second.json()["user"]["role"] == kind, (first.text, second.text)
    # A CAPTCHA solved for another form does not count.
    first, _ = _register_with("customer", "r2@example.org", "9000000320", captcha_for="login", ip="198.51.102.20")
    assert first.status_code == 400, first.text
    # Independent switches: customer OFF leaves pujari ON, and the reverse.
    _switch(root, "customer_register", False)
    first, second = _register_with("customer", "r3@example.org", "9000000330", captcha_for=None, ip="198.51.102.30")
    assert first.status_code == 200 and second.status_code == 200, (first.text, second.text)
    first, _ = _register_with("pujari", "r4@example.org", "9000000340", captcha_for=None, ip="198.51.102.31")
    assert first.status_code == 400 and first.json()["detail"]["code"] == "CAPTCHA_REQUIRED", first.text
    # No account type given: the stricter switch (pujari ON) applies.
    r = post("/auth/otp/request", {"email": "r5@example.org", "purpose": "register"}, ip="198.51.102.32")
    assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", r.text
    # A code requested as a customer (no CAPTCHA) cannot register a pujari.
    first, second = _register_with("pujari", "r6@example.org", "9000000360", captcha_for=None, code_type="customer", ip="198.51.102.33")
    assert first.status_code == 200 and second.status_code == 400 and second.json()["detail"]["code"] == "INVALID_OTP", second.text
    assert sql("SELECT count(*) FROM users WHERE email = 'r6@example.org'").scalar() == 0
    _switch(root, "customer_register", True)
    _switch(root, "pujari_register", False)
    first, _ = _register_with("customer", "r7@example.org", "9000000370", captcha_for=None, ip="198.51.102.34")
    assert first.status_code == 400, first.text
    first, second = _register_with("pujari", "r8@example.org", "9000000380", captcha_for=None, ip="198.51.102.35")
    assert first.status_code == 200 and second.status_code == 200 and second.json()["user"]["role"] == "pujari", second.text
    # Both OFF: no CAPTCHA, with or without an account type.
    _switch(root, "customer_register", False)
    assert post("/auth/otp/request", {"email": "r9@example.org", "purpose": "register"}, ip="198.51.102.36").status_code == 200
    # Sign-in codes are never asked for a CAPTCHA.
    _all_switches_on()
    assert post("/auth/otp/request", {"email": "someone@example.org", "purpose": "login"}, ip="198.51.102.37").status_code == 200


def _login(email: str, password: str, portal: str | None, ip: str, captcha_for: str | None = None):
    body = {"identifier": email, "password": password}
    if portal:
        body["portal"] = portal
    if captcha_for:
        body.update(solved(captcha_for, ip=ip))
    return post("/auth/login", body, ip=ip)


def check_captcha_login_switches():
    reset_state()
    _all_switches_on()
    register("customer", "lc@example.org", "9000000201", "Login Customer")
    register("pujari", "lp@example.org", "9000000202", "Ravi Kumar Sharma")
    root = _staff("root-cs5@example.org", "super_admin", "9000000203")
    admin = _staff("admin-cs5@example.org", "admin", "9000000204")
    del admin
    settings.captcha_settings_enforcement = True
    ips = iter(f"198.51.103.{i}" for i in range(1, 250))
    # Both ON: each portal asks first, then signs in with the answer.
    for email, portal in (("lc@example.org", "customer"), ("lp@example.org", "pujari")):
        r = _login(email, "Str0ng!pass", portal, next(ips))
        assert r.status_code == 400 and r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", r.text
        r = _login(email, "Str0ng!pass", portal, next(ips), captcha_for="login")
        assert r.status_code == 200 and r.json()["access_token"], r.text
    # The same question for unknown accounts, so asking reveals nothing.
    r = _login("nobody@example.org", "Str0ng!pass", "customer", next(ips))
    assert r.json()["detail"]["code"] == "CAPTCHA_REQUIRED", r.text
    # Independent switches.
    _switch(root, "customer_login", False)
    assert _login("lc@example.org", "Str0ng!pass", "customer", next(ips)).status_code == 200
    assert _login("lp@example.org", "Str0ng!pass", "pujari", next(ips)).json()["detail"]["code"] == "CAPTCHA_REQUIRED"
    # Naming the portal whose switch is off does not unlock another portal's accounts, even with the right password.
    r = _login("lp@example.org", "Str0ng!pass", "customer", next(ips))
    assert r.status_code == 401 and r.json()["detail"]["code"] == "LOGIN_FAILED", r.text
    # No portal (older clients): the stricter switch applies.
    assert _login("lc@example.org", "Str0ng!pass", None, next(ips)).json()["detail"]["code"] == "CAPTCHA_REQUIRED"
    _switch(root, "customer_login", True)
    _switch(root, "pujari_login", False)
    assert _login("lp@example.org", "Str0ng!pass", "pujari", next(ips)).status_code == 200
    assert _login("lc@example.org", "Str0ng!pass", "customer", next(ips)).json()["detail"]["code"] == "CAPTCHA_REQUIRED"
    r = _login("lc@example.org", "Str0ng!pass", "pujari", next(ips))
    assert r.status_code == 401 and r.json()["detail"]["code"] == "LOGIN_FAILED", r.text
    _switch(root, "customer_login", False)
    assert _login("lc@example.org", "Str0ng!pass", None, next(ips)).status_code == 200
    # Admin sign-in is never asked; customer accounts cannot use it; Super Admin keeps the emailed second step.
    _all_switches_on()
    assert _login("admin-cs5@example.org", "Sup3r!admin", "admin", next(ips)).status_code == 200
    assert _login("lc@example.org", "Str0ng!pass", "admin", next(ips)).status_code == 401
    r = _login("root-cs5@example.org", "Sup3r!admin", "admin", next(ips))
    assert r.status_code == 200 and r.json()["otp_required"] is True, r.text
    # Lockout still applies with the CAPTCHA on.
    reset_state()
    for _ in range(10):
        _login("lc@example.org", "wrong-pass1", "customer", next(ips), captcha_for="login")
    r = _login("lc@example.org", "Str0ng!pass", "customer", next(ips), captcha_for="login")
    assert r.status_code == 429, r.text


CHECKS = {name[len("check_"):]: fn for name, fn in globals().items() if name.startswith("check_")}

if __name__ == "__main__":
    assert settings.environment == "development", settings.environment
    assert "127.0.0.1" in settings.database_url or "localhost" in settings.database_url, "loopback test DB only"
    from app.mail.smtp_client import smtp_configured

    assert not smtp_configured(), "SMTP must be blank for these checks"
    CHECKS[sys.argv[1]]()
    print("PASS", sys.argv[1])
