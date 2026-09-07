"""Seed Top-10 (+ Bhoomi) preparation/Samagri content in en/hi/te.

No personal names or phone numbers. Lists are BSeva-authored common-practice
checklists marked VERIFIED for Top 10 active/featured services.
"""
from __future__ import annotations

import json
from typing import Any

from sqlalchemy import text

# item_key -> (en, hi, te, default_unit)
CATALOG: dict[str, tuple[str, str, str, str]] = {
    "turmeric": ("Turmeric", "हल्दी", "పసుపు", "g"),
    "kumkum": ("Kumkum", "कुमकुम", "కుంకుమ", "g"),
    "sandalwood": ("Sandalwood paste/powder", "चंदन", "చందనం", "box"),
    "akshata": ("Akshata (rice with turmeric)", "अक्षत", "అక్షతలు", "g"),
    "flowers": ("Fresh flowers", "फूल", "పుష్పాలు", "bunch"),
    "garlands": ("Flower garlands", "माला", "పూల దండలు", "pcs"),
    "incense": ("Incense sticks", "अगरबत्ती", "అగరబత్తులు", "pkt"),
    "camphor": ("Camphor", "कर्पूर", "కర్పూరం", "g"),
    "lamp_oil": ("Lamp oil / ghee for deepam", "दीप तेल / घी", "దీప నూనె / నెయ్యి", "ml"),
    "cotton_wicks": ("Cotton wicks", "बत्ती", "వత్తులు", "pcs"),
    "betel_leaves": ("Betel leaves", "पान के पत्ते", "తమలపాకులు", "pcs"),
    "betel_nuts": ("Betel nuts", "सुपारी", "వక్కలు", "pcs"),
    "coconuts": ("Coconuts", "नारियल", "కొబ్బరికాయలు", "pcs"),
    "fruits": ("Assorted fruits", "फल", "పండ్లు", "tray"),
    "bananas": ("Bananas", "केले", "అరటిపళ్లు", "pcs"),
    "kalash": ("Kalash / metal pot", "कलश", "కలశం", "pcs"),
    "mango_leaves": ("Mango leaves", "आम के पत्ते", "మామిడి ఆకులు", "pcs"),
    "thread": ("Sacred thread / kalava", "मौली / कलावा", "మౌళి / దారం", "pcs"),
    "rice": ("Raw rice", "चावल", "బియ్యం", "kg"),
    "jaggery": ("Jaggery", "गुड़", "బెల్లం", "g"),
    "sugar": ("Sugar", "चीनी", "చక్కెర", "g"),
    "milk": ("Milk", "दूध", "పాలు", "ml"),
    "curd": ("Curd / yogurt", "दही", "పెరుగు", "ml"),
    "ghee": ("Ghee", "घी", "నెయ్యి", "ml"),
    "honey": ("Honey", "शहद", "తేనె", "ml"),
    "panchamrit_kit": ("Panchamrit ingredients", "पंचामृत सामग्री", "పంచామృత సామగ్రి", "set"),
    "navadhanyalu": ("Navadhanyalu (nine grains)", "नवधान्य", "నవధాన్యాలు", "set"),
    "homa_samidha": ("Homa sticks / samidha", "होम समिधा", "హోమ సమిధలు", "bundle"),
    "homa_kund": ("Homa kund / tray (if not provided)", "होम कुंड", "హోమ కుండం", "pcs"),
    "blades_grass": ("Darbha / sacred grass", "दर्भ घास", "దర్భ గడ్డి", "bunch"),
    "new_cloth": ("New cloth / angavastram as needed", "नया वस्त्र", "కొత్త వస్త్రం", "pcs"),
    "deity_photo": ("Deity photo / idol (family tradition)", "देवता फोटो / मूर्ति", "దైవ చిత్రం / విగ్రహం", "pcs"),
    "mats": ("Mats / asana for seating", "आसन / चटाई", "చాప / ఆసనం", "pcs"),
    "plates_glasses": ("Clean plates, bowls, glasses", "थाली गिलास कटोरी", "ప్లేట్లు, గ్లాసులు, గిన్నెలు", "set"),
    "drinking_water": ("Drinking water", "पीने का पानी", "తాగునీరు", "l"),
    "matchbox": ("Matchbox / lighter", "माचिस", "మ్యాచ్‌బాక్స్", "pcs"),
    "knife": ("Clean knife (for coconut/fruits)", "चाकू", "కత్తి", "pcs"),
    "bricks": ("Bricks / base for sanku (as advised)", "ईंटें", "ఇటుకలు", "pcs"),
    "soil_turmeric_mix": ("Clean soil for bhoomi ritual", "शुद्ध मिट्टी", "శుభ్రమైన మట్టి", "bowl"),
    "bell": ("Hand bell (optional)", "घंटी", "గంట", "pcs"),
    "prasadam_rice": ("Rice for prasadam / naivedyam", "प्रसाद चावल", "ప్రసాదం బియ్యం", "kg"),
    "prasadam_sweet": ("Sweet for naivedyam", "मिठाई नैवेद्य", "నైవేద్యం స్వీట్", "pcs"),
    "blouse_piece": ("Blouse piece / cloth offering (optional)", "ब्लाउज पीस", "బ్లౌజ్ పీస్", "pcs"),
    "coins": ("Coins for dakshina tray (optional)", "सिक्के", "నాణేలు", "pcs"),
    "samagri_kit": ("Puja Samagri Kit (BSeva)", "पूजा सामग्री किट (BSeva)", "పూజా సామగ్రి కిట్ (BSeva)", "kit"),
    "vehicle_lemon": ("Lemons for vehicle (optional)", "नींबू", "నిమ్మకాయలు", "pcs"),
    "vehicle_ribbon": ("Decorative ribbon / toran (optional)", "तोरण / रिबन", "తోరణం", "pcs"),
}

