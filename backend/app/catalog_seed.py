"""Idempotent Phase-1 Puja catalog seed: categories, multi-map, aliases, Top 10 flags.

Does NOT overwrite existing live services' names, slugs, or prices.
New services are created inactive with pricing_status='awaiting_pricing' and NULL prices.
"""
from __future__ import annotations

import json

from sqlalchemy import text

# (slug, name, sort_order)
CATEGORIES = [
    ("home-property", "Home & Property", 10),
    ("ganapathi", "Ganapathi", 20),
    ("shiva", "Shiva", 30),
    ("lakshmi-wealth", "Lakshmi & Wealth", 40),
    ("homam-havan", "Homam / Havan", 50),
    ("marriage", "Marriage", 60),
    ("baby-children", "Baby & Children", 70),
    ("navagraha-dosha", "Navagraha & Dosha", 80),
    ("health-wellness", "Health & Wellness", 90),
    ("festivals", "Festivals", 100),
    ("vratham-parayanam", "Vratham & Parayanam", 110),
    ("business-office", "Business & Office", 120),
    ("life-milestones", "Life Milestones", 130),
    ("vehicle", "Vehicle", 140),
    ("death-ancestor", "Death & Ancestor", 150),
    ("astrology-muhurtham", "Astrology & Muhurtham", 160),
]

# Existing live services: only attach categories/aliases/flags — never change prices/names/slugs.
EXISTING_ENRICH = [
    {
        "slug": "ganapathi-puja",
        "categories": ["ganapathi"],
        "aliases": ["Ganesh Puja", "Ganapati Puja", "Vinayaka Puja", "Ganesh Pooja", "Ganapathi Pooja"],
        "slug_aliases": [],
        "is_popular": True,
        "is_featured_home": True,
        "homepage_rank": 1,
        "display_order": 10,
        "short_description": "Household Ganapathi puja for removing obstacles and auspicious beginnings.",
    },
    {
        "slug": "satyanarayana-puja",
        "categories": ["vratham-parayanam"],
        "aliases": [
            "Satyanarayan Puja",
            "Satyanarayana Vratham",
            "Satyanarayan Vrat",
            "Satyanarayana Pooja",
            "Satya Narayana Puja",
        ],
        "slug_aliases": ["satyanarayan-puja", "satyanarayan-vratham"],
        "is_popular": True,
        "is_featured_home": True,
        "homepage_rank": 2,
        "display_order": 20,
        "short_description": "Satyanarayana vratham for peace, prosperity, and fulfilment of sankalpas.",
    },
    {
        "slug": "griha-pravesham",
        "categories": ["home-property"],
        "aliases": [
            "Griha Pravesh",
            "Gruha Pravesham",
            "Housewarming",
            "House Warming Puja",
            "Grihapravesha",
            "Gruha Pravesh",
        ],
        "slug_aliases": ["griha-pravesh-puja", "griha-pravesh", "gruha-pravesham", "housewarming"],
        "is_popular": True,
        "is_featured_home": True,
        "homepage_rank": 3,
        "display_order": 30,
        "short_description": "Housewarming ceremony to sanctify a new home.",
        "requires_muhurta": True,
    },
    {
        "slug": "marriage-ceremony",
        "categories": ["marriage"],
        "aliases": ["Vivaham", "Vivaha", "Wedding Puja", "Marriage Puja", "Wedding Ceremony"],
        "slug_aliases": ["vivaham", "wedding-ceremony", "marriage-puja"],
        "is_popular": True,
        "is_featured_home": True,
        "homepage_rank": 4,
        "display_order": 40,
        "short_description": "Traditional Vedic marriage / vivaham rituals.",
        "requires_muhurta": True,
    },
    {
        "slug": "vehicle-puja",
        "categories": ["vehicle"],
        "aliases": ["Vahana Puja", "Car Puja", "Bike Puja", "Vehicle Pooja", "New Vehicle Puja"],
        "slug_aliases": ["vahana-puja", "car-puja"],
        "is_popular": True,
        "is_featured_home": True,
        "homepage_rank": 5,
        "display_order": 50,
        "short_description": "Auspicious puja for a new vehicle.",
    },
]

