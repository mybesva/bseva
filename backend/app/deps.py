from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.security import decode_token, password_version

bearer = HTTPBearer(auto_error=False)

ACCOUNT_BLOCKED = "Your account has been blocked. Please contact BSeva support for assistance."
SESSION_ENDED = "Your session has ended. Please sign in again."


def account_state_error(row) -> HTTPException | None:
    """Accounts pending deletion (or deleted) cannot use the API; they may only cancel the request."""
    state = (row.get("account_state") if hasattr(row, "get") else None) or "active"
    if state == "active":
        return None
    message = "This account has been deleted."
    if state == "deletion_requested":
        message = (
            "This account is scheduled for deletion. You can cancel the request from the Delete Account page "
            "before the deletion is completed."
        )
    return HTTPException(status.HTTP_403_FORBIDDEN, {"code": "ACCOUNT_DELETION_PENDING", "message": message})


def _revoked(row, payload: dict) -> bool:
    revoked_at = row.get("sessions_revoked_at") if hasattr(row, "get") else None
    if not revoked_at:
        return False
    revoked_ms = int(revoked_at.timestamp() * 1000)
    if payload.get("iatm") is not None:
        return int(payload["iatm"]) < revoked_ms
    issued = payload.get("iat")
    return issued is None or int(issued) * 1000 < revoked_ms


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    if not creds:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in")
    try:
        payload = decode_token(creds.credentials)
    except ValueError:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    row = db.execute(
        text("SELECT * FROM users WHERE id = CAST(:id AS uuid)"),
        {"id": payload.get("sub")},
    ).mappings().first()
    if not row:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    if row["blocked"]:
        raise HTTPException(status.HTTP_403_FORBIDDEN, ACCOUNT_BLOCKED)
    state_error = account_state_error(row)
    if state_error:
        raise state_error
    if _revoked(row, payload):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, SESSION_ENDED)
    if payload.get("pv") and payload["pv"] != password_version(row["password_hash"]):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Your password was changed. Please sign in again.")
    # Also ends sessions from before OTP was required, and accounts promoted while signed in.
    if row["role"] == "super_admin" and not payload.get("mfa"):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Please sign in again with your one-time code.")
    return dict(row)


def optional_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
):
    """The signed-in user, or None for anonymous callers and for any token current_user would refuse."""
    if not creds:
        return None
    try:
        return current_user(creds=creds, db=db)
    except HTTPException:
        return None


def require_roles(*roles: str):
    def inner(user=Depends(current_user)):
        effective = set(roles)
        if "admin" in effective:
            effective.add("super_admin")
        if "pujari" in effective:
            effective.add("head_pujari")
        if user["role"] not in effective:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed")
        return user

    return inner
