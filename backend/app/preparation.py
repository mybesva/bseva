"""Centralized booking preparation / Samagri localization (no runtime AI translation)."""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session

SUPPORTED_LANGS = ("en", "hi", "te")
FALLBACK_LANG = "en"

SECTION_CUSTOMER = "customer_arrange"
SECTION_INCLUDED = "included_bseva"
SECTION_PRASADAM = "prasadam"
SECTION_VENUE = "home_venue"
SECTION_OPTIONAL = "optional"

PROVIDER_CUSTOMER = "CUSTOMER"
PROVIDER_BSEVA = "BSEVA"
PROVIDER_PUJARI = "PUJARI"
PROVIDER_INCLUDED = "INCLUDED_IN_SAMAGRI_PACKAGE"
PROVIDER_OPTIONAL = "OPTIONAL"

DEFAULT_DISCLAIMER = {
    "en": "Requirements may vary based on family tradition / Veda Shakha / regional practice. Your assigned Pujari may confirm final requirements.",
    "hi": "पारिवारिक परंपरा / वेद शाखा / क्षेत्रीय रीति के अनुसार आवश्यकताएँ बदल सकती हैं। नियुक्त पुजारी अंतिम सूची की पुष्टि कर सकते हैं।",
    "te": "కుటుంబ సాంప్రదాయం / వేద శాఖ / ప్రాంతీయ ఆచారం బట్టి అవసరాలు మారవచ్చు. మీకు కేటాయించిన పుజారి తుది జాబితాను నిర్ధారించవచ్చు.",
}

PENDING_MSG = {
    "en": "Your detailed Samagri checklist will be confirmed shortly.",
    "hi": "आपकी विस्तृत सामग्री सूची शीघ्र पुष्टि की जाएगी।",
    "te": "మీ వివరమైన సామగ్రి జాబితా త్వరలో నిర్ధారించబడుతుంది.",
}


def normalize_lang(code: str | None) -> str:
    c = (code or FALLBACK_LANG).strip().lower()[:5]
    if c in SUPPORTED_LANGS:
        return c
    if c.startswith("te"):
        return "te"
    if c.startswith("hi"):
        return "hi"
    return FALLBACK_LANG


def customer_preferred_language(db: Session, customer_id: str) -> str:
    row = db.execute(
        text(
            """
            SELECT COALESCE(cp.preferred_language, u.preferred_language, 'en') AS lang
            FROM users u
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            WHERE u.id = CAST(:id AS uuid)
            """
        ),
        {"id": customer_id},
    ).first()
    return normalize_lang(row[0] if row else FALLBACK_LANG)


def _pick_translation(translations: dict[str, str], lang: str) -> str:
    return translations.get(lang) or translations.get(FALLBACK_LANG) or next(iter(translations.values()), "")


def _section_for(category: str, provided_by: str, samagri_purchased: bool) -> str:
    cat = (category or "PUJA_SAMAGRI").upper()
    prov = (provided_by or PROVIDER_CUSTOMER).upper()
    if cat == "PRASADAM":
        if samagri_purchased and prov in (PROVIDER_INCLUDED, PROVIDER_BSEVA):
            return SECTION_INCLUDED
        return SECTION_PRASADAM
    if cat == "HOME_VENUE":
        return SECTION_VENUE
    if cat == "OPTIONAL" or prov == PROVIDER_OPTIONAL:
        return SECTION_OPTIONAL
    if prov in (PROVIDER_INCLUDED, PROVIDER_BSEVA) and samagri_purchased:
        return SECTION_INCLUDED
    if prov == PROVIDER_BSEVA and not samagri_purchased:
        # Kit not purchased — customer must arrange equivalent items
        return SECTION_CUSTOMER
    if prov == PROVIDER_PUJARI:
        return SECTION_INCLUDED
    return SECTION_CUSTOMER


