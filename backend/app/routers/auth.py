from datetime import datetime, timezone
from uuid import uuid4
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app import rate_limit
from app.config import settings
from app.db import get_db
from app.deps import ACCOUNT_BLOCKED, account_state_error, current_user
from app.domain import row_dict
from app.platform_config import get_setting
from app.profile_utils import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION
from app.schemas import (
    ChangePasswordIn,
    LoginChallengeIn,
    LoginIn,
    LoginOtpIn,
    LoginOut,
    MePatchIn,
    OtpRequestIn,
    OtpVerifyIn,
    RegisterIn,
    TokenOut,
)
from app.security import (
    create_access_token,
    create_login_challenge,
    decode_login_challenge,
    hash_password,
    password_version,
    verify_password,
)
from app.i18n import coded_http
from app.otp_service import OTP_TTL_MINUTES

logger = logging.getLogger("bseva.auth")

router = APIRouter(prefix="/auth", tags=["auth"])


OTP_ATTEMPTS_MESSAGE = "Too many incorrect codes. Please request a new OTP."


def _check_otp_verify_ip(db: Session, ip: str) -> None:
    if rate_limit.is_blocked(db, rate_limit.OTP_VERIFY_FAIL_IP, ip):
        raise rate_limit.too_many()


def _raise_otp_failure(db: Session, ip: str, result: dict, status_code: int) -> None:
    rate_limit.record(db, rate_limit.OTP_VERIFY_FAIL_IP, ip)
    db.commit()
    if result.get("error") == "too_many_attempts":
        raise coded_http(429, "OTP_ATTEMPTS_EXCEEDED", OTP_ATTEMPTS_MESSAGE)
    raise coded_http(status_code, "INVALID_OTP", "Invalid or expired OTP")


def _verify_registration_otp(db: Session, body: RegisterIn, ip: str = "unknown") -> None:
    from app.otp_service import verify_email_otp

    _check_otp_verify_ip(db, ip)
    result = verify_email_otp(
        db,
        email=str(body.email),
        code=body.otp,
        purpose="register",
        consume=True,
    )
    if not result.get("ok"):
        _raise_otp_failure(db, ip, result, 400)


def _public(row: dict) -> dict:
    from app.name_parts import split_display_name

    f = (row.get("first_name") or "").strip()
    m = (row.get("middle_name") or "").strip()
    l = (row.get("last_name") or "").strip()
    if not f and not l:
        f, m, l = split_display_name(row.get("name"))
    return {
        "id": str(row["id"]),
        "public_id": row.get("public_id"),
        "name": row["name"],
        "first_name": f or None,
        "middle_name": m or None,
        "last_name": l or None,
        "email": row["email"],
        "phone": row["phone"],
        "role": row["role"],
        "blocked": row["blocked"],
        "preferred_language": row["preferred_language"],
        "calendar_preference": row["calendar_preference"],
    }


OTP_WAIT_MESSAGE = "Please wait before requesting another OTP"
OTP_DAILY_MESSAGE = "Too many codes were requested for this email today. Please try again later or contact BSeva support."


def _otp_refused(reason: str | None, retry_after: int | None):
    """The same refusal for every address, so limits never reveal whether an account exists."""
    if reason == "daily_limit":
        return coded_http(429, "OTP_DAILY_LIMIT", OTP_DAILY_MESSAGE)
    return HTTPException(429, OTP_WAIT_MESSAGE + (f" ({retry_after}s)" if retry_after else ""))


def _public_otp_circuit(db: Session, purpose: str = "login") -> None:
    """Whole-deployment cap on OTP mail anonymous callers can trigger; refuses rather than flood the mailbox.

    Registration and verify codes draw on their own budget so abusing them cannot block sign-in codes."""
    if purpose in ("register", "verify"):
        rate_limit.public_otp_circuit(
            db, int(settings.otp_register_emails_per_hour), rule=rate_limit.OTP_REGISTER_EMAILS_HOUR, kind="otp_register"
        )
    else:
        rate_limit.public_otp_circuit(db, int(settings.otp_public_emails_per_hour))