DISCLAIMER = {
    "en": "Requirements may vary based on family tradition / Veda Shakha / regional practice. Your assigned Pujari may confirm final requirements.",
    "hi": "पारिवारिक परंपरा / वेद शाखा / क्षेत्रीय रीति के अनुसार आवश्यकताएँ बदल सकती हैं। नियुक्त पुजारी अंतिम सूची की पुष्टि कर सकते हैं।",
    "te": "కుటుంబ సాంప్రదాయం / వేద శాఖ / ప్రాంతీయ ఆచారం బట్టి అవసరాలు మారవచ్చు. మీకు కేటాయించిన పుజారి తుది జాబితాను నిర్ధారించవచ్చు.",
}

# Per-service lines: (item_key, qty, unit|None, category, provided_by, optional, sort)
# provided_by: CUSTOMER | BSEVA | INCLUDED_IN_SAMAGRI_PACKAGE | OPTIONAL | PUJARI
Line = tuple[str, float | None, str | None, str, str, bool, int]


def _base_puja(sort0: int = 10) -> list[Line]:
    return [
        ("samagri_kit", 1, "kit", "PUJA_SAMAGRI", "INCLUDED_IN_SAMAGRI_PACKAGE", False, sort0),
        ("turmeric", 100, "g", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 1),
        ("kumkum", 50, "g", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 2),
        ("sandalwood", 1, "box", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 3),
        ("akshata", 250, "g", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 4),
        ("flowers", 2, "bunch", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 5),
        ("incense", 1, "pkt", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 6),
        ("camphor", 20, "g", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 7),
        ("lamp_oil", 200, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 8),
        ("cotton_wicks", 20, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 9),
        ("betel_leaves", 21, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 10),
        ("betel_nuts", 21, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 11),
        ("coconuts", 2, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 12),
        ("fruits", 1, "tray", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 13),
        ("kalash", 1, "pcs", "HOME_VENUE", "CUSTOMER", False, sort0 + 20),
        ("mango_leaves", 5, "pcs", "HOME_VENUE", "CUSTOMER", True, sort0 + 21),
        ("deity_photo", 1, "pcs", "HOME_VENUE", "CUSTOMER", False, sort0 + 22),
        ("mats", 2, "pcs", "HOME_VENUE", "CUSTOMER", False, sort0 + 23),
        ("plates_glasses", 1, "set", "HOME_VENUE", "CUSTOMER", False, sort0 + 24),
        ("drinking_water", 2, "l", "HOME_VENUE", "CUSTOMER", False, sort0 + 25),
        ("matchbox", 1, "pcs", "HOME_VENUE", "CUSTOMER", False, sort0 + 26),
        ("knife", 1, "pcs", "HOME_VENUE", "CUSTOMER", True, sort0 + 27),
        ("prasadam_rice", 1, "kg", "PRASADAM", "CUSTOMER", False, sort0 + 30),
        ("prasadam_sweet", 1, "pcs", "PRASADAM", "CUSTOMER", True, sort0 + 31),
        ("milk", 500, "ml", "PRASADAM", "CUSTOMER", True, sort0 + 32),
        ("bell", 1, "pcs", "OPTIONAL", "OPTIONAL", True, sort0 + 40),
        ("coins", 1, "pcs", "OPTIONAL", "OPTIONAL", True, sort0 + 41),
    ]