def load_service_preparation_master(db: Session, service_id: str, lang: str) -> dict[str, Any]:
    lang = normalize_lang(lang)
    svc = db.execute(
        text(
            """
            SELECT id, name, slug, samagri_review_status, samagri_provider, alankaram_provider, food_provider,
                   samagri_price_paise, alankaram_price_paise, food_price_paise
            FROM services WHERE id = CAST(:id AS uuid)
            """
        ),
        {"id": service_id},
    ).mappings().first()
    if not svc:
        return {"ok": False, "error": "service_not_found"}

    content = db.execute(
        text(
            """
            SELECT * FROM service_preparation_content
            WHERE service_id = CAST(:sid AS uuid) AND language_code = :lang
            """
        ),
        {"sid": service_id, "lang": lang},
    ).mappings().first()
    if not content and lang != FALLBACK_LANG:
        content = db.execute(
            text(
                """
                SELECT * FROM service_preparation_content
                WHERE service_id = CAST(:sid AS uuid) AND language_code = :lang
                """
            ),
            {"sid": service_id, "lang": FALLBACK_LANG},
        ).mappings().first()

    items = db.execute(
        text(
            """
            SELECT ss.*, si.item_key, si.name AS item_name_en, si.unit AS item_default_unit,
                   t.item_name AS translated_name, t.notes AS translated_notes
            FROM service_samagri ss
            JOIN samagri_items si ON si.id = ss.samagri_item_id
            LEFT JOIN samagri_item_translations t
              ON t.samagri_item_id = si.id AND t.language_code = :lang
            WHERE ss.service_id = CAST(:sid AS uuid)
              AND COALESCE(ss.active, TRUE) = TRUE
              AND si.active = TRUE
            ORDER BY ss.sort_order, si.name
            """
        ),
        {"sid": service_id, "lang": lang},
    ).mappings().all()

    # Fallback names if translation missing for non-en
    if lang != FALLBACK_LANG:
        enriched = []
        for it in items:
            d = dict(it)
            if not d.get("translated_name"):
                fb = db.execute(
                    text(
                        """
                        SELECT item_name, notes FROM samagri_item_translations
                        WHERE samagri_item_id = CAST(:id AS uuid) AND language_code = 'en'
                        """
                    ),
                    {"id": str(d["samagri_item_id"])},
                ).mappings().first()
                if fb:
                    d["translated_name"] = fb["item_name"]
                    d["translated_notes"] = d.get("translated_notes") or fb.get("notes")
            enriched.append(d)
        items = enriched

    return {
        "ok": True,
        "service": dict(svc),
        "content": dict(content) if content else None,
        "items": [dict(i) for i in items],
        "language": lang,
        "verified": (svc.get("samagri_review_status") or "UNVERIFIED") == "VERIFIED",
    }


def package_flags_from_booking(booking: dict) -> dict[str, bool]:
    # Component charges > 0 or provider reimbursable/included imply purchase intent
    sam = int(booking.get("samagri_charge_paise") or 0) > 0
    alan = int(booking.get("alankaram_charge_paise") or 0) > 0
    food = int(booking.get("food_charge_paise") or 0) > 0
    # Also treat samagri_provider included with active package as purchased when charge recorded in base historically
    return {"samagri_purchased": sam, "alankaram_purchased": alan, "food_purchased": food}


