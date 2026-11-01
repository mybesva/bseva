import hashlib
from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.context import CryptContext

from app.config import settings

pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(plain: str) -> str:
    return pwd.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd.verify(plain, hashed)


# Aliases used by lifecycle OTP
hash_otp = hash_password
verify_otp = verify_password


def password_version(password_hash: str | None) -> str:
    return hashlib.sha256(str(password_hash or "").encode()).hexdigest()[:16]


SUPER_ADMIN_LOGIN_AUDIENCE = "bseva-super-admin-login"
SUPER_ADMIN_LOGIN_MINUTES = 10


def create_access_token(sub: str, role: str, password_hash: str | None = None, *, mfa: bool = False) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.jwt_expire_minutes)
    claims: dict[str, Any] = {"sub": sub, "role": role, "exp": exp}
    # Admin sessions end when the password changes.
    if role in ("admin", "super_admin") and password_hash:
        claims["pv"] = password_version(password_hash)
    if mfa:
        claims["mfa"] = True
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_login_challenge(sub: str, password_hash: str) -> str:
    """Proof the password step passed. Its audience makes it useless as an access token."""
    exp = datetime.now(timezone.utc) + timedelta(minutes=SUPER_ADMIN_LOGIN_MINUTES)
    claims = {"sub": sub, "pv": password_version(password_hash), "aud": SUPER_ADMIN_LOGIN_AUDIENCE, "exp": exp}
    return jwt.encode(claims, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_login_challenge(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(
            token, settings.jwt_secret, algorithms=[settings.jwt_algorithm], audience=SUPER_ADMIN_LOGIN_AUDIENCE
        )
    except jwt.PyJWTError as e:
        raise ValueError("Invalid challenge") from e


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError as e:
        raise ValueError("Invalid token") from e


def hash_otp(code: str) -> str:
    return pwd.hash(code)


def verify_otp(code: str, hashed: str) -> bool:
    return pwd.verify(code, hashed)
