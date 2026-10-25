"""Security PR 2: booking cancellation authorization, transaction locking, muhurta ownership,
OTP attempt limits, login/contact rate limiting, and fail-closed production configuration.
Endpoint functions are called directly against a scripted fake DB."""
from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from app import otp_service, rate_limit
from app.config import INSECURE_JWT_DEFAULT, Settings, insecure_settings_problems, settings
from app.deps import require_roles
from app.routers import auth, bookings, consultations, ops
from app.schemas import LoginIn
from app.seva import registrations

CUST = "00000000-0000-0000-0000-0000000000c1"
CUST2 = "00000000-0000-0000-0000-0000000000c2"
PUJ = "00000000-0000-0000-0000-0000000000a1"
PUJ2 = "00000000-0000-0000-0000-0000000000a2"
ADMIN = "00000000-0000-0000-0000-0000000000f1"
BK = "00000000-0000-0000-0000-0000000000b1"
MC = "00000000-0000-0000-0000-0000000000e1"


class _Result:
    def __init__(self, row=None):
        self._row = row

    def mappings(self):
        return self

    def first(self):
        return self._row[0] if isinstance(self._row, list) else self._row

    def all(self):
        if self._row is None:
            return []
        return self._row if isinstance(self._row, list) else [self._row]

    def scalar(self):
        return self._row

    def scalars(self):
        return self


class FakeDB:
    """First matching (substring, value) rule answers each statement; callables get (sql, params)."""

    def __init__(self, rules=()):
        self.rules, self.statements, self.commits, self.rollbacks = list(rules), [], 0, 0

    def execute(self, stmt, params=None):
        sql = " ".join(str(stmt).split())
        self.statements.append((sql, params or {}))
        for needle, value in self.rules:
            if needle in sql:
                return _Result(value(sql, params or {}) if callable(value) else value)
        return _Result()

    @contextmanager
    def begin_nested(self):
        yield

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def writes(self, needle):
        return [(s, p) for s, p in self.statements if needle in s and s.split()[0] in ("INSERT", "UPDATE", "DELETE")]


def _user(uid, role):
    return {"id": uid, "role": role}


def _request(ip="203.0.113.7"):
    return SimpleNamespace(headers={"x-real-ip": ip}, client=None)


@pytest.fixture(autouse=True)
def _production(monkeypatch):
    monkeypatch.setattr(settings, "environment", "production")


# ---------------------------------------------------------------- booking cancellation / refund authorization


@pytest.mark.parametrize("role", ["pujari", "head_pujari", "customer"])
def test_non_admin_cannot_use_status_endpoint(role):
    guard = require_roles("admin")
    with pytest.raises(HTTPException) as exc:
        guard(user=_user(PUJ, role))
    assert exc.value.status_code == 403


@pytest.mark.parametrize("status", ["cancelled", "rejected", "in_progress", "completed"])
def test_status_endpoint_refuses_transitions_with_money_side_effects(monkeypatch, status):
    monkeypatch.setattr(bookings, "ensure_booking_access", lambda *a, **k: None)
    db = FakeDB([("FROM bookings WHERE id", {"id": BK, "status": "confirmed", "pujari_id": PUJ})])
    with pytest.raises(HTTPException) as exc:
        bookings.update_status(BK, status=status, user=_user(ADMIN, "admin"), db=db)
    assert exc.value.status_code == 400
    assert db.writes("bookings") == []


def test_admin_rescue_to_pending_acceptance_still_works(monkeypatch):
    monkeypatch.setattr(bookings, "ensure_booking_access", lambda *a, **k: None)
    calls = []
    import app.booking_state as booking_state

    monkeypatch.setattr(booking_state, "set_booking_status", lambda db, bid, st, actor_id=None: calls.append(st))
    db = FakeDB([("FROM bookings WHERE id", {"id": BK, "status": "confirmed", "pujari_id": PUJ})])
    assert bookings.update_status(BK, status="pending_acceptance", user=_user(ADMIN, "admin"), db=db) == {"ok": True}
    assert calls == ["pending_acceptance"]


def _cancel_db(status="confirmed", update_returns=True):
    booking = {
        "id": BK, "status": status, "customer_id": CUST, "pujari_id": PUJ, "payment_status": "paid",
        "total_paise": 100_000, "booking_date": "2030-01-10", "start_time": "10:00", "booking_number": "BSV-1",
    }
    return FakeDB([
        ("FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE", booking),
        ("UPDATE bookings SET status = 'cancelled'", {"id": BK} if update_returns else None),
        ("FROM wallets WHERE user_id", {"id": "w1", "balance_paise": 0, "status": "active"}),
    ])


