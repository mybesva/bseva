from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.security import decode_token

bearer = HTTPBearer(auto_error=False)

ACCOUNT_BLOCKED = "Your account has been blocked. Please contact BSeva support for assistance."


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
    return dict(row)


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