def _homa_extra(sort0: int = 50) -> list[Line]:
    return [
        ("homa_samidha", 1, "bundle", "PUJA_SAMAGRI", "CUSTOMER", False, sort0),
        ("ghee", 250, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 1),
        ("blades_grass", 1, "bunch", "PUJA_SAMAGRI", "CUSTOMER", False, sort0 + 2),
        ("homa_kund", 1, "pcs", "HOME_VENUE", "CUSTOMER", True, sort0 + 3),
    ]


SERVICE_LINES: dict[str, list[Line]] = {
    "ganapathi-puja": _base_puja(),
    "satyanarayana-puja": _base_puja()
    + [
        ("bananas", 12, "pcs", "PRASADAM", "CUSTOMER", False, 60),
        ("jaggery", 250, "g", "PRASADAM", "CUSTOMER", False, 61),
        ("new_cloth", 1, "pcs", "OPTIONAL", "OPTIONAL", True, 62),
    ],
    "griha-pravesham": _base_puja()
    + [
        ("navadhanyalu", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 55),
        ("rice", 2, "kg", "PUJA_SAMAGRI", "CUSTOMER", False, 56),
        ("new_cloth", 2, "pcs", "HOME_VENUE", "CUSTOMER", False, 57),
        ("blouse_piece", 1, "pcs", "OPTIONAL", "OPTIONAL", True, 58),
    ]
    + _homa_extra(70),
    "marriage-ceremony": _base_puja()
    + [
        ("garlands", 4, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, 55),
        ("new_cloth", 4, "pcs", "HOME_VENUE", "CUSTOMER", False, 56),
        ("navadhanyalu", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 57),
        ("thread", 2, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, 58),
    ],
    "vehicle-puja": [
        ("samagri_kit", 1, "kit", "PUJA_SAMAGRI", "INCLUDED_IN_SAMAGRI_PACKAGE", False, 1),
        ("turmeric", 50, "g", "PUJA_SAMAGRI", "CUSTOMER", False, 2),
        ("kumkum", 50, "g", "PUJA_SAMAGRI", "CUSTOMER", False, 3),
        ("flowers", 1, "bunch", "PUJA_SAMAGRI", "CUSTOMER", False, 4),
        ("coconuts", 1, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, 5),
        ("fruits", 1, "tray", "PUJA_SAMAGRI", "CUSTOMER", False, 6),
        ("incense", 1, "pkt", "PUJA_SAMAGRI", "CUSTOMER", False, 7),
        ("camphor", 10, "g", "PUJA_SAMAGRI", "CUSTOMER", False, 8),
        ("lamp_oil", 100, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, 9),
        ("vehicle_lemon", 4, "pcs", "OPTIONAL", "OPTIONAL", True, 20),
        ("vehicle_ribbon", 1, "pcs", "OPTIONAL", "OPTIONAL", True, 21),
        ("matchbox", 1, "pcs", "HOME_VENUE", "CUSTOMER", False, 22),
        ("drinking_water", 1, "l", "HOME_VENUE", "CUSTOMER", False, 23),
    ],
    "ganapathi-homam": _base_puja() + _homa_extra(),
    "rudrabhishekam": _base_puja()
    + [
        ("panchamrit_kit", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 55),
        ("milk", 1000, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, 56),
        ("curd", 250, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, 57),
        ("honey", 100, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, 58),
        ("ghee", 100, "ml", "PUJA_SAMAGRI", "CUSTOMER", False, 59),
    ],
    "navagraha-shanti": _base_puja()
    + [
        ("navadhanyalu", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 55),
        ("thread", 9, "pcs", "PUJA_SAMAGRI", "CUSTOMER", False, 56),
    ]
    + _homa_extra(70),
    "lakshmi-kubera-puja": _base_puja()
    + [
        ("coins", 1, "pcs", "OPTIONAL", "OPTIONAL", True, 55),
        ("blouse_piece", 1, "pcs", "OPTIONAL", "OPTIONAL", True, 56),
        ("sugar", 250, "g", "PRASADAM", "CUSTOMER", False, 57),
    ],
    "vastu-shanti": _base_puja()
    + [
        ("navadhanyalu", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 55),
        ("soil_turmeric_mix", 1, "bowl", "PUJA_SAMAGRI", "CUSTOMER", False, 56),
    ]
    + _homa_extra(70),
    "bhoomi-puja": _base_puja()
    + [
        ("bricks", 4, "pcs", "HOME_VENUE", "CUSTOMER", False, 55),
        ("soil_turmeric_mix", 1, "bowl", "PUJA_SAMAGRI", "CUSTOMER", False, 56),
        ("navadhanyalu", 1, "set", "PUJA_SAMAGRI", "CUSTOMER", False, 57),
        ("rice", 1, "kg", "PUJA_SAMAGRI", "CUSTOMER", False, 58),
    ]
    + _homa_extra(70),
}

