# Legal documents: changes from the owner's drafts (version 1.1)

Date: 2 November 2026. Source drafts: the owner's Customer Terms, Pujari / Service Provider Terms, and App Terms of Use (all "Version 1.0", effective "DD Month 2026"). Facts come from `docs/compliance/2026-11-02-legal-security-audit.md` (cited as C1–C16, §6 data inventory, and "Decisions taken"), `docs/compliance/api-contract.md`, and the code.

Content lives in `bseva-export/client/src/content/legal/`:
- `customer-terms.ts`
- `pujari-terms.ts`
- `app-terms.ts`
- `privacy-policy.ts` (new)
- `refund-policy.ts` (new; replaces the `cancellation_policy` seed text)
- `types.ts`, `shared.ts`, `index.ts`

Every document is version `1.1`. The placeholders listed in earlier drafts are resolved; see *Resolved placeholders* below.

Counsel should still approve the text, especially the values marked *default* below.

## Changes common to all three drafts

| Section | Draft (gist) | New text (gist) | Reason |
|---|---|---|---|
| Header | "Effective date: DD Month 2026", "Version: 1.0" | `effectiveDate` = `{{TO_CONFIRM: effective date}}`, version `1.1-draft` | Audit §2 placeholders |
| Header | No CIN | `CIN: {{TO_CONFIRM: CIN}}` | Audit §2 placeholders, §8 item 9 |
| Header and grievance table | Address "Divyasree Holdings Pvt Ltd, Plot No. 5 & 43, …" | Same address followed by `{{TO_CONFIRM: registered office as per MCA record}}` | C14: the line begins with another company's name |
| Grievance table | "Grievance Officer name" | `{{TO_CONFIRM: Grievance Officer name}}` | Audit §2 placeholders |
| Material-change notices | "through the Platform / Partner app, email, SMS, or WhatsApp" | "through the Platform / Partner app or by email (and by SMS or WhatsApp where enabled)" | C6: only email is active |
| Section layout | Paragraphs and bullets in one numbered section | Text that follows a bullet list is a short unnumbered sub-heading (for example "Order of precedence", "Limits and remedies") under the same numbered section | `LegalDoc` sections hold paragraphs, then bullets, then a table. Wording and numbering are unchanged. |

## Customer Terms & Conditions (`customer-terms.ts`)

