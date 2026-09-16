# BSeva Web → Mobile feature parity

Source of truth: working web app in `bseva-export/` plus FastAPI `backend/`.  
Apps: `apps/mobile` (Customer + Pujari) and `apps/admin-mobile` (Admin + Super Admin).

Statuses: **DONE** · **PARTIAL** · **NOT APPLICABLE** · **BLOCKED**

Android and iOS share the same React Native screens. Native Firebase client files exist for Customer/Pujari (`com.bseva.app`). Admin (`com.bseva.admin`) FCM is coded but needs a second Firebase Android/iOS app (manual).

---

## Customer

| Web route | Web feature | Role | Mobile screen | Android | iOS | API | Shared logic | Notes |
|---|---|---|---|---|---|---|---|---|
| `/login` | Password login | all | `app/login.tsx` | DONE | DONE | `POST /auth/login` | `@bseva/validation` loginSchema, api-client | Role from `GET /auth/me` only |
| `/register` | Register + OTP + consent | customer/pujari | `app/register.tsx` | DONE | DONE | `/auth/otp/request`, `/auth/register` | registerSchema, locales | 6 preferred languages; legal links |
| `/terms` | Platform / booking / cancel terms | public | `app/legal/[slug].tsx` | DONE | DONE | `GET /legal/{slug}` | api-client.legal | `platform_terms` |
| `/privacy` | Privacy policy | public | `app/legal/privacy` | DONE | DONE | `GET /legal/privacy` | api-client.legal | |
| `/` | Marketing home | public | `app/index.tsx` | PARTIAL | PARTIAL | `/services?featured=1` | locales | Native landing, not a WebView of marketing site |
| `/services` | Catalog search/filter | public | `browse-services.tsx`, `customer/(tabs)/services.tsx` | DONE | DONE | `/services`, `/service-categories` | api-client | |
| `/services/:slug` | Puja details | public | `app/service/[slug].tsx` | DONE | DONE | `/services/{slug}` | types.CatalogService | |
| `/book/:slug` | Booking wizard | customer | `app/customer/book/[slug].tsx` | PARTIAL | PARTIAL | `/quote`, `/bookings`, `/panchang`, `/bookings/virtual-precheck` | quote + booking models | basic/standard/premium, samagri/alankaram/food, virtual country; map pin / recurring selected_dates thinner than web |
| `/astrology` | Muhurtham / astrology | customer | `app/customer/astrology.tsx` | PARTIAL | PARTIAL | `/astrology/services`, `/muhurta-consultations` | api-client | List + book; not identical to web MuhurtaConsultationBook widget |
| `/customer` | Dashboard, wallet, recs, panchang | customer | `customer/(tabs)/index.tsx` | DONE | DONE | bookings, wallet, recommendations, panchang, promos | locales, rupees | Promo banners + start-OTP on booking detail |
| `/customer/profile` | Profile + photo | customer | `customer/profile.tsx` | DONE | DONE | `/customer/profile`, photo upload | validation | |
| `/customer/address` | Address + geo | customer | `customer/address.tsx` | DONE | DONE | profile PATCH | addressSchema | |
| `/customer/wallet` | Balance, load, txns | customer | `customer/(tabs)/wallet.tsx` | DONE | DONE | `/wallet`, `/wallet/load` | walletLoadSchema | Wallet is the live payment rail |
| `/customer/bookings` | Booking list | customer | `customer/(tabs)/bookings.tsx` | DONE | DONE | `GET /bookings` | api-client.listBookings | |
| `/customer/notifications` | Inbox | customer | `customer/notifications.tsx` | DONE | DONE | `/notifications*` | mapNotificationLinkToMobile | |
| `/customer/history` | History | customer | `customer/history.tsx` | DONE | DONE | `/bookings` | | |
| `/customer/change-password` | Password | customer | `customer/password.tsx` | DONE | DONE | `/auth/change-password` | changePasswordSchema | |
| `/customer/support` | Tickets | customer | `customer/support.tsx` | DONE | DONE | `/support/tickets` | supportSchema | |
| `/customer/invoices` | Invoices + PDF | customer | `invoices.tsx`, `invoice/[id].tsx` | DONE | DONE | `/invoices`, `/invoices/{id}/html`, `/pdf` | api-client | HTML view + native share of PDF |
| `/customer/rewards` | Referral | customer | `customer/rewards.tsx` | DONE | DONE | `/customer/referral-code`, `/wallet/rewards` | | Copy + Share |
| `/customer/terms` | Portal terms | customer | `legal/[slug]` | DONE | DONE | `/legal/*` | | |
| `/booking/:id` | Receipt, pay, cancel, track, rate | customer | `customer/booking/[id].tsx` | DONE | DONE | booking lifecycle + start-otp + location | | Start OTP, Maps link, meeting URL, cancel preview |
| `/booking-confirmation` | Post-book | customer | booking detail | PARTIAL | PARTIAL | same | | Redirects to detail |
| `/join/:token` | Virtual invite | customer | `app/join/[token].tsx` | DONE | DONE | `/meetings/invite/{token}` | | |
| `/pujari-profile/:id` | Public pujari | public | `pujari-public/[id].tsx` | DONE | DONE | `/pujaris/{id}/public` | | |
| `/about` `/contact` | Marketing | public | landing + support | NOT APPLICABLE | NOT APPLICABLE | | | Native apps are product apps, not the marketing site |
| FCM | Web push | customer | `src/services/push.ts` | DONE | PARTIAL | `/notifications/fcm/token` | api-client | iOS APNs key in Apple/Firebase Console still manual |
| Deep links | `bseva://` | customer | scheme + SessionEffects | DONE | DONE | notification `link` | mapNotificationLinkToMobile | |
| Dark mode | Theme toggle | customer | ThemeProvider | DONE | DONE | local | `@bseva/tokens` | |
| i18n | Preferred langs | customer | LanguagePicker | DONE | DONE | `PATCH /auth/me` | `@bseva/locales` | en/hi/te full dict; mr/ta/kn chrome + English fallback for older marketing keys |

