"""Self-hosted image CAPTCHA for public web forms: five characters drawn as a noisy PNG, checked on the server.

Nothing that reveals the answer leaves the server or is stored in a readable form. The browser gets an
unguessable challenge id and a PNG. The table keeps SHA-256 of the id and an HMAC of id + answer keyed from
JWT_SECRET, so even a database read does not give working answers. Every check runs in one UPDATE in
Postgres (shared by all API instances): a challenge passes at most once, expires after five minutes, and is
burned after three wrong answers. A broken store refuses the request (503) instead of skipping the check.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import io
import logging
import random
import secrets

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app import rate_limit
from app.config import settings
from app.i18n import coded_http

logger = logging.getLogger("bseva.captcha")

# Uppercase letters and digits without the look-alikes O/0, I/1/L.
ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LENGTH = 5
TTL_SECONDS = 5 * 60
MAX_ATTEMPTS = 3
PURPOSES = ("contact", "register", "login")
WIDTH, HEIGHT = 200, 60

# Challenges one client address may create, and wrong answers it may give, per window.
NEW_PER_IP = ("captcha_new_ip", 30, 10 * 60)
FAIL_PER_IP = ("captcha_fail_ip", 20, 15 * 60)

REQUIRED_MESSAGE = "Please type the characters shown in the image."
INVALID_MESSAGE = "The characters did not match or the image expired. Please try the new image."


class CaptchaUnavailable(Exception):
    pass


def _id_hash(captcha_id: str) -> str:
    return hashlib.sha256(f"captcha-id:{captcha_id}".encode()).hexdigest()


def _answer_hash(captcha_id: str, answer: str) -> str:
    key = hashlib.sha256(f"bseva-captcha:{settings.jwt_secret}".encode()).digest()
    return hmac.new(key, f"{captcha_id}:{answer}".encode(), hashlib.sha256).hexdigest()


def normalize_answer(raw: str | None) -> str:
    """What people type: case and spaces do not matter."""
    return "".join(str(raw or "").split()).upper()[:16]


def _new_answer() -> str:
    return "".join(secrets.choice(ALPHABET) for _ in range(LENGTH))


def _render(answer: str) -> bytes:
    from PIL import Image, ImageDraw, ImageFilter, ImageFont

    rnd = random.SystemRandom()
    img = Image.new("RGB", (WIDTH, HEIGHT), (rnd.randint(244, 255), rnd.randint(238, 250), rnd.randint(226, 242)))
    draw = ImageDraw.Draw(img)
    for _ in range(140):  # speckle
        x, y = rnd.randrange(WIDTH), rnd.randrange(HEIGHT)
        shade = rnd.randint(150, 215)
        draw.point((x, y), fill=(shade, shade - 10, shade - 30))
    for _ in range(4):  # background strokes
        pts = [(rnd.randrange(WIDTH), rnd.randrange(HEIGHT)) for _ in range(2)]
        draw.line(pts, fill=(rnd.randint(170, 210), rnd.randint(150, 190), rnd.randint(120, 170)), width=1)
    try:
        font = ImageFont.load_default(size=34)
    except TypeError:  # Pillow without FreeType: bitmap font, still readable after scaling
        font = ImageFont.load_default()
    step = (WIDTH - 24) // LENGTH
    for i, ch in enumerate(answer):
        glyph = Image.new("RGBA", (48, 56), (0, 0, 0, 0))
        colour = (rnd.randint(20, 60), rnd.randint(30, 70), rnd.randint(80, 130), 255)
        ImageDraw.Draw(glyph).text((6, 6), ch, font=font, fill=colour)
        glyph = glyph.rotate(rnd.uniform(-22, 22), resample=Image.BICUBIC, expand=False)
        img.paste(glyph, (6 + i * step + rnd.randint(-2, 2), rnd.randint(-2, 6)), glyph)
    for _ in range(2):  # strokes through the text
        y0 = rnd.randint(18, HEIGHT - 18)
        draw.line([(0, y0), (WIDTH, y0 + rnd.randint(-12, 12))], fill=(110, 90, 140), width=2)
    img = img.filter(ImageFilter.SMOOTH)
    out = io.BytesIO()
    img.save(out, format="PNG", optimize=True)
    return out.getvalue()


def new_challenge(db: Session, *, purpose: str, ip: str, replaces: str | None = None) -> dict:
    """Create a challenge and return its id and image. Retires the challenge it replaces (Refresh)."""
    if purpose not in PURPOSES:
        raise coded_http(400, "CAPTCHA_PURPOSE", "Unknown form.")
    rate_limit.enforce(
        db, NEW_PER_IP, ip, "Too many new images were requested. Please wait a few minutes.", fail_closed=True
    )
    answer = _new_answer()
    captcha_id = secrets.token_urlsafe(32)
    try:
        if replaces:
            db.execute(
                text("UPDATE captcha_challenges SET used_at = NOW() WHERE id_hash = :i AND used_at IS NULL"),
                {"i": _id_hash(str(replaces))},
            )
        db.execute(
            text(
                """
                INSERT INTO captcha_challenges (id_hash, answer_hash, purpose, expires_at)
                VALUES (:i, :a, :p, NOW() + make_interval(secs => :ttl))
                """
            ),
            {"i": _id_hash(captcha_id), "a": _answer_hash(captcha_id, answer), "p": purpose, "ttl": TTL_SECONDS},
        )
        if secrets.randbelow(50) == 0:
            db.execute(text("DELETE FROM captcha_challenges WHERE expires_at < NOW() - INTERVAL '1 day'"))
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.error("CAPTCHA_STORE_UNAVAILABLE (apply supabase/migrations/039)")
        raise rate_limit.unavailable() from None
    image = base64.b64encode(_render(answer)).decode()
    return {
        "captcha_id": captcha_id,
        "image": f"data:image/png;base64,{image}",
        "length": LENGTH,
        "expires_in_seconds": TTL_SECONDS,
    }


def _consume(db: Session, captcha_id: str, answer: str, purpose: str) -> bool:
    """True once for a correct, live, unused challenge; any other call counts a wrong attempt."""
    i = _id_hash(captcha_id)
    try:
        won = db.execute(
            text(
                """
                UPDATE captcha_challenges SET used_at = NOW(), attempts = attempts + 1
                WHERE id_hash = :i AND purpose = :p AND answer_hash = :a
                  AND used_at IS NULL AND expires_at > NOW() AND attempts < :max
                RETURNING 1
                """
            ),
            {"i": i, "p": purpose, "a": _answer_hash(captcha_id, answer), "max": MAX_ATTEMPTS},
        ).first()
        if not won:
            db.execute(
                text(
                    """
                    UPDATE captcha_challenges
                    SET attempts = attempts + 1,
                        used_at = CASE WHEN attempts + 1 >= :max THEN NOW() ELSE used_at END
                    WHERE id_hash = :i AND used_at IS NULL
                    """
                ),
                {"i": i, "max": MAX_ATTEMPTS},
            )
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.error("CAPTCHA_STORE_UNAVAILABLE")
        raise CaptchaUnavailable() from None
    return bool(won)


def require(db: Session, captcha_id: str | None, answer: str | None, *, purpose: str, ip: str) -> None:
    """Refuse the request unless it carries a correct answer to a live challenge for this form.

    400 CAPTCHA_REQUIRED (nothing sent) or CAPTCHA_INVALID (wrong, expired, reused or burned); 429 when this
    client has given too many wrong answers; 503 when the store is unavailable."""
    if rate_limit.is_blocked(db, FAIL_PER_IP, ip):
        raise rate_limit.too_many("Too many wrong answers. Please wait a few minutes and try again.")
    cid = str(captcha_id or "").strip()[:128]
    typed = normalize_answer(answer)
    if not cid or not typed:
        raise coded_http(400, "CAPTCHA_REQUIRED", REQUIRED_MESSAGE)
    try:
        ok = _consume(db, cid, typed, purpose)
    except CaptchaUnavailable:
        raise rate_limit.unavailable() from None
    if not ok:
        rate_limit.record(db, FAIL_PER_IP, ip)
        db.commit()
        logger.warning("SECURITY_EVENT kind=captcha_failed purpose=%s", purpose)
        raise coded_http(400, "CAPTCHA_INVALID", INVALID_MESSAGE)


def mode(raw: str | None) -> str:
    return "enforce" if (raw or "").strip().lower() == "enforce" else "off"


def public_config() -> dict:
    """Which web forms show the CAPTCHA. Login asks only after repeated failures (0 = never)."""
    return {
        "captcha": {
            "contact": mode(settings.contact_captcha) == "enforce",
            "register_otp": mode(settings.register_otp_captcha) == "enforce",
            "login_after_failures": max(0, int(settings.login_captcha_after_failures or 0)),
        }
    }
