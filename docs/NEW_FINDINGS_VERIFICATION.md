# New findings verification report

Source: `/Users/chandu/Downloads/new_findings.docx` (extracted 20 Sep 2026). Every finding was checked against the **current** codebase before changes. Nothing was assumed already fixed.

Items 1–16 and 18–24 were verified in the first code pass. **#17 was re-verified on production** (`https://bseva.vercel.app`) after deploying commit `5036e45` (wallet pay-pending debit sign + root `reportlab`).

| # | Finding | Previous State | Final Status | Files Changed | Verification |
|---|---------|----------------|--------------|---------------|--------------|
| 1 | Approve and Reject buttons not working | Admin Reviews used hardcoded `sampleReviews`; Approve/Reject had **no** `onClick` and no API | FIXED | `backend/app/schema_migrate.py`, `backend/app/routers/ops.py`, `backend/app/routers/lifecycle.py`, `backend/app/routers/bookings.py`, `bseva-export/client/src/pages/admin/Reviews.tsx` | Confirmed mock-only UI in current code. Added `ratings.moderation_status`, `GET /admin/reviews`, `POST .../approve` and `.../reject`. UI loads real rows and updates status after API success. Python modules compile. **Live click on production DB not run (no admin session).** |
| 2 | Action column/header alignment | Action header was not `text-center`; cells used `justify-end` | FIXED | `bseva-export/client/src/pages/admin/Reviews.tsx` | Header and action controls both `text-center` / `justify-center`. |
| 3 | Notifications Total / Read / Unread | Only unread (or “0 unread”) shown | FIXED | `backend/app/routers/notifications.py`, `bseva-export/client/src/pages/admin/Notifications.tsx`, `bseva-export/client/src/pages/NotificationsInbox.tsx` | `/notifications/unread-count` now returns `{ total, read, unread }`. Admin + portal inboxes display all three and reload after mark-read / mark-all. |
| 4 | Reports Bookings / Avg. Duration alignment | `text-right` on those columns (screenshot showed misaligned values) | FIXED | `bseva-export/client/src/pages/admin/Reports.tsx` | Bookings and Avg duration headers/values are `text-center` + `tabular-nums`; Revenue stays right-aligned. |
| 5 | Stars field leading zero (`02`) | `type="number"` with `Number(e.target.value)` allowed `02` | FIXED | `bseva-export/client/src/pages/HeadRatings.tsx` | Input strips leading zeros and clamps 1–5. Backend already `Field(ge=1, le=5)`. |
| 6 | Settings navigation does not scroll | Settings was one long page with no section jump nav | FIXED | `bseva-export/client/src/pages/admin/Settings.tsx` | Sticky section chips + `id`s + `scrollIntoView`; `#contact` / `#pricing` hashes also scroll after load. |
| 7 | Admin header: logo + “Admin”, not tab name | Header had empty title; sidebar avatar; pages repeated “Dashboard” | FIXED | `bseva-export/client/src/components/AdminLayout.tsx`, `bseva-export/client/src/components/AdminPageHeader.tsx`, admin page heading files below | Shared header now **B-Seva logo + Admin / Super Admin**. `AdminPageHeader` no longer prints tab names by default. |
| 8 | Pujari pager “10 names / page” | `AdminPager` default `names / page` | FIXED | `bseva-export/client/src/components/AdminPager.tsx`, `bseva-export/client/src/pages/admin/Pujaris.tsx` | Default and Pujaris page use `IDs / page` (10/20/50/100). Bookings still pass `per page`. |
| 9 | Remove Temple CSV Template button | Button present beside Export / Bulk Import | FIXED | `bseva-export/client/src/pages/admin/Temples.tsx` | CSV Template control and unused template download removed. Export + Bulk Import remain. |
| 10 | Samagri column header | `Samagri ₹` | FIXED | `bseva-export/client/src/pages/admin/ServicesAdmin.tsx` | Heading is `Samagri Cost (₹)`. |
| 11 | Remove Samagri Key column | Key + Name (EN) both shown | FIXED | `bseva-export/client/src/pages/admin/Samagri.tsx` | Key hidden in table. Add-item dialog still accepts `item_key` for backend. |
| 12 | Remove Unit and Status columns | Shown on catalog table | FIXED | `bseva-export/client/src/pages/admin/Samagri.tsx` | Columns removed from table. Create payload still sends `unit` / `active`. |
| 13 | Rename Promos → Promotions | Sidebar `admin.promos` = “Promos”; page header mixed | FIXED | `packages/locales/src/resources/en.ts`, `packages/locales/src/extras.ts`, `bseva-export/client/src/pages/admin/PromosAdmin.tsx` | User-facing EN label is Promotions. Route `/promos` unchanged. |
| 14 | Public puja cards alignment | Grid items not stretching; content height varied | FIXED | `bseva-export/client/src/components/ServiceCard.tsx`, `bseva-export/client/src/pages/Services.tsx` | Stretch grid, `h-full` flex cards, reserved title height, footer `mt-auto`. Responsive 1/2/3 columns unchanged. |
| 15 | Public header/logo alignment | Header logo `h-[5.5rem]` / `max-w-[22rem]` overflowed nav | FIXED | `bseva-export/client/src/components/BSevaLogo.tsx`, `bseva-export/client/src/components/MarketingLayout.tsx` | Smaller header lockup (`h-12`–`3.75rem`, max ~11.5rem) inside shorter bar (`h-16` / `4.5rem`). Shared `BSevaLogo`. |
| 16 | Customer “Recommended for you” cards | Title/price/button wrapped inline (` · Starting from`) | FIXED | `bseva-export/client/src/pages/customer/Dashboard.tsx` | Equal-height cards; stacked title, service + price, bottom-aligned Book Now. |
| 17 | Pay with Wallet / follow-on invoice PDF | (a) `POST /bookings/{id}/pay` **credited** wallet (`+total`). (b) Vercel root `requirements.txt` omitted `reportlab` → `No module named 'reportlab'`. | FIXED | `backend/app/routers/bookings.py`, `requirements.txt` (deployed `5036e45`) | Live E2E on production as CUST-QAC0002. See **#17 production E2E** below. |
| 18 | Pujari Om / Swastik | `PujaTitle` existed but `truncate` on the whole title clipped marks; Services list used plain names | FIXED | `bseva-export/client/src/components/PujaTitle.tsx`, `bseva-export/client/src/pages/pujari/BookingsPage.tsx`, `bseva-export/client/src/pages/pujari/Dashboard.tsx`, `bseva-export/client/src/pages/pujari/ServicesPage.tsx` | Marks `shrink-0` in orange (`text-primary`). Services & Dakshina names use `PujaTitle`. |
| 19 | Remove “My Documents” intro card | Extra card above Certificates & Aadhaar | FIXED | `bseva-export/client/src/pages/pujari/Documents.tsx` | Intro card removed. `PriestOnboardingPanel` (Aadhaar/certs) kept. |
| 20 | Highlight Services & Dakshina + symbols | Names unadorned; title not theme orange | FIXED | `bseva-export/client/src/pages/pujari/ServicesPage.tsx` | Page title uses `text-h1` (BSeva orange). Dakshina already `text-primary`. Om/Swastik via `PujaTitle`. |
| 21 | Remove “Assess Pujaris” | Nav `Assess Pujaris`; page `Assess Pujaris` / Head assessments | FIXED | `packages/locales/src/resources/en.ts`, `packages/locales/src/extras.ts`, `bseva-export/client/src/components/AdminLayout.tsx`, `bseva-export/client/src/pages/HeadRatings.tsx` | Menu: **Pujari Ratings**. Pujari page: **Rate Pujari**. Admin page: **Pujari Ratings**. APIs `/head/ratings` unchanged. |
| 22 | Admin header cleanup (logo, Admin, no tab names, no per-tab headers) | Duplicate Dashboard/Invoices titles; logo not in header | FIXED | Shared `AdminLayout` + `AdminPageHeader`; Dashboard, Pujaris, Customers, Reports, Services, Samagri, Payments, Promos, Recommendations, Permissions, Pricing, Legal, Email/SMS templates, Reviews, Notifications, Invoices (header component) | Shared chrome. Extra screenshot: Admin invoices `Missing permission: view_payments` — `view_payments` added to default admin perms; list uses `require_any_permission(view_payments, manage_bookings, manage_settlements)`. |
| 23 | Super Admin: remove header tab names | Same header as Admin; Super Admin used same layout | FIXED | `bseva-export/client/src/components/AdminLayout.tsx` | Super Admin header shows **Super Admin** (not Dashboard/Invoices). Same layout for every `${ops}` route. |
| 24 | Landing hero “Bring the right ritual home.” mixed colors | `.text-display` forced orange; screenshot mixed white + gold | FIXED | `bseva-export/client/src/pages/Home.tsx` | Entire headline is explicit white (`[color:#ffffff]`). Layout/animation otherwise unchanged. |

