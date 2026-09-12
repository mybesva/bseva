"""Import/update puja master content from docs/puja_sources without duplicating services.

Safe rules:
- Match by normalized name / slug / aliases; preserve UUIDs
- Never overwrite priced production package prices
- Import only documented process/samagri text (no invented rituals)
- Competitor prices never stored for customer display
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.engine import Connection

SRC_DIR = Path(__file__).resolve().parents[2] / "docs" / "puja_sources"

# Document Top-10 → canonical slug (+ create if missing)
TOP10: list[tuple[int, str, str, list[str]]] = [
    (1, "ganapathi-puja", "Ganesh Puja", ["ganesh puja", "ganapati puja", "ganapathi puja", "vighneshwara"]),
    (2, "lakshmi-puja", "Lakshmi Puja", ["laxmi puja", "lakshmi puja"]),
    (3, "satyanarayana-puja", "Satyanarayan Puja", ["satyanarayan", "satyanarayana", "sri satyanarayan"]),
    (4, "rudrabhishekam", "Rudrabhishek / Shiva Puja", ["rudrabhishek", "rudrabhishekam", "shiva puja"]),
    (5, "navaratri-durga-puja", "Durga Puja", ["durga puja", "navaratri", "navratri durga"]),
    (6, "hanuman-puja", "Hanuman Puja", ["hanuman puja", "hanuman chalisa"]),
    (7, "navagraha-shanti", "Navagraha Shanti Puja", ["navagraha", "navagraha shanti", "navagraha puja"]),
    (8, "maha-mrityunjaya-puja", "Maha Mrityunjaya Puja", ["maha mrityunjaya", "mrityunjaya"]),
    (9, "saraswati-puja", "Saraswati Puja", ["saraswati puja"]),
    (10, "griha-pravesham", "Griha Pravesh Puja", ["griha pravesh", "gruha pravesam", "griha pravesham", "housewarming"]),
]

# Process/samagri doc title → slug (keys must be _norm()'d)
CONTENT_ALIASES: dict[str, str] = {
    "maha ganapathi homa": "maha-ganapathi-homam",
    "ganapathi chaturthi puja": "ganesh-chaturthi-puja",
    "sri satyanarayan swamy puja": "satyanarayana-puja",
    "satyanarayan puja with homa": "satyanarayana-puja",
    "rudrabhishek": "rudrabhishekam",
    "maha rudrabhishek with homa": "maha-rudrabhishekam",
    "maha mrityunjaya homa": "maha-mrityunjaya-homam",
    "durga saptashati path": "durga-saptashati",
    "diwali lakshmi kubera puja": "diwali-lakshmi-puja",
    "varalakshmi vrata puja": "varalakshmi-vratham",
    "saraswati puja": "saraswati-puja",
    "navagraha shanti homa": "navagraha-homam",
    "griha pravesh basic": "griha-pravesham",
    "griha pravesh with vastu homa": "griha-pravesham",
    "bhoomi puja foundation": "bhoomi-puja",
    "vastu shanti homa": "vastu-shanti",
    "new office opening puja": "new-office-puja",
    "ayudha puja": "ayudha-puja",
    "hanuman chalisa 108 avarti": "hanuman-puja",
    "sri rama navami puja": "sri-rama-navami",
    "krishna janmashtami puja": "krishna-janmashtami",
    "santana gopala krishna homa": "santana-gopala-homam",
    "shani shanti puja": "shani-shanti",
    "navratri durga ashtami homa": "navaratri-durga-puja",
    "lalitha sahasranama puja": "lalitha-sahasranama",
}


def _norm(s: str) -> str:
    s = (s or "").lower().strip()
    s = s.replace("&", " and ")
    s = re.sub(r"[^a-z0-9\s]+", " ", s)
    s = re.sub(r"\s+", " ", s).strip()
    for a, b in (
        ("pooja", "puja"),
        ("ganapati", "ganapathi"),
        ("ganesh", "ganapathi"),
        ("laxmi", "lakshmi"),
        ("gruha", "griha"),
        ("pravesam", "pravesh"),
        ("pravesham", "pravesh"),
        ("homam", "homa"),
        ("havan", "homa"),
        ("abhishekam", "abhishek"),
    ):
        s = s.replace(a, b)
    return s


def _read(name: str) -> str:
    p = SRC_DIR / name
    return p.read_text(encoding="utf-8", errors="ignore") if p.exists() else ""


def _parse_top10_cards(text: str) -> dict[str, dict[str, str]]:
    """Parse numbered sections from The_10_Most_Popular…txt into content by heading key."""
    out: dict[str, dict[str, str]] = {}
    parts = re.split(r"\n(?=\d+\.\s+)", text)
    for part in parts:
        m = re.match(r"(\d+)\.\s+(.+)", part.strip())
        if not m:
            continue
        title = m.group(2).split("\n")[0].strip()
        body = part[m.end() :].strip()

        def grab(label: str) -> str:
            mm = re.search(
                rf"{label}\n(.+?)(?=\n(?:Short website|Full website|What this puja|Common occasions|Important note|Trust-building|\d+\.\s+|$))",
                body,
                re.S | re.I,
            )
            return (mm.group(1).strip() if mm else "").strip()

        short = grab("Short website card copy")
        full = grab("Full website description")
        meaning = grab("What this puja represents:")
        if not meaning:
            mm = re.search(r"What this puja represents:\s*(.+)", body)
            meaning = mm.group(1).strip() if mm else ""
        occasions = ""
        mm = re.search(r"Common occasions:\s*(.+)", body)
        if mm:
            occasions = mm.group(1).strip()
        # Quick-guide row fallback
        out[_norm(title)] = {
            "title": title,
            "short": short,
            "full": full,
            "meaning": meaning,
            "occasions": occasions,
        }
    return out


def _parse_process_blocks(text: str) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    # Rituals always have Occasion: on the following line — do NOT split on
    # process step lines like "1. Deepa Prajwalana..." which also start with digit+capital.
    parts = re.split(r"\n(?=\d+\.\s+.+\nOccasion:)", text)
    for part in parts:
        raw = part.strip()
        m = re.match(r"(\d+)\.\s+(.+)", raw)
        if not m:
            continue
        title = m.group(2).split("\n")[0].strip()
        if len(title) > 90 or "Occasion:" not in raw:
            continue
        body = raw[m.end() :]
        occasion = _field(body, "Occasion")
        location = _field(body, "Location")
        priests = _field(body, "Required Priests")
        process_raw = ""
        pm = re.search(
            r"Process:\s*(?:\n)?(.+?)(?=\nB-Seva Recommended|\n\d+\.\s+.+\nOccasion:|$)",
            body,
            re.S | re.I,
        )
        if pm:
            process_raw = pm.group(1).strip()
        steps: list[dict[str, Any]] = []
        # Prefer splitting smashed inline steps: "1. foo.2. bar.3. baz"
        chunks = re.split(r"(?<=\.)(?=\d+\.)", process_raw)
        if len(chunks) <= 1:
            chunks = re.split(r"(?:^|\n)\s*(?=\d+\.\s+)", process_raw)
        for chunk in chunks:
            sm = re.match(r"(\d+)\.\s*(.+)", chunk.strip(), re.S)
            if not sm:
                continue
            step_text = re.sub(r"\s+", " ", sm.group(2)).strip(" .")
            if step_text:
                steps.append({"order": int(sm.group(1)), "text": step_text})
        priests_min, priests_max = _parse_priests(priests)
        homa = bool(re.search(r"homa|havan|agni", title + " " + process_raw, re.I))
        out[_norm(title)] = {
            "title": title,
            "occasion": occasion,
            "location": location,
            "priests_min": priests_min,
            "priests_max": priests_max,
            "steps": steps,
            "homa_included": homa,
        }
    return out


def _best_process_match(
    processes: dict[str, dict[str, Any]], names: list[str]
) -> dict[str, Any] | None:
    """Prefer exact / longest normalized key match over loose substring hits."""
    norms = [_norm(n) for n in names if n]
    # exact
    for n in norms:
        if n in processes and processes[n].get("steps"):
            return processes[n]
    # key contains name or name contains key — score by key length
    best: tuple[int, dict[str, Any]] | None = None
    for pk, pv in processes.items():
        if not pv.get("steps"):
            continue
        for n in norms:
            if not n:
                continue
            if n == pk or n in pk or pk in n:
                score = 1000 if n == pk else (500 if n in pk else 100) + len(pk)
                # prefer non-homa for plain "puja" names when both exist
                if "puja" in n and "homa" not in n and "homa" in pk:
                    score -= 50
                if best is None or score > best[0]:
                    best = (score, pv)
    return best[1] if best else None


def _field(body: str, label: str) -> str:
    m = re.search(rf"{label}:\s*(.+)", body)
    return m.group(1).strip() if m else ""


def _parse_priests(s: str) -> tuple[int | None, int | None]:
    nums = [int(x) for x in re.findall(r"\d+", s or "")]
    if not nums:
        return None, None
    if len(nums) == 1:
        return nums[0], nums[0]
    return min(nums), max(nums)


def _parse_samagri_blocks(text: str) -> dict[str, list[dict[str, str]]]:
    out: dict[str, list[dict[str, str]]] = {}
    parts = re.split(r"\n(?=\d+\.\s+)", text)
    for part in parts:
        m = re.match(r"(\d+)\.\s+(.+)", part.strip())
        if not m:
            continue
        title = m.group(2).split("\n")[0].strip()
        if "Recommended Base Quantity" not in part:
            continue
        qty_line = ""
        qm = re.search(r"Recommended Base Quantity[^:]*:\s*(.+)", part, re.S)
        if qm:
            qty_line = qm.group(1).split("\n")[0].strip()
        items = []
        for chunk in re.split(r",\s*", qty_line):
            chunk = chunk.strip().rstrip(".")
            if not chunk or len(chunk) < 3:
                continue
            # "Turmeric Powder (50g)" or "Matchbox"
            mm = re.match(r"^(.+?)\s*\(([^)]+)\)\s*$", chunk)
            if mm:
                items.append({"name": mm.group(1).strip(), "quantity": mm.group(2).strip(), "unit": ""})
            else:
                items.append({"name": chunk, "quantity": "1", "unit": "pc"})
        if items:
            out[_norm(title)] = items
    return out


def _load_reference_prices() -> dict[str, int]:
    """INR → paise from Research_100plus (B-Seva starting price if present) or Market Benchmark INR."""
    prices: dict[str, int] = {}
    path = SRC_DIR / "B-Seva_Puja_Pricing_Research_100plus.xlsx"
    if not path.exists():
        return prices
    try:
        import openpyxl
    except ImportError:
        return prices
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    if "B-Seva Puja Catalog" not in wb.sheetnames:
        return prices
    ws = wb["B-Seva Puja Catalog"]
    rows = ws.iter_rows(values_only=True)
    header = next(rows, None)
    if not header:
        return prices
    headers = [str(h or "").strip() for h in header]
    # Prefer a B-Seva suggested column if present
    name_i = next((i for i, h in enumerate(headers) if "puja" in h.lower() or "seva" in h.lower()), 0)
    price_i = None
    for prefer in ("b-seva", "suggested", "launch", "starting", "market benchmark inr", "benchmark"):
        for i, h in enumerate(headers):
            if prefer in h.lower():
                price_i = i
                break
        if price_i is not None:
            break
    if price_i is None:
        return prices
    for row in rows:
        if not row or row[name_i] is None:
            continue
        name = str(row[name_i]).strip()
        raw = row[price_i]
        try:
            inr = int(float(str(raw).replace(",", "").replace("₹", "").strip()))
        except Exception:
            continue
        if inr <= 0:
            continue
        prices[_norm(name)] = inr * 100
    return prices


def _resolve_slug(conn: Connection, key: str) -> str | None:
    if key in CONTENT_ALIASES:
        return CONTENT_ALIASES[key]
    row = conn.execute(
        text(
            """
            SELECT slug FROM services
            WHERE lower(slug) = :k
               OR lower(name) = :n
               OR search_aliases::text ILIKE :like
            LIMIT 1
            """
        ),
        {"k": key.replace(" ", "-"), "n": key, "like": f"%{key}%"},
    ).first()
    return row[0] if row else None


def _ensure_service(conn: Connection, slug: str, name: str) -> str:
    row = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
    if row:
        return str(row[0])
    sid = str(uuid4())
    conn.execute(
        text(
            """
            INSERT INTO services (
              id, name, slug, description, short_description, active, pricing_status,
              required_level, duration_minutes, display_order, category
            ) VALUES (
              CAST(:id AS uuid), :name, :slug, :desc, :short, FALSE, 'awaiting_pricing',
              1, 90, 500, 'puja'
            )
            """
        ),
        {
            "id": sid,
            "name": name,
            "slug": slug,
            "desc": name,
            "short": name,
        },
    )
    # Prefer leaving image null for brand-new services without a matching asset
    img_candidates = {
        "hanuman-puja": "/images/services/hanuman-jayanti.jpg",
        "saraswati-puja": "/images/services/saraswati-homam.jpg",
    }
    # Intentionally do NOT auto-assign mismatched festival images for new master pujas
    _ = img_candidates
    return sid


def _qty_numeric(qty: str) -> float:
    """quantity column is NUMERIC; keep display scales in qty_* text fields."""
    m = re.search(r"(\d+(?:\.\d+)?)", str(qty or ""))
    if not m:
        return 1.0
    try:
        return float(m.group(1))
    except ValueError:
        return 1.0


def _upsert_samagri(conn: Connection, service_id: str, items: list[dict[str, str]]) -> int:
    n = 0
    for i, it in enumerate(items):
        name = it["name"]
        qty = it.get("quantity") or "1"
        qnum = _qty_numeric(qty)
        # find or create samagri_items (match name or item_key to avoid unique violations)
        key = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")[:60] or "item"
        existing = conn.execute(
            text(
                """
                SELECT id FROM samagri_items
                WHERE lower(name) = lower(:n)
                   OR item_key = :key
                   OR lower(replace(coalesce(item_key,''), '_', ' ')) = lower(:n)
                LIMIT 1
                """
            ),
            {"n": name, "key": key},
        ).first()
        if existing:
            iid = str(existing[0])
        else:
            iid = str(uuid4())
            # ensure unique item_key if collision with different name
            base_key = key
            for suffix in range(0, 20):
                try_key = base_key if suffix == 0 else f"{base_key}_{suffix}"
                clash = conn.execute(
                    text("SELECT 1 FROM samagri_items WHERE item_key = :k LIMIT 1"),
                    {"k": try_key},
                ).first()
                if not clash:
                    key = try_key
                    break
            conn.execute(
                text(
                    """
                    INSERT INTO samagri_items (id, name, unit, active, item_key, default_unit)
                    VALUES (CAST(:id AS uuid), :name, :unit, TRUE, :key, :unit)
                    """
                ),
                {
                    "id": iid,
                    "name": name,
                    "unit": it.get("unit") or "pc",
                    "key": key,
                },
            )
        # link
        link = conn.execute(
            text(
                """
                SELECT id FROM service_samagri
                WHERE service_id = CAST(:sid AS uuid) AND samagri_item_id = CAST(:iid AS uuid)
                LIMIT 1
                """
            ),
            {"sid": service_id, "iid": iid},
        ).first()
        # scale text kept as documented qty; Admin can override per size
        med = qty
        large = qty
        grand = qty
        if link:
            conn.execute(
                text(
                    """
                    UPDATE service_samagri SET
                      quantity = :qnum, qty_small = :qtxt, qty_medium = :mtxt, qty_large = :ltxt, qty_grand = :gtxt,
                      sort_order = :ord, active = TRUE, provided_by = COALESCE(provided_by, 'bseva'),
                      unit = COALESCE(NULLIF(:unit,''), unit)
                    WHERE id = :id
                    """
                ),
                {
                    "qnum": qnum,
                    "qtxt": str(qty),
                    "mtxt": str(med),
                    "ltxt": str(large),
                    "gtxt": str(grand),
                    "ord": i,
                    "unit": it.get("unit") or "",
                    "id": link[0],
                },
            )
        else:
            conn.execute(
                text(
                    """
                    INSERT INTO service_samagri (
                      id, service_id, samagri_item_id, required, quantity, unit, sort_order,
                      provided_by, active, qty_small, qty_medium, qty_large, qty_grand
                    ) VALUES (
                      CAST(:id AS uuid), CAST(:sid AS uuid), CAST(:iid AS uuid), TRUE, :qnum, :unit, :ord,
                      'bseva', TRUE, :qtxt, :mtxt, :ltxt, :gtxt
                    )
                    """
                ),
                {
                    "id": str(uuid4()),
                    "sid": service_id,
                    "iid": iid,
                    "qnum": qnum,
                    "qtxt": str(qty),
                    "unit": it.get("unit") or "pc",
                    "ord": i,
                    "mtxt": str(med),
                    "ltxt": str(large),
                    "gtxt": str(grand),
                },
            )
        n += 1
    return n


def ensure_puja_catalog_import(conn: Connection) -> dict[str, Any]:
    report: dict[str, Any] = {
        "updated": [],
        "created": [],
        "featured": [],
        "samagri_links": 0,
        "prices_set": 0,
        "manual_review": [],
    }
    top_text = _read("The_10_Most_Popular_Pujas_to_Feature_on_BSeva.txt")
    proc_text = _read("B-Seva_Puja_Processes_Guidelines_For_All_Pujas.txt")
    sam_text = _read("B-Seva_Samagri_Expanded.txt")
    cards = _parse_top10_cards(top_text)
    processes = _parse_process_blocks(proc_text)
    samagri = _parse_samagri_blocks(sam_text)
    ref_prices = _load_reference_prices()

    # Clear featured flags then apply Top-10
    conn.execute(text("UPDATE services SET is_featured_home = FALSE, homepage_rank = NULL WHERE is_featured_home = TRUE"))

    for rank, slug, display_name, aliases in TOP10:
        existed = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
        sid = _ensure_service(conn, slug, display_name if not existed else display_name)
        if not existed and slug in ("hanuman-puja", "saraswati-puja"):
            report["created"].append(slug)
            report["manual_review"].append(f"{slug}: new service — assign dedicated image in Admin")

        # Match card content
        card = None
        for ak, val in cards.items():
            if any(a in ak or ak in a for a in [_norm(display_name), *[ _norm(x) for x in aliases]]):
                card = val
                break
        if not card:
            # try by first alias token
            for ak, val in cards.items():
                if _norm(display_name).split()[0] in ak:
                    card = val
                    break

        short = (card or {}).get("short") or ""
        full = (card or {}).get("full") or ""
        meaning = (card or {}).get("meaning") or ""
        occasions = (card or {}).get("occasions") or ""

        # Process match — prefer documented aliases / exact keys
        preferred_proc_keys = {
            "ganapathi-puja": ["ganapathi chaturthi puja", "ganesh chaturthi puja"],
            "lakshmi-puja": ["diwali lakshmi kubera puja", "varalakshmi vrata puja"],
            "satyanarayana-puja": ["sri satyanarayan swamy puja", "satyanarayan puja with homa"],
            "rudrabhishekam": ["rudrabhishek", "rudrabhishekam"],
            "navaratri-durga-puja": ["navratri durga ashtami homa", "durga saptashati path"],
            "hanuman-puja": ["hanuman chalisa 108 avarti"],
            "navagraha-shanti": ["navagraha shanti homa"],
            "maha-mrityunjaya-puja": ["maha mrityunjaya homa"],
            "saraswati-puja": ["saraswati puja"],
            "griha-pravesham": ["griha pravesh basic", "griha pravesh with vastu homa"],
        }.get(slug, [])
        proc = None
        for pk in preferred_proc_keys:
            if pk in processes and processes[pk].get("steps"):
                proc = processes[pk]
                break
        if not proc:
            proc = _best_process_match(processes, aliases + [display_name])
        # Samagri match
        preferred_sam_keys = {
            "ganapathi-puja": ["ganapathi chaturthi puja", "maha ganapathi homa"],
            "lakshmi-puja": ["diwali lakshmi kubera puja", "varalakshmi vrata puja", "vaibhav lakshmi vrata"],
            "satyanarayana-puja": ["sri satyanarayan swamy puja", "satyanarayan puja with homa"],
            "rudrabhishekam": ["rudrabhishek", "maha rudrabhishek with homa"],
            "navaratri-durga-puja": ["navratri durga ashtami homa", "durga saptashati path"],
            "hanuman-puja": ["hanuman chalisa 108 avarti"],
            "navagraha-shanti": ["navagraha shanti homa"],
            "maha-mrityunjaya-puja": ["maha mrityunjaya homa"],
            "saraswati-puja": ["saraswati puja"],
            "griha-pravesham": ["griha pravesh basic", "griha pravesh with vastu homa"],
        }.get(slug, [])
        sam_items = None
        for sk in preferred_sam_keys:
            if sk in samagri:
                sam_items = samagri[sk]
                break
        if not sam_items:
            for sk, sv in samagri.items():
                if any(_norm(a) in sk or sk in _norm(a) for a in aliases + [display_name]):
                    sam_items = sv
                    break
        if not sam_items:
            for sk, sv in samagri.items():
                if any(a in sk for a in [_norm(x) for x in aliases + [display_name]]):
                    sam_items = sv
                    break

        deity = {
            "ganapathi-puja": "Lord Ganesha",
            "lakshmi-puja": "Goddess Lakshmi",
            "satyanarayana-puja": "Lord Satyanarayana (Vishnu)",
            "rudrabhishekam": "Lord Shiva",
            "navaratri-durga-puja": "Goddess Durga",
            "hanuman-puja": "Lord Hanuman",
            "navagraha-shanti": "Navagraha",
            "maha-mrityunjaya-puja": "Lord Shiva (Maha Mrityunjaya)",
            "saraswati-puja": "Goddess Saraswati",
            "griha-pravesham": "Home deities / Vastu",
        }.get(slug)

        steps = (proc or {}).get("steps") or []
        conn.execute(
            text(
                """
                UPDATE services SET
                  short_description = COALESCE(NULLIF(:short,''), short_description),
                  full_description = COALESCE(NULLIF(:full,''), full_description),
                  description = COALESCE(NULLIF(:short,''), description),
                  spiritual_meaning = COALESCE(NULLIF(:meaning,''), spiritual_meaning),
                  common_occasions = COALESCE(NULLIF(:occasions,''), common_occasions),
                  deity = COALESCE(:deity, deity),
                  location_notes = COALESCE(NULLIF(:loc,''), location_notes),
                  priests_min = COALESCE(:pmin, priests_min),
                  priests_max = COALESCE(:pmax, priests_max),
                  pujaris_required = COALESCE(:pmin, pujaris_required),
                  process_steps = CAST(:steps AS jsonb),
                  homa_included = COALESCE(:homa, homa_included),
                  prasadam_included = TRUE,
                  sankalpa_required = TRUE,
                  languages = CAST(:langs AS jsonb),
                  search_aliases = CAST(:aliases AS jsonb),
                  is_featured_home = TRUE,
                  is_popular = TRUE,
                  homepage_rank = :rank,
                  display_order = :rank,
                  updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                """
            ),
            {
                "id": sid,
                "short": short,
                "full": full,
                "meaning": meaning,
                "occasions": occasions,
                "deity": deity,
                "loc": (proc or {}).get("location") or "",
                "pmin": (proc or {}).get("priests_min"),
                "pmax": (proc or {}).get("priests_max"),
                "steps": json.dumps(steps),
                "homa": bool((proc or {}).get("homa_included")),
                "langs": json.dumps(["en", "hi", "te"]),
                "aliases": json.dumps(list({*aliases, display_name})),
                "rank": rank,
            },
        )
        # English translation row
        conn.execute(
            text(
                """
                INSERT INTO service_translations (
                  service_id, language_code, short_description, full_description,
                  spiritual_meaning, common_occasions
                ) VALUES (
                  CAST(:id AS uuid), 'en', :short, :full, :meaning, :occasions
                )
                ON CONFLICT (service_id, language_code) DO UPDATE SET
                  short_description = EXCLUDED.short_description,
                  full_description = EXCLUDED.full_description,
                  spiritual_meaning = EXCLUDED.spiritual_meaning,
                  common_occasions = EXCLUDED.common_occasions,
                  updated_at = NOW()
                """
            ),
            {"id": sid, "short": short, "full": full, "meaning": meaning, "occasions": occasions},
        )
        # slug aliases
        for a in ("durga-puja",) if slug == "navaratri-durga-puja" else ():
            conn.execute(
                text(
                    """
                    INSERT INTO service_slug_aliases (alias_slug, service_id)
                    VALUES (:a, CAST(:id AS uuid))
                    ON CONFLICT (alias_slug) DO UPDATE SET service_id = EXCLUDED.service_id
                    """
                ),
                {"a": a, "id": sid},
            )
        if sam_items:
            report["samagri_links"] += _upsert_samagri(conn, sid, sam_items)
            conn.execute(
                text(
                    """
                    UPDATE services SET samagri_review_status = 'VERIFIED',
                      samagri_last_reviewed_at = NOW(), samagri_available = TRUE
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {"id": sid},
            )
        report["updated"].append(slug)
        report["featured"].append({"rank": rank, "slug": slug})

    # Apply process + samagri to other matched catalog services (content only)
    for key, proc in processes.items():
        slug = CONTENT_ALIASES.get(key) or _resolve_slug(conn, key)
        if not slug:
            continue
        row = conn.execute(
            text("SELECT id, process_steps FROM services WHERE slug = :s"),
            {"s": slug},
        ).mappings().first()
        if not row:
            continue
        steps = proc.get("steps") or []
        if steps:
            conn.execute(
                text(
                    """
                    UPDATE services SET
                      process_steps = CASE
                        WHEN process_steps IS NULL OR process_steps = '[]'::jsonb
                        THEN CAST(:steps AS jsonb) ELSE process_steps END,
                      location_notes = COALESCE(NULLIF(location_notes,''), :loc),
                      priests_min = COALESCE(priests_min, :pmin),
                      priests_max = COALESCE(priests_max, :pmax),
                      homa_included = CASE
                        WHEN process_steps IS NULL OR process_steps = '[]'::jsonb
                        THEN :homa ELSE homa_included END,
                      updated_at = NOW()
                    WHERE id = CAST(:id AS uuid)
                    """
                ),
                {
                    "id": str(row["id"]),
                    "steps": json.dumps(steps),
                    "loc": proc.get("location") or "",
                    "pmin": proc.get("priests_min"),
                    "pmax": proc.get("priests_max"),
                    "homa": bool(proc.get("homa_included")),
                },
            )

    for key, items in samagri.items():
        slug = CONTENT_ALIASES.get(key) or _resolve_slug(conn, key)
        if not slug:
            continue
        row = conn.execute(text("SELECT id FROM services WHERE slug = :s"), {"s": slug}).first()
        if not row:
            continue
        # Only fill if service has few/no samagri links
        cnt = conn.execute(
            text("SELECT COUNT(*) FROM service_samagri WHERE service_id = CAST(:id AS uuid) AND active = TRUE"),
            {"id": str(row[0])},
        ).scalar() or 0
        if int(cnt) < 3:
            report["samagri_links"] += _upsert_samagri(conn, str(row[0]), items)

    # Reference pricing for awaiting_pricing only
    for key, paise in ref_prices.items():
        slug = CONTENT_ALIASES.get(key)
        if not slug:
            # fuzzy by normalized name
            row = conn.execute(
                text(
                    """
                    SELECT id, slug, pricing_status, standard_price_paise, active
                    FROM services
                    WHERE lower(regexp_replace(name, '[^a-zA-Z0-9]+', ' ', 'g')) LIKE :pat
                    LIMIT 1
                    """
                ),
                {"pat": f"%{key[:40]}%"},
            ).mappings().first()
        else:
            row = conn.execute(
                text(
                    """
                    SELECT id, slug, pricing_status, standard_price_paise, active
                    FROM services WHERE slug = :s
                    """
                ),
                {"s": slug},
            ).mappings().first()
        if not row:
            continue
        if row["pricing_status"] == "priced" and row["standard_price_paise"] is not None:
            continue
        if row["pricing_status"] != "awaiting_pricing" and row["standard_price_paise"] is not None:
            continue
        conn.execute(
            text(
                """
                UPDATE services SET
                  main_puja_price_paise = COALESCE(main_puja_price_paise, :p),
                  standard_price_paise = COALESCE(standard_price_paise, :p),
                  basic_price_paise = COALESCE(basic_price_paise, :basic),
                  premium_price_paise = COALESCE(premium_price_paise, :prem),
                  updated_at = NOW()
                WHERE id = CAST(:id AS uuid)
                  AND (pricing_status = 'awaiting_pricing' OR standard_price_paise IS NULL)
                """
            ),
            {
                "id": str(row["id"]),
                "p": paise,
                "basic": int(paise * 0.85),
                "prem": int(paise * 1.35),
            },
        )
        report["prices_set"] += 1

    return report