# Phase-1 new services: inactive, awaiting Admin pricing. Prices left NULL.
# categories: list of category slugs (multi supported)
# featured_rank: set for Top 10 entries 6–10
NEW_SERVICES = [
    # Home & Property
    ("vastu-shanti", "Vastu Shanti", ["home-property"], ["Vastu Shanti Puja", "Vaastu Shanti", "Vastu Puja"], 2, False, 10),
    ("bhoomi-puja", "Bhoomi Puja", ["home-property"], ["Bhumi Puja", "Bhoomi Pooja", "Land Puja"], 2, False, None),
    ("vastu-dosha-nivarana", "Vastu Dosha Nivarana", ["home-property", "navagraha-dosha"], ["Vastu Dosha Puja", "Vaastu Dosha Nivarana"], 3, False, None),
    ("new-home-flat-puja", "New Home / Flat Puja", ["home-property"], ["New Flat Puja", "New House Puja", "Apartment Puja"], 2, False, None),
    # Ganapathi
    ("ganapathi-homam", "Ganapathi Homam", ["ganapathi", "homam-havan"], ["Ganapati Homam", "Ganesh Homam", "Ganapathi Havan", "Ganapathi Homa", "Vinayaka Homam"], 2, True, 6),
    ("maha-ganapathi-homam", "Maha Ganapathi Homam", ["ganapathi", "homam-havan"], ["Maha Ganapati Homam", "Maha Ganesh Homam"], 3, False, None),
    ("ganesh-chaturthi-puja", "Ganesh Chaturthi Puja", ["ganapathi", "festivals"], ["Ganesh Chaturthi", "Vinayaka Chaturthi Puja", "Ganapathi Chaturthi"], 2, False, None),
    # Shiva
    ("rudrabhishekam", "Rudrabhishekam", ["shiva"], ["Rudra Abhishekam", "Rudrabhishek", "Rudra Abhishek"], 2, True, 7),
    ("maha-rudrabhishekam", "Maha Rudrabhishekam", ["shiva"], ["Maha Rudra Abhishekam", "Maha Rudrabhishek"], 3, False, None),
    ("maha-mrityunjaya-puja", "Maha Mrityunjaya Puja", ["shiva", "health-wellness"], ["Mahamrityunjaya Puja", "Mrityunjaya Puja", "Maha Mrutyunjaya Puja"], 2, False, None),
    ("maha-mrityunjaya-homam", "Maha Mrityunjaya Homam", ["shiva", "homam-havan", "health-wellness"], ["Mahamrityunjaya Homam", "Mrityunjaya Homam", "Maha Mrutyunjaya Homa"], 3, False, None),
    ("shivaratri-puja", "Shivaratri Puja", ["shiva", "festivals"], ["Maha Shivaratri Puja", "Shivratri Puja"], 2, False, None),
    # Lakshmi / Wealth
    ("lakshmi-puja", "Lakshmi Puja", ["lakshmi-wealth"], ["Laxmi Puja", "Mahalakshmi Puja", "Lakshmi Pooja"], 2, False, None),
    ("lakshmi-kubera-puja", "Lakshmi Kubera Puja", ["lakshmi-wealth", "business-office"], ["Laxmi Kubera Puja", "Lakshmi Kuber Puja", "Kubera Lakshmi Puja"], 2, True, 9),
    ("lakshmi-kubera-homam", "Lakshmi Kubera Homam", ["lakshmi-wealth", "homam-havan"], ["Laxmi Kubera Homam", "Lakshmi Kubera Havan"], 3, False, None),
    ("varalakshmi-vratham", "Varalakshmi Vratham", ["lakshmi-wealth", "festivals", "vratham-parayanam"], ["Varalakshmi Vrat", "Varamahalakshmi Vratham", "Vara Lakshmi Puja"], 2, False, None),
    ("ashta-lakshmi-puja", "Ashta Lakshmi Puja", ["lakshmi-wealth"], ["Ashtalakshmi Puja", "Ashta Laxmi Puja"], 2, False, None),
    # Homam (additional)
    ("navagraha-homam", "Navagraha Homam", ["homam-havan", "navagraha-dosha"], ["Navagraha Havan", "Navgraha Homam", "Navagraha Homa"], 2, False, None),
    ("sudarshana-homam", "Sudarshana Homam", ["homam-havan"], ["Sudarshan Homam", "Sudarshana Havan", "Sudarshana Homa"], 3, False, None),
    ("sudarshana-narasimha-homam", "Sudarshana Narasimha Homam", ["homam-havan"], ["Sudarshana Narasimha Homa", "Sudarshan Narasimha Homam"], 3, False, None),
    ("dhanvantari-homam", "Dhanvantari Homam", ["homam-havan", "health-wellness"], ["Dhanvanthari Homam", "Dhanvantari Homa"], 2, False, None),
    ("ayush-homam", "Ayush Homam", ["homam-havan", "baby-children", "health-wellness", "life-milestones"], ["Ayushya Homam", "Ayush Havan", "Aayush Homam"], 2, False, None),
    ("santana-gopala-homam", "Santana Gopala Homam", ["homam-havan", "baby-children"], ["Santana Gopal Homam", "Santan Gopala Homam"], 2, False, None),
    ("saraswati-homam", "Saraswati Homam", ["homam-havan"], ["Saraswathi Homam", "Saraswati Havan"], 2, False, None),
    ("lakshmi-narayana-homam", "Lakshmi Narayana Homam", ["homam-havan", "lakshmi-wealth"], ["Lakshmi Narayan Homam", "Laxmi Narayana Homam"], 3, False, None),
    ("nava-chandi-homam", "Nava Chandi Homam", ["homam-havan"], ["Navachandi Homam", "Nava Chandi Homa", "Chandi Homam"], 3, False, None),
    # Marriage
    ("nischitartham", "Nischitartham / Engagement", ["marriage"], ["Nischitartha", "Engagement Ceremony", "Nischayathartham"], 2, False, None),
    ("marriage-muhurta-consultation", "Marriage Muhurta Consultation", ["marriage", "astrology-muhurtham"], ["Marriage Muhurtham", "Wedding Muhurta", "Vivaha Muhurta"], 2, False, None),
    ("pre-wedding-ganapathi-puja", "Pre-Wedding Ganapathi Puja", ["marriage", "ganapathi"], ["Pre Wedding Ganesh Puja", "Wedding Ganapathi Puja"], 2, False, None),
    ("uma-maheshwara-puja", "Uma Maheshwara Puja", ["marriage", "shiva"], ["Uma Maheswara Puja", "Uma Maheshwara Kalyanam"], 2, False, None),
    ("marriage-anniversary-puja", "Marriage Anniversary Puja", ["marriage", "life-milestones"], ["Wedding Anniversary Puja", "Marriage Anniversary"], 2, False, None),
    # Baby & Children
    ("seemantham", "Seemantham", ["baby-children"], ["Seemantha", "Seemantam", "Baby Shower Puja"], 2, False, None),
    ("namakaranam", "Namakaranam", ["baby-children"], ["Namkaran", "Namakarana", "Naming Ceremony"], 2, False, None),
    ("annaprashanam", "Annaprashanam", ["baby-children"], ["Annaprasana", "Annaprashana", "First Rice Ceremony"], 2, False, None),
    ("aksharabhyasam", "Aksharabhyasam / Vidyarambham", ["baby-children"], ["Aksharabhyasa", "Vidyarambham", "Vidyarambha", "Akshara Abhyasam"], 2, False, None),
    ("mundan-choula", "Mundan / Choula", ["baby-children"], ["Mundan", "Choula", "Chudakarana", "Tonsure Ceremony"], 2, False, None),
    ("karnavedha", "Karnavedha", ["baby-children"], ["Karnavedham", "Ear Piercing Ceremony"], 2, False, None),
    # Navagraha & Dosha
    ("navagraha-shanti", "Navagraha Shanti", ["navagraha-dosha"], ["Navagraha Shanti Puja", "Navgraha Shanti", "Navagraha Puja"], 2, True, 8),
    ("shani-shanti", "Shani Shanti", ["navagraha-dosha"], ["Shani Shanti Puja", "Shani Shanti Homam", "Sani Shanti"], 2, False, None),
    ("rahu-ketu-shanti", "Rahu / Ketu Shanti", ["navagraha-dosha"], ["Rahu Ketu Shanti", "Rahu Shanti", "Ketu Shanti"], 2, False, None),
    ("kuja-dosha-nivarana", "Kuja Dosha Nivarana", ["navagraha-dosha", "marriage"], ["Manglik Dosha", "Mangal Dosha Nivarana", "Kuja Dosha Puja", "Mangalya Dosha"], 2, False, None),
    ("kala-sarpa-dosha-puja", "Kala Sarpa Dosha Puja", ["navagraha-dosha"], ["Kaal Sarp Dosh", "Kalasarpa Dosha", "Kala Sarpa Shanti", "Kaal Sarp Dosha Nivarana"], 3, False, None),
    ("nakshatra-shanti", "Nakshatra Shanti", ["navagraha-dosha"], ["Nakshatra Shanti Puja", "Birth Star Shanti"], 2, False, None),
    ("pitru-dosha-nivarana", "Pitru Dosha Nivarana", ["navagraha-dosha", "death-ancestor"], ["Pitra Dosha Nivarana", "Pitru Dosha Puja", "Pitru Shanti"], 2, False, None),
    # Festivals
    ("ugadi-puja", "Ugadi Puja", ["festivals"], ["Ugadi", "Yugadi Puja", "Gudi Padwa Puja"], 2, False, None),
    ("sankranti-pongal-puja", "Sankranti / Pongal Puja", ["festivals"], ["Makara Sankranti", "Pongal Puja", "Sankranthi Puja"], 2, False, None),
    ("sri-rama-navami", "Sri Rama Navami", ["festivals"], ["Rama Navami Puja", "Ram Navami"], 2, False, None),
    ("hanuman-jayanti", "Hanuman Jayanti", ["festivals"], ["Hanuman Jayanthi", "Anjaneya Jayanti"], 2, False, None),
    ("krishna-janmashtami", "Krishna Janmashtami", ["festivals"], ["Janmashtami Puja", "Gokulashtami", "Sri Krishna Janmashtami"], 2, False, None),
    ("navaratri-durga-puja", "Navaratri / Durga Puja", ["festivals"], ["Navratri Puja", "Durga Puja", "Navaratri"], 2, False, None),
    ("diwali-lakshmi-puja", "Diwali Lakshmi Puja", ["festivals", "lakshmi-wealth"], ["Deepavali Lakshmi Puja", "Diwali Puja", "Chopda Pujan"], 2, False, None),
    ("karthika-deepam", "Karthika Deepam", ["festivals"], ["Kartika Deepam", "Karthigai Deepam", "Karthika Pournami"], 2, False, None),
    # Parayanam
    ("sundarakanda-parayanam", "Sundarakanda Parayanam", ["vratham-parayanam"], ["Sundarkand Path", "Sunderkand Paath", "Sundarakanda Path"], 2, False, None),
    ("ramayana-parayanam", "Ramayana Parayanam", ["vratham-parayanam"], ["Akhand Ramayana", "Ramayan Path", "Ramayana Paath"], 2, False, None),
    ("bhagavad-gita-parayanam", "Bhagavad Gita Parayanam", ["vratham-parayanam"], ["Gita Parayanam", "Bhagavad Gita Path"], 2, False, None),
    ("vishnu-sahasranama", "Vishnu Sahasranama", ["vratham-parayanam"], ["Vishnu Sahasranamam", "Sri Vishnu Sahasranama"], 2, False, None),
    ("lalitha-sahasranama", "Lalitha Sahasranama", ["vratham-parayanam"], ["Lalita Sahasranamam", "Lalitha Sahasranamam"], 2, False, None),
    ("durga-saptashati", "Durga Saptashati", ["vratham-parayanam", "festivals"], ["Devi Mahatmyam", "Durga Saptashati Path", "Chandi Path"], 2, False, None),
    # Business
    ("new-office-puja", "New Office Puja", ["business-office"], ["Office Opening Puja", "Office Inauguration Puja"], 2, False, None),
    ("new-shop-puja", "New Shop Puja", ["business-office"], ["Shop Opening Puja", "New Shop Opening"], 2, False, None),
    ("business-growth-puja", "Business Growth Puja", ["business-office", "lakshmi-wealth"], ["Vyapara Vruddhi Puja", "Business Prosperity Puja"], 2, False, None),
    ("office-ganapathi-puja", "Office Ganapathi Puja", ["business-office", "ganapathi"], ["Office Ganesh Puja", "Workplace Ganapathi"], 2, False, None),
    ("ayudha-puja", "Ayudha Puja", ["business-office", "festivals"], ["Ayudha Pooja", "Shastra Puja", "Weapons Puja"], 2, False, None),
    # Life milestones
    ("birthday-puja", "Birthday Puja", ["life-milestones"], ["Janmadina Puja", "Birthday Homam"], 2, False, None),
    ("upanayanam", "Upanayanam", ["life-milestones"], ["Upanayana", "Janeu Ceremony", "Sacred Thread Ceremony"], 3, False, None),
    ("shashti-poorthi", "Shashti Poorthi", ["life-milestones"], ["Shasti Poorti", "Shashtipoorthi", "60th Birthday Ceremony"], 3, False, None),
    ("bhima-ratha-shanti", "Bhima Ratha Shanti", ["life-milestones"], ["Bheema Ratha Shanti", "70th Year Ceremony"], 3, False, None),
    ("sahasra-chandra-darshanam", "Sahasra Chandra Darshanam", ["life-milestones"], ["Sahasra Chandra Darshana", "1000 Moon Sighting Ceremony"], 3, False, None),
]