---

## Pujari

| Web route | Web feature | Role | Mobile screen | Android | iOS | API | Shared logic | Notes |
|---|---|---|---|---|---|---|---|---|
| `/pujari` | Dashboard | pujari | `pujari/(tabs)/index.tsx` | DONE | DONE | bookings | | |
| `/pujari/bookings` | Jobs | pujari | `pujari/(tabs)/jobs.tsx` | DONE | DONE | `/bookings` | | |
| `/pujari/notifications` | Inbox | pujari | `pujari/notifications.tsx` | DONE | DONE | `/notifications*` | mapNotificationLinkToMobile | |
| `/pujari/onboarding` | Onboarding wizard | pujari | `pujari/onboarding.tsx` | PARTIAL | PARTIAL | profile, documents, joining fee | | No drawn signature pad (photo signature instead) |
| `/pujari/profile` | Profile / photo / signature | pujari | `pujari/profile.tsx` | PARTIAL | PARTIAL | `/pujari/profile*` | | Image signature, not canvas pad |
| `/pujari/documents` | KYC upload | pujari | `pujari/documents.tsx` | DONE | DONE | `/pujari/documents/upload` | | Camera + library |
| `/pujari/address` | Address | pujari | `pujari/address.tsx` | DONE | DONE | profile | addressSchema | |
| `/pujari/experience` | Experience | pujari | `pujari/experience.tsx` | DONE | DONE | profile PATCH | | |
| Angikara | Angikara form | pujari | `pujari/angikara.tsx` | PARTIAL | PARTIAL | `/pujari/angikara` | | Submit/status; no print layout |
| `/pujari/availability` | Blocks | pujari | `pujari/availability.tsx` | DONE | DONE | `/pujari/availability/blocks` | | |
| `/pujari/services` | Service-offers apply + level | pujari | `pujari/services.tsx` | DONE | DONE | `/pujari/service-offers`, `/apply-level` | | |
| `/pujari/bank` | Bank | pujari | `pujari/bank.tsx` | DONE | DONE | profile | | |
| `/pujari/earnings` | Settlements | pujari | `pujari/(tabs)/earnings.tsx` | DONE | DONE | `/settlements` | rupees | |
| `/pujari/referral` | Referral | pujari | `pujari/referral.tsx` | DONE | DONE | `/pujari/referral-code` | | |
| `/pujari/head-ratings` | Head ratings | head_pujari | `pujari/ratings.tsx` | DONE | DONE | `/head/ratings` | | |
| `/pujari/support` `/password` `/terms` | Support, password, legal | pujari | matching screens + legal | DONE | DONE | same as web | | |
| Booking accept/reject/start/complete/location | Journey | pujari | `customer/booking/[id].tsx` (shared) | DONE | DONE | lifecycle routes | | Location is on-demand share, not background tracking |

