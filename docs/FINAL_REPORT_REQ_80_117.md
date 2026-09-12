# Final Report — Requirements #80–#117 (updated)

| # | Classification | Status | What Changed | Files/Modules | DB/API Change | Testing |
| - | -------------- | ------ | ------------ | ------------- | ------------- | ------- |
| 80 | 🐛 | ✅ Completed | Transparent logo | Layout | No | Visual |
| 81 | 🔧 | ✅ Completed | Removed `#F7931E`; theme `primary` | client src | No | Visual |
| 82 | ⚙️ | ✅ Completed | Satyanarayana food + wizard | catalog_seed, BookingWizard | Seed | Book flow |
| 83 | 🐛 | ✅ Completed | Food on review bill | BookingWizard | No | Review step |
| 84 | 🔧 | 🟡 Partially | Core customer keys; admin still mostly EN | translations | No | i18n smoke |
| 85 | ⚙️ | ✅ Completed | Defaults + quote fallback | pricing, Settings | settings | Quote |
| 86 | 🆕 | 🟡 Partially | users/pujaris/bookings paginated | admin, bookings | page/page_size | Admin lists |
| 87 | ✅ | ✅ Completed | Existing | Settings | Existing | — |
| 88 | 🔧 | ✅ Completed | Muhurtham labels | Astrology, MuhurtaConsultationBook | No | Labels |
| 89 | 🆕 | ✅ Completed | Admin Promos CMS + carousel | PromosAdmin, promos.py | promo_banners | Create banner |
| 90–91 | 🔧 | ✅ Completed | Allowlist enforced on nearby/public | booking_visibility, domain | No | Public API |
| 92 | ✅ | ✅ Completed | Single accept | lifecycle | Existing | Accept |
| 93 | 🔧 | ✅ Completed | GPS + manual address + map link | BookingWizard | No | Book location |
| 94–96 | 🆕 | ✅ Completed | Licence KYC | pujari, onboarding | licence_* | Submit |
| 97 | 🔧 | ✅ Completed | Cancel bands + preview | Settings, BookingDetail | Existing | Cancel |
| 98 | 🔧 | ✅ Completed | Block/Suspend not Delete | Customers, Pujaris | No | Admin |
| 99 | 🆕 | 🟡 Partially | Event notifications + reminder job + API | notifications.py, jobs | link col | Manual job |
| 100 | 🆕 | ✅ Completed | Ops/KYC notifs + Admin inbox UI | Notifications.tsx | categories | Inbox |
| 101–102 | 🔌 | 🔌 External | Config complete; provider pending | Settings | settings | Config |
| 103 | 🆕 | ✅ Completed | Popups CMS + 7-day frequency | SeasonalPopup, PromosAdmin | seasonal_popups | Create popup |
| 104 | 🆕 | ✅ Completed | Sponsored/third-party flag + UI | PromosAdmin, carousel | advertiser | Banner |
| 105 | 🔧 | ✅ Completed | physical/temple/virtual | BookingWizard | mode temple | Book |
| 106 | 🔌 | 🔌 External | Schema + contract doc | consultations, docs | session cols | Config |
| 107–108 | 🆕 | ✅ Completed | In-app chat queue + reply + poll | Support admin/customer | support_* | Chat |
| 109 | 🔧 | ✅ Completed | Login terminology | Login, gate, i18n | No | Auth |
| 110 | 🔧 | ✅ Completed | Register only via `/register` | RolePortalGate | No | Register |
| 111 | 🐛 | ✅ Completed | Pujari flow hides toggle | Register | No | Register |
| 112 | 🆕 | ✅ Completed | Script load + server verify + env | Register, auth | env | Enable flag |
| 113 | 🔧 | ✅ Completed | Upgrade UI removed; API 403 | ServicesPage, pujari | API | 403 |
| 114 | 🔧 | ✅ Completed | Dakshina labels | Earnings, Dashboard | No | UI |
| 115 | 🐛 | ✅ Completed | Name mask bookings + muhurta | booking_visibility, consultations | No | Pujari view |
| 116 | 🔧 | ✅ Completed | Map link for assigned pujari | BookingDetailPanel | No | Map |
| 117 | 🔧 | ✅ Completed | Master specs + synonym merge | pujariSpecializations | No | Onboarding |

## 1. Schema / migrations
Run: `cd backend && python3 -c "from app.schema_migrate import ensure_schema; ensure_schema()"`

Adds/ensures: `basic_price_paise`, `licence_*`, notification `is_read/category/user_id/link`, `promo_banners` (+subtitle/advertiser), `seasonal_popups`, `support_*`, muhurta `consultation_type/provider_session_id/join_status`.

## 2. Environment variables
- `RECAPTCHA_SECRET_KEY`, `RECAPTCHA_SITE_KEY` / `VITE_RECAPTCHA_SITE_KEY`
- Documented in `backend/.env.example` and `bseva-export/.env.example`

## 3. Cron / jobs
```bash
python3 -c "from app.jobs.booking_reminders import send_upcoming_booking_reminders; print(send_upcoming_booking_reminders())"
```
Safe to re-run (36h dedupe by booking number). Schedule every 15–30 minutes.

## 4. Provider integrations still pending
See `docs/EXTERNAL_INTEGRATIONS_101_106.md` — telephony + RTC adapters.

## 5. Known limitations
- Full #84 coverage of every admin English string not finished
- #86: settlements/tickets/services lists not all paginated yet
- #99: requires cron; no push/SMS channel for reminders
- Schema migrate needs live `DATABASE_URL` (not runnable in this sandbox without DB)
- No Playwright E2E executed in this environment (no app server/DB)

## 6. Untranslated customer strings (source translations unavailable / deferred)
Many admin-only screens remain English-only by design priority. Customer-facing leftovers still often hardcode EN descriptions inside BookingWizard tier feature bullets and some toast messages — add `t()` keys when product provides hi/te copy.