# Death / astrology — preserve if present; seed inactive drafts if missing (not in Top 10)
SPECIAL_SERVICES = [
    (
        "antyeshti",
        "Antyeshti (Death Rituals)",
        ["death-ancestor"],
        ["Antyesti", "Funeral Rituals", "Last Rites", "Death Rituals"],
        3,
        "Death-related funeral and last rites support.",
    ),
    (
        "shraddha-death-anniversary",
        "Shraddha / Death Anniversary",
        ["death-ancestor"],
        ["Shraddh", "Shraadh", "Death Anniversary Puja", "Pitru Shraddha"],
        2,
        "Annual death anniversary and related ancestor rituals.",
    ),
    (
        "astrology-consultation",
        "Astrology Consultation",
        ["astrology-muhurtham"],
        ["Astrologer Consultation", "Jyotish Consultation"],
        2,
        "General astrology consultation.",
    ),
    (
        "kundali-consultation",
        "Horoscope / Kundali Consultation",
        ["astrology-muhurtham"],
        ["Kundli Consultation", "Horoscope Reading", "Jataka"],
        2,
        "Kundali and horoscope consultation.",
    ),
    (
        "muhurta-consultation",
        "Muhurta Consultation",
        ["astrology-muhurtham"],
        ["Muhurtham Consultation", "Muhurta", "Auspicious Timing Consultation"],
        2,
        "Standalone muhurta / muhurtham guidance.",
    ),
]