CONTENT: dict[str, dict[str, dict[str, str]]] = {
    "ganapathi-puja": {
        "en": {
            "display_name": "Ganapathi Puja",
            "preparation_notes": "Prepare a clean puja space facing an auspicious direction as advised.",
            "special_instructions": "Keep the deity photo/idol ready before the scheduled time.",
            "prasadam_notes": "Simple naivedyam such as fruits and a sweet is sufficient unless your tradition specifies otherwise.",
            "venue_notes": "Ensure seating mats, water, and plates are ready for the Pujari and family.",
        },
        "hi": {
            "display_name": "गणपति पूजा",
            "preparation_notes": "पूजा स्थान साफ़ रखें और निर्देशानुसार दिशा में व्यवस्था करें।",
            "special_instructions": "निर्धारित समय से पहले देवता का फोटो/मूर्ति तैयार रखें।",
            "prasadam_notes": "फल और मिठाई का नैवेद्य पर्याप्त है, जब तक आपकी परंपरा अन्यथा न कहे।",
            "venue_notes": "आसन, पानी और थाली आदि पहले से तैयार रखें।",
        },
        "te": {
            "display_name": "గణపతి పూజ",
            "preparation_notes": "పూజా స్థలాన్ని శుభ్రంగా ఉంచి సూచన ప్రకారం దిశలో ఏర్పాటు చేయండి.",
            "special_instructions": "నిర్ణీత సమయానికి ముందు దైవ చిత్రం/విగ్రహం సిద్ధంగా ఉంచండి.",
            "prasadam_notes": "పండ్లు మరియు స్వీట్ నైవేద్యం సాధారణంగా సరిపోతుంది.",
            "venue_notes": "ఆసనాలు, నీరు, ప్లేట్లు ముందుగా సిద్ధం చేయండి.",
        },
    },
}


def _default_content(slug: str, display_en: str) -> dict[str, dict[str, str]]:
    if slug in CONTENT:
        base = CONTENT[slug]
    else:
        base = {
            "en": {
                "display_name": display_en,
                "preparation_notes": "Keep the puja area clean and ready before the scheduled muhurta/time.",
                "special_instructions": "Follow any final guidance from your assigned Pujari.",
                "prasadam_notes": "Arrange simple prasadam/naivedyam as per family custom.",
                "venue_notes": "Provide mats, water, plates, and a calm seating space.",
            },
            "hi": {
                "display_name": display_en,
                "preparation_notes": "निर्धारित समय से पहले पूजा स्थान साफ़ और तैयार रखें।",
                "special_instructions": "नियुक्त पुजारी के अंतिम निर्देशों का पालन करें।",
                "prasadam_notes": "पारिवारिक रीति के अनुसार सरल प्रसाद/नैवेद्य रखें।",
                "venue_notes": "आसन, पानी और बर्तन तैयार रखें।",
            },
            "te": {
                "display_name": display_en,
                "preparation_notes": "నిర్ణీత సమయం/ముహూర్తానికి ముందు పూజా ప్రాంతాన్ని శుభ్రంగా సిద్ధం చేయండి.",
                "special_instructions": "కేటాయించిన పుజారి ఇచ్చే తుది సూచనలను పాటించండి.",
                "prasadam_notes": "కుటుంబ ఆచారం ప్రకారం సాధారణ ప్రసాదం/నైవేద్యం ఏర్పాటు చేయండి.",
                "venue_notes": "ఆసనాలు, నీరు, పాత్రలు సిద్ధంగా ఉంచండి.",
            },
        }
    for lang in ("en", "hi", "te"):
        base.setdefault(lang, {})
        base[lang]["disclaimer"] = DISCLAIMER[lang]
    return base