def build_preparation_view(
    master: dict[str, Any],
    *,
    samagri_purchased: bool,
    lang: str,
) -> dict[str, Any]:
    lang = normalize_lang(lang)
    if not master.get("ok"):
        return {"verified": False, "pending_message": PENDING_MSG.get(lang, PENDING_MSG["en"]), "sections": {}}

    verified = bool(master.get("verified"))
    content = master.get("content") or {}
    disclaimer = content.get("disclaimer") or DEFAULT_DISCLAIMER.get(lang, DEFAULT_DISCLAIMER["en"])

    if not verified:
        return {
            "verified": False,
            "language": lang,
            "pending_message": PENDING_MSG.get(lang, PENDING_MSG["en"]),
            "disclaimer": disclaimer,
            "display_name": content.get("display_name") or (master.get("service") or {}).get("name"),
            "sections": {},
            "items": [],
        }

    sections: dict[str, list] = {
        SECTION_INCLUDED: [],
        SECTION_CUSTOMER: [],
        SECTION_PRASADAM: [],
        SECTION_VENUE: [],
        SECTION_OPTIONAL: [],
    }
    flat = []
    for raw in master.get("items") or []:
        provided_by = (raw.get("provided_by") or PROVIDER_CUSTOMER).upper()
        # Legacy boolean mapping
        if raw.get("customer_provided") and provided_by == PROVIDER_CUSTOMER:
            provided_by = PROVIDER_CUSTOMER
        category = (raw.get("category") or "PUJA_SAMAGRI").upper()
        # Kit line only relevant when package purchased
        if provided_by == PROVIDER_INCLUDED and not samagri_purchased:
            continue
        section = _section_for(category, provided_by, samagri_purchased)
        name = raw.get("translated_name") or raw.get("item_name_en") or raw.get("name") or "Item"
        qty = raw.get("quantity")
        unit = raw.get("unit") or raw.get("item_default_unit") or ""
        label = name
        if qty is not None:
            try:
                qf = float(qty)
                q_str = str(int(qf)) if qf == int(qf) else str(qf)
                label = f"{name} — {q_str}" + (f" {unit}" if unit else "")
            except (TypeError, ValueError):
                label = name
        item = {
            "item_key": raw.get("item_key"),
            "name": name,
            "label": label,
            "quantity": float(qty) if qty is not None else None,
            "unit": unit or None,
            "category": category,
            "provided_by": provided_by,
            "section": section,
            "optional": bool(raw.get("optional")),
            "required": bool(raw.get("required", True)),
            "notes": raw.get("translated_notes") or raw.get("notes") or raw.get("instructions"),
            "sort_order": int(raw.get("sort_order") or 0),
        }
        sections[section].append(item)
        flat.append(item)

    return {
        "verified": True,
        "language": lang,
        "display_name": content.get("display_name") or (master.get("service") or {}).get("name"),
        "preparation_notes": content.get("preparation_notes"),
        "special_instructions": content.get("special_instructions"),
        "prasadam_notes": content.get("prasadam_notes"),
        "venue_notes": content.get("venue_notes"),
        "disclaimer": disclaimer,
        "samagri_purchased": samagri_purchased,
        "sections": sections,
        "items": flat,
        "pending_message": None,
    }


def create_booking_preparation_snapshot(
    db: Session,
    *,
    booking_id: str,
    booking: dict,
    service_id: str,
    customer_id: str,
) -> dict[str, Any]:
    lang = customer_preferred_language(db, customer_id)
    master = load_service_preparation_master(db, service_id, lang)
    flags = package_flags_from_booking(booking)
    # If samagri_provider on service is included and customer paid total with component 0,
    # treat purchased when booking has samagri_charge or service default included after quote
    if not flags["samagri_purchased"]:
        # Infer from service if main booking used included provider and charge column missing historically
        svc = master.get("service") or {}
        if (svc.get("samagri_provider") or "").lower() == "included" and int(svc.get("samagri_price_paise") or 0) > 0:
            # only if charge was rolled into total — we don't know; leave false unless charge set
            pass

    view = build_preparation_view(master, samagri_purchased=flags["samagri_purchased"], lang=lang)
    svc_name = (master.get("service") or {}).get("name") or booking.get("service_name")
    review = (master.get("service") or {}).get("samagri_review_status") or "UNVERIFIED"
    verified = bool(view.get("verified"))

    # Clear prior snapshot rows for this booking (idempotent recreate)
    db.execute(text("DELETE FROM booking_samagri_snapshot WHERE booking_id = CAST(:id AS uuid)"), {"id": booking_id})
    db.execute(text("DELETE FROM booking_preparation_snapshot WHERE booking_id = CAST(:id AS uuid)"), {"id": booking_id})

    content = master.get("content") or {}
    db.execute(
        text(
            """
            INSERT INTO booking_preparation_snapshot (
              booking_id, language_code, service_name, review_status,
              samagri_purchased, alankaram_purchased, food_purchased,
              preparation_notes, special_instructions, prasadam_notes, venue_notes, disclaimer,
              verified, payload
            ) VALUES (
              CAST(:bid AS uuid), :lang, :sname, :rev,
              :sam, :alan, :food,
              :prep, :spec, :pras, :venue, :disc,
              :ver, CAST(:payload AS jsonb)
            )
            """
        ),
        {
            "bid": booking_id,
            "lang": lang,
            "sname": svc_name,
            "rev": review,
            "sam": flags["samagri_purchased"],
            "alan": flags["alankaram_purchased"],
            "food": flags["food_purchased"],
            "prep": view.get("preparation_notes") or content.get("preparation_notes"),
            "spec": view.get("special_instructions") or content.get("special_instructions"),
            "pras": view.get("prasadam_notes") or content.get("prasadam_notes"),
            "venue": view.get("venue_notes") or content.get("venue_notes"),
            "disc": view.get("disclaimer"),
            "ver": verified,
            "payload": json.dumps(view, default=str),
        },
    )

    if verified:
        for it in view.get("items") or []:
            db.execute(
                text(
                    """
                    INSERT INTO booking_samagri_snapshot (
                      booking_id, name, required, optional, customer_provided, instructions, sort_order,
                      quantity, unit, category, provided_by, language_code, item_key, section
                    ) VALUES (
                      CAST(:b AS uuid), :n, :req, :opt, :cp, :ins, :ord,
                      :qty, :unit, :cat, :prov, :lang, :ikey, :sec
                    )
                    """
                ),
                {
                    "b": booking_id,
                    "n": it["name"],
                    "req": it.get("required", True),
                    "opt": it.get("optional", False),
                    "cp": it.get("provided_by") == PROVIDER_CUSTOMER,
                    "ins": it.get("notes"),
                    "ord": it.get("sort_order") or 0,
                    "qty": it.get("quantity"),
                    "unit": it.get("unit"),
                    "cat": it.get("category"),
                    "prov": it.get("provided_by"),
                    "lang": lang,
                    "ikey": it.get("item_key"),
                    "sec": it.get("section"),
                },
            )
    return view


