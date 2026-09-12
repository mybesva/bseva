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


@router.get("/service-categories")
def list_service_categories(db: Session = Depends(get_db)):
    from app.catalog import list_categories_public

    try:
        return list_categories_public(db)
    except Exception:
        return []


@router.get("/services")
def list_services(
    q: str | None = None,
    category: str | None = None,
    popular: bool | None = None,
    featured: bool | None = None,
    include_inactive: bool = False,
    db: Session = Depends(get_db),
):
    """Catalog discovery. By default only active+priced (bookable) services.
    featured=1 returns homepage Top N (may include awaiting_pricing for display).
    category=popular is a virtual filter (is_popular).
    """
    from app.catalog import enrich_service, normalize_search

    params: dict = {}
    where = ["1=1"]
    if featured:
        where.append("s.is_featured_home = TRUE")
        # Featured home may include inactive drafts awaiting pricing
    elif not include_inactive:
        # Bookable services + draft catalog awaiting Admin pricing (Coming soon)
        where.append(
            """
            (
              (s.active = TRUE AND s.standard_price_paise IS NOT NULL
                AND COALESCE(s.pricing_status, 'priced') <> 'awaiting_pricing')
              OR COALESCE(s.pricing_status, 'priced') = 'awaiting_pricing'
            )
            """
        )

    if popular or (category and category.lower() == "popular"):
        where.append("s.is_popular = TRUE")

    if category and category.lower() not in ("all", "popular", ""):
        where.append(
            """
            EXISTS (
              SELECT 1 FROM service_category_map m
              JOIN service_categories c ON c.id = m.category_id
              WHERE m.service_id = s.id AND c.slug = :cat AND c.active = TRUE
            )
            """
        )
        params["cat"] = category

    nq = normalize_search(q or "")
    if nq:
        # Match name, slug, description, aliases (case-insensitive)
        where.append(
            """
            (
              s.name ILIKE :like
              OR s.slug ILIKE :like
              OR COALESCE(s.short_description, '') ILIKE :like
              OR COALESCE(s.description, '') ILIKE :like
              OR COALESCE(s.local_name, '') ILIKE :like
              OR CAST(COALESCE(s.search_aliases, '[]'::jsonb) AS text) ILIKE :like
              OR EXISTS (
                SELECT 1 FROM service_slug_aliases a
                WHERE a.service_id = s.id AND a.alias_slug ILIKE :like
              )
            )
            """
        )
        params["like"] = f"%{nq}%"
        # Also try original query tokens
        if q and q.strip().lower() != nq:
            where.append(
                """
                (
                  s.name ILIKE :like2
                  OR CAST(COALESCE(s.search_aliases, '[]'::jsonb) AS text) ILIKE :like2
                )
                """
            )
            params["like2"] = f"%{q.strip()}%"

    order = "s.homepage_rank NULLS LAST, s.display_order, s.name" if featured else "s.display_order, s.name"
    limit = " LIMIT 10" if featured else ""
    sql = f"SELECT s.* FROM services s WHERE {' AND '.join(where)} ORDER BY {order}{limit}"
    try:
        rows = db.execute(text(sql), params).mappings().all()
    except Exception:
        # Fallback for pre-migration DBs
        rows = db.execute(text("SELECT * FROM services WHERE active = TRUE ORDER BY name")).mappings().all()
    return [enrich_service(db, r) for r in rows]


@router.get("/services/{slug}")
def get_service(slug: str, db: Session = Depends(get_db)):
    from app.catalog import enrich_service, resolve_service_by_slug

    # Resolve alias; allow inactive for admin-style preview via active_only=False then gate bookable
    row = resolve_service_by_slug(db, slug, active_only=False)
    if not row:
        raise HTTPException(404, "Service not found")
    data = enrich_service(db, row)
    # Public detail: active services always; inactive featured allowed for "coming soon"
    if not row["active"] and not row.get("is_featured_home"):
        raise HTTPException(404, "Service not found")
    # Canonical slug for client redirects
    data["canonical_slug"] = row["slug"]
    data["requested_slug"] = slug
    return data


