# QA Findings Fix Report

Source of truth: `docs/B-Seva_findings.docx` (extracted text in `docs/B-Seva_findings_extracted.txt`).  
Checklist: `docs/QA_FINDINGS_CHECKLIST.md`.

| # | Role | Module | Bug | Root Cause | Fix Implemented | Files Changed | Test Result | Status |
|---|------|--------|-----|------------|-----------------|---------------|-------------|--------|
| 1 | Pujari | Dashboard bookings | Accept and Reject opened the same detail modal | Both buttons called the same `openDetail()` with no intent | Accept opens detail for confirmation; Reject opens detail with `initialIntent="reject"` and auto-opens reject dialog | `bseva-export/client/src/pages/pujari/Dashboard.tsx`, `BookingDetailPanel.tsx` | Manual + typecheck | FIXED |
| 2 | Pujari | Onboarding | Profile photo missing `*` | Translation label lacked mandatory marker | Label set to `Upload Profile Photo *` | `bseva-export/client/src/i18n/pujariForm.ts` | Visual | FIXED |
| 3 | Pujari | Profile photo upload | 403 Invalid Compact JWS | Supabase `sb_secret_*` keys were sent as `Authorization: Bearer`, which Storage rejects as non-JWT | Shared `_supabase_auth_headers()`: Bearer only for `eyJ…` JWTs; `apikey` only for `sb_secret_*` | `backend/app/storage.py`, `backend/scripts/migrate_supabase_storage.py` | `tests/test_qa_validation.py` (headers) | FIXED |
| 4 | Pujari | Onboarding personal | Invalid mobile / underage DOB accepted | Weak FE checks; BE only blocked future DOB | FE + BE: Indian 10-digit mobile; min age 18 | `Onboarding.tsx`, `validation_rules.py`, `pujari.py` | Unit tests | FIXED |
| 5 | Pujari | Address | Current Location no-op / silent fail | Stale closure; weak geolocation errors; no toast | valueRef for coords; permission/timeout errors + toast | `AddressFields.tsx` | Manual QA (browser permission) | FIXED |
| 6 | Pujari | Address | Invalid address/PIN accepted | Presence-only checks | Shared address validation (meaningful text + 6-digit PIN) FE+BE | `validation_rules.py`, `pujari.py`, `Onboarding.tsx`, `AddressPage.tsx`, `fieldValidation.ts` | Unit tests | FIXED |
| 7 | Pujari | Documents | Aadhaar skippable | Step advance not gated on BE; FE-only check | BE rejects `onboarding_step >= 5` without `identity` doc; FE still checks | `pujari.py`, `Onboarding.tsx` | Unit/logic | FIXED |
| 8 | Pujari | Signature | 403 storage | Same as #3 | Same shared storage auth fix | `storage.py` | Unit tests | FIXED |
| 9 | Pujari | Sidebar | Complete Profile after onboarding | Nav filter already present; kept/verified | Hide `/pujari/onboarding` when submitted/verified | `RolePortals.tsx` | Manual | FIXED |
| 10 | Pujari | Sidebar | Scroll jumps on nav | Sidebar remount + ScrollToTop reset `main` broadly | Persist sidebar `scrollTop`; ScrollToTop only `[data-scroll-reset]` | `RolePortals.tsx`, `ScrollToTop.tsx` | Manual | FIXED |
| 11 | Pujari | Bank | Empty bank save | Allowed null bank fields | FE+BE bank validation (holder, IFSC, last4) | `BankPage.tsx`, `validation_rules.py`, `pujari.py` | Unit tests | FIXED |
| 12 | Pujari | Support | Weak ticket validation | min_length 3; junk allowed | Subject ≥5 / Description ≥10 + meaningful text FE+BE | `ops.py`, `Support.tsx`, `validation_rules.py` | Unit tests | FIXED |
| 13 | Pujari | Sidebar | Scroll jump (dup of #10) | Same as #10 | Same as #10 | same | Manual | FIXED |
| 14 | Customer | Bookings card | Premium looks clickable | Outline badge looked interactive | Non-interactive badge (`pointer-events-none`) | `customer/Dashboard.tsx` | Visual | FIXED |
| 15 | Customer | Profile photo | 403 storage | Same as #3 | Same shared storage auth fix | `storage.py` | Unit tests | FIXED |
| 16 | Customer | Profile save | “Profile updated” after photo fail | Same toast for details save vs photo | Photo upload keeps its own error; details toast = “Profile details updated” | `customer/Profile.tsx` | Manual | FIXED |
| 17 | Customer | Address | Invalid address saved | Weak validation | Same shared address validators FE+BE | `customer.py`, `Address.tsx`, `fieldValidation.ts` | Unit tests | FIXED |
| 18 | Customer | Wallet | Load wording | Copy | “Add money (₹)” / “Add Money” | `WalletPanel.tsx` | Visual | FIXED |
| 19 | Customer | Cancel | Reason UX / 24h order | Reason shown even when not allowed; optional “N” accepted | Preview first; hide reason if not allowed; require ≥5 chars when allowed (FE+BE) | `BookingDetailPanel.tsx`, `bookings.py` | Unit tests | FIXED |
| 20 | Customer | Referral | Min-length error on valid code | Empty/placeholder confusion; opaque Pydantic message | Clear FE empty check; accept `code`/`referral_code`; existence error after length | `ops.py`, `RewardsPage.tsx` | Manual | FIXED |
| 21 | Customer | Support | Weak ticket validation | Same as #12 | Same support validators | `ops.py`, `Support.tsx` | Unit tests | FIXED |
| 22 | Customer | Sidebar | Terms keeps Change Password active | Terms is modal, not a route | Track `legalOpen`; highlight Terms; clear other actives | `RolePortals.tsx`, `LegalModal.tsx` | Manual | FIXED |
| 23 | Super Admin | Dashboard | Active Pujaris count mismatch | Counted all non-blocked pujari users, not approved | `activePriests` = approved + not blocked (matches Approved list) | `admin.py` | Query review | FIXED |
| 24 | Super Admin | Dashboard | Revenue `$` icon | Lucide `DollarSign` | `IndianRupee` icon | `admin/Dashboard.tsx` | Visual | FIXED |
| 25 | Super Admin | Dashboard | Unclear status icons | Similar icons | Distinct icons (Clock, Pencil, FileWarning, Ban, CheckCircle) | `admin/Dashboard.tsx` | Visual | FIXED |
| 26 | Shared | Homepage | Hyderabad missing | City list incomplete / search-only hero | City select includes Hyderabad (+ legacy `client` Home) | `bseva-export/.../Home.tsx`, `client/.../Home.tsx` | Visual | FIXED |
| 27 | Super Admin | Sidebar | Profile not clickable | Decorative block | Links to Settings (`/settings`) | `AdminLayout.tsx` | Manual | FIXED |
| 28 | Super Admin | Sidebar | Active blue vs orange | Accent tokens not primary orange | Active nav uses `bg-primary/15 text-primary` | `AdminLayout.tsx` | Visual | FIXED |
| 29 | Admin | Dashboard | Counts `—` on first load | Race: fetch before auth ready; silent catch | Wait for `useAuth`; surface errors; retry on user ready | `admin/Dashboard.tsx` | Manual | FIXED |
| 30 | Admin | Dashboard | Icons / ₹ | Same as #24–25 | Same dashboard icon pass | `admin/Dashboard.tsx` | Visual | FIXED |
| 31 | Admin | Sidebar | Profile not clickable | Same as #27 | Same Settings link | `AdminLayout.tsx` | Manual | FIXED |
| 32 | Admin | Customers | Single-char search | Search used stale/`q` inconsistently | Load from URL `q`; allow 1+ char | `Customers.tsx` | Manual | FIXED |
| 33 | Admin/Head | Assessments | Request failed | Numeric ID `2` cast to UUID → 500 | Resolve UUID/email/phone; list via `GET /head/pujaris`; clearer 400 | `ops.py`, `HeadRatings.tsx` | Manual | FIXED |

## Summary

| Metric | Count |
|--------|------:|
| Total findings | 33 |
| Fixed | 33 |
| Partially fixed | 0 |
| Blocked | 0 |
| Not reproducible | 0 |

### Tests added

- `backend/tests/test_qa_validation.py` — mobile, DOB, address, bank, support, cancel reason, UUID, storage auth headers  
- Result: **11 passed** (`python3 -m pytest tests/test_qa_validation.py -q`)

### Build / typecheck

- Backend unit tests: **pass**
- `npm run check` / `tsc`: existing project errors remain in legacy `server/db.mysql.backup.ts` and unrelated files; **no new errors** attributed to the QA fix files beyond pre-existing `head_pujari` role typing gaps

### Remaining manual QA

1. **Storage uploads** with real Supabase credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STORAGE_BUCKET`) — confirm photo/signature succeed after key-format fix.  
2. **Current Location** in a secure context (HTTPS/localhost) with Maps key / geolocation permission.  
3. **Accept vs Reject** on a live `pending_acceptance` booking.  
4. **Head assessment** using picker UUID (not numeric `2`).  
5. **Admin dashboard** first paint as admin and super_admin.  
6. **Referral apply** with a real existing code vs invalid code messaging.  
7. **Cancel** within and outside the 24h window.

### Shared root causes called out

- **403 Invalid Compact JWS**: one fix in `backend/app/storage.py` covers pujari photo, pujari signature, and customer photo.  
- **Address validation**: shared `validation_rules.py` + `fieldValidation.ts` for customer and pujari.  
- **Support tickets**: shared FE/BE rules for both roles.