@router.post("/otp/request")
def request_otp(body: OtpRequestIn, request: Request, db: Session = Depends(get_db)):
    """Issue email OTP (5 minutes). Delivery via email provider; SMS reserved for later."""
    from app import captcha
    from app.otp_service import OtpStoreUnavailable, issue_email_otp, mask_email, reserve_otp_send

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        # Prefer email OTP; do not fall back to SMS for now
        raise HTTPException(400, "Email is required for OTP")
    ip = rate_limit.client_ip(request)
    # Per-email limits are counted below; these cap one client spraying many addresses.
    rate_limit.enforce_otp_request_ip(db, ip, settings.otp_requests_per_ip_per_day)

    purpose = body.purpose if body.purpose in ("register", "login", "verify") else "login"
    if purpose in ("register", "verify"):
        bucket, _limit, window = rate_limit.OTP_REGISTER_IP_DAY
        rate_limit.enforce(db, (bucket, int(settings.otp_register_requests_per_ip_per_day), window), ip, fail_closed=True)
    if purpose == "register" and captcha.mode(settings.register_otp_captcha) == "enforce":
        captcha.require(db, body.captcha_id, body.captcha_answer, purpose="register", ip=ip)
    # Counted before the account lookup, for known and unknown addresses alike.
    try:
        gate = reserve_otp_send(db, email=email, scope=purpose, ip=ip)
    except OtpStoreUnavailable:
        raise rate_limit.unavailable() from None
    if not gate.get("allowed"):
        raise _otp_refused(gate.get("reason"), gate.get("retry_after_seconds"))
    _public_otp_circuit(db, purpose)

    user_row = db.execute(
        text("SELECT name, role, preferred_language, blocked FROM users WHERE lower(email) = :e LIMIT 1"),
        {"e": email},
    ).mappings().first()

    if purpose == "login":
        # Always return the same message; only send if a non-blocked user exists
        generic = {
            "ok": True,
            "message": "If an account exists for this email, an OTP has been sent.",
            "expires_in_minutes": OTP_TTL_MINUTES,
        }
        # Admins and Super Admins sign in with their password (a Super Admin then gets the code), so a code
        # alone is never sent to them here.
        if not user_row or user_row.get("blocked") or user_row.get("role") in ("admin", "super_admin"):
            logger.info("OTP_REQUEST_NO_SEND purpose=login to=%s", mask_email(email))
            return generic
        issue_email_otp(
            db,
            email=email,
            purpose="login",
            customer_name=str(user_row.get("name") or ""),
            language=str(user_row.get("preferred_language") or "en"),
            phone=body.phone,
            deliver=True,
            reserved=True,
            ip=ip,
        )
        return generic

    # register / verify — send to provided email (existence checked later on register)
    name = str(user_row.get("name") or "") if user_row else ""
    lang = str(user_row.get("preferred_language") or "en") if user_row else "en"
    result = issue_email_otp(
        db,
        email=email,
        purpose=purpose,
        customer_name=name,
        language=lang,
        phone=body.phone,
        deliver=True,
        reserved=True,
        ip=ip,
    )
    if not result.get("ok"):
        if result.get("error") == "recipient_not_allowed":
            raise HTTPException(403, result["message"])
        raise HTTPException(
            502,
            result.get("message")
            or "Could not send OTP to your email. Please try again or contact support.",
        )
    out = {
        "ok": True,
        "message": result.get("message") or f"OTP sent to {email}. Valid for {OTP_TTL_MINUTES} minutes.",
        "expires_in_minutes": int(result.get("expires_in_minutes") or OTP_TTL_MINUTES),
        "email": email,
    }
    if result.get("dev_hint"):
        out["dev_hint"] = result["dev_hint"]
    return out


@router.post("/otp/verify")
def verify_otp_ep(body: OtpVerifyIn, request: Request, db: Session = Depends(get_db)):
    from app.otp_service import verify_email_otp

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        raise HTTPException(400, "Email is required")
    ip = rate_limit.client_ip(request)
    _check_otp_verify_ip(db, ip)
    purpose = body.purpose if body.purpose in ("register", "login", "verify") else None
    result = verify_email_otp(db, email=email, code=body.code, purpose=purpose, consume=True)
    if not result.get("ok"):
        _raise_otp_failure(db, ip, result, 400)
    return {"ok": True}