| Section | Draft (gist) | New text (gist) | Reason |
|---|---|---|---|
| §3 | No description of sign-up method | New paragraph: account is email + password; email OTP verifies the email, resets a forgotten password, and confirms account deletion; mobile/SMS/WhatsApp OTP "may be offered in future; we will update this document first" | C1, C12, Decisions (authentication) |
| §4 | "communication tools" | "Booking notifications and support communication" | C10: there is no chat between users |
| §5 | Confirmation "through the Platform, SMS, email, or WhatsApp" | "through the Platform or by email (and by SMS or WhatsApp where enabled)" | C6 |
| §8 ¶2 | Payments processed by "authorized payment gateway partners"; you authorize charging "your selected payment method" | Bookings are paid from the B-Seva wallet; wallet credit is currently added through B-Seva support after payment by UPI or bank transfer; a gateway may be added later; you authorize B-Seva to debit your wallet for the Booking, approved extras and disclosed cancellation/no-show amounts | C9: no gateway; production top-up is offline by Super Admin (`routers/wallet.py`) |
| §9 last ¶ | Refunds to "original payment method, generally within 7–10 working days" | Refunds are credited to the B-Seva wallet, when the cancellation is recorded. Support can return unused balance to a bank account `{{TO_CONFIRM: process and timing…}}` | Code: `cancel_booking` credits the wallet immediately (`routers/bookings.py`); C13 |
| §10 ¶4 | Report through "Report an Issue" in the app | "reporting the Pujari or the Booking in the app, or by contacting support" | C10, Decisions (report), contract "Reports" |
| §13 ¶1 | "through ‘Report an Issue’ in the app" | "by reporting the Pujari or the Booking in the app" | C10 |
| §15 ¶1 | "ratings, reviews, and photographs" | "ratings and reviews" | Audit §6: ratings with comments only; no review photos |
| §15 ¶3 | "report objectionable content or block a user" | "report a Pujari or a Booking through the Platform, or contact support about objectionable content, and we will review reports promptly" | C10: no block feature |
| §20 ¶1 | Delete in app or via support | Adds the website `https://www.b-seva.com/delete-account` | Audit §3, contract "Legal pages" |
| §20 bullet 1 | "Immediate deactivation … as soon as you submit the request"; upcoming bookings "cancelled and refunded" | "Confirmation and deactivation": confirm with email OTP; deactivated once confirmed; signed out on all devices; upcoming Bookings cancelled under the Cancellation Policy, so charges may apply; refund shown before confirming; ongoing puja completed first | C2, C4, Decisions (customer bookings), contract "Sessions" |
| §20 bullet 2 | "(up to 14 days)"; refund "to your original payment method" | "(14 days)"; refunds credited to the wallet; refundable wallet balance returned `{{TO_CONFIRM: method for returning wallet balance on account deletion}}` | C5 (deletion on day 14), C9 |
| §20 bullet 3 | "Final deletion (within 14 days)"; confirmation "by SMS, email, or WhatsApp" | "on completion of the 14-day period", subject to retention; confirmation by email (SMS/WhatsApp where enabled); waits for an open refund, settlement, complaint or dispute, with notice | C5, C6, C13 |
| §20 ¶ | Cancel "by logging in and choosing Cancel Deletion before the 14 days end" | Cancel before final deletion on the delete-account page or by signing in and choosing Cancel Deletion, confirmed by email OTP; cancelled Bookings are not restored | C5, contract "Cancel deletion" |
| §21 | Notice by "Platform, email, SMS, or WhatsApp" | Platform or email (SMS/WhatsApp where enabled) | C6 |
| §24 | "include your registered phone number" | "registered email address or phone number" | C1: accounts are keyed on email |

## Pujari / Service Provider Terms (`pujari-terms.ts`)

| Section | Draft (gist) | New text (gist) | Reason |
|---|---|---|---|
| §3 | No description of sign-up method | New paragraph: email + password; email OTP for sign-up, password reset and deletion; keep password and OTPs confidential; SMS/WhatsApp "may be offered in future; we will update this document first" | C1, C12, Decisions |
| §8 ¶3 | "report the request through the Partner app within 48 hours" | "report the request within 48 hours by reporting the Customer or the Booking in the Partner app, or through partner support" | C10, contract "Reports" (`customer` and `booking` targets) |
| new §9A | None (draft says nothing about location) | "Location sharing while travelling to a Booking": background location shared with B-Seva and the Customer for a confirmed in-person Booking during the travel window only (currently 15 minutes before start until arrival, at most start + 120 minutes; about every 60 s or 35 m; not for virtual Bookings); shown on a map by a mapping service; used for arrival, support and investigations; retention `{{TO_CONFIRM: location history retention}}`; permission can be withdrawn | C11; code: `pujari_location_tracking_before_minutes` 15, `pujari_tracking_after_start_minutes` 120, `pujari_gps_update_interval_seconds` 60, `distanceInterval: 35`, virtual excluded (`booking_tracking.py`, `/pujari/tracking-assignments`). Engineering proposes 30 days retention. |
| §16 ¶2 | "through the Partner app’s emergency or incident option" | "by reporting the Customer or the Booking in the Partner app or through partner support" | C10: no emergency or incident option exists |
| §21 ¶3 | Delete in Partner app or partner support | Adds the website delete-account page | Audit §3 |
| §21 bullet 1 | Deactivated "as soon as you submit"; accepted Bookings "will be reassigned" | Confirm with email OTP; deactivated once confirmed; signed out everywhere; accepted Bookings reassigned or, where no replacement exists, resolved by B-Seva with the Customer; ongoing puja completed first | C3, C4 |
| §21 bullets 2–3 | "(up to 14 days)", "within 14 days", SMS/email/WhatsApp | "(14 days)", "on completion of the 14-day period", email (SMS/WhatsApp where enabled); waits for open refunds, settlements or disputes, with notice | C5, C6, C13 |
| §21 ¶ | Cancel "by logging in … before the 14 days end" | Cancel on the delete-account page or by signing in, confirmed by email OTP; reassigned Bookings are not returned | C5, contract |
| §23 | Notice via Partner app, SMS, email, or WhatsApp | Partner app or email (SMS/WhatsApp where enabled) | C6 |

