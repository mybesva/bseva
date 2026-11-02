"""Issue image CAPTCHA challenges for the public web forms (see app.captcha)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import captcha, rate_limit
from app.db import get_db

router = APIRouter(tags=["captcha"])


class CaptchaIn(BaseModel):
    purpose: str = Field(min_length=3, max_length=16)
    # Refresh: the challenge being replaced, retired so it can no longer be answered.
    replaces: str | None = Field(default=None, max_length=128)


@router.post("/captcha")
def new_captcha(body: CaptchaIn, request: Request, response: Response, db: Session = Depends(get_db)):
    response.headers["Cache-Control"] = "no-store"
    return captcha.new_challenge(db, purpose=body.purpose, ip=rate_limit.client_ip(request), replaces=body.replaces)
