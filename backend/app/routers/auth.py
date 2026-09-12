from uuid import uuid4
import json
import os
import urllib.parse
import urllib.request

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import ACCOUNT_BLOCKED, current_user
from app.domain import row_dict
from app.platform_config import get_setting
from app.schemas import ChangePasswordIn, LoginIn, MePatchIn, OtpRequestIn, OtpVerifyIn, RegisterIn, TokenOut
from app.security import create_access_token, hash_password, verify_password
from app.profile_utils import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION

router = APIRouter(prefix="/auth", tags=["auth"])


def _verify_registration_captcha(db: Session, token: str | None) -> None:
    if not bool(get_setting(db, "registration_captcha_enabled", False)):
        return
    secret = (os.environ.get("RECAPTCHA_SECRET_KEY") or "").strip()
    if not secret:
        raise HTTPException(503, "CAPTCHA is enabled but RECAPTCHA_SECRET_KEY is not configured")
    if not token or not str(token).strip():
        raise HTTPException(400, "CAPTCHA verification is required")
    # Dev/test bypass when secret is explicitly set to this value
    if secret == "dev-bypass" and token == "dev-bypass":
        return
    data = urllib.parse.urlencode({"secret": secret, "response": token}).encode()
    try:
        with urllib.request.urlopen(
            "https://www.google.com/recaptcha/api/siteverify",
            data=data,
            timeout=8,
        ) as resp:
            payload = json.loads(resp.read().decode())
    except Exception as exc:
        raise HTTPException(502, f"CAPTCHA verification failed: {exc}") from exc
    if not payload.get("success"):
        raise HTTPException(400, "CAPTCHA verification failed")


def _verify_registration_otp(db: Session, body: RegisterIn) -> None:
    from app.otp_service import verify_email_otp

    result = verify_email_otp(
        db,
        email=str(body.email),
        code=body.otp,
        purpose="register",
        consume=True,
    )
    if not result.get("ok"):
        raise HTTPException(400, "Invalid or expired OTP")


def _public(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "email": row["email"],
        "phone": row["phone"],
        "role": row["role"],
        "blocked": row["blocked"],
        "preferred_language": row["preferred_language"],
        "calendar_preference": row["calendar_preference"],
    }


@router.post("/otp/request")
def request_otp(body: OtpRequestIn, db: Session = Depends(get_db)):
    """Issue email OTP (10 minutes). Delivery via email provider; SMS reserved for later."""
    from app.otp_service import issue_email_otp

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        # Prefer email OTP; do not fall back to SMS for now
        raise HTTPException(400, "Email is required for OTP")

    purpose = body.purpose if body.purpose in ("register", "login", "verify") else "login"
    # Generic response — do not reveal whether the account exists for login
    user_row = db.execute(
        text("SELECT name, preferred_language, blocked FROM users WHERE lower(email) = :e LIMIT 1"),
        {"e": email},
    ).mappings().first()

    if purpose == "login":
        # Always return the same message; only send if a non-blocked user exists
        generic = {
            "ok": True,
            "message": "If an account exists for this email, an OTP has been sent.",
            "expires_in_minutes": 10,
        }
        if not user_row or user_row.get("blocked"):
            return generic
        result = issue_email_otp(
            db,
            email=email,
            purpose="login",
            customer_name=str(user_row.get("name") or ""),
            language=str(user_row.get("preferred_language") or "en"),
            phone=body.phone,
            deliver=True,
        )
        if not result.get("ok"):
            if result.get("error") in ("cooldown", "hourly_limit", "rate_limited"):
                raise HTTPException(
                    429,
                    f"Please wait before requesting another OTP"
                    + (f" ({result.get('retry_after_seconds')}s)" if result.get("retry_after_seconds") else ""),
                )
            return generic
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
    )
    if not result.get("ok"):
        if result.get("error") in ("cooldown", "hourly_limit", "rate_limited"):
            raise HTTPException(429, "Please wait before requesting another OTP")
        raise HTTPException(400, "Could not send OTP")
    out = {
        "ok": True,
        "message": "OTP sent to your email. Valid for 10 minutes.",
        "expires_in_minutes": 10,
    }
    if result.get("dev_hint"):
        out["dev_hint"] = result["dev_hint"]
    return out


@router.post("/otp/verify")
def verify_otp_ep(body: OtpVerifyIn, db: Session = Depends(get_db)):
    from app.otp_service import verify_email_otp

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        raise HTTPException(400, "Email is required")
    purpose = body.purpose if body.purpose in ("register", "login", "verify") else None
    result = verify_email_otp(db, email=email, code=body.code, purpose=purpose, consume=True)
    if not result.get("ok"):
        raise HTTPException(400, "Invalid or expired OTP")
    return {"ok": True}


