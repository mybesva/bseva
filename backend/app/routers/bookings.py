from datetime import date, datetime, timedelta
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.deps import current_user, require_roles
from app.domain import apply_wallet, cancel_policy, hours_until, nearby_pujaris, row_dict, slot_conflict
from app.panchang import panchang_for
from app.schemas import BookingCreateIn

router = APIRouter(tags=["bookings"])


@router.get("/panchang")
def panchang(on: date = Query(..., alias="date"), calendar: str = "north"):
    cal = calendar if calendar in ("north", "south", "lunar") else "north"
    return panchang_for(on, cal)


@router.get("/services")
def list_services(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM services WHERE active = TRUE ORDER BY name")).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/services/{slug}")
def get_service(slug: str, db: Session = Depends(get_db)):
    row = db.execute(text("SELECT * FROM services WHERE slug = :s AND active = TRUE"), {"s": slug}).mappings().first()
    if not row:
        raise HTTPException(404, "Service not found")
    return row_dict(row)


@router.get("/pujari-roles")
def list_pujari_roles(db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT id, level, title, summary, examples FROM pujari_roles ORDER BY level ASC")).mappings().all()
    out = []
    for r in rows:
        data = row_dict(r)
        examples = data.get("examples") or []
        if isinstance(examples, str):
            import json

            examples = json.loads(examples)
        data["examples"] = examples
        out.append(data)
    return out


@router.get("/legal")
def list_legal_public(db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT slug, title, version, sort_order, points, updated_at FROM legal_policies ORDER BY sort_order ASC")
    ).mappings().all()
    out = []
    for r in rows:
        data = row_dict(r)
        points = data.get("points") or []
        if isinstance(points, str):
            import json

            points = json.loads(points)
        data["points"] = points
        out.append(data)
    return out


@router.get("/legal/{slug}")
def get_legal_public(slug: str, db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT slug, title, version, sort_order, points, updated_at FROM legal_policies WHERE slug = :slug"),
        {"slug": slug},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Policy not found")
    data = row_dict(row)
    points = data.get("points") or []
    if isinstance(points, str):
        import json

        points = json.loads(points)
    data["points"] = points
    return data


@router.get("/quote")
def quote(service_id: UUID, package_type: str = "standard", db: Session = Depends(get_db)):
    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid) AND active = TRUE"),
        {"id": str(service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    pricing = db.execute(text("SELECT * FROM pricing_config WHERE id = 1")).mappings().one()
    base = int(svc["premium_price_paise"] if package_type == "premium" else svc["standard_price_paise"])
    gst_pct = float(pricing["gst_percent"])
    gst_amt = int(round(base * gst_pct / 100))
    return {
        "basePrice": base,
        "peakFee": 0,
        "subtotal": base,
        "gstPercent": gst_pct,
        "gstAmount": gst_amt,
        "totalAmount": base + gst_amt,
    }


@router.get("/pujaris")
def list_pujaris(db: Session = Depends(get_db), user=Depends(require_roles("customer", "admin"))):
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, u.phone, p.approved_level, p.verification_status, p.available, p.location_label
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.blocked = FALSE AND p.verification_status = 'approved' AND p.available = TRUE
            ORDER BY p.approved_level DESC
            """
        )
    ).mappings().all()
    return [row_dict(r) for r in rows]


@router.get("/pujaris/nearby")
def nearby(
    lat: float = Query(...),
    lng: float = Query(...),
    service_id: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles("customer", "admin")),
):
    required = 1
    if service_id:
        row = db.execute(text("SELECT required_level FROM services WHERE id = CAST(:id AS uuid)"), {"id": service_id}).first()
        if not row:
            raise HTTPException(404, "Service not found")
        required = int(row[0])
    return nearby_pujaris(db, lat, lng, required)


@router.get("/pujaris/previous")
def previous_pujaris(user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            """
            SELECT DISTINCT ON (u.id) u.id, u.name, p.approved_level, p.verification_status, p.available, u.blocked
            FROM bookings b
            JOIN users u ON u.id = b.pujari_id
            JOIN pujari_profiles p ON p.user_id = u.id
            WHERE b.customer_id = :cid AND b.pujari_id IS NOT NULL
            ORDER BY u.id, b.created_at DESC
            """
        ),
        {"cid": user["id"]},
    ).mappings().all()
    return [row_dict(r) for r in rows if not r["blocked"] and r["verification_status"] == "approved" and r["available"]]


@router.post("/bookings")
def create_booking(body: BookingCreateIn, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    if not body.terms_accepted:
        raise HTTPException(400, "Please accept the Terms & Conditions and Cancellation Policy")
    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid) AND active = TRUE"),
        {"id": str(body.service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    pujari = db.execute(
        text(
            """
            SELECT u.id, u.blocked, p.approved_level, p.verification_status, p.available
            FROM users u JOIN pujari_profiles p ON p.user_id = u.id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": str(body.pujari_id)},
    ).mappings().first()
    if not pujari or pujari["blocked"] or pujari["verification_status"] != "approved" or not pujari["available"]:
        raise HTTPException(400, "This pujari is not available")
    blocked = db.execute(
        text(
            """
            SELECT 1 FROM pujari_blocked_dates
            WHERE pujari_id = CAST(:pid AS uuid) AND blocked_date = :d
            """
        ),
        {"pid": str(body.pujari_id), "d": body.booking_date},
    ).first()
    if blocked:
        raise HTTPException(400, "This pujari is not available on the selected date")
    if not pujari["approved_level"] or int(pujari["approved_level"]) < int(svc["required_level"]):
        raise HTTPException(400, "Pujari is not eligible for this service")
    if body.mode == "virtual" and not svc["virtual_available"]:
        raise HTTPException(400, "This service is not available as a virtual puja")

    duration = int(svc["duration_minutes"] or 90)
    start = body.start_time
    end = (datetime.combine(body.booking_date, start) + timedelta(minutes=duration)).time()
    if slot_conflict(db, str(body.pujari_id), body.booking_date, start, end):
        raise HTTPException(409, "This time slot is already booked")

    pricing = db.execute(text("SELECT * FROM pricing_config WHERE id = 1")).mappings().one()
    base = int(svc["premium_price_paise"] if body.package_type == "premium" else svc["standard_price_paise"])
    gst_pct = float(pricing["gst_percent"])
    gst_amt = int(round(base * gst_pct / 100))
    total = base + gst_amt
    wallet = db.execute(text("SELECT balance_paise FROM wallets WHERE user_id = :id"), {"id": user["id"]}).first()
    if not wallet or wallet[0] < total:
        raise HTTPException(400, "Insufficient wallet balance")

    booking_id = str(uuid4())
    number = f"BSV-{datetime.utcnow().strftime('%y%m%d')}-{booking_id[:8].upper()}"
    meeting = f"https://meet.bseva.example/virtual/{booking_id[:8]}" if body.mode == "virtual" else None
    db.execute(
        text(
            """
            INSERT INTO bookings (
              id, booking_number, customer_id, pujari_id, service_id, package_type, mode,
              booking_date, start_time, end_time, location_label, address, latitude, longitude,
              meeting_url, status, base_price_paise, peak_fee_paise, gst_percent, gst_amount_paise,
              total_paise, terms_accepted
            ) VALUES (
              CAST(:id AS uuid), :num, :cid, CAST(:pid AS uuid), CAST(:sid AS uuid), :pkg, :mode,
              :d, :st, :et, :loc, :addr, :lat, :lng, :meet, 'confirmed', :base, 0, :gstp, :gsta, :total, TRUE
            )
            """
        ),
        {
            "id": booking_id,
            "num": number,
            "cid": user["id"],
            "pid": str(body.pujari_id),
            "sid": str(body.service_id),
            "pkg": body.package_type,
            "mode": body.mode,
            "d": body.booking_date,
            "st": start,
            "et": end,
            "loc": body.location_label,
            "addr": body.address,
            "lat": body.latitude,
            "lng": body.longitude,
            "meet": meeting,
            "base": base,
            "gstp": gst_pct,
            "gsta": gst_amt,
            "total": total,
        },
    )
    try:
        apply_wallet(db, str(user["id"]), -total, "debit", f"Booking {number}", booking_id, number)
        apply_wallet(db, str(body.pujari_id), int(round(base * 0.85)), "credit", f"Earnings {number}", booking_id, number)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    db.execute(
        text("INSERT INTO payments (booking_id, amount_paise, status, provider) VALUES (CAST(:id AS uuid), :amt, 'successful', 'wallet')"),
        {"id": booking_id, "amt": total},
    )
    db.commit()
    return {"id": booking_id, "booking_number": number, "total_paise": total, "meeting_url": meeting}


@router.get("/bookings")
def list_bookings(user=Depends(current_user), db: Session = Depends(get_db)):
    if user["role"] == "admin":
        rows = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, pu.name AS pujari_name, s.name AS service_name
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                ORDER BY b.created_at DESC LIMIT 200
                """
            )
        ).mappings().all()
    elif user["role"] == "pujari":
        rows = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, s.name AS service_name
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                JOIN services s ON s.id = b.service_id
                WHERE b.pujari_id = :id
                ORDER BY b.created_at DESC
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    else:
        rows = db.execute(
            text(
                """
                SELECT b.*, pu.name AS pujari_name, s.name AS service_name
                FROM bookings b
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.customer_id = :id
                ORDER BY b.created_at DESC
                """
            ),
            {"id": user["id"]},
        ).mappings().all()
    return [row_dict(r) for r in rows]


@router.patch("/bookings/{booking_id}/status")
def update_status(booking_id: str, status: str = Query(...), user=Depends(require_roles("pujari", "admin")), db: Session = Depends(get_db)):
    allowed = {"pending", "confirmed", "in_progress", "completed", "cancelled"}
    if status not in allowed:
        raise HTTPException(400, "Invalid status")
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    db.execute(text("UPDATE bookings SET status = :st WHERE id = CAST(:id AS uuid)"), {"st": status, "id": booking_id})
    db.commit()
    return {"ok": True}


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, reason: str | None = None, user=Depends(current_user), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] != "admin" and str(b["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["status"] == "cancelled":
        raise HTTPException(400, "Already cancelled")
    policy = cancel_policy(hours_until(b["booking_date"], b["start_time"]))
    if not policy["allowed"]:
        raise HTTPException(400, "Cancellation is not allowed less than 24 hours before the booking")
    total = int(b["total_paise"])
    fee = int(round(total * policy["fee_percent"] / 100))
    refund = int(round(total * policy["refund_percent"] / 100))
    db.execute(
        text(
            """
            UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancel_policy = :p,
              cancel_fee_paise = :fee, refund_paise = :ref, cancel_reason = :reason
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"p": policy["policy"], "fee": fee, "ref": refund, "reason": reason, "id": booking_id},
    )
    db.execute(
        text(
            """
            INSERT INTO cancellations (booking_id, policy, percentage, fee_paise, refund_paise, reason)
            VALUES (CAST(:id AS uuid), :pol, :pct, :fee, :ref, :reason)
            """
        ),
        {"id": booking_id, "pol": policy["policy"], "pct": policy["fee_percent"], "fee": fee, "ref": refund, "reason": reason},
    )
    if refund:
        apply_wallet(db, str(b["customer_id"]), refund, "credit", f"Refund {b['booking_number']}", booking_id)
    db.commit()
    return {"ok": True, "fee_paise": fee, "refund_paise": refund, "policy": policy["policy"]}