## Totals

- **Total findings checked:** 24
- **Already fixed and verified:** 0 (none were complete in current code)
- **Fixed:** 24
- **Partially fixed:** 0
- **Blocked:** 0

## Tests / typechecks / builds run

- `python3 -m compileall` on changed backend modules — OK
- `npx vitest run` `packages/locales/src/parity.test.ts` + `pujaTitle.test.ts` — **7 passed**
- `pytest` `backend/tests/test_invoice_docs.py` + `test_document_brand.py` — **11 passed**
- `pytest` `test_qa_validation.py` + `test_admin_nav_badges.py` + `test_admin_list_sort.py` — **25 passed**
- Cursor diagnostics on edited TSX — no issues in those files
- Full production web build ran via Vercel deploy of `5036e45` (success)

## #17 production E2E (20 Sep 2026)

Environment: `https://bseva.vercel.app` after Vercel success on `5036e45`. Customer CUST-QAC0002 (no unpaid bookings existed; checkout **Pay with Wallet** is the live customer path).

| Check | Result |
|-------|--------|
| Pre wallet | ₹70,448.88 (7,044,888 paise) |
| Booking amount | ₹2,981.86 (298,186 paise) Ganapathi Standard 23-09-2026 18:00 |
| Pay with Wallet | Button went **Processing…** (disabled); double-click did not start a second request |
| Wallet after | ₹67,467.02 (6,746,702 paise) = pre − amount **exactly once** |
| Sign / type | Ledger **debit** 298,186 paise, `Booking BSV-260920-121DC485`, completed. Not a credit |
| Booking | `BSV-260920-121DC485` (`121dc485-8025-487f-950f-10119da359d2`) **paid** / confirmed |
| Payment row | Create-booking inserts `payments` `successful` / `wallet` for `total_paise` |
| Invoice | `BSEVA/2026-27/000033` ₹2,981.86 created 20-09-2026 13:40 |
| PDF | `GET /invoices/ec84653c-9b22-40e6-a76c-ff2a5ea4c215/pdf` **200** `%PDF-` ~9KB. Pre-deploy same endpoint was 500 `No module named 'reportlab'` |
| UI | Receipt Payment **Paid**; wallet page shows debit and new balance; reload of `/booking/121dc485-…` still Paid + invoice download |
| Retry | `POST /bookings/{id}/pay` → **400 Already paid**; wallet still 6,746,702; still **one** related debit |
| Insufficient balance | Not clickable on this account (balance ≫ booking). Create-booking returns **400 Insufficient wallet balance** *before* insert (`bookings.py`); `apply_wallet` raises the same on `/pay` before updates. No extra debit observed on the paid retry |
| API | Pay success created paid booking; retry 400; PDF 200 |

## Pre-existing TypeScript failures (unrelated to findings)

`npx tsc --noEmit` in `bseva-export` still fails on older files such as `server/db.mysql.backup.ts` and Reports union types. Those errors were **not** introduced by this findings pass and are **not** part of the 24-item status.

## Remaining issues

1. **#1 live approve/reject** needs pending rows in `ratings` after migrate (`moderation_status`).
2. Admin **Email/SMS template** screens are not in the main sidebar; their large H1s were still reduced. Pujari **detail** still uses the person’s name as H1 (not a tab name).
3. Extracted docx working copy under `.tmp-new-findings` is local-only and should not be committed.
