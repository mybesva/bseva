"""Firebase Cloud Messaging helpers shared by web, PWA, Android, and iOS.

Initialize once at FastAPI startup. Local dev uses GOOGLE_APPLICATION_CREDENTIALS
pointing at a service-account JSON file. Production can set
FIREBASE_SERVICE_ACCOUNT_JSON to the JSON string (never ship this to the browser).
"""
from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Mapping

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

_initialized = False

try:
    import firebase_admin
    from firebase_admin import credentials, messaging
except ImportError:  # pragma: no cover
    firebase_admin = None  # type: ignore[assignment]
    credentials = None  # type: ignore[assignment]
    messaging = None  # type: ignore[assignment]


INVALID_TOKEN_CODES = {
    "UNREGISTERED",
    "NOT_FOUND",
    "INVALID_ARGUMENT",
    "SENDER_ID_MISMATCH",
    "REGISTRATION_TOKEN_NOT_REGISTERED",
    "INVALID_REGISTRATION_TOKEN",
}


@dataclass
class PushResult:
    success: int = 0
    failure: int = 0
    invalid_tokens: list[str] = field(default_factory=list)
    skipped_reason: str | None = None


def stringify_data(data: Mapping[str, Any] | None) -> dict[str, str]:
    out: dict[str, str] = {}
    if not data:
        return out
    for key, value in data.items():
        if value is None:
            continue
        out[str(key)] = value if isinstance(value, str) else json.dumps(value, default=str)
    return out


def is_invalid_token_error(exc: BaseException | None) -> bool:
    if exc is None:
        return False
    code = str(getattr(exc, "code", "") or "").upper().replace("-", "_")
    if code in INVALID_TOKEN_CODES:
        return True
    text_blob = f"{type(exc).__name__} {exc}".upper()
    return any(c.replace("_", " ") in text_blob or c in text_blob for c in INVALID_TOKEN_CODES)


def _expand_cred_path(raw: str) -> Path | None:
    path = Path(raw).expanduser()
    return path if path.is_file() else None