@router.post("/login/otp", response_model=TokenOut)
def login_with_otp(body: OtpVerifyIn, request: Request, db: Session = Depends(get_db)):
    """Email OTP login — replaces SMS OTP login delivery for now."""
    from app.otp_service import verify_email_otp

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        raise HTTPException(400, "Email is required")
    ip = rate_limit.client_ip(request)
    _check_otp_verify_ip(db, ip)
    verified = verify_email_otp(db, email=email, code=body.code, purpose="login", consume=True)
    if not verified.get("ok"):
        _raise_otp_failure(db, ip, verified, status.HTTP_401_UNAUTHORIZED)
    row = db.execute(
        text("SELECT * FROM users WHERE lower(email) = :e LIMIT 1"),
        {"e": email},
    ).mappings().first()
    if not row:
        raise coded_http(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", "Invalid or expired OTP")
    if row["blocked"]:
        raise coded_http(status.HTTP_403_FORBIDDEN, "ACCOUNT_BLOCKED", ACCOUNT_BLOCKED)
    state_error = account_state_error(row)
    if state_error:
        raise state_error
    if row["role"] in ("admin", "super_admin"):
        # No code is ever sent to these accounts here; refuse in the same words as any wrong code.
        raise coded_http(status.HTTP_401_UNAUTHORIZED, "INVALID_OTP", "Invalid or expired OTP")
    return TokenOut(access_token=create_access_token(str(row["id"]), row["role"], row["password_hash"]), user=_public(dict(row)))


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    if not body.registration_consent:
        raise HTTPException(400, "You must accept the Terms & Conditions and Privacy Policy")
    if body.account_type not in ("customer", "pujari"):
        raise HTTPException(400, "Invalid account type")
    # Validate the referral before consuming the OTP so a bad code does not burn it.
    if body.referral_code:
        from app.referrals import find_referrer_by_code

        referrer_ok = find_referrer_by_code(db, body.referral_code)
        if not referrer_ok or referrer_ok.get("blocked"):
            raise HTTPException(400, "Invalid referral code")
    from app.name_parts import compose_display_name, split_display_name, validate_name_parts

    reg_first = (body.first_name or "").strip()
    reg_middle = (body.middle_name or "").strip()
    reg_last = (body.last_name or "").strip()
    display_name = body.name.strip()
    if body.account_type == "pujari" and (reg_first or reg_last):
        reg_first, reg_middle, reg_last = validate_name_parts(
            first=reg_first or None,
            middle=reg_middle or None,
            last=reg_last or None,
            require_last=True,
            min_last_length=3,
        )
        display_name = compose_display_name(reg_first, reg_middle, reg_last)
    elif body.account_type == "pujari":
        cf, cm, cl = split_display_name(display_name)
        reg_first, reg_middle, reg_last = validate_name_parts(
            first=cf or None,
            middle=cm or None,
            last=cl or None,
            require_last=True,
            min_last_length=3,
        )
        display_name = compose_display_name(reg_first, reg_middle, reg_last)

    # Production schema_migrate is not run on Vercel cold start — heal calendar check if needed.
    from app.schema_migrate import ensure_calendar_preference_schema

    ensure_calendar_preference_schema()
    # The emailed code is checked first, so only someone who controls the mailbox learns whether an account
    # already uses this email or phone (otherwise /register answers "already exists" to anyone who asks).
    _verify_registration_otp(db, body, rate_limit.client_ip(request))
    exists = db.execute(
        text("SELECT id FROM users WHERE email = :e OR phone = :p"),
        {"e": str(body.email), "p": body.phone},
    ).first()
    if exists:
        db.commit()  # the code stays used: a new attempt needs a new OTP
        raise HTTPException(409, "An account with this email or phone already exists")

    user_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO users (id, name, first_name, middle_name, last_name, email, phone, password_hash, role, preferred_language, calendar_preference, phone_verified,
              registration_consent, registration_consent_at, terms_version, privacy_version)
            VALUES (CAST(:id AS uuid), :name, :fn, :mn, :ln, :email, :phone, :pw, :role, :lang, :cal, TRUE,
              TRUE, NOW(), :tv, :pv)
            """
        ),
        {
            "id": user_id,
            "name": display_name,
            "fn": reg_first or None,
            "mn": reg_middle or None,
            "ln": reg_last or None,
            "email": str(body.email),
            "phone": body.phone,
            "pw": hash_password(body.password),
            "role": body.account_type,
            "lang": body.language,
            "cal": body.calendar_preference,
            "tv": body.terms_version or CURRENT_TERMS_VERSION,
            "pv": body.privacy_version or CURRENT_PRIVACY_VERSION,
        },
    )
    db.execute(text("INSERT INTO wallets (user_id) VALUES (CAST(:id AS uuid))"), {"id": user_id})
    if body.account_type == "customer":
        db.execute(
            text(
                """
                INSERT INTO customer_profiles
                  (user_id, location_label, address, address_line1, address_line2, city, district, state, pincode, country,
                   latitude, longitude, preferred_language, calendar_preference)
                VALUES (CAST(:id AS uuid), :loc, :addr, :a1, :a2, :city, :district, :state, :pin, :country, :lat, :lng, :lang, :cal)
                """
            ),
            {
                "id": user_id,
                "loc": body.location,
                "addr": body.address,
                "a1": body.address_line1,
                "a2": body.address_line2,
                "city": body.city,
                "district": body.district,
                "state": body.state,
                "pin": body.pincode,
                "country": body.country or "India",
                "lat": body.latitude,
                "lng": body.longitude,
                "lang": body.language,
                "cal": body.calendar_preference,
            },
        )
    else:
        from app.platform_config import get_setting

        fee_enabled = bool(get_setting(db, "pujari_joining_fee_enabled", False))
        fee_amt = int(get_setting(db, "pujari_joining_fee_paise", 0) or 0) if fee_enabled else 0
        fee_status = "pending" if fee_enabled and fee_amt > 0 else "not_required"
        db.execute(
            text(
                """
                INSERT INTO pujari_profiles
                  (user_id, full_name, first_name, middle_name, last_name, mobile_number,
                   requested_level, verification_status, location_label, address, address_line1, address_line2,
                   city, district, state, pincode, country, latitude, longitude, backup_phone,
                   joining_fee_status, joining_fee_paise)
                VALUES (CAST(:id AS uuid), :full_name, :fn, :mn, :ln, :mobile,
                        :lvl, 'pending', :loc, :addr, :a1, :a2, :city, :district, :state, :pin, :country, :lat, :lng, :backup,
                        :jfs, :jfa)
                """
            ),
            {
                "id": user_id,
                "full_name": display_name,
                "fn": reg_first or None,
                "mn": reg_middle or None,
                "ln": reg_last or None,
                "mobile": body.phone,
                "lvl": body.requested_level or 1,
                "loc": body.location,
                "addr": body.address,
                "a1": body.address_line1,
                "a2": body.address_line2,
                "city": body.city,
                "district": body.district,
                "state": body.state,
                "pin": body.pincode,
                "country": body.country or "India",
                "lat": body.latitude,
                "lng": body.longitude,
                "backup": body.backup_phone,
                "jfs": fee_status,
                "jfa": fee_amt,
            },
        )
    if body.account_type == "pujari":
        from app.referrals import ensure_pujari_referral_code

        ensure_pujari_referral_code(db, user_id)
    else:
        from app.referrals import ensure_customer_referral_code

        ensure_customer_referral_code(db, user_id)
    from app.public_ids import ensure_public_id

    ensure_public_id(db, user_id)
    if body.referral_code:
        from app.referrals import apply_referral_code

        apply_referral_code(db, user_id, body.referral_code)
    try:
        from app.routers.notifications import notify_head_pujaris, notify_ops_staff

        if body.account_type == "pujari":
            notify_ops_staff(
                db,
                title="New Pujari Registration",
                body=f"{display_name} registered as a pujari.",
                category="kyc",
                link="/admin/pujaris",
            )
            notify_head_pujaris(db, pujari_id=user_id, pujari_name=display_name)
        else:
            notify_ops_staff(
                db,
                title="New Customer",
                body=f"{display_name} created a customer account.",
                category="ops",
                link="/admin/customers",
            )
    except Exception:
        pass
    db.commit()
    row = db.execute(text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": user_id}).mappings().one()
    try:
        from app.mail.senders import send_welcome_email

        if row.get("email"):
            send_welcome_email(
                to=str(row["email"]),
                customer_name=str(row.get("name") or ""),
                language=str(row.get("preferred_language") or body.language or "en"),
            )
    except Exception:
        pass
    return TokenOut(access_token=create_access_token(user_id, body.account_type), user=_public(dict(row)))


def _mask_email(email: str) -> str:
    name, _, domain = str(email).partition("@")
    return f"{name[:2]}***@{domain}"


def _send_super_admin_otp(db: Session, row: dict) -> None:
    from app.otp_service import issue_email_otp
    from app.sensitive_auth import SUPER_ADMIN_OTP_PER_HOUR

    result = issue_email_otp(
        db,
        email=str(row["email"]),
        purpose="login",
        customer_name=str(row.get("name") or ""),
        language=str(row.get("preferred_language") or "en"),
        # Its own counter, so public OTP requests for this address cannot use up the Super Admin's sends.
        limit_scope="super_admin_login",
        daily_limit=None,
        hourly_limit=SUPER_ADMIN_OTP_PER_HOUR,
    )
    if result.get("ok"):
        return
    if result.get("error") in ("cooldown", "hourly_limit", "rate_limited"):
        wait = result.get("retry_after_seconds")
        raise HTTPException(429, f"Please wait before requesting another OTP{f' ({wait}s)' if wait else ''}")
    if result.get("error") == "unavailable":
        raise rate_limit.unavailable()
    # No OTP means no sign-in: this step never falls back to password alone.
    raise HTTPException(502, result.get("message") or "Could not send your OTP. Please try again shortly.")


def _super_admin_challenge(db: Session, token: str) -> dict:
    try:
        claims = decode_login_challenge(token)
    except ValueError:
        raise coded_http(status.HTTP_401_UNAUTHORIZED, "LOGIN_EXPIRED", "Your sign-in expired. Please start again.") from None
    row = db.execute(
        text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": claims.get("sub")}
    ).mappings().first()
    if not row or row["role"] != "super_admin" or claims.get("pv") != password_version(row["password_hash"]):
        raise coded_http(status.HTTP_401_UNAUTHORIZED, "LOGIN_EXPIRED", "Your sign-in expired. Please start again.")
    if row["blocked"]:
        raise coded_http(status.HTTP_403_FORBIDDEN, "ACCOUNT_BLOCKED", ACCOUNT_BLOCKED)
    return dict(row)


@router.post("/login", response_model=LoginOut)
def login(body: LoginIn, request: Request, db: Session = Depends(get_db)):
    identifier = body.identifier.strip()
    ip = rate_limit.client_ip(request)
    # Lock out repeated failures per account and per client before checking the password.
    if rate_limit.is_blocked(db, rate_limit.LOGIN_FAIL_IDENTIFIER, identifier) or rate_limit.is_blocked(
        db, rate_limit.LOGIN_FAIL_IP, ip
    ):
        raise rate_limit.too_many("Too many failed sign-in attempts. Please wait 15 minutes or sign in with an email OTP.")
    row = db.execute(
        text("SELECT * FROM users WHERE email = :id OR phone = :id"),
        {"id": identifier},
    ).mappings().first()
    threshold = int(settings.login_captcha_after_failures or 0)
    # Off by default (the mobile apps send no CAPTCHA). Never asked of Admin or Super Admin sign-in.
    if threshold > 0 and not (row and row["role"] in ("admin", "super_admin")):
        if rate_limit.hits(db, rate_limit.LOGIN_FAIL_IDENTIFIER, identifier) >= threshold or rate_limit.hits(
            db, rate_limit.LOGIN_FAIL_IP, ip
        ) >= threshold:
            from app import captcha

            captcha.require(db, body.captcha_id, body.captcha_answer, purpose="login", ip=ip)
    if not row or not verify_password(body.password, row["password_hash"]):
        rate_limit.record(db, rate_limit.LOGIN_FAIL_IDENTIFIER, identifier)
        rate_limit.record(db, rate_limit.LOGIN_FAIL_IP, ip)
        db.commit()
        raise coded_http(status.HTTP_401_UNAUTHORIZED, "LOGIN_FAILED", "Invalid email/phone or password")
    rate_limit.reset(db, rate_limit.LOGIN_FAIL_IDENTIFIER, identifier)
    db.commit()
    if row["blocked"]:
        raise coded_http(status.HTTP_403_FORBIDDEN, "ACCOUNT_BLOCKED", ACCOUNT_BLOCKED)
    state_error = account_state_error(row)
    if state_error:
        raise state_error
    if row["role"] in ("customer", "pujari", "head_pujari") and not (row.get("public_id") or "").strip():
        from app.public_ids import ensure_public_id

        ensure_public_id(db, str(row["id"]))
        db.commit()
        row = db.execute(text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": str(row["id"])}).mappings().one()
    if row["role"] == "super_admin":
        _send_super_admin_otp(db, dict(row))
        return LoginOut(
            otp_required=True,
            challenge_token=create_login_challenge(str(row["id"]), row["password_hash"]),
            email_hint=_mask_email(row["email"]),
            expires_in_minutes=OTP_TTL_MINUTES,
        )
    return LoginOut(access_token=create_access_token(str(row["id"]), row["role"], row["password_hash"]), user=_public(dict(row)))


@router.post("/login/otp/resend")
def resend_super_admin_otp(body: LoginChallengeIn, request: Request, db: Session = Depends(get_db)):
    rate_limit.enforce(db, rate_limit.OTP_REQUEST_IP, rate_limit.client_ip(request))
    _send_super_admin_otp(db, _super_admin_challenge(db, body.challenge_token))
    return {"ok": True}


@router.post("/login/otp/complete", response_model=TokenOut)
def complete_super_admin_login(body: LoginOtpIn, request: Request, db: Session = Depends(get_db)):
    """Second step of Super Admin sign-in; only this mints a Super Admin session."""
    from app.otp_service import verify_email_otp
    from app.sensitive_auth import log_event, log_failure

    ip = rate_limit.client_ip(request)
    _check_otp_verify_ip(db, ip)
    row = _super_admin_challenge(db, body.challenge_token)
    verified = verify_email_otp(db, email=str(row["email"]), code=body.code, purpose="login", consume=True)
    if not verified.get("ok"):
        log_failure(db, row, "super_admin_login", "wrong_otp", ip=ip)
        _raise_otp_failure(db, ip, verified, status.HTTP_401_UNAUTHORIZED)
    log_event(db, row, "super_admin_login", "success", ip=ip)
    db.commit()
    return TokenOut(
        access_token=create_access_token(str(row["id"]), row["role"], row["password_hash"], mfa=True),
        user=_public(row),
    )


@router.get("/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] in ("customer", "pujari", "head_pujari") and not (user.get("public_id") or "").strip():
        from app.public_ids import ensure_public_id

        ensure_public_id(db, str(user["id"]))
        db.commit()
        refreshed = db.execute(text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"), {"id": user["id"]}).mappings().one()
        user = dict(refreshed)
    extra: dict = {}
    if user["role"] == "customer":
        p = db.execute(text("SELECT * FROM customer_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
        extra["profile"] = row_dict(p) if p else None
    elif user["role"] in ("pujari", "head_pujari"):
        p = db.execute(text("SELECT * FROM pujari_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
        extra["profile"] = row_dict(p) if p else None
        from app.booking_reschedule import pujari_rating_summary

        extra["rating"] = pujari_rating_summary(db, str(user["id"]))
    return {**_public(user), **extra}


@router.patch("/me")
def patch_me(body: MePatchIn, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.name_parts import compose_display_name, split_display_name, validate_name_parts

    name_keys = {"first_name", "middle_name", "last_name"}
    if name_keys & body.model_fields_set:
        cur = db.execute(
            text(
                "SELECT first_name, middle_name, last_name, name FROM users WHERE id = CAST(:id AS uuid)"
            ),
            {"id": user["id"]},
        ).mappings().first()
        cf, cm, cl = split_display_name((cur or {}).get("name"))
        f = body.first_name if "first_name" in body.model_fields_set else ((cur or {}).get("first_name") or cf)
        m = body.middle_name if "middle_name" in body.model_fields_set else ((cur or {}).get("middle_name") or cm)
        l = body.last_name if "last_name" in body.model_fields_set else ((cur or {}).get("last_name") or cl)
        f, m, l = validate_name_parts(first=f, middle=m, last=l, require_last=True)
        display = compose_display_name(f, m, l)
        db.execute(
            text(
                """
                UPDATE users SET
                  first_name = :f, middle_name = :m, last_name = :l, name = :n, updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"f": f, "m": m or None, "l": l, "n": display, "id": user["id"]},
        )
    elif body.name:
        db.execute(text("UPDATE users SET name = :v WHERE id = CAST(:id AS uuid)"), {"v": body.name, "id": user["id"]})
    if body.preferred_language:
        db.execute(text("UPDATE users SET preferred_language = :v WHERE id = CAST(:id AS uuid)"), {"v": body.preferred_language, "id": user["id"]})
        if user["role"] == "customer":
            db.execute(
                text("UPDATE customer_profiles SET preferred_language = :v WHERE user_id = CAST(:id AS uuid)"),
                {"v": body.preferred_language, "id": user["id"]},
            )
    if body.calendar_preference:
        db.execute(text("UPDATE users SET calendar_preference = :v WHERE id = CAST(:id AS uuid)"), {"v": body.calendar_preference, "id": user["id"]})
        if user["role"] == "customer":
            db.execute(
                text("UPDATE customer_profiles SET calendar_preference = :v WHERE user_id = CAST(:id AS uuid)"),
                {"v": body.calendar_preference, "id": user["id"]},
            )
    if body.phone is not None:
        from app.validation_rules import normalize_mobile, phone_for_user_account

        mobile = phone_for_user_account(normalize_mobile(body.phone))
        taken = db.execute(
            text("SELECT id FROM users WHERE phone = :p AND id <> CAST(:id AS uuid)"),
            {"p": mobile, "id": user["id"]},
        ).first()
        if taken:
            raise HTTPException(409, "This phone number is already registered")
        db.execute(
            text("UPDATE users SET phone = :p, updated_at = NOW() WHERE id = CAST(:id AS uuid)"),
            {"p": mobile, "id": user["id"]},
        )
        if user["role"] in ("pujari", "head_pujari"):
            # Keep profile mobile in sync (national 10-digit for India, E.164 otherwise)
            profile_mobile = normalize_mobile(body.phone)
            db.execute(
                text("UPDATE pujari_profiles SET mobile_number = :p WHERE user_id = CAST(:id AS uuid)"),
                {"p": profile_mobile, "id": user["id"]},
            )
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_password(body: ChangePasswordIn, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(text("SELECT password_hash FROM users WHERE id = CAST(:id AS uuid)"), {"id": user["id"]}).mappings().one()
    if not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different from current password")
    from app.account_lifecycle import notify_password_changed

    new_hash = hash_password(body.new_password)
    # Ends every other session; the caller gets a fresh token below, issued after this moment.
    db.execute(
        text(
            """
            UPDATE users SET password_hash = :pw, updated_at = NOW(), sessions_revoked_at = :revoked
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"pw": new_hash, "id": user["id"], "revoked": datetime.now(timezone.utc)},
    )
    db.commit()
    notify_password_changed(db, user)
    return {
        "ok": True,
        "message": "Password updated successfully",
        "access_token": create_access_token(str(user["id"]), user["role"], new_hash, mfa=user["role"] == "super_admin"),
    }