def _ensure_categories(conn) -> dict[str, str]:
    """Return map slug -> id."""
    out: dict[str, str] = {}
    for slug, name, sort_order in CATEGORIES:
        conn.execute(
            text(
                """
                INSERT INTO service_categories (slug, name, sort_order, active)
                VALUES (:slug, :name, :ord, TRUE)
                ON CONFLICT (slug) DO UPDATE SET
                  name = EXCLUDED.name,
                  sort_order = EXCLUDED.sort_order,
                  active = TRUE,
                  updated_at = NOW()
                """
            ),
            {"slug": slug, "name": name, "ord": sort_order},
        )
    rows = conn.execute(text("SELECT id, slug FROM service_categories")).mappings().all()
    for r in rows:
        out[str(r["slug"])] = str(r["id"])
    return out


def _map_categories(conn, service_id: str, cat_slugs: list[str], cat_ids: dict[str, str]) -> None:
    for cs in cat_slugs:
        cid = cat_ids.get(cs)
        if not cid:
            continue
        conn.execute(
            text(
                """
                INSERT INTO service_category_map (service_id, category_id)
                VALUES (CAST(:sid AS uuid), CAST(:cid AS uuid))
                ON CONFLICT DO NOTHING
                """
            ),
            {"sid": service_id, "cid": cid},
        )