def _ensure_item(conn, item_key: str) -> str:
    en, hi, te, unit = CATALOG[item_key]
    row = conn.execute(text("SELECT id FROM samagri_items WHERE item_key = :k"), {"k": item_key}).first()
    if row:
        sid = str(row[0])
    else:
        conn.execute(
            text(
                """
                INSERT INTO samagri_items (name, description, unit, default_unit, item_key, active)
                VALUES (:n, :d, :u, :u, :k, TRUE)
                """
            ),
            {"n": en, "d": en, "u": unit, "k": item_key},
        )
        sid = str(conn.execute(text("SELECT id FROM samagri_items WHERE item_key = :k"), {"k": item_key}).scalar())
    for lang, name in (("en", en), ("hi", hi), ("te", te)):
        conn.execute(
            text(
                """
                INSERT INTO samagri_item_translations (samagri_item_id, language_code, item_name)
                VALUES (CAST(:id AS uuid), :lang, :name)
                ON CONFLICT (samagri_item_id, language_code) DO UPDATE SET item_name = EXCLUDED.item_name
                """
            ),
            {"id": sid, "lang": lang, "name": name},
        )
    return sid


def ensure_samagri_content(conn) -> dict[str, Any]:
    try:
        conn.execute(text("SELECT 1 FROM samagri_item_translations LIMIT 1"))
    except Exception:
        return {"skipped": True, "reason": "phase5 tables missing"}

    # Ensure catalog items
    for key in CATALOG:
        _ensure_item(conn, key)

    populated = []
    for slug, lines in SERVICE_LINES.items():
        svc = conn.execute(
            text("SELECT id, name FROM services WHERE slug = :s"),
            {"s": slug},
        ).mappings().first()
        if not svc:
            continue
        sid = str(svc["id"])
        # Replace links for idempotent seed of these featured services
        conn.execute(text("DELETE FROM service_samagri WHERE service_id = CAST(:id AS uuid)"), {"id": sid})
        # Deduplicate by item_key (later entries win — e.g. ritual milk over prasadam milk)
        deduped: dict[str, Line] = {}
        for line in lines:
            deduped[line[0]] = line
        for item_key, qty, unit, category, provided_by, optional, sort_order in deduped.values():
            item_id = _ensure_item(conn, item_key)
            customer_provided = provided_by == "CUSTOMER"
            conn.execute(
                text(
                    """
                    INSERT INTO service_samagri (
                      service_id, samagri_item_id, required, optional, customer_provided,
                      instructions, sort_order, quantity, unit, category, provided_by, active
                    ) VALUES (
                      CAST(:sid AS uuid), CAST(:iid AS uuid), :req, :opt, :cp,
                      NULL, :ord, :qty, :unit, :cat, :prov, TRUE
                    )
                    ON CONFLICT (service_id, samagri_item_id) DO UPDATE SET
                      required = EXCLUDED.required,
                      optional = EXCLUDED.optional,
                      customer_provided = EXCLUDED.customer_provided,
                      sort_order = EXCLUDED.sort_order,
                      quantity = EXCLUDED.quantity,
                      unit = EXCLUDED.unit,
                      category = EXCLUDED.category,
                      provided_by = EXCLUDED.provided_by,
                      active = TRUE
                    """
                ),
                {
                    "sid": sid,
                    "iid": item_id,
                    "req": not optional,
                    "opt": optional,
                    "cp": customer_provided,
                    "ord": sort_order,
                    "qty": qty,
                    "unit": unit,
                    "cat": category,
                    "prov": provided_by,
                },
            )

        content = _default_content(slug, str(svc["name"]))
        for lang, fields in content.items():
            conn.execute(
                text(
                    """
                    INSERT INTO service_preparation_content (
                      service_id, language_code, display_name, short_description,
                      preparation_notes, special_instructions, prasadam_notes, venue_notes, disclaimer
                    ) VALUES (
                      CAST(:sid AS uuid), :lang, :dn, :sd, :pn, :si, :pr, :vn, :disc
                    )
                    ON CONFLICT (service_id, language_code) DO UPDATE SET
                      display_name = EXCLUDED.display_name,
                      preparation_notes = EXCLUDED.preparation_notes,
                      special_instructions = EXCLUDED.special_instructions,
                      prasadam_notes = EXCLUDED.prasadam_notes,
                      venue_notes = EXCLUDED.venue_notes,
                      disclaimer = EXCLUDED.disclaimer,
                      updated_at = NOW()
                    """
                ),
                {
                    "sid": sid,
                    "lang": lang,
                    "dn": fields.get("display_name"),
                    "sd": fields.get("short_description"),
                    "pn": fields.get("preparation_notes"),
                    "si": fields.get("special_instructions"),
                    "pr": fields.get("prasadam_notes"),
                    "vn": fields.get("venue_notes"),
                    "disc": fields.get("disclaimer"),
                },
            )

        conn.execute(
            text(
                """
                UPDATE services SET
                  samagri_review_status = 'VERIFIED',
                  samagri_last_reviewed_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {"id": sid},
        )
        populated.append(slug)

    return {"populated_services": populated, "catalog_items": len(CATALOG)}
