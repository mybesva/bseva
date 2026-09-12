# Puja Catalog Implementation Report

**Date:** 2026-09-12  
**Sources:** `docs/puja_sources/` (+ audit `docs/PUJA_CATALOG_IMPORT_AUDIT.md`)

## Migrations created

| Module | Change |
|--------|--------|
| `backend/app/phase6_puja_master_migrate.py` | Columns on `services`: spiritual_meaning, common_occasions, deity, tradition/location notes, priests_min/max, process_steps JSONB, homa/prasadam/sankalpa flags, languages JSONB, online_nri_price_paise, admin_notes, whats_included |
| same | `service_samagri`: qty_small/medium/large/grand, scale_override |
| same | Tables: `service_translations` (lang overlay, no row dup), `service_gallery_images` |
| `backend/app/schema_migrate.py` | Wires Phase 6 + runs `ensure_puja_catalog_import` in a savepoint |
| `backend/app/puja_catalog_import.py` | Idempotent import from Top-10 / process / samagri docs + reference prices |

Applied successfully against the live DB via `ensure_schema` / direct Phase 6 + import.

## Records added / updated

| Action | Count / detail |
|--------|----------------|
| **Created** | `hanuman-puja`, `saraswati-puja` (stable new UUIDs) |
| **Updated (Top 10 content)** | ganapathi-puja, lakshmi-puja, satyanarayana-puja, rudrabhishekam, navaratri-durga-puja, hanuman-puja, navagraha-shanti, maha-mrityunjaya-puja, saraswati-puja, griha-pravesham |
| **Total services** | **80** (was 78) |
| **Samagri links** | ~200+ structured rows linked for matched pujas |
| **EN translations** | 10 Top Pujas seeded in `service_translations` |
| **Reference prices set** | Only where `awaiting_pricing` / safe fill (~17–18); **priced production rows unchanged** |

### Production prices preserved (`pricing_status=priced`)

| Slug | Standard (paise) |
|------|-----------------:|
| ganapathi-puja | 250000 |
| satyanarayana-puja | 350000 |
| griha-pravesham | 750000 |
| marriage-ceremony | 2500000 |
| vehicle-puja | 150000 |

## Alias / duplicate mappings

| Alias / variant | Canonical slug |
|-----------------|----------------|
| Ganesh / Ganapati / Vighneshwara | `ganapathi-puja` |
| Satyanarayan / Sri Satyanarayan Swamy | `satyanarayana-puja` |
| Rudrabhishek / Rudrabhishekam / Shiva Puja | `rudrabhishekam` |
| Durga / Navaratri Durga (+ slug alias `durga-puja`) | `navaratri-durga-puja` |
| Navagraha Puja / Shanti | `navagraha-shanti` |
| Maha Mrityunjaya (puja content; homa process from doc) | `maha-mrityunjaya-puja` |
| Griha Pravesh / Gruha Pravesam | `griha-pravesham` |
| Hanuman Chalisa 108 (process) | `hanuman-puja` (new) |
| Saraswati Puja | `saraswati-puja` (new; distinct from `saraswati-homam`) |

## Top 10 seeded (Admin-configurable, not hard-coded in UI)

Home uses `GET /services?featured=1` ordered by `homepage_rank`.

| Rank | Slug | Process steps | Samagri items | Image |
|-----:|------|--------------:|--------------:|-------|
| 1 | ganapathi-puja | 6 | 27 | reused |
| 2 | lakshmi-puja | 6 | 14+ (from Diwali Lakshmi Kubera list) | reused |
| 3 | satyanarayana-puja | 6 | 34 | reused |
| 4 | rudrabhishekam | 6 | 35 | reused |
| 5 | navaratri-durga-puja | 7 | 20 | reused |
| 6 | hanuman-puja | 6 | 14 | **missing** |
| 7 | navagraha-shanti | 7 | 43 | reused |
| 8 | maha-mrityunjaya-puja | 7 | 20 | reused |
| 9 | saraswati-puja | 6 | 14 | **missing** |
| 10 | griha-pravesham | 6 | 39 | reused |

Unfeatured from Home (services kept): marriage-ceremony, vehicle-puja, ganapathi-homam, lakshmi-kubera-puja, vastu-shanti.

## Images reused / missing

- **Reused** slug-matched `/images/services/{slug}.jpg` for existing Top Pujas.
- **Not auto-assigned** (avoid wrong festival art): `hanuman-puja`, `saraswati-puja` — Admin upload required.
- Gallery table ready; no gallery rows seeded.

## APIs added / changed

| API | Change |
|-----|--------|
| `GET /services`, `GET /services/{slug}` | Optional `lang=` overlays `service_translations` |
| Admin create/update service | Full master fields + EN translation upsert |
| Availability toggle | Featured may be Coming Soon |
| `POST .../samagri` | qty_small/medium/large/grand + scale_override |
| Catalog enrich | Parses `process_steps` / `languages` JSON |

## Admin screens changed

- `ServicesAdmin.tsx`: tabbed editor — Basic, Content, Process, Images, Pricing, Featured, Samagri, Advanced (admin notes, NRI price, tradition, what’s included, process steps, featured rank).
- Samagri link UI shows scale qty hints; structured items remain Admin-editable via existing samagri APIs.

## Customer screens changed

- `Home.tsx`: featured list from API + `lang`.
- `ServiceDetail.tsx`: meaning, occasions, what’s included, tradition, priests range, process steps, language, flags; prep + detail fetch with preferred UI language.

## Manual review needed

1. **Upload images** for `hanuman-puja` and `saraswati-puja`.
2. **Lakshmi Puja samagri** — seeded from Diwali Lakshmi Kubera list when exact “Lakshmi Puja” block is absent; Admin may refine.
3. **Lakshmi / Navagraha / Maha Mrityunjaya** still `awaiting_pricing` (no production overwrite) — Admin to confirm activate prices.
4. **Process templates** in the source doc are often similar across rituals — imported as written; refine per puja in Admin (do not invent steps).
5. **Competitor columns** in Excel sheets were never stored for customers.
6. **hi/te translations** — schema ready; fill via Admin / future translation tooling (EN seeded).
7. **Gallery images** — optional multi-image upload UI not fully built; table exists for Admin extension.
8. **Drag-reorder featured** — rank editable numerically; true DnD can be added later if desired.

## Safety

- Existing bookings / invoices / payments / pujari assignment untouched.
- No duplicate service rows for languages.
- Import is idempotent and match-by-slug/alias.
