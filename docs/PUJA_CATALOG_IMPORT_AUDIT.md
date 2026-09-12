# Puja Catalog Import — Pre-Implementation Audit

**Date:** 2026-09-12  
**Sources:** `docs/puja_sources/`

## Source files

| # | File | Status |
|---|------|--------|
| 1 | The_10_Most_Popular_Pujas…docx | Ready (+ txt) |
| 2 | B-Seva_Samagri_Expanded.docx | Ready (closest to “Comprehensive Samagri…”) |
| 3 | B-Seva_Puja_Processes_Guidelines…docx | Ready (+ txt) |
| 4 | BSeva_Puja_Pricing_Analysis_One.xlsx | Ready |
| 5 | Comprehensive Puja Pricing & Market Benchmark.xlsx | Ready (competitor cols — **not** shown to customers) |
| 6 | B-Seva_Puja_Pricing_Research_100plus.xlsx | Ready (reference INR only) |

## Current DB (live)

| Metric | Count |
|--------|------:|
| Total services | **78** |
| Active + priced (bookable) | **5** |
| Featured home | **10** (seed ranks; includes Marriage/Vehicle) |
| Awaiting pricing / inactive | ~73 |
| Public images `/images/services/{slug}.jpg` | **78** |

### Already supported
Name, slug, categories, short/full description, benefits, duration, pujaris_required, package prices (basic/standard/premium), main/samagri/alankaram/food prices + providers, image_url/path, featured/popular/seasonal, homepage_rank, display_order, search_aliases, slug aliases, structured `service_samagri`, prep content en/hi/te.

### Schema gaps vs required full master
| Field | Plan |
|-------|------|
| spiritual_meaning, common_occasions, deity, tradition_notes, location_notes | ADD columns on `services` |
| priests_min / priests_max | ADD (keep `pujaris_required`) |
| process_steps JSONB ordered | ADD |
| samagri scale qty S/M/L/G | ADD on `service_samagri` |
| homa_included, prasadam_included, sankalpa_required | ADD booleans |
| languages JSONB | ADD |
| online_nri_price_paise | ADD |
| admin_notes | ADD |
| gallery | NEW `service_gallery_images` |
| marketing i18n without row dup | NEW `service_translations` (lang → short/full/meaning/occasions) |

## Top-10 document → existing match

| Rank | Doc name | Match | Action |
|-----:|----------|-------|--------|
| 1 | Ganesh Puja | `ganapathi-puja` | UPDATE content; keep ID; feature rank 1 |
| 2 | Lakshmi Puja | `lakshmi-puja` | UPDATE; feature rank 2 (replace current #9 kubera as featured) |
| 3 | Satyanarayan Puja | `satyanarayana-puja` | UPDATE; rank 3 |
| 4 | Rudrabhishek / Shiva | `rudrabhishekam` | UPDATE; rank 4 |
| 5 | Durga Puja | `navaratri-durga-puja` | UPDATE + alias `durga-puja`; rank 5 |
| 6 | Hanuman Puja | **no exact** (`hanuman-jayanti` exists) | CREATE `hanuman-puja` OR alias jayanti → prefer **new** `hanuman-puja` with alias; reuse image if present |
| 7 | Navagraha Shanti | `navagraha-shanti` | UPDATE; rank 7 |
| 8 | Maha Mrityunjaya | `maha-mrityunjaya-puja` | UPDATE; rank 8 |
| 9 | Saraswati Puja | **no exact** (`saraswati-homam` exists) | CREATE `saraswati-puja` |
| 10 | Griha Pravesh | `griha-pravesham` | UPDATE; rank 10 |

**Unfeature from homepage (keep services):** `marriage-ceremony`, `vehicle-puja`, `ganapathi-homam`, `lakshmi-kubera-puja`, `vastu-shanti` (unless Admin re-features later).

## Alias / duplicate map

| Alias / variant | Canonical slug |
|-----------------|----------------|
| Ganesh / Ganapati / Vighneshwara Puja | ganapathi-puja |
| Sri Satyanarayan Swamy / Satyanarayana | satyanarayana-puja |
| Rudrabhishek / Rudrabhishekam / Shiva Puja | rudrabhishekam |
| Griha Pravesh / Gruha Pravesam / Griha Pravesham | griha-pravesham |
| Navagraha Puja / Navagraha Shanti | navagraha-shanti |
| Maha Mrityunjaya Homa (samagri) | maha-mrityunjaya-homam (samagri) + puja content on maha-mrityunjaya-puja |
| Durga / Navaratri Durga | navaratri-durga-puja |

## Pricing policy

- **Do not overwrite** services with `pricing_status='priced'` and non-null production prices (current 5 bookable).
- For `awaiting_pricing`: set **reference** `main_puja_price_paise` / standard from Research_100plus / Analysis_One when name matches; leave inactive until Admin activates.
- **Never** store/expose competitor columns (GoPooja/SmartPuja/etc.) to customers.

## Images

- Reuse `/images/services/{slug}.jpg` when slug matches.
- New `hanuman-puja` / `saraswati-puja`: use existing stem if file exists (`hanuman-jayanti.jpg`, `saraswati-homam.jpg` only as **fallback** if visually ok — prefer leave upload-ready if wrong). Prefer: copy only if ATTRIBUTION has matching name; else leave null for Admin upload.

## Admin / API / Customer changes

| Area | Change |
|------|--------|
| Migration | `phase6_puja_master_migrate.py` + wire in `ensure_schema` |
| Import | `backend/app/puja_catalog_import.py` + seed hook |
| API | Extend `ServiceIn` / enrich_service; gallery CRUD; process_steps; translations |
| Admin | Tabbed ServicesAdmin editor |
| Customer | ServiceDetail shows new fields; Home stays `GET /services?featured=1` |

## Risk controls

- Preserve service UUIDs on match
- Soft-deactivate only; never DELETE booked services
- Import only documented process/samagri (no invented rituals)
- Intention-based language (no guaranteed outcomes)