def _patch_cancel_deps(monkeypatch):
    monkeypatch.setattr(bookings, "ensure_booking_access", lambda *a, **k: None)
    monkeypatch.setattr(bookings, "cancel_policy", lambda *a, **k: {"policy": "gt48", "fee_percent": 10, "refund_percent": 90})
    monkeypatch.setattr(bookings, "hours_until", lambda *a, **k: 200)


def test_cancel_locks_the_booking_row_before_checking_status(monkeypatch):
    _patch_cancel_deps(monkeypatch)
    db = _cancel_db()
    bookings.cancel_booking(BK, reason="Family emergency, cannot attend", user=_user(CUST, "customer"), db=db)
    first_select = next(s for s, _ in db.statements if s.startswith("SELECT * FROM bookings"))
    assert first_select.endswith("FOR UPDATE")
    refunds = db.writes("INSERT INTO wallet_transactions")
    assert len(refunds) == 1 and refunds[0][1]["amt"] == 90_000


def test_second_cancel_of_same_booking_gets_no_refund(monkeypatch):
    _patch_cancel_deps(monkeypatch)
    db = _cancel_db(status="cancelled")  # what the second request sees after the first one commits
    with pytest.raises(HTTPException) as exc:
        bookings.cancel_booking(BK, reason="Family emergency, cannot attend", user=_user(CUST, "customer"), db=db)
    assert exc.value.status_code == 400
    assert db.writes("wallet_transactions") == []


def test_cancel_refund_is_skipped_if_status_changed_underneath(monkeypatch):
    _patch_cancel_deps(monkeypatch)
    db = _cancel_db(update_returns=False)
    with pytest.raises(HTTPException) as exc:
        bookings.cancel_booking(BK, reason="Family emergency, cannot attend", user=_user(CUST, "customer"), db=db)
    assert exc.value.status_code == 409
    assert db.writes("wallet_transactions") == [] and db.rollbacks == 1


def test_pay_locks_the_booking_row(monkeypatch):
    db = FakeDB([("FROM bookings WHERE id = CAST(:id AS uuid) FOR UPDATE", {
        "id": BK, "customer_id": CUST, "payment_status": "paid", "status": "pending", "total_paise": 100,
    })])
    with pytest.raises(HTTPException) as exc:
        bookings.pay_pending_booking(BK, user=_user(CUST, "customer"), db=db)
    assert exc.value.status_code == 400  # already paid -> no second debit
    assert db.writes("wallet") == []


def test_seva_cancel_locks_registration_row(monkeypatch):
    db = FakeDB([("FROM seva_event_registrations", {"id": "r1", "status": "cancelled", "customer_id": CUST})])
    with pytest.raises(registrations.RegistrationError):
        registrations.cancel_registration(db, registration_id="r1", customer_id=CUST)
    assert db.statements[0][0].endswith("FOR UPDATE")
    assert db.writes("wallet") == []


def test_no_show_penalty_locks_booking_row():
    import inspect

    from app.routers import lifecycle

    src = inspect.getsource(lifecycle.mark_no_show_penalty)
    assert "FOR UPDATE" in src


# ---------------------------------------------------------------- muhurta consultation ownership


def _muhurta_db(pujari_id=PUJ, booking_customer=CUST):
    return FakeDB([
        ("FROM muhurta_consultations WHERE id", {"id": MC, "customer_id": CUST, "pujari_id": pujari_id}),
        ("SELECT customer_id FROM bookings", {"customer_id": booking_customer}),
    ])


def _patch_muhurta(monkeypatch):
    monkeypatch.setattr(consultations, "ensure_admin_permission", lambda *a, **k: None)


def test_unassigned_pujari_cannot_update_consultation(monkeypatch):
    _patch_muhurta(monkeypatch)
    db = _muhurta_db(pujari_id=PUJ2)
    with pytest.raises(HTTPException) as exc:
        consultations.update_muhurta_consultation(MC, status="completed", user=_user(PUJ, "pujari"), db=db)
    assert exc.value.status_code == 403
    assert db.writes("muhurta_consultations") == []


def test_assigned_pujari_can_add_guidance(monkeypatch):
    _patch_muhurta(monkeypatch)
    db = _muhurta_db()
    out = consultations.update_muhurta_consultation(
        MC, guidance_notes="Auspicious window 6-8am", status="guided", user=_user(PUJ, "pujari"), db=db
    )
    assert out == {"ok": True} and db.writes("UPDATE muhurta_consultations")