def _set_aliases(conn, service_id: str, aliases: list[str], slug_aliases: list[str] | None = None) -> None:
    conn.execute(
        text(
            """
            UPDATE services SET search_aliases = CAST(:a AS jsonb), updated_at = NOW()
            WHERE id = CAST(:id AS uuid)
            """
        ),
        {"a": json.dumps(aliases), "id": service_id},
    )
    for alias in slug_aliases or []:
        conn.execute(
            text(
                """
                INSERT INTO service_slug_aliases (alias_slug, service_id)
                VALUES (:alias, CAST(:sid AS uuid))
                ON CONFLICT (alias_slug) DO UPDATE SET service_id = EXCLUDED.service_id
                """
            ),
            {"alias": alias, "sid": service_id},
        )


def _enrich_existing(conn, cat_ids: dict[str, str]) -> None:
    for item in EXISTING_ENRICH:
        row = conn.execute(
            text("SELECT id FROM services WHERE slug = :s"),
            {"s": item["slug"]},
        ).first()
        if not row:
            continue
        sid = str(row[0])
        conn.execute(
            text(
                """
                UPDATE services SET
                  short_description = COALESCE(NULLIF(short_description, ''), :short),
                  is_popular = :pop,
                  is_featured_home = :feat,
                  homepage_rank = :rank,
                  display_order = :ord,
                  pricing_status = 'priced',
                  requires_muhurta = CASE WHEN :muh THEN TRUE ELSE requires_muhurta END,
                  updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {
                "short": item.get("short_description"),
                "pop": item["is_popular"],
                "feat": item["is_featured_home"],
                "rank": item["homepage_rank"],
                "ord": item["display_order"],
                "muh": bool(item.get("requires_muhurta")),
                "id": sid,
            },
        )
        _map_categories(conn, sid, item["categories"], cat_ids)
        _set_aliases(conn, sid, item["aliases"], item.get("slug_aliases"))


def _insert_new(conn, cat_ids: dict[str, str]) -> int:
    added = 0
    display = 100
    for slug, name, cats, aliases, level, popular, feat_rank in NEW_SERVICES:
        exists = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
        if exists:
            sid = str(exists[0])
            # Keep existing row; still attach categories/aliases if missing maps
            _map_categories(conn, sid, cats, cat_ids)
            _set_aliases(conn, sid, aliases)
            if feat_rank:
                conn.execute(
                    text(
                        """
                        UPDATE services SET
                          is_featured_home = TRUE,
                          is_popular = TRUE,
                          homepage_rank = :rank,
                          display_order = LEAST(display_order, :ord)
                        WHERE id = CAST(:id AS uuid)
                          AND (standard_price_paise IS NOT NULL OR pricing_status = 'priced')
                        """
                    ),
                    {"rank": feat_rank, "ord": feat_rank * 10, "id": sid},
                )
            continue

        # Draft: inactive, null prices, awaiting Admin pricing
        featured = feat_rank is not None
        conn.execute(
            text(
                """
                INSERT INTO services (
                  name, slug, description, short_description, required_level,
                  standard_price_paise, premium_price_paise,
                  duration_minutes, virtual_available, active,
                  search_aliases, is_popular, is_featured_home, homepage_rank, display_order,
                  pricing_status, samagri_available, alankaram_available, food_available,
                  pujaris_required
                ) VALUES (
                  :name, :slug, :desc, :short, :lvl,
                  NULL, NULL,
                  90, FALSE, FALSE,
                  CAST(:aliases AS jsonb), :pop, :feat, :rank, :ord,
                  'awaiting_pricing', TRUE, FALSE, FALSE,
                  1
                )
                """
            ),
            {
                "name": name,
                "slug": slug,
                "desc": name,
                "short": name,
                "lvl": level,
                "aliases": json.dumps(aliases),
                "pop": popular or featured,
                "feat": featured,
                "rank": feat_rank,
                "ord": (feat_rank * 10) if feat_rank else display,
            },
        )
        display += 10
        row = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
        sid = str(row[0])
        _map_categories(conn, sid, cats, cat_ids)
        # slug aliases from common alias spellings (normalized)
        slug_aliases = []
        for a in aliases[:3]:
            s = (
                a.lower()
                .replace("/", " ")
                .replace("&", " ")
                .replace("  ", " ")
                .strip()
                .replace(" ", "-")
            )
            if s and s != slug:
                slug_aliases.append(s)
        _set_aliases(conn, sid, aliases, slug_aliases)
        added += 1
    return added


def _ensure_special(conn, cat_ids: dict[str, str]) -> int:
    added = 0
    for slug, name, cats, aliases, level, short in SPECIAL_SERVICES:
        exists = conn.execute(text("SELECT id, active FROM services WHERE slug = :s"), {"s": slug}).first()
        if exists:
            sid = str(exists[0])
            _map_categories(conn, sid, cats, cat_ids)
            _set_aliases(conn, sid, aliases)
            conn.execute(
                text(
                    """
                    UPDATE services SET
                      is_featured_home = FALSE,
                      short_description = COALESCE(NULLIF(short_description, ''), :short)
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {"short": short, "id": sid},
            )
            continue
        conn.execute(
            text(
                """
                INSERT INTO services (
                  name, slug, description, short_description, required_level,
                  standard_price_paise, premium_price_paise, duration_minutes,
                  virtual_available, active, search_aliases, is_popular, is_featured_home,
                  display_order, pricing_status
                ) VALUES (
                  :name, :slug, :desc, :short, :lvl,
                  NULL, NULL, 60,
                  TRUE, FALSE, CAST(:aliases AS jsonb), FALSE, FALSE,
                  2000, 'awaiting_pricing'
                )
                """
            ),
            {
                "name": name,
                "slug": slug,
                "desc": short,
                "short": short,
                "lvl": level,
                "aliases": json.dumps(aliases),
            },
        )
        row = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
        sid = str(row[0])
        _map_categories(conn, sid, cats, cat_ids)
        _set_aliases(conn, sid, aliases)
        added += 1
    return added


def ensure_catalog(conn) -> dict:
    """Run inside an open SQLAlchemy connection/transaction."""
    # Tables may not exist yet on very old DBs — caller should run phase4 first
    try:
        conn.execute(text("SELECT 1 FROM service_categories LIMIT 1"))
    except Exception:
        return {"skipped": True, "reason": "service_categories missing"}

    cat_ids = _ensure_categories(conn)
    _enrich_existing(conn, cat_ids)
    new_n = _insert_new(conn, cat_ids)
    special_n = _ensure_special(conn, cat_ids)
    images_n = 0
    try:
        from app.service_images_seed import apply_service_images

        # Always sync image_url/image_path from ATTRIBUTION (unique per-slug AI assets).
        images_n = apply_service_images(conn, only_if_empty=False)
    except Exception:
        images_n = 0
    return {
        "categories": len(cat_ids),
        "new_services": new_n,
        "special_services": special_n,
        "service_images": images_n,
    }
