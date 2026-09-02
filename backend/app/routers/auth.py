from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.config import settings
from app.db import get_db
from app.deps import ACCOUNT_BLOCKED, current_user
from app.schemas import ChangePasswordIn, LoginIn, MePatchIn, OtpRequestIn, OtpVerifyIn, RegisterIn, TokenOut
from app.security import create_access_token, hash_otp, hash_password, verify_otp, verify_password
from app.profile_utils import CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION

router = APIRouter(prefix="/auth", tags=["auth"])


def _verify_registration_otp(db: Session, body: RegisterIn) -> None:
    rows = db.execute(
        text(
            """
            SELECT * FROM otp_codes
            WHERE consumed = FALSE AND expires_at > NOW() AND purpose = 'register'
              AND (phone = :phone OR email = :email)
            ORDER BY created_at DESC LIMIT 5
            """
        ),
        {"phone": body.phone, "email": str(body.email)},
    ).mappings().all()
    for row in rows:
        if verify_otp(body.otp, row["code_hash"]):
            db.execute(text("UPDATE otp_codes SET consumed = TRUE WHERE id = :id"), {"id": row["id"]})
            return
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
    if not body.phone and not body.email:
        raise HTTPException(400, "Phone or email required")
    code = settings.otp_dev_code if settings.environment != "production" else f"{uuid4().int % 1_000_000:06d}"
    db.execute(
        text(
            """
            INSERT INTO otp_codes (phone, email, code_hash, purpose, expires_at)
            VALUES (:phone, :email, :hash, :purpose, NOW() + INTERVAL '10 minutes')
            """
        ),
        {
            "phone": body.phone,
            "email": str(body.email) if body.email else None,
            "hash": hash_otp(code),
            "purpose": "register" if body.purpose == "register" else "login",
        },
    )
    db.commit()
    out = {"ok": True, "message": "OTP sent"}
    return out


@router.post("/otp/verify")
def verify_otp_ep(body: OtpVerifyIn, db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT * FROM otp_codes
            WHERE consumed = FALSE AND expires_at > NOW()
              AND (phone = :phone OR email = :email)
            ORDER BY created_at DESC LIMIT 5
            """
        ),
        {"phone": body.phone, "email": str(body.email) if body.email else None},
    ).mappings().all()
    for row in rows:
        if verify_otp(body.code, row["code_hash"]):
            db.execute(text("UPDATE otp_codes SET consumed = TRUE WHERE id = :id"), {"id": row["id"]})
            db.commit()
            return {"ok": True}
    raise HTTPException(400, "Invalid or expired OTP")


@router.post("/register", response_model=TokenOut)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    if not body.registration_consent:
        raise HTTPException(400, "You must accept the Terms & Conditions and Privacy Policy")
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
        db.execute(
            text(
                """
                INSERT INTO pujari_profiles
                  (user_id, requested_level, verification_status, location_label, address, address_line1, address_line2,
                   city, district, state, pincode, country, latitude, longitude, backup_phone)
                VALUES (CAST(:id AS uuid), :lvl, 'pending', :loc, :addr, :a1, :a2, :city, :district, :state, :pin, :country, :lat, :lng, :backup)
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
        extra["profile"] = dict(p) if p else None
    elif user["role"] == "pujari":
        p = db.execute(text("SELECT * FROM pujari_profiles WHERE user_id = :id"), {"id": user["id"]}).mappings().first()
        extra["profile"] = dict(p) if p else None
    return {**_public(user), **extra}


@router.patch("/me")
def patch_me(body: MePatchIn, user=Depends(current_user), db: Session = Depends(get_db)):
    if body.name:
        db.execute(text("UPDATE users SET name = :v WHERE id = CAST(:id AS uuid)"), {"v": body.name, "id": user["id"]})
    if body.preferred_language:
        db.execute(text("UPDATE users SET preferred_language = :v WHERE id = CAST(:id AS uuid)"), {"v": body.preferred_language, "id": user["id"]})
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