## App Terms of Use & EULA (`app-terms.ts`)

| Section | Draft (gist) | New text (gist) | Reason |
|---|---|---|---|
| Header | "Developer … Address" | Adds CIN and the MCA placeholder | Audit §2 |
| §5 | "You register using your mobile number and a one-time password (OTP)." "Do not share your OTP" | Register with email + password; email OTP for verification, password reset and deletion; SMS/WhatsApp "may be offered in future; we will update this document first"; "Do not share your password or OTP" | C1, C12, Decisions |
| §6 ¶1 | Real-world/live services | Kept; adds that online Services take place through an external meeting link in a separate meeting app | C8 |
| §6 ¶2 | Payments by "payment gateway partners within the App, using UPI, cards, net banking, or wallets" | Wallet; credit added through support after UPI or bank transfer; gateway may come later. "Payments are not processed through Google Play billing or Apple In-App Purchase" is kept. | C9 |
| §7 table | Location (incl. "navigation and arrival updates"); Camera and photos (incl. review/complaint photos); Microphone and camera; Notifications; SMS / OTP auto-read; Face ID / passcode | Location (while using the App); Background location (Pujari app only, travel window for a confirmed booking); Camera and photos (profile photo, Pujari documents); Notifications. Microphone, SMS auto-read and Face ID rows removed. | C7, C8, C11; audit §3 (permissions) |
| §7 note | — | New: the App does not use the microphone; the external meeting app asks for its own camera and microphone permissions | C8 |
| §8 heading | "User content, reporting, and blocking" | "User content and reporting" | C10 |
| §8 | Post "ratings, reviews, photographs, and messages"; report "a review, message, profile, or user, and block a user" | Post ratings and reviews; Customers report a Pujari or a Booking; Pujaris report a Customer or a Booking; no chat between users; "We review reports promptly…" kept | C10, Decisions (report), contract |
| §9 web bullet | Email support "with your registered phone number" | "from your registered email address" | C1 |
| §9 process | As in the Customer/Pujari drafts | Same corrections as Customer §20 and Pujari §21 (email OTP, deactivation once confirmed, cancellation charges may apply with refund shown first, reassignment or B-Seva resolution, ongoing puja first, day 14, email confirmation, waits for open items, cancel via page or sign-in with email OTP, no restoration) | C2–C6, C13, contract |
| §11 | Third-party services "payment gateways, maps, messaging, cloud hosting, and analytics"; "charges for data and SMS" | "maps and location search, email delivery, push notifications, cloud hosting, and analytics", plus the third-party meeting app; "data charges" | Audit §6 third parties; no gateway or SMS |
| §15 | Notice "in the App or by SMS, email, or WhatsApp" | "in the App or by email (and by SMS or WhatsApp where enabled)" | C6 |
| §17 | Table has no designation or working hours | Adds "Designation: Grievance Officer" and working hours (copied from the other two drafts) | Audit §2 notes the gap. Counsel to approve. |
| §19 Developer bullet | Draft address | Adds the MCA placeholder | C14 |

## Privacy Policy (`privacy-policy.ts`, new)

Written from audit §6 (data inventory, third parties, retention) and the contract. It replaces the four-bullet seed text in `schema_migrate.py` (`_DEFAULT_LEGAL_POLICIES`, slug `privacy`). Points worth checking:
- The data categories list every item in audit §6, including Aadhaar and documents, bank and UPI details, Family Sankalp and seva data, puja start and completion codes, meeting links, push tokens, IP and log data, and consent records.
- Third parties are named generically:
  - email delivery provider
  - push notification provider
  - mapping and geocoding services
  - IP-based location services (for online-puja time zones)
  - cloud hosting (AWS, Mumbai)
  - analytics
  - the other party to a Booking