def test_pujari_cannot_relink_booking_or_reassign(monkeypatch):
    _patch_muhurta(monkeypatch)
    for kwargs in ({"linked_booking_id": BK}, {"pujari_id": PUJ2}):
        with pytest.raises(HTTPException) as exc:
            consultations.update_muhurta_consultation(MC, user=_user(PUJ, "pujari"), db=_muhurta_db(), **kwargs)
        assert exc.value.status_code == 403


def test_customer_cannot_change_status_of_own_consultation(monkeypatch):
    _patch_muhurta(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        consultations.update_muhurta_consultation(
            MC, status="completed", linked_booking_id=BK, user=_user(CUST, "customer"), db=_muhurta_db()
        )
    assert exc.value.status_code == 403


def test_customer_cannot_link_someone_elses_booking(monkeypatch):
    _patch_muhurta(monkeypatch)
    db = _muhurta_db(booking_customer=CUST2)
    with pytest.raises(HTTPException) as exc:
        consultations.update_muhurta_consultation(MC, linked_booking_id=BK, user=_user(CUST, "customer"), db=db)
    assert exc.value.status_code == 400
    assert db.writes("UPDATE bookings") == []


def test_customer_links_own_booking(monkeypatch):
    _patch_muhurta(monkeypatch)
    db = _muhurta_db()
    assert consultations.update_muhurta_consultation(MC, linked_booking_id=BK, user=_user(CUST, "customer"), db=db) == {"ok": True}
    assert db.writes("UPDATE bookings SET consultation_id")


def test_other_customer_cannot_touch_consultation(monkeypatch):
    _patch_muhurta(monkeypatch)
    with pytest.raises(HTTPException) as exc:
        consultations.update_muhurta_consultation(MC, linked_booking_id=BK, user=_user(CUST2, "customer"), db=_muhurta_db())
    assert exc.value.status_code == 403


def test_admin_can_assign_pujari(monkeypatch):
    _patch_muhurta(monkeypatch)
    db = _muhurta_db()
    assert consultations.update_muhurta_consultation(MC, pujari_id=PUJ2, user=_user(ADMIN, "super_admin"), db=db) == {"ok": True}


def test_pujari_list_only_shows_assigned_consultations(monkeypatch):
    monkeypatch.setattr("app.routers.notifications.mask_customer_display_name", lambda n: n, raising=False)
    db = FakeDB([("FROM muhurta_consultations m", [])])
    consultations.list_muhurta_consultations(user=_user(PUJ, "pujari"), db=db)
    sql = db.statements[0][0]
    assert "m.pujari_id = CAST(:id AS uuid)" in sql and "status = 'requested'" not in sql


# ---------------------------------------------------------------- OTP verification attempt limits


def _otp_db(attempt_count, after_increment):
    row = {"id": "o1", "code_hash": "x", "purpose": "login", "attempt_count": attempt_count}
    return FakeDB([
        ("SELECT * FROM otp_codes", [row]),
        ("SET attempt_count", [after_increment]),
    ])


def test_wrong_otp_counts_an_attempt(monkeypatch):
    monkeypatch.setattr(otp_service, "verify_otp", lambda code, h: False)
    db = _otp_db(0, 1)
    out = otp_service.verify_email_otp(db, email="a@b.in", code="000000", purpose="login")
    assert out == {"ok": False, "error": "invalid_or_expired"}
    assert db.writes("SET attempt_count") and db.commits == 1
    assert "FOR UPDATE" in db.statements[0][0]


def test_fifth_wrong_otp_burns_the_code(monkeypatch):
    monkeypatch.setattr(otp_service, "verify_otp", lambda code, h: False)
    db = _otp_db(4, otp_service.MAX_VERIFY_ATTEMPTS)
    out = otp_service.verify_email_otp(db, email="a@b.in", code="000000", purpose="login")
    assert out["error"] == "too_many_attempts"
    assert db.writes("SET consumed = TRUE WHERE id = ANY")


def test_correct_code_is_refused_after_limit(monkeypatch):
    monkeypatch.setattr(otp_service, "verify_otp", lambda code, h: True)
    db = _otp_db(otp_service.MAX_VERIFY_ATTEMPTS, 6)
    out = otp_service.verify_email_otp(db, email="a@b.in", code="123456", purpose="login")
    assert out == {"ok": False, "error": "too_many_attempts"}


def test_correct_code_still_logs_in_under_limit(monkeypatch):
    monkeypatch.setattr(otp_service, "verify_otp", lambda code, h: True)
    out = otp_service.verify_email_otp(_otp_db(2, 3), email="a@b.in", code="123456", purpose="login")
    assert out == {"ok": True, "purpose": "login"}


def test_otp_login_endpoint_returns_429_when_attempts_exhausted(monkeypatch):
    monkeypatch.setattr(otp_service, "verify_otp", lambda code, h: False)
    db = _otp_db(4, otp_service.MAX_VERIFY_ATTEMPTS)
    db.rules.insert(0, ("SELECT hits FROM security_rate_limits", 0))
    with pytest.raises(HTTPException) as exc:
        auth.login_with_otp(SimpleNamespace(email="a@b.in", code="000000"), request=_request(), db=db)
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "OTP_ATTEMPTS_EXCEEDED"


def test_fixed_dev_otp_is_never_used_outside_development(monkeypatch):
    for env in ("production", "qa", "test"):
        monkeypatch.setattr(settings, "environment", env)
        assert otp_service._is_development() is False
    monkeypatch.setattr(settings, "environment", "development")
    assert otp_service._is_development() is True


# ---------------------------------------------------------------- login and contact-form rate limiting


def test_login_blocked_after_repeated_failures(monkeypatch):
    db = FakeDB([("SELECT hits FROM security_rate_limits", rate_limit.LOGIN_FAIL_IDENTIFIER[1])])
    with pytest.raises(HTTPException) as exc:
        auth.login(LoginIn(identifier="a@b.in", password="guess"), request=_request(), db=db)
    assert exc.value.status_code == 429
    assert not any("FROM users" in s for s, _ in db.statements)  # password never checked


def test_failed_login_is_counted_and_committed(monkeypatch):
    db = FakeDB([("SELECT hits FROM security_rate_limits", 0), ("INSERT INTO security_rate_limits", 1)])
    with pytest.raises(HTTPException) as exc:
        auth.login(LoginIn(identifier="a@b.in", password="guess"), request=_request(), db=db)
    assert exc.value.status_code == 401
    buckets = [p["b"] for s, p in db.statements if "INSERT INTO security_rate_limits" in s]
    assert buckets == [rate_limit.LOGIN_FAIL_IDENTIFIER[0], rate_limit.LOGIN_FAIL_IP[0]]
    assert db.commits >= 1


def test_rate_limit_keys_are_hashed_not_raw():
    db = FakeDB([("INSERT INTO security_rate_limits", 1)])
    rate_limit.record(db, rate_limit.CONTACT_EMAIL, "Person@Example.com")
    params = next(p for s, p in db.statements if "INSERT" in s)
    assert "example" not in params["k"].lower() and len(params["k"]) == 40


def test_contact_form_refused_over_limit():
    from app.routers import support

    db = FakeDB([("INSERT INTO security_rate_limits", rate_limit.CONTACT_IP[1] + 1)])
    body = SimpleNamespace(name="A", email="a@b.in", subject="Hi", message="Hello there", country_code="+91", phone="")
    with pytest.raises(HTTPException) as exc:
        support.submit_contact_form(body, request=_request(), db=db)
    assert exc.value.status_code == 429


def test_rate_limit_fails_open_if_table_missing():
    from sqlalchemy.exc import ProgrammingError

    class Broken(FakeDB):
        def execute(self, stmt, params=None):
            raise ProgrammingError("SELECT", {}, Exception("relation does not exist"))

    assert rate_limit.record(Broken(), rate_limit.LOGIN_FAIL_IP, "1.2.3.4") == 0
    assert rate_limit.is_blocked(Broken(), rate_limit.LOGIN_FAIL_IP, "1.2.3.4") is False


def test_client_ip_prefers_proxy_header():
    assert rate_limit.client_ip(SimpleNamespace(headers={"x-real-ip": "198.51.100.4", "x-forwarded-for": "10.0.0.1"}, client=None)) == "198.51.100.4"
    assert rate_limit.client_ip(SimpleNamespace(headers={"x-forwarded-for": "198.51.100.5, 10.0.0.1"}, client=None)) == "198.51.100.5"


# ---------------------------------------------------------------- production JWT / environment configuration


def _settings(**kw):
    return Settings(database_url="postgresql://x/y", **kw)


def test_default_jwt_secret_rejected_outside_development():
    probs = insecure_settings_problems(_settings(environment="production"), env={})
    assert any("JWT_SECRET" in p for p in probs)
    assert INSECURE_JWT_DEFAULT not in " ".join(probs)  # never echo secret material


def test_short_jwt_secret_rejected():
    assert insecure_settings_problems(_settings(environment="qa", jwt_secret="short"), env={})


def test_strong_secret_in_production_passes():
    assert insecure_settings_problems(_settings(environment="production", jwt_secret="x" * 48), env={}) == []


def test_hosted_deployment_must_declare_environment():
    probs = insecure_settings_problems(_settings(environment="development", jwt_secret="x" * 48), env={"VERCEL": "1"})
    assert any("ENVIRONMENT" in p for p in probs)


def test_local_development_unaffected():
    assert insecure_settings_problems(_settings(environment="development"), env={}) == []


def test_recaptcha_dev_bypass_ignored_in_production(monkeypatch):
    monkeypatch.setenv("RECAPTCHA_SECRET_KEY", "dev-bypass")
    monkeypatch.setattr(auth, "get_setting", lambda db, k, d=None: True)
    import urllib.request

    def _no_network(*a, **k):
        raise OSError("network disabled in test")

    monkeypatch.setattr(urllib.request, "urlopen", _no_network)
    with pytest.raises(HTTPException) as exc:
        auth._verify_registration_captcha(FakeDB(), "dev-bypass")
    assert exc.value.status_code == 502  # went to real verification instead of bypassing


def test_cron_requires_secret_outside_development(monkeypatch):
    monkeypatch.delenv("CRON_SECRET", raising=False)
    monkeypatch.delenv("VERCEL_CRON_SECRET", raising=False)
    for env in ("production", "qa"):
        monkeypatch.setattr(settings, "environment", env)
        with pytest.raises(HTTPException) as exc:
            ops._require_cron_auth(SimpleNamespace(headers={}))
        assert exc.value.status_code == 503


def test_cron_rejects_wrong_secret(monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "s" * 40)
    with pytest.raises(HTTPException) as exc:
        ops._require_cron_auth(SimpleNamespace(headers={"authorization": "Bearer wrong"}))
    assert exc.value.status_code == 401
    ops._require_cron_auth(SimpleNamespace(headers={"authorization": "Bearer " + "s" * 40}))


def test_pujari_ownership_checks_include_head_pujari():
    # require_roles("pujari") also admits head_pujari, so hand-written role checks must name both.
    from pathlib import Path

    root = Path(__file__).resolve().parents[1] / "app/routers"
    src = (root / "lifecycle.py").read_text() + (root / "bookings.py").read_text()
    assert 'user["role"] == "pujari"' not in src
    assert 'role == "pujari" and' not in src


def test_cancel_actor_treats_head_pujari_as_assigned_pujari():
    from app.routers.bookings import _cancel_actor

    booking = {"customer_id": "c1", "pujari_id": "p1"}
    assert _cancel_actor({"id": "p1", "role": "head_pujari"}, booking) == "pujari"
    with pytest.raises(Exception):
        _cancel_actor({"id": "p2", "role": "head_pujari"}, booking)


def test_database_errors_are_generic_outside_development(monkeypatch):
    from sqlalchemy.exc import IntegrityError
    from starlette.requests import Request
    from app import main

    req = Request({"type": "http", "method": "POST", "path": "/api/v1/bookings", "headers": [], "query_string": b""})
    exc = IntegrityError("INSERT", {}, Exception('violates check constraint "bookings_package_type_check"'))
    monkeypatch.setattr(main.settings, "environment", "production")
    body = main._database_error_response(req, exc, "Database error").body
    assert b"constraint" not in body and b"bookings" not in body


def test_unpaid_bookings_cannot_start_or_earn_settlement():
    import inspect
    from fastapi import HTTPException
    from app.routers import lifecycle

    with pytest.raises(HTTPException):
        lifecycle._require_paid({"payment_status": "pending"})
    lifecycle._require_paid({"payment_status": "paid"})
    src = inspect.getsource(lifecycle._run_completion_pipeline)
    assert "and paid:" in src and "if paid:" in src


def test_seva_cancel_refused_after_event_start_and_override_locks():
    import inspect
    from app.routers import lifecycle
    from app.seva import registrations

    assert "EVENT_STARTED" in inspect.getsource(registrations.cancel_registration)
    assert "FOR UPDATE" in inspect.getsource(lifecycle.override_settlement)