---

## Admin (normal Admin)

Permission-driven UI. Backend RBAC remains authoritative (`GET /admin/me/permissions`). Customer/Pujari tokens cannot use these screens (app rejects non-admin at login).

| Web route | Web feature | Role | Mobile screen | Android | iOS | API | Shared logic | Notes |
|---|---|---|---|---|---|---|---|---|
| `{ops}/` | Dashboard KPIs | admin | `(app)/index.tsx` | DONE | DONE | `/admin/stats`, nav-badges | hasAdminPermission | Card layout, not a desktop grid |
| `{ops}/customers` | List/search/block/create | view_customers | `customers.tsx` | DONE | DONE | `/admin/users` | | |
| `{ops}/pujaris` | List/filter | view_pujaris | `(app)/pujaris.tsx` | DONE | DONE | `/admin/pujaris` | | |
| `{ops}/pujaris/:id` | Verify / block / level | verify/edit | `pujari/[id].tsx` | PARTIAL | PARTIAL | `/admin/pujaris/{id}` | | Core verify/block; document file viewer is thinner than desktop |
| `{ops}/temples` | CRUD | manage_services | `temples.tsx` | PARTIAL | PARTIAL | `/admin/temples` | | Search/create/delete; CSV bulk import is NOT APPLICABLE on phone (use web) |
| `{ops}/services` | Catalog + availability | manage_services | `services.tsx` | PARTIAL | PARTIAL | `/admin/services` | | Toggle availability + search; full package/image editor stays richer on web |
| `{ops}/recommendations` | Seasonal recs | manage_services | `recommendations.tsx` | DONE | DONE | `/admin/recommendations` | | |
| `{ops}/bulk-import` | CSV temples | manage_services | — | NOT APPLICABLE | NOT APPLICABLE | `/admin/temples/bulk` | | File-heavy desktop tool; temples can be added one-by-one on mobile |
| `{ops}/samagri` | Items | manage_samagri | `samagri.tsx` | DONE | DONE | `/samagri/items`, POST admin | | |
| `{ops}/bookings` | Assign / filter | view/manage_bookings | `(app)/bookings.tsx`, `booking/[id].tsx` | DONE | DONE | `/bookings`, `/admin/bookings/{id}/assign` | listBookingsPage | Card → detail → assign |
| `{ops}/virtual-puja` | Virtual queue | view/manage_bookings | `virtual-puja.tsx` | DONE | DONE | `/bookings?mode=virtual` | | |
| `{ops}/settlements` | Override settle | manage_settlements | `settlements.tsx` | DONE | DONE | `/settlements`, `/override` | | |
| `{ops}/invoices` | Search / resend | view_payments | `invoices.tsx` | PARTIAL | PARTIAL | `/admin/invoices`, resend | | Resend; HTML/PDF viewer not inlined (customer app has PDF share) |
| `{ops}/payments` | Payment list | view_payments | `payments.tsx` | DONE | DONE | `/bookings?stats=true` | | No refund button on web either |
| `{ops}/pricing` | Location + surge | manage_config | `pricing.tsx` | DONE | DONE | `/admin/location-prices`, `/surge-rules` | | |
| `{ops}/permissions` | Admin ACL | manage_admins | `permissions.tsx` | DONE | DONE | `/admin/admins`, PUT permissions | ADMIN_PERMISSIONS | Super Admin row is read-only |
| `{ops}/reviews` | Mock reviews UI | view_bookings | `reviews.tsx` | NOT APPLICABLE | NOT APPLICABLE | none on web | | Web is sample data only; live ratings live on bookings |
| `{ops}/notifications` | Inbox + test push | manage_config | `notifications.tsx` | DONE | DONE | `/notifications*`, `/fcm/test` | | |
| `{ops}/promos` | Banners/popups | manage_config | `promos.tsx` | PARTIAL | PARTIAL | `/admin/promos/*` | | Publish/delete; image upload easier on web |
| `{ops}/reports` | Range reports | view_reports | `reports.tsx` | PARTIAL | PARTIAL | `/admin/reports` | | Totals; Excel export is desktop-oriented |
| `{ops}/settings` | GST + platform keys | manage_config | `settings.tsx` | PARTIAL | PARTIAL | `/admin/pricing`, `/admin/config` | | GST save + key viewer; pujari-role CRUD richer on web |
| `{ops}/support` | Tickets | manage_support | `support.tsx` | PARTIAL | PARTIAL | `/support/tickets` | | Status updates; live chat polling thinner than web |
| `{ops}/legal` | Policy editor | manage_legal | `legal.tsx` | PARTIAL | PARTIAL | `/admin/legal` | | Read/select sections; point editor is desktop-sized |
| `{ops}/head-ratings` | Head assessments | admin | `head-ratings.tsx` | DONE | DONE | `/head/ratings` | | |
| `{ops}/email-templates` | Mock templates | — | — | NOT APPLICABLE | NOT APPLICABLE | none | | Web-only local mock |
| `{ops}/sms-templates` | Mock templates | — | — | NOT APPLICABLE | NOT APPLICABLE | none | | Web-only local mock |
| FCM | Ops pushes | admin | `src/services/push.ts` | BLOCKED | BLOCKED | `/notifications/fcm/token` | | Needs Firebase apps for `com.bseva.admin` |

