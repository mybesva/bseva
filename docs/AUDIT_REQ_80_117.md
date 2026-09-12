# BSeva Requirements Audit #80–#117 (updated)

| # | Requirement | Current State | Classification | Screens/API/DB Affected | Required Change |
| - | ----------- | ------------- | -------------- | ----------------------- | --------------- |
| 80 | Logo | Transparent logo in Layout | ✅ Done | Layout | — |
| 81 | Theme | `#F7931E` removed from client src; uses `primary` | ✅ Done | BookingWizard, admin templates, Wallet | — |
| 82–83 | Food/Samagri/Alankaram | Wizard + review bill + ServiceDetail | ✅ Done | BookingWizard, Book | — |
| 84 | Localization | en/hi/te; customer core keys; many admin pages still EN | 🟡 Partial | translations, pages | More admin/customer strings |
| 85 | Packages 2499/3499/4499 | Defaults via settings + quote fallback | ✅ Done | pricing, Settings, ServicesAdmin | Admin set per service |
| 86 | Pagination | bookings, users, pujaris paginated | 🟡 Partial | admin lists | settlements/tickets/services |
| 87 | Consultation config | Done | ✅ Done | Settings | — |
| 88 | Muhurtham | UI labels standardized | ✅ Done | Astrology, MuhurtaConsultationBook | — |
| 89 | Promo banners | Admin CMS + carousel + API | ✅ Done | PromosAdmin, PromoBannerCarousel | Seed banners in Admin |
| 90–91 | Pujari privacy | `public_pujari()` on nearby + public profile | ✅ Done | domain, bookings | Documented allowlist |
| 92 | Accept workflow | Single assignee | ✅ Done | lifecycle | — |
| 93 | Location | GPS button + manual address; map for pujari | ✅ Done | BookingWizard, BookingDetailPanel | Maps key optional |
| 94–96 | KYC licence | Done | ✅ Done | onboarding | — |
| 97–98 | Cancel / Delete | Done | ✅ Done | Settings, Customers | — |
| 99 | Pujari notifications | Event inserts + reminder job + API inbox | 🟡 Partial | notifications, jobs | Cron schedule |
| 100 | Super Admin notifs | Ops/KYC categories + Admin Notifications UI | ✅ Done | Notifications.tsx | Cron for reminders |
| 101–102 | Call forwarding | Config only | 🔌 External | Settings | Provider adapter |
| 103–104 | Popups / 3P ads | Admin CMS + 7-day frequency + Sponsored | ✅ Done | PromosAdmin, SeasonalPopup | — |
| 105 | Virtual/temple modes | Done | ✅ Done | BookingWizard | — |
| 106 | Voice/video | Schema fields + contract doc | 🔌 External | consultations | RTC adapter |
| 107–108 | Support chat | Customer start + Admin queue/reply/resolve + poll | ✅ Done | Support pages, support.py | No external vendor |
| 109 | Login term | Login used | ✅ Done | Login, RolePortalGate, i18n | — |
| 110 | Register cleanup | Single `/register`; gate login-only | ✅ Done | RolePortalGate | — |
| 111–117 | See final report | Mostly done | ✅ / 🟡 | various | — |

## Customer-visible Pujari fields (allowlist)

From `PUBLIC_PUJARI_KEYS` + ratings on public profile:

- `id`, `name`, `approved_level`, `verification_status`, `available`
- `location_label`, `city`, `distance_km`
- `experience_years`, `languages`, `specializations`
- `avg_stars`, `rating_count` (public profile only)

**Not returned:** phone, email, Aadhaar/docs, bank, gotra/sampradaya/district/state, `service_radius_km`, internal notes, payouts.