def get_booking_preparation(db: Session, booking_id: str, preferred_language: str | None = None) -> dict[str, Any]:
    """Return frozen snapshot when present; else live master (for preview)."""
    header = db.execute(
        text("SELECT * FROM booking_preparation_snapshot WHERE booking_id = CAST(:id AS uuid)"),
        {"id": booking_id},
    ).mappings().first()
    if header:
        payload = header.get("payload") or {}
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {}
        # Prefer payload; enrich with row-level items if needed
        if payload.get("sections"):
            out = dict(payload)
        else:
            rows = db.execute(
                text(
                    """
                    SELECT * FROM booking_samagri_snapshot
                    WHERE booking_id = CAST(:id AS uuid)
                    ORDER BY sort_order, name
                    """
                ),
                {"id": booking_id},
            ).mappings().all()
            sections: dict[str, list] = {k: [] for k in (
                SECTION_INCLUDED, SECTION_CUSTOMER, SECTION_PRASADAM, SECTION_VENUE, SECTION_OPTIONAL
            )}
            items = []
            for r in rows:
                it = {
                    "name": r["name"],
                    "label": r["name"] + (
                        f" — {r['quantity']} {r['unit']}" if r.get("quantity") is not None else ""
                    ),
                    "quantity": float(r["quantity"]) if r.get("quantity") is not None else None,
                    "unit": r.get("unit"),
                    "category": r.get("category"),
                    "provided_by": r.get("provided_by"),
                    "section": r.get("section") or SECTION_CUSTOMER,
                    "optional": r.get("optional"),
                    "required": r.get("required"),
                    "notes": r.get("instructions"),
                }
                sections.setdefault(it["section"], []).append(it)
                items.append(it)
            out = {
                "verified": bool(header.get("verified")),
                "language": header.get("language_code") or FALLBACK_LANG,
                "display_name": header.get("service_name"),
                "preparation_notes": header.get("preparation_notes"),
                "special_instructions": header.get("special_instructions"),
                "prasadam_notes": header.get("prasadam_notes"),
                "venue_notes": header.get("venue_notes"),
                "disclaimer": header.get("disclaimer"),
                "samagri_purchased": header.get("samagri_purchased"),
                "sections": sections,
                "items": items,
                "pending_message": None if header.get("verified") else PENDING_MSG.get(
                    normalize_lang(header.get("language_code")), PENDING_MSG["en"]
                ),
            }
        out["from_snapshot"] = True
        out["review_status"] = header.get("review_status")
        return out

    # No snapshot yet — live preview (e.g. admin)
    b = db.execute(text("SELECT * FROM bookings WHERE id = CAST(:id AS uuid)"), {"id": booking_id}).mappings().first()
    if not b:
        return {"verified": False, "error": "booking_not_found", "sections": {}}
    lang = normalize_lang(preferred_language) if preferred_language else customer_preferred_language(db, str(b["customer_id"]))
    master = load_service_preparation_master(db, str(b["service_id"]), lang)
    flags = package_flags_from_booking(dict(b))
    view = build_preparation_view(master, samagri_purchased=flags["samagri_purchased"], lang=lang)
    view["from_snapshot"] = False
    return view