@router.post("/login/otp", response_model=TokenOut)
def login_with_otp(body: OtpVerifyIn, db: Session = Depends(get_db)):
    """Email OTP login — replaces SMS OTP login delivery for now."""
    from app.otp_service import verify_email_otp

    email = str(body.email).strip().lower() if body.email else None
    if not email:
        raise HTTPException(400, "Email is required")
    verified = verify_email_otp(db, email=email, code=body.code, purpose="login", consume=True)
    if not verified.get("ok"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired OTP")
    row = db.execute(
        text("SELECT * FROM users WHERE lower(email) = :e LIMIT 1"),
        {"e": email},
    ).mappings().first()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired OTP")
    if row["blocked"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, ACCOUNT_BLOCKED)
    return TokenOut(access_token=create_access_token(str(row["id"]), row["role"]), user=_public(dict(row)))


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not body.registration_consent:
        raise HTTPException(400, "You must accept the Terms & Conditions and Privacy Policy")
    if body.account_type not in ("customer", "pujari"):
        raise HTTPException(400, "Invalid account type")
    _verify_registration_captcha(db, body.captcha_token)
    _verify_registration_otp(db, body)
    referrer_ok = None
    if body.referral_code:
        from app.referrals import find_referrer_by_code

        referrer_ok = find_referrer_by_code(db, body.referral_code)
        if not referrer_ok or referrer_ok.get("blocked"):
            raise HTTPException(400, "Invalid referral code")
    exists = db.execute(
        text("SELECT id FROM users WHERE email = :e OR phone = :p"),
        {"e": str(body.email), "p": body.phone},
    ).first()
    if exists:
        raise HTTPException(409, "An account with this email or phone already exists")
    user_id = str(uuid4())
    db.execute(
        text(
            """
            INSERT INTO users (id, name, email, phone, password_hash, role, preferred_language, calendar_preference, phone_verified,
              registration_consent, registration_consent_at, terms_version, privacy_version)
            VALUES (CAST(:id AS uuid), :name, :email, :phone, :pw, :role, :lang, :cal, TRUE,
              TRUE, NOW(), :tv, :pv)
            """
        ),
        {
            "id": user_id,
            "name": body.name,
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
                  (user_id, requested_level, verification_status, location_label, address, address_line1, address_line2,
                   city, district, state, pincode, country, latitude, longitude, backup_phone,
                   joining_fee_status, joining_fee_paise)
                VALUES (CAST(:id AS uuid), :lvl, 'pending', :loc, :addr, :a1, :a2, :city, :district, :state, :pin, :country, :lat, :lng, :backup,
                        :jfs, :jfa)
                """
            ),
            {
                "id": user_id,
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
    if body.referral_code:
        from app.referrals import apply_referral_code

        apply_referral_code(db, user_id, body.referral_code)
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


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM users WHERE email = :id OR phone = :id"),
        {"id": body.identifier.strip()},
    ).mappings().first()
    if not row or not verify_password(body.password, row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email/phone or password")
    if row["blocked"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, ACCOUNT_BLOCKED)
    return TokenOut(access_token=create_access_token(str(row["id"]), row["role"]), user=_public(dict(row)))


@router.get("/me")
def me(user=Depends(current_user), db: Session = Depends(get_db)):
    extra: dict = {}
    if user["role"] == "customer":
        p = db.execute(text("SELECT * FROM customer_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
        extra["profile"] = row_dict(p) if p else None
    elif user["role"] in ("pujari", "head_pujari"):
        p = db.execute(text("SELECT * FROM pujari_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
        extra["profile"] = row_dict(p) if p else None
    return {**_public(user), **extra}


@router.patch("/me")
def patch_me(body: MePatchIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if body.name:
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
    db.commit()
    return {"ok": True}


@router.post("/change-password")
def change_password(body: ChangePasswordIn, user=Depends(current_user), db: Session = Depends(get_db)):
    row = db.execute(text("SELECT password_hash FROM users WHERE id = CAST(:id AS uuid)"), {"id": user["id"]}).mappings().one()
    if not verify_password(body.current_password, row["password_hash"]):
        raise HTTPException(400, "Current password is incorrect")
    if body.current_password == body.new_password:
        raise HTTPException(400, "New password must be different from current password")
    db.execute(
        text("UPDATE users SET password_hash = :pw, updated_at = NOW() WHERE id = CAST(:id AS uuid)"),
        {"pw": hash_password(body.new_password), "id": user["id"]},
    )
    db.commit()
    return {"ok": True, "message": "Password updated successfully"}