@router.get("/services/{slug}/image")
def get_service_image(slug: str, db: Session = Depends(get_db)):
    """Public cover image for admin-uploaded storage objects (and storage-backed paths)."""
    from pathlib import Path

    from app.catalog import resolve_service_by_slug
    from app.storage import file_response

    row = resolve_service_by_slug(db, slug, active_only=False)
    if not row:
        raise HTTPException(404, "Service not found")
    path = (row.get("image_path") or "").strip()
    if not path.startswith("services/"):
        raise HTTPException(404, "No uploaded image")
    return file_response(path, filename=Path(path).name)


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
def quote(
    service_id: UUID,
    package_type: str = "standard",
    city: str | None = None,
    booking_date: str | None = None,
    include_samagri: bool = False,
    include_alankaram: bool = False,
    include_food: bool = False,
    db: Session = Depends(get_db),
):
    from app.pricing import compute_quote, parse_booking_date

    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid) AND active = TRUE"),
        {"id": str(service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    if svc.get("standard_price_paise") is None or svc.get("pricing_status") == "awaiting_pricing":
        raise HTTPException(400, "This service is not yet priced for booking")
    return compute_quote(
        db,
        service=svc,
        package_type=package_type,
        city=city,
        booking_date=parse_booking_date(booking_date),
        include_samagri=include_samagri,
        include_alankaram=include_alankaram,
        include_food=include_food,
    )


@router.get("/pujaris")
def list_pujaris(db: Session = Depends(get_db), user=Depends(require_roles("customer", "admin"))):
    rows = db.execute(
        text(
            """
            SELECT u.id, u.name, p.approved_level, p.verification_status, p.available,
                   p.location_label, p.experience_years, p.languages, p.specializations, p.city
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
    from app.platform_config import get_setting

    if not body.terms_accepted:
        raise HTTPException(400, "Please accept the Terms & Conditions and Cancellation Policy")
    svc = db.execute(
        text("SELECT * FROM services WHERE id = CAST(:id AS uuid) AND active = TRUE"),
        {"id": str(body.service_id)},
    ).mappings().first()
    if not svc:
        raise HTTPException(404, "Service not found")
    if svc.get("standard_price_paise") is None or svc.get("pricing_status") == "awaiting_pricing":
        raise HTTPException(400, "This service is not yet available for booking")
    if body.mode == "virtual" and not bool(get_setting(db, "virtual_puja_enabled", False)):
        raise HTTPException(400, "Virtual Puja is currently disabled by Admin")
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
              AND (
                start_time IS NULL OR end_time IS NULL
                OR (start_time < :et AND end_time > :st)
              )
            """
        ),
        {"pid": str(body.pujari_id), "d": body.booking_date, "st": body.start_time, "et": body.start_time},
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

    from app.pricing import compute_quote

    city = body.city or (body.location_label.split(",")[-1].strip() if body.location_label else None)
    bill = compute_quote(
        db,
        service=svc,
        package_type=body.package_type,
        city=city,
        booking_date=body.booking_date,
        include_samagri=bool(body.include_samagri),
        include_alankaram=bool(body.include_alankaram),
        include_food=bool(body.include_food),
    )
    base = int(bill["basePrice"]) + int(bill["locationAdjustment"])
    platform_fee = int(bill["platformFee"])
    payable = int(bill["pujariShare"])
    peak = int(bill["peakFee"])
    gst_pct = float(bill["gstPercent"])
    gst_amt = int(bill["gstAmount"])
    total = int(bill["totalAmount"])
    wallet = db.execute(text("SELECT balance_paise FROM wallets WHERE user_id = :id"), {"id": user["id"]}).first()
    if not wallet or wallet[0] < total:
        raise HTTPException(400, "Insufficient wallet balance")

    booking_id = str(uuid4())
    number = f"BSV-{datetime.utcnow().strftime('%y%m%d')}-{booking_id[:8].upper()}"
    meeting = f"https://meet.bseva.example/virtual/{booking_id[:8]}" if body.mode == "virtual" else None
    # New bookings await pujari acceptance; customer pays now; pujari settlement after completion
    db.execute(
        text(
            """
            INSERT INTO bookings (
              id, booking_number, customer_id, pujari_id, service_id, package_type, mode,
              booking_date, start_time, end_time, location_label, address, latitude, longitude,
              meeting_url, status, payment_status, settlement_status, rating_status,
              base_price_paise, peak_fee_paise, platform_fee_paise, pujari_payable_paise,
              gst_percent, gst_amount_paise, total_paise, terms_accepted, special_instructions,
              main_puja_charge_paise, samagri_charge_paise, alankaram_charge_paise, food_charge_paise,
              pujari_reimbursement_paise, samagri_requested, alankaram_requested, food_requested
            ) VALUES (
              CAST(:id AS uuid), :num, :cid, CAST(:pid AS uuid), CAST(:sid AS uuid), :pkg, :mode,
              :d, :st, :et, :loc, :addr, :lat, :lng, :meet, 'pending_acceptance', 'paid', 'pending', 'not_applicable',
              :base, :peak, :plat, :payable, :gstp, :gsta, :total, TRUE, :instr,
              :mainc, :samc, :alanc, :foodc, :reimb, :samreq, :alanreq, :foodreq
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
            "peak": peak,
            "plat": platform_fee,
            "payable": payable,
            "gstp": gst_pct,
            "gsta": gst_amt,
            "total": total,
            "instr": body.special_instructions,
            "mainc": int(bill.get("mainPuja") or bill["basePrice"]),
            "samc": int(bill.get("samagri") or 0),
            "alanc": int(bill.get("alankaram") or 0),
            "foodc": int(bill.get("foodPrasadam") or 0),
            "reimb": int(bill.get("pujariReimbursement") or 0),
            "samreq": bool(body.include_samagri),
            "alanreq": bool(body.include_alankaram),
            "foodreq": bool(body.include_food),
        },
    )
    try:
        apply_wallet(db, str(user["id"]), -total, "debit", f"Booking {number}", booking_id, number)
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    db.execute(
        text("INSERT INTO payments (booking_id, amount_paise, status, provider) VALUES (CAST(:id AS uuid), :amt, 'successful', 'wallet')"),
        {"id": booking_id, "amt": total},
    )
    # Snapshot preparation / Samagri (localized, package-aware, frozen)
    prep_view: dict = {}
    try:
        from app.preparation import create_booking_preparation_snapshot

        b_row = db.execute(
            text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"),
            {"id": booking_id},
        ).mappings().first()
        prep_view = create_booking_preparation_snapshot(
            db,
            booking_id=booking_id,
            booking=dict(b_row) if b_row else {},
            service_id=str(body.service_id),
            customer_id=str(user["id"]),
        )
    except Exception:
        prep_view = {}
    # Recommended List email (localized short confirmation + link; full list on page)
    email_result = {"status": "skipped"}
    try:
        from app.email_service import send_booking_preparation_email
        from app.platform_config import get_setting as _gs
        from app.preparation import customer_preferred_language

        cust = db.execute(
            text("SELECT email, name FROM users WHERE id = CAST(:id AS uuid)"),
            {"id": user["id"]},
        ).mappings().first()
        lang = customer_preferred_language(db, str(user["id"]))
        # Only emphasize Samagri checklist when customer opted in for pujari-arranged items
        opted_samagri = bool(body.include_samagri) or int(bill.get("samagri") or 0) > 0
        opted_alan = bool(body.include_alankaram) or int(bill.get("alankaram") or 0) > 0
        if cust and cust.get("email"):
            email_result = send_booking_preparation_email(
                to=str(cust["email"]),
                customer_name=str(cust.get("name") or ""),
                booking_number=number,
                booking_id=booking_id,
                service_name=str(svc.get("name") or "Puja"),
                booking_date=str(body.booking_date),
                start_time=str(body.start_time),
                preparation=prep_view if (opted_samagri or opted_alan) else {**prep_view, "verified": False, "skip_samagri_cta": True},
                language=lang,
                from_addr=str(_gs(db, "email_from_accounts", "admin@b-seva.com")),
                package=str(body.package_type or ""),
                location=str(body.location_label or body.address or body.city or ""),
                main_puja_paise=int(bill.get("mainPuja") or bill.get("basePrice") or 0),
                samagri_paise=int(bill.get("samagri") or 0),
                alankaram_paise=int(bill.get("alankaram") or 0),
                food_prasadam_paise=int(bill.get("foodPrasadam") or 0),
                total_paise=int(bill.get("total") or bill.get("totalPaise") or total or 0),
                payment_status="paid",
                booking_status="pending_acceptance",
            )
    except Exception as e:
        email_result = {"status": "failed", "error": str(e)}
    # Recurring series (first occurrence is this booking; more dates recorded for follow-up)
    series_id = None
    next_dates: list[str] = []
    if body.recurring and body.recurring != "none":
        import json
        from datetime import timedelta as td
        from app.pricing import compute_quote

        try:
            dates: list = []
            if body.recurring == "selected_dates":
                dates = sorted({d for d in (body.selected_dates or []) if d != body.booking_date})
                if not dates:
                    raise HTTPException(400, "selected_dates required for selected_dates recurrence")
            else:
                count = int(body.recurring_count or (4 if body.recurring == "weekly" else 3))
                d = body.booking_date
                for _ in range(max(0, count - 1)):
                    if body.recurring == "weekly":
                        d = d + td(weeks=1)
                    else:
                        y, m = d.year, d.month + 1
                        if m > 12:
                            y, m = y + 1, 1
                        day = min(d.day, 28)
                        d = d.replace(year=y, month=m, day=day)
                    dates.append(d)

            series_id = str(uuid4())
            db.execute(
                text(
                    """
                    INSERT INTO recurring_series (
                      id, customer_id, pujari_id, service_id, package_type, mode, recurrence,
                      interval_count, selected_dates, start_date, start_time, location_label, address, city,
                      latitude, longitude, active
                    ) VALUES (
                      CAST(:id AS uuid), CAST(:c AS uuid), CAST(:p AS uuid), CAST(:s AS uuid),
                      :pkg, :mode, :rec, 1, CAST(:sdates AS jsonb), :sd, :st, :loc, :addr, :city, :lat, :lng, TRUE
                    )
                    """
                ),
                {
                    "id": series_id,
                    "c": user["id"],
                    "p": str(body.pujari_id),
                    "s": str(body.service_id),
                    "pkg": body.package_type,
                    "mode": body.mode,
                    "rec": body.recurring,
                    "sdates": json.dumps([x.isoformat() for x in dates]),
                    "sd": body.booking_date,
                    "st": start,
                    "loc": body.location_label,
                    "addr": body.address,
                    "city": city,
                    "lat": body.latitude,
                    "lng": body.longitude,
                },
            )
            db.execute(
                text("UPDATE bookings SET recurring_series_id = CAST(:sid AS uuid) WHERE id = CAST(:id AS uuid)"),
                {"sid": series_id, "id": booking_id},
            )
            skipped: list[str] = []
            for d in dates:
                child_bill = compute_quote(
                    db,
                    service=svc,
                    package_type=body.package_type,
                    city=city,
                    booking_date=d,
                    include_samagri=bool(body.include_samagri),
                    include_alankaram=bool(body.include_alankaram),
                    include_food=bool(body.include_food),
                )
                c_base = int(child_bill["basePrice"])
                c_peak = int(child_bill["peakFee"])
                c_plat = int(child_bill["platformFee"])
                c_payable = int(child_bill["pujariShare"])
                c_gstp = float(child_bill["gstPercent"])
                c_gsta = int(child_bill["gstAmount"])
                c_total = int(child_bill["totalAmount"])
                if slot_conflict(db, str(body.pujari_id), d, start, end):
                    skipped.append(d.isoformat())
                    continue
                next_dates.append(d.isoformat())
                nid = str(uuid4())
                nnum = f"BSV-{datetime.utcnow().strftime('%y%m%d')}-{nid[:8].upper()}"
                db.execute(
                    text(
                        """
                        INSERT INTO bookings (
                          id, booking_number, customer_id, pujari_id, service_id, package_type, mode,
                          booking_date, start_time, end_time, location_label, address, latitude, longitude,
                          status, payment_status, settlement_status, rating_status,
                          base_price_paise, peak_fee_paise, platform_fee_paise, pujari_payable_paise,
                          gst_percent, gst_amount_paise, total_paise, terms_accepted, recurring_series_id,
                          main_puja_charge_paise, samagri_charge_paise, alankaram_charge_paise, food_charge_paise,
                          pujari_reimbursement_paise, samagri_requested, alankaram_requested, food_requested
                        ) VALUES (
                          CAST(:id AS uuid), :num, :cid, CAST(:pid AS uuid), CAST(:sid AS uuid), :pkg, :mode,
                          :d, :st, :et, :loc, :addr, :lat, :lng,
                          'pending', 'pending', 'not_applicable', 'not_applicable',
                          :base, :peak, :plat, :payable, :gstp, :gsta, :total, TRUE, CAST(:rs AS uuid),
                          :mainc, :samc, :alanc, :foodc, :reimb, :samreq, :alanreq, :foodreq
                        )
                        """
                    ),
                    {
                        "id": nid,
                        "num": nnum,
                        "cid": user["id"],
                        "pid": str(body.pujari_id),
                        "sid": str(body.service_id),
                        "pkg": body.package_type,
                        "mode": body.mode,
                        "d": d,
                        "st": start,
                        "et": end,
                        "loc": body.location_label,
                        "addr": body.address,
                        "lat": body.latitude,
                        "lng": body.longitude,
                        "base": c_base,
                        "peak": c_peak,
                        "plat": c_plat,
                        "payable": c_payable,
                        "gstp": c_gstp,
                        "gsta": c_gsta,
                        "total": c_total,
                        "rs": series_id,
                        "mainc": int(child_bill.get("mainPuja") or child_bill["basePrice"]),
                        "samc": int(child_bill.get("samagri") or 0),
                        "alanc": int(child_bill.get("alankaram") or 0),
                        "foodc": int(child_bill.get("foodPrasadam") or 0),
                        "reimb": int(child_bill.get("pujariReimbursement") or 0),
                        "samreq": bool(body.include_samagri),
                        "alanreq": bool(body.include_alankaram),
                        "foodreq": bool(body.include_food),
                    },
                )
            if skipped:
                db.execute(
                    text(
                        """
                        UPDATE recurring_series
                        SET selected_dates = CAST(:sd AS jsonb)
                        WHERE id = CAST(:id AS uuid)
                        """
                    ),
                    {
                        "id": series_id,
                        "sd": json.dumps({"created": next_dates, "skipped_conflicts": skipped}),
                    },
                )
        except HTTPException:
            raise
        except Exception:
            series_id = None
            next_dates = []
    if getattr(body, "referral_code", None):
        try:
            from app.referrals import apply_referral_code

            apply_referral_code(db, str(user["id"]), body.referral_code)
        except Exception:
            pass
    try:
        from app.routers.notifications import create_notification

        create_notification(
            db,
            user_id=str(body.pujari_id),
            title="New booking request",
            body=f"New booking {number} awaiting your acceptance.",
            category="booking",
            link="/pujari",
        )
    except Exception:
        pass
    db.commit()
    return {
        "id": booking_id,
        "booking_number": number,
        "total_paise": total,
        "meeting_url": meeting,
        "status": "pending_acceptance",
        "recurring_series_id": series_id,
        "recurring_next_dates": next_dates,
        "breakdown": {
            "basePrice": bill["basePrice"],
            "locationAdjustment": bill["locationAdjustment"],
            "peakFee": peak,
            "platformFee": platform_fee,
            "gstAmount": gst_amt,
            "totalAmount": total,
        },
        "recommended_list_email": email_result.get("status", "queued"),
        "recommended_list_email_detail": email_result,
    }



@router.get("/bookings")
def list_bookings(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=100),
    user=Depends(current_user),
    db: Session = Depends(get_db),
):
    from app.booking_visibility import booking_for_role

    offset = (page - 1) * limit

    if user["role"] in ("admin", "super_admin"):
        total = int(db.execute(text("SELECT COUNT(*) FROM bookings")).scalar() or 0)
        rows = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, pu.name AS pujari_name, s.name AS service_name
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                ORDER BY
                  CASE WHEN COALESCE(b.needs_reassignment, FALSE) THEN 0 ELSE 1 END,
                  CASE WHEN b.status = 'rejected' THEN 0 ELSE 1 END,
                  b.created_at DESC
                LIMIT :lim OFFSET :off
                """
            ),
            {"lim": limit, "off": offset},
        ).mappings().all()
        items = [row_dict(r) for r in rows]
    elif user["role"] in ("pujari", "head_pujari"):
        total = int(
            db.execute(
                text("SELECT COUNT(*) FROM bookings WHERE pujari_id = :id"),
                {"id": user["id"]},
            ).scalar()
            or 0
        )
        rows = db.execute(
            text(
                """
                SELECT b.*, cu.name AS customer_name, s.name AS service_name
                FROM bookings b
                JOIN users cu ON cu.id = b.customer_id
                JOIN services s ON s.id = b.service_id
                WHERE b.pujari_id = :id
                ORDER BY b.created_at DESC
                LIMIT :lim OFFSET :off
                """
            ),
            {"id": user["id"], "lim": limit, "off": offset},
        ).mappings().all()
        items = [booking_for_role(db, dict(r), user) for r in rows]
    else:
        total = int(
            db.execute(
                text("SELECT COUNT(*) FROM bookings WHERE customer_id = :id"),
                {"id": user["id"]},
            ).scalar()
            or 0
        )
        rows = db.execute(
            text(
                """
                SELECT b.*, pu.name AS pujari_name, s.name AS service_name
                FROM bookings b
                LEFT JOIN users pu ON pu.id = b.pujari_id
                JOIN services s ON s.id = b.service_id
                WHERE b.customer_id = :id
                ORDER BY b.created_at DESC
                LIMIT :lim OFFSET :off
                """
            ),
            {"id": user["id"], "lim": limit, "off": offset},
        ).mappings().all()
        items = [booking_for_role(db, dict(r), user) for r in rows]

    return {
        "items": items,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": max(1, (total + limit - 1) // limit) if total else 1,
    }


@router.patch("/bookings/{booking_id}/status")
def update_status(booking_id: str, status: str = Query(...), user=Depends(require_roles("pujari", "admin")), db: Session = Depends(get_db)):
    """Deprecated for start/complete — prefer /start-otp and /complete. Kept for admin rescue."""
    from app.booking_state import set_booking_status

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if user["role"] == "pujari" and str(b["pujari_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if user["role"] == "pujari" and status in ("in_progress", "completed"):
        raise HTTPException(400, "Use OTP start and End Puja endpoints")
    set_booking_status(db, booking_id, status, actor_id=str(user["id"]))
    db.commit()
    return {"ok": True}


def _cancel_actor(user: dict, booking: dict) -> str:
    role = user.get("role") or ""
    if role in ("admin", "super_admin"):
        return "customer"  # admin cancel uses customer fee schedule for refund math
    if str(booking.get("customer_id")) == str(user.get("id")):
        return "customer"
    if role == "pujari" and str(booking.get("pujari_id")) == str(user.get("id")):
        return "pujari"
    raise HTTPException(403, "Not allowed")


@router.get("/bookings/{booking_id}/cancel-preview")
def cancel_preview(booking_id: str, user=Depends(current_user), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    actor = _cancel_actor(user, b)
    if b["status"] not in ("pending", "pending_acceptance", "confirmed"):
        raise HTTPException(400, f"Cannot cancel a booking in status {b['status']}")
    hours = hours_until(b["booking_date"], b["start_time"])
    policy = cancel_policy(hours, db=db, actor=actor)
    total = int(b["total_paise"] or 0)
    paid = b["payment_status"] == "paid"
    fee = int(round(total * policy["fee_percent"] / 100)) if policy["allowed"] and paid else 0
    if actor == "pujari":
        # Pujari pays time-based penalty; customer is refunded in full when paid
        refund = total if (policy["allowed"] and paid) else 0
    else:
        refund = int(round(total * policy["refund_percent"] / 100)) if (policy["allowed"] and paid) else 0
        if not paid:
            fee, refund = 0, 0
    return {
        "ok": True,
        "actor": actor,
        "allowed": policy["allowed"],
        "policy": policy["policy"],
        "hours_until": policy.get("hours"),
        "min_hours": policy.get("min_hours"),
        "fee_percent": policy["fee_percent"],
        "refund_percent": policy["refund_percent"] if actor == "customer" else (100 if paid else 0),
        "fee_paise": fee,
        "refund_paise": refund,
        "total_paise": total,
        "payment_status": b["payment_status"],
        "message": (
            None
            if policy["allowed"]
            else f"Cancellation is not allowed less than {int(policy.get('min_hours') or 24)} hours before the puja."
        ),
    }


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(booking_id: str, reason: str | None = None, user=Depends(current_user), db: Session = Depends(get_db)):
    from app.validation_rules import validate_cancel_reason

    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    actor = _cancel_actor(user, b)
    if b["status"] == "cancelled":
        raise HTTPException(400, "Already cancelled")
    if b["status"] not in ("pending", "pending_acceptance", "confirmed"):
        raise HTTPException(400, f"Cannot cancel a booking in status {b['status']}")
    policy = cancel_policy(hours_until(b["booking_date"], b["start_time"]), db=db, actor=actor)
    if not policy["allowed"]:
        raise HTTPException(
            400,
            f"Cancellation is not allowed less than {int(policy.get('min_hours') or 24)} hours before the booking",
        )
    total = int(b["total_paise"] or 0)
    paid = b["payment_status"] == "paid"
    fee = int(round(total * policy["fee_percent"] / 100)) if paid else 0
    if actor == "pujari":
        refund = total if paid else 0
    else:
        refund = int(round(total * policy["refund_percent"] / 100)) if paid else 0
        if not paid:
            fee, refund = 0, 0
    # Reason required when cancelling (meaningful text)
    reason_clean = validate_cancel_reason(reason, required=True)
    reason_full = reason_clean
    if actor == "pujari":
        reason_full = f"[pujari] {reason_full}"
    db.execute(
        text(
            """
            UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(), cancel_policy = :p,
              cancel_fee_paise = :fee, refund_paise = :ref, cancel_reason = :reason
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"p": f"{actor}:{policy['policy']}", "fee": fee, "ref": refund, "reason": reason_full, "id": booking_id},
    )
    db.execute(
        text(
            """
            INSERT INTO cancellations (booking_id, policy, percentage, fee_paise, refund_paise, reason)
            VALUES (CAST(:id AS uuid), :pol, :pct, :fee, :ref, :reason)
            """
        ),
        {
            "id": booking_id,
            "pol": f"{actor}:{policy['policy']}",
            "pct": policy["fee_percent"],
            "fee": fee,
            "ref": refund,
            "reason": reason_full,
        },
    )
    if refund:
        apply_wallet(db, str(b["customer_id"]), refund, "credit", f"Refund {b['booking_number']}", booking_id)
    if actor == "pujari" and fee > 0 and b.get("pujari_id"):
        try:
            apply_wallet(
                db,
                str(b["pujari_id"]),
                -fee,
                "debit",
                f"Cancel penalty {b['booking_number']}",
                booking_id,
            )
        except ValueError as e:
            db.rollback()
            raise HTTPException(400, f"Pujari cancel fee could not be deducted: {e}") from e
    db.commit()
    # Emails after commit — never roll back booking/payment on mail failure
    try:
        from app.mail.booking_payload import booking_email_data_from_row, load_customer_email_context, load_service_name
        from app.mail.senders import send_booking_cancellation_email, send_refund_confirmation_email

        ctx = load_customer_email_context(db, str(b["customer_id"]))
        if ctx.get("email"):
            svc_name = load_service_name(db, str(b["service_id"]))
            data = booking_email_data_from_row(
                dict(b),
                customer_name=ctx["name"],
                service_name=svc_name,
                language=ctx["language"],
                extra={"status": "cancelled"},
            )
            send_booking_cancellation_email(to=ctx["email"], data=data, reason=reason_full or "")
            if refund:
                send_refund_confirmation_email(
                    to=ctx["email"],
                    data=data,
                    refund_paise=refund,
                    refund_method="Wallet credit",
                )
    except Exception:
        pass
    return {
        "ok": True,
        "actor": actor,
        "fee_paise": fee,
        "refund_paise": refund,
        "policy": policy["policy"],
    }


@router.post("/recurring/{series_id}/cancel")
def cancel_recurring_series(series_id: str, reason: str | None = None, user=Depends(current_user), db: Session = Depends(get_db)):
    series = db.execute(
        text("SELECT * FROM recurring_series WHERE id = CAST(:id AS uuid)"),
        {"id": series_id},
    ).mappings().first()
    if not series:
        raise HTTPException(404, "Series not found")
    if user["role"] not in ("admin", "super_admin") and str(series["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    db.execute(
        text("UPDATE recurring_series SET active = FALSE WHERE id = CAST(:id AS uuid)"),
        {"id": series_id},
    )
    rows = db.execute(
        text(
            """
            SELECT id FROM bookings
            WHERE recurring_series_id = CAST(:sid AS uuid)
              AND status IN ('pending', 'pending_acceptance', 'confirmed')
              AND payment_status = 'pending'
            """
        ),
        {"sid": series_id},
    ).mappings().all()
    cancelled = []
    for r in rows:
        db.execute(
            text(
                """
                UPDATE bookings SET status = 'cancelled', cancelled_at = NOW(),
                  cancel_reason = :reason, cancel_policy = 'series_cancel', refund_paise = 0
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": str(r["id"]), "reason": reason or "Series cancelled"},
        )
        cancelled.append(str(r["id"]))
    db.commit()
    return {"ok": True, "cancelled_pending_bookings": cancelled, "series_active": False}


@router.post("/bookings/{booking_id}/pay")
def pay_pending_booking(booking_id: str, user=Depends(require_roles("customer")), db: Session = Depends(get_db)):
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        raise HTTPException(404, "Booking not found")
    if str(b["customer_id"]) != str(user["id"]):
        raise HTTPException(403, "Not allowed")
    if b["payment_status"] == "paid":
        raise HTTPException(400, "Already paid")
    if b["status"] == "cancelled":
        raise HTTPException(400, "Booking cancelled")
    total = int(b["total_paise"])
    try:
        apply_wallet(db, str(user["id"]), total, "debit", f"Pay booking {b['booking_number']}", booking_id)
    except ValueError as e:
        raise HTTPException(400, str(e))
    db.execute(
        text(
            """
            UPDATE bookings SET payment_status = 'paid', status = CASE
              WHEN status = 'pending' THEN 'pending_acceptance' ELSE status END
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": booking_id},
    )
    db.commit()
    try:
        from app.mail.booking_payload import booking_email_data_from_row, load_customer_email_context, load_service_name
        from app.mail.senders import send_payment_confirmation_email

        ctx = load_customer_email_context(db, str(user["id"]))
        if ctx.get("email"):
            svc_name = load_service_name(db, str(b["service_id"]))
            data = booking_email_data_from_row(
                dict(b),
                customer_name=ctx["name"],
                service_name=svc_name,
                language=ctx["language"],
                extra={"payment_status": "paid"},
            )
            send_payment_confirmation_email(
                to=ctx["email"],
                data=data,
                method="Wallet",
                transaction_id=str(b.get("booking_number") or booking_id),
            )
    except Exception:
        pass
    return {"ok": True, "payment_status": "paid", "total_paise": total}


@router.get("/pujaris/{pujari_id}/public")
def public_pujari_profile(pujari_id: str, db: Session = Depends(get_db)):
    from app.booking_visibility import public_pujari

    row = db.execute(
        text(
            """
            SELECT u.id, u.name, p.approved_level, p.verification_status, p.available,
                   p.city, p.experience_years, p.languages, p.specializations,
                   p.location_label
            FROM pujari_profiles p
            JOIN users u ON u.id = p.user_id
            WHERE u.id = CAST(:id AS uuid) AND u.blocked = FALSE
              AND p.verification_status = 'approved'
              AND COALESCE(p.website_publication_consent, FALSE) = TRUE
            """
        ),
        {"id": pujari_id},
    ).mappings().first()
    if not row:
        raise HTTPException(404, "Pujari not found")
    data = public_pujari(row_dict(row))
    ratings = db.execute(
        text(
            """
            SELECT COALESCE(AVG(stars),0) AS avg_stars, COUNT(*) AS rating_count
            FROM ratings WHERE to_user_id = CAST(:id AS uuid) AND skipped = FALSE AND role_from = 'customer'
            """
        ),
        {"id": pujari_id},
    ).mappings().first()
    data["avg_stars"] = float(ratings["avg_stars"] or 0) if ratings else 0
    data["rating_count"] = int(ratings["rating_count"] or 0) if ratings else 0
    return data