def init_firebase() -> bool:
    """Initialize Firebase Admin SDK once. Safe to call repeatedly."""
    global _initialized
    if firebase_admin is None:
        logger.warning("firebase-admin is not installed")
        return False
    if firebase_admin._apps:
        _initialized = True
        return True

    from app.config import settings

    raw_json = (os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON") or settings.firebase_service_account_json or "").strip()
    cred_path = (
        os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        or os.getenv("FIREBASE_SERVICE_ACCOUNT_FILE")
        or settings.google_application_credentials
        or settings.firebase_service_account_file
        or ""
    ).strip()

    try:
        if raw_json:
            info = json.loads(raw_json)
            cred = credentials.Certificate(info)
        elif cred_path:
            path = _expand_cred_path(cred_path)
            if not path:
                logger.warning("Firebase credential file not found: %s", cred_path)
                return False
            cred = credentials.Certificate(str(path))
        else:
            logger.info("Firebase Admin SDK not configured (set GOOGLE_APPLICATION_CREDENTIALS)")
            return False
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin SDK initialized")
        return True
    except Exception:
        logger.exception("Firebase Admin SDK initialization failed")
        return False


def firebase_ready() -> bool:
    return bool(firebase_admin and firebase_admin._apps) or init_firebase()


def _public_app_url() -> str:
    env = (os.getenv("PUBLIC_APP_URL") or "").strip()
    if env:
        return env.rstrip("/")
    try:
        from app.config import settings

        return (settings.public_app_url or "http://localhost:5173").rstrip("/")
    except Exception:
        return "http://localhost:5173"


def _admin_ui_base() -> str:
    env = (os.getenv("VITE_ADMIN_PATH") or os.getenv("ADMIN_UI_PATH") or "").strip()
    if not env:
        try:
            from app.config import settings

            env = (settings.admin_ui_path or "/bseva-ops-m8k4q").strip()
        except Exception:
            env = "/bseva-ops-m8k4q"
    if not env.startswith("/"):
        env = f"/{env}"
    return env.rstrip("/") or "/bseva-ops-m8k4q"


def web_click_url(data: Mapping[str, Any] | None) -> str:
    """Absolute URL used by FCM web push click-through."""
    link = str((data or {}).get("link") or "/").strip() or "/"
    if link.startswith("http://") or link.startswith("https://"):
        return link
    if not link.startswith("/"):
        link = f"/{link}"
    if link == "/admin" or link.startswith("/admin/"):
        rest = link[len("/admin") :] or "/"
        if rest != "/" and not rest.startswith("/"):
            rest = f"/{rest}"
        link = f"{_admin_ui_base()}{'' if rest == '/' else rest}"
    return f"{_public_app_url()}{link}"


def _build_message(token: str, title: str, body: str, data: dict[str, str]) -> Any:
    click = web_click_url(data)
    return messaging.Message(
        token=token,
        notification=messaging.Notification(title=title, body=body),
        data=data,
        android=messaging.AndroidConfig(priority="high"),
        apns=messaging.APNSConfig(
            payload=messaging.APNSPayload(aps=messaging.Aps(sound="default", badge=1)),
        ),
        webpush=messaging.WebpushConfig(
            headers={"Urgency": "high"},
            notification=messaging.WebpushNotification(
                title=title,
                body=body,
                icon="/bseva-logo.png",
            ),
            fcm_options=messaging.WebpushFCMOptions(link=click),
        ),
    )


def send_to_token(
    token: str,
    *,
    title: str,
    body: str,
    data: Mapping[str, Any] | None = None,
) -> PushResult:
    return send_to_tokens([token], title=title, body=body, data=data)


def send_to_tokens(
    tokens: list[str],
    *,
    title: str,
    body: str,
    data: Mapping[str, Any] | None = None,
) -> PushResult:
    """Send the same notification to one or many FCM registration tokens."""
    unique = [t.strip() for t in tokens if t and str(t).strip()]
    unique = list(dict.fromkeys(unique))
    if not unique:
        return PushResult(skipped_reason="no_tokens")
    if not firebase_ready() or messaging is None:
        return PushResult(skipped_reason="firebase_not_configured")

    payload = stringify_data(data)
    invalid: list[str] = []
    success = 0
    failure = 0
    chunk_size = 500
    for i in range(0, len(unique), chunk_size):
        chunk = unique[i : i + chunk_size]
        messages = [_build_message(tok, title, body, payload) for tok in chunk]
        try:
            batch = messaging.send_each(messages)
        except Exception:
            logger.exception("FCM send_each failed")
            failure += len(chunk)
            continue
        for tok, resp in zip(chunk, batch.responses):
            if resp.success:
                success += 1
                continue
            failure += 1
            if is_invalid_token_error(resp.exception):
                invalid.append(tok)
            else:
                logger.warning("FCM send failed for token …%s: %s", tok[-8:], resp.exception)
    return PushResult(success=success, failure=failure, invalid_tokens=invalid)


def deactivate_tokens(db: Session, tokens: list[str]) -> int:
    if not tokens:
        return 0
    n = 0
    for tok in tokens:
        db.execute(
            text(
                """
                UPDATE fcm_device_tokens
                SET active = FALSE, updated_at = NOW()
                WHERE fcm_token = :tok AND active = TRUE
                """
            ),
            {"tok": tok},
        )
        n += 1
    return n


def active_tokens_for_user(db: Session, user_id: str) -> list[str]:
    rows = db.execute(
        text(
            """
            SELECT fcm_token FROM fcm_device_tokens
            WHERE user_id = CAST(:uid AS uuid) AND active = TRUE
            """
        ),
        {"uid": user_id},
    ).all()
    return [str(r[0]) for r in rows if r and r[0]]


def push_to_user(
    db: Session,
    user_id: str,
    *,
    title: str,
    body: str,
    data: Mapping[str, Any] | None = None,
) -> PushResult:
    tokens = active_tokens_for_user(db, user_id)
    result = send_to_tokens(tokens, title=title, body=body, data=data)
    if result.invalid_tokens:
        try:
            deactivate_tokens(db, result.invalid_tokens)
        except Exception:
            logger.exception("Failed to deactivate invalid FCM tokens")
    return result


def upsert_device_token(db: Session, *, user_id: str, token: str, platform: str) -> str:
    row = db.execute(
        text(
            """
            INSERT INTO fcm_device_tokens (user_id, fcm_token, platform, active, created_at, updated_at)
            VALUES (CAST(:uid AS uuid), :token, :platform, TRUE, NOW(), NOW())
            ON CONFLICT (fcm_token) DO UPDATE SET
              user_id = EXCLUDED.user_id,
              platform = EXCLUDED.platform,
              active = TRUE,
              updated_at = NOW()
            RETURNING id
            """
        ),
        {"uid": user_id, "token": token, "platform": platform},
    ).first()
    return str(row[0]) if row else ""


def deactivate_user_token(db: Session, *, user_id: str, token: str) -> bool:
    row = db.execute(
        text(
            """
            UPDATE fcm_device_tokens
            SET active = FALSE, updated_at = NOW()
            WHERE user_id = CAST(:uid AS uuid) AND fcm_token = :token
            RETURNING id
            """
        ),
        {"uid": user_id, "token": token},
    ).first()
    return bool(row)