---

## Super Admin

There are **no Super-Admin-only routes** in the current web nav (`superOnly` unused). Super Admin receives every permission from the backend and sees every Admin screen. Normal Admin cannot gain those APIs by hiding/showing UI.

| Web feature | Mobile | Status | Notes |
|---|---|---|---|
| Bypass permission filters | `hasAdminPermission(role, perms)` | DONE | `super_admin` always true in UI; APIs still enforce |
| `PUT /admin/users/{id}/permissions` | `permissions.tsx` | DONE | Super Admin target is not editable |
| `POST /admin/users/{id}/promote-super` | — | PARTIAL | Dangerous; keep on web until a dedicated confirm flow is needed |
| Legal / support extra nav | shown when `manage_legal` / `manage_support` or super | DONE | |

---

## Cross-cutting

| Topic | Status | Notes |
|---|---|---|
| Same FastAPI backend | DONE | No second API |
| Same users / JWT | DONE | SecureStore `bseva_token` |
| Same catalog/pricing/bookings | DONE | Server-authoritative |
| Wallet payments | DONE | Same `/bookings/{id}/pay` and `/wallet/load` |
| Localization 6 languages | PARTIAL | Preferred codes en/hi/te/mr/ta/kn; hi/te have full web dictionaries |
| Customer/Pujari app rejects Admin tools | DONE | `admin-web.tsx` + RoleGate |
| Admin app rejects Customer/Pujari | DONE | Login + AuthProvider |
| Database migrations | NOT APPLICABLE | No new tables for this mobile work; FCM table already exists |
| Web still working | DONE | Shared packages are additive; `bseva-export` not rewritten |
