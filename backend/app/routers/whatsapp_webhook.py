"""Meta WhatsApp Cloud API webhook: GET subscription check and signed POST events (see app.whatsapp.webhook).

Answers 404 until configured, so an unconfigured deployment does not look like a webhook to Meta.
"""
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool

from app import rate_limit
from app.config import settings
from app.db import get_db
from app.whatsapp import webhook

logger = logging.getLogger("bseva.whatsapp")

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

NO_STORE = {"Cache-Control": "no-store"}


def _apply(db: Session, body: bytes) -> dict[str, int]:
    counts = webhook.process(db, webhook.parse(body))
    db.commit()
    return counts


@router.get("/whatsapp")
def verify_subscription(request: Request):
    if not settings.whatsapp_webhook_verify_token:
        raise HTTPException(404, "Not Found")
    q = request.query_params
    challenge = webhook.challenge_response(q.get("hub.mode"), q.get("hub.verify_token"), q.get("hub.challenge"))
    if challenge is None:
        # Query values are caller-controlled: log only whether the mode was right, never the values themselves.
        logger.warning(
            "WHATSAPP_WEBHOOK_VERIFY_REFUSED ip=%s subscribe_mode=%s", rate_limit.client_ip(request), q.get("hub.mode") == "subscribe"
        )
        raise HTTPException(403, "Forbidden")
    logger.info("WHATSAPP_WEBHOOK_VERIFIED")
    return PlainTextResponse(challenge, headers=NO_STORE)


@router.post("/whatsapp")
async def receive_events(request: Request, db: Session = Depends(get_db)):
    if not settings.whatsapp_app_secret:
        raise HTTPException(404, "Not Found")
    ip = rate_limit.client_ip(request)
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > webhook.MAX_BODY_BYTES:
        raise HTTPException(413, "Payload too large")
    body = await request.body()
    if len(body) > webhook.MAX_BODY_BYTES:
        raise HTTPException(413, "Payload too large")
    if not webhook.signature_valid(body, request.headers.get("x-hub-signature-256")):
        logger.warning("WHATSAPP_WEBHOOK_BAD_SIGNATURE ip=%s bytes=%s", ip, len(body))
        raise HTTPException(401, "Invalid signature")
    try:
        # Database work runs in the thread pool, like every synchronous route, not on the event loop.
        counts = await run_in_threadpool(_apply, db, body)
    except webhook.MalformedPayload as exc:
        db.rollback()
        # Signed by Meta but not in a shape we understand: a retry would fail the same way.
        logger.warning("WHATSAPP_WEBHOOK_MALFORMED reason=%s", exc)
        raise HTTPException(400, "Malformed payload") from None
    except SQLAlchemyError:
        db.rollback()
        # Not acknowledged, so Meta retries; events already claimed were rolled back with everything else.
        logger.exception("WHATSAPP_WEBHOOK_STORE_UNAVAILABLE")
        return JSONResponse(status_code=503, content={"detail": "Temporarily unavailable"}, headers={"Retry-After": "60"})
    logger.info("WHATSAPP_WEBHOOK_OK %s", " ".join(f"{k}={v}" for k, v in counts.items()))
    return JSONResponse({"ok": True}, headers=NO_STORE)