- It says pujaris see full customer details "currently from 20 hours before" (setting `pujari_full_booking_details_before_hours`, `booking_visibility.py`).
- SMS and WhatsApp are described as not active.
- Retention:
  - server logs: 30 days
  - backups: "kept for a limited period", and deleted data disappears when they expire
  - every other period is a `TO_CONFIRM`
- Rights are described neutrally (access, correction, erasure, withdrawal, grievance, nomination), with no statutory deadlines.

## Cancellation & Refund Policy (`refund-policy.ts`, new)

Matches the code defaults:
- `domain.cancel_policy`
- `_cancel_fee_and_refund` and `cancel_booking` in `routers/bookings.py`
- `booking_reschedule.py`
- `no_show.py`
- `platform_config.py`

| Topic | Old seed text (`cancellation_policy`) | New text | Source in code |
|---|---|---|---|
| Customer charges | >48 h 10%, 24–48 h 50%, <24 h 100%, refund to wallet | Same, as a table, plus: charges are a % of the Booking total; the charge and refund are shown and a reason is required before confirming; unpaid Bookings have no charge | `customer_cancel_fee_*` 10/50/100, `customer_cancel_min_hours` 24, `cancel-preview` |
| Pujari cancels <24 h | "the customer is refunded in full" | The Customer's Booking stays active and goes back out to other Pujaris; the Customer is not charged; if there is no replacement, B-Seva offers a new date, credit, or full refund (Customer Terms §9) | `_pujari_cancel_release` makes no customer refund and releases the booking. **The old text contradicted the code.** |
| Pujari charges | Only <24 h mentioned | >48 h 10%, 24–48 h 50%, <24 h = no-show (100% of puja cost), from the Pujari wallet; low wallet may block in-app cancellation | `pujari_cancel_fee_*`, `penalty_paise_for_booking`, `_pujari_cancel_wallet_allowed` |
| Rescheduling | Not covered | Paid Bookings waiting for a Pujari or confirmed can be rescheduled up to 48 h before start; any fee is shown first `{{TO_CONFIRM}}` | `reschedule_cutoff_hours` 48, `reschedule_fee_enabled` false by default |
| No-show | Not covered | Marked by B-Seva or automatically after 2 h grace; can be waived; 100% of puja cost from the Pujari wallet; settlement held; Customer remedy `{{TO_CONFIRM}}` | `pujari_no_show_grace_hours` 2, `_block_settlement_for_no_show` |
| Refund method | "refund to your Customer Wallet" | Wallet credit when the cancellation is recorded, plus notification, refund email and credit note; bank return `{{TO_CONFIRM}}` | `apply_wallet`, `send_refund_confirmation_email`, `create_credit_note` |
| Account deletion | Not covered | Upcoming Bookings cancelled under this policy; refunds shown first; not restored on cancellation of the request | Decisions, contract |

## Resolved placeholders (4 November 2026)

All `{{TO_CONFIRM: ...}}` placeholders were replaced and the draft banner removed. The documents now live in
`packages/config/src/legal/` and are shown unchanged on the website and in the apps (Profile → Terms & Policies).
Values marked *default* were chosen by engineering and should be checked by the owner or counsel.

| Item | Value now used |
|---|---|
| Version / effective date | `1.1` / 4 November 2026 (owner: change when publishing) |
| CIN | Removed from the documents until the number is provided |
| Registered office | Divyasree Holdings Pvt Ltd, Plot No. 5 & 43, HITEC City Layout, Madhapur, Shaikpet, Hyderabad – 500081 (confirmed by owner, 4 Nov 2026) |
| Grievance Officer | Pavan Kumar Kulkarni (owner) |
| Grievance / data protection email | support@b-seva.com (owner) |
| Location history | 30 days (code: `location_history_retention_days`, default 30) |
| Provider countries | "United States and other countries where they operate" (*default*) |
| Bank details encryption | Claim removed; text says access-controlled, visible only to authorised staff (code stores the number as plain text) |
| Retention | Account/profile 30 days after deletion; Pujari documents and bank/UPI 90 days after deletion; bookings, invoices/tax/settlement and consent records 8 years; ratings/support/reports 3 years; OTP 24 hours; notifications 1 year; security and audit logs 1 year (*defaults*) |
| Rescheduling fee | Shown before confirming; set by B-Seva (Admin setting) |
| Pujari no-show remedy | Customer chooses substitute Pujari, new date, credit or full wallet refund |
| Customer no-show charge | Up to the full amount paid, depending on what was prepared or performed (*default*) |
| Wallet balance to bank | Within 7 working days of verifying bank details (*default*) |

## Items needing counsel's approval

1. Authentication wording (C1) in Customer §3, Pujari §3, App §5. Forgot password must ship before publication (C12).
2. Account deletion wording in Customer §20, Pujari §21, App §9, Privacy §11:
   - deactivation "once you confirm"
   - final deletion "on completion of the 14-day period"
   - deletion waits for open items, with notice
   - normal cancellation charges apply to a customer's upcoming Bookings on deletion (Decisions; audit §8 had recommended a waiver)
3. "Reassigned or resolved by B-Seva" for a Pujari's accepted Bookings (C3), and the statement that reassigned or cancelled Bookings are not restored if deletion is cancelled.
4. Reporting clauses narrowed to report-a-pujari/customer/booking with no blocking (C10). The audit notes Apple guideline 1.2 if review content ever becomes visible to other users.
5. The new Pujari §9A on background location (C11), and its retention period.
6. Removal of the microphone, SMS auto-read and Face ID rows, and the new background-location row (C7, C8). The app configuration must drop those permissions in the same release.
7. Payment wording (C9): the wallet with offline top-up. Also counsel's view that Bookings are real-world/person-to-person services outside in-app purchase (audit §7).
8. Refunds go to the wallet, not the original payment method (Customer §9). Counsel should decide whether the 7–10 working day commitment should be kept for bank returns.
9. Privacy Policy as a whole, especially:
   - legal grounds and legitimate-use wording under the DPDP Act
   - the parent/guardian statement for family members under 18
   - anonymised ratings and support messages kept after deletion (audit §4 "pending counsel's view")
   - cross-border processing
10. App §17: designation and working hours added to the grievance table.
11. Refund Policy as a whole, especially:
    - the pujari-cancellation outcome, which corrects the old text
    - the no-show remedy
    - that the percentages are admin-configurable (the live values must match before publishing)

## Engineering items found while drafting (must be true before publishing)

- **Bank account numbers** are stored unencrypted (audit §6). The Privacy Policy no longer claims encryption; it says the details are access-controlled. Add column encryption before restoring an encryption claim.
- **Admin cancellations** use the customer fee schedule (`_cancel_actor` returns "customer" for admins). Customer Terms §9 and Refund §7 promise a full refund when B-Seva cancels for its own reasons. Admins must waive the fee or credit the wallet manually, or the code must change.
- **Production worker is off** (`WORKER_ENABLED=0`). The automatic no-show after 2 hours and the day-14 deletion job will not run in Production until it is enabled.
- **Customer IP to ip-api.com** is sent over plain HTTP (audit §7). The policy discloses IP lookup services, but the transport should be fixed.
- **Customer iOS location** declares Always location and background mode. The Privacy Policy says the Customer app does not collect location in the background, so that configuration must be removed.
- **Sessions** must end on password change, password reset and deletion (contract "Sessions"). The Privacy Policy states this.
- **Reports feature** (contract "Reports") and **Profile → Legal / Profile → Account** in both apps must exist before the documents that reference them are published.
- **Pujari §14** ("declare your existing customers through the Partner app"): not confirmed in code. The text is unchanged from the draft; product should confirm the feature exists or counsel should reword.
- **Pujari §11** ("payout cycle shown in the Partner app" and a pre-acceptance fee breakdown): unchanged from the draft and not verified in this pass.
- **Acceptance version** is a hard-coded "2026-01" (C16). The acceptance-record wording (Customer §3, Pujari §3) depends on the versioned-acceptance work.
- **Seed policies** (`_DEFAULT_LEGAL_POLICIES` in `schema_migrate.py`, and the fallback in `client/src/hooks/useLegalPolicies.ts`) still carry the old cancellation text, including the incorrect "customer is refunded in full". Update or retire them when the new pages ship.
