# B-Seva Legal, Account Deletion, Authentication and App Store Audit

Date: 2 November 2026. Scope: web (customer, pujari, admin), Customer and Pujari mobile apps, Admin app, backend and database, b-seva.com. Read-only audit: no code, data or infrastructure was changed.

Sources:
- The three owner documents:
  - Customer Terms (CUST)
  - Pujari / Service Provider Terms (PROV)
  - App Terms of Use and EULA (APP)
- The repository at `main` `e2e9972`, plus `develop`.
- The live site.

Section numbers below are the documents' own.

Status key: PASS, FAIL, PARTIAL, BLOCKED, NOT IMPLEMENTED, NEEDS LEGAL APPROVAL.

---

## 1. Summary

The documents promise several things the platform does not do yet:
- in-app and web account deletion with a 14-day process
- the option to cancel a deletion request
- in-app report and block tools
- mobile-number OTP login
- Face ID unlock
- OTP auto-read
- a payment gateway

Several things the platform does are not disclosed at all:
- email and password login
- background live tracking of pujaris
- storage of bank details and Aadhaar
- third-party map and geocoding services that receive coordinates and IP addresses

Neither app can pass Google Play or Apple review today. Neither has account deletion, and both apps declare sensitive permissions they never use. There is also no Pujari iOS app configured.

The documents are close to ready but cannot be published as they stand:
- every effective date is a placeholder
- the Grievance Officer is unnamed
- the company name and address in invoice settings disagree with the documents

The current Privacy Policy is four generic bullet points. It discloses no data categories, third parties or retention periods.

---

## 2. Contradictions between the documents and the software

| # | Document says | Software does | Proposed resolution | Owner |
|---|---|---|---|---|
| C1 | APP §5: "You register using your mobile number and a one-time password (OTP)." CUST §3 mentions "login credentials and OTPs". | Registration is email + password, with an email OTP. Login is email/phone + password. An email-OTP login API exists but has no screen. No SMS or WhatsApp is sent anywhere. | Change the documents to describe email + password with email OTP. Building phone OTP needs an SMS provider, which is not approved. | NEEDS LEGAL APPROVAL |
| C2 | CUST §20, APP §9: upcoming bookings "will be cancelled and refunded under the Cancellation Policy". | No deletion feature exists. The new requirements say not to cancel bookings silently. | Show each booking before confirmation. The customer explicitly confirms cancellation, with a full refund. Ongoing pujas block final deletion until they complete. Needs a decision on waiving cancellation fees for deletion. | NEEDS DECISION |
| C3 | PROV §21, APP §9: accepted bookings "will be reassigned". | A reassignment flow exists, but nothing covers "no replacement found". | Use the existing reassignment flow. Admin resolves cases with no replacement. Final deletion waits until each booking is reassigned, cancelled with refund, or completed. | Legal wording |
| C4 | All three: deactivated "as soon as you submit the request". | No deletion feature exists. | Deactivate once the email OTP is verified. Wording should say "once you confirm the request". | NEEDS LEGAL APPROVAL (minor) |
| C5 | All three: cancel deletion "by logging in and choosing Cancel Deletion before the 14 days end". | No deletion feature exists. | A deactivated account can sign in only to a restricted "Cancel Deletion" screen, confirmed by email OTP. Final deletion runs at day 14, not earlier, so the full window stays open. | NEEDS DECISION (day 14 vs "within 14 days") |
| C6 | All three: confirmation "by SMS, email, or WhatsApp". | Only email is active. | Send email only. Wording should say "by email (and SMS or WhatsApp where enabled)". | Legal wording |
| C7 | APP §7: "SMS / OTP auto-read (Android)" and "Face ID / passcode (iOS, optional)". | Neither exists. The Face ID string is added by default by a library. | Remove both from APP §7, and remove the unused Face ID declaration. | NEEDS LEGAL APPROVAL |
| C8 | APP §7: "Microphone and camera: only when you use a live or online pooja". | Virtual pujas use an external meeting link. The app never uses the microphone. RECORD_AUDIO and the iOS microphone string are declared anyway. | Remove the microphone permission and the clause, or state that the meeting app handles audio and video. | NEEDS LEGAL APPROVAL |
| C9 | APP §6 and CUST §8: payments through "authorized payment gateway partners… UPI, cards, net banking, or wallets". | No gateway is integrated. Bookings are paid from a B-Seva wallet. Production top-up is done offline by Super Admin, with OTP + MPIN. The app says "processed securely by BSeva". | Describe the real mechanism, or integrate Razorpay first. Correct the misleading wallet text in the app. | NEEDS DECISION |
| C10 | APP §8, CUST §15: "report a review, message, profile, or user, and block a user, from within the App". | No report or block exists. Review comments are not shown to other users. There is no peer-to-peer chat. | Either build minimal reporting (report pujari or booking, plus an admin moderation queue), or narrow the clause to what exists. | NEEDS DECISION |
| C11 | APP §7: location is used for nearby pujaris and "navigation and arrival updates". PROV says nothing about location. | The Pujari app tracks location in the background, every 60 seconds and 35 metres. Tracking starts 15 minutes before a puja and runs until arrival or start + 120 minutes. Pings are stored with no deletion. Customers see the pujari's position on a Google map. | Disclose background tracking in PROV, the Privacy Policy and APP. Add a retention period and a purge job for location pings. | NEEDS LEGAL APPROVAL |
| C12 | No document mentions password reset or change. | Change password exists. Forgot password does not. | Build forgot password and mention it in the Privacy Policy and APP. | Implement + legal wording |
| C13 | CUST §9: refunds "within 7–10 working days". PROV §11: settlement questions "within 30 days". | 14-day deletion sits close to the 10-working-day refund window. | Retention exceptions cover open refunds and disputes. Explain that deletion waits for them, with notice to the user, rather than silently extending. | Legal wording |
| C14 | Documents name B-SEVA PRIVATE LIMITED, Divyasree Holdings address, GSTIN 36AAPCB2396C1ZK. | Invoice settings say "BSeva Services Private Limited" at "123, Banjara Hills Road No. 12, Hyderabad". | Use the documents' legal name and address on invoices. The registered office line begins with another company's name. Confirm it against the MCA record. | NEEDS DECISION |
| C15 | Support: PROV uses partners@b-seva.com. CUST and APP use support@b-seva.com. | The site shows support@b-seva.com and the WhatsApp number. | Choose one per audience and use it everywhere, including both apps' store listings. | NEEDS DECISION |
| C16 | CUST §3 and PROV §3 record "the version accepted". | Registration stores a terms and privacy version, but the client sends a hard-coded "2026-01". It never matches `legal_policies.version`. Customer bookings store a boolean only. | Store the server's current version with a timestamp. Ask for re-acceptance when a version changes (PROV §23 requires this before new bookings). | Implement |

### Placeholders that block publishing (all three documents)
- "DD Month 2026" effective date.
- "Grievance Officer name" (CUST §24, PROV §26, APP §17).
- APP §17 lacks the designation and working hours that the other two documents give.
- No CIN anywhere.
- No Data Protection contact for DPDP Act rights.
- **I will not fill these in.** They need real company data.

---

## 3. Compliance matrix (main requirements)

| Requirement | Source | Today | Status | Change | Apps |
|---|---|---|---|---|---|
| Delete account in app (Profile → Account → Delete Account) | CUST §20, PROV §21, APP §9, Apple 5.1.1(v), Google Play | None. The admin hard delete fails on most users and cascade-deletes the wallet ledger. | NOT IMPLEMENTED | Build the full flow (section 4) | All |
| Web deletion page `/delete-account` | APP §9, Google Play | Route does not exist (the SPA shows its 404) | NOT IMPLEMENTED | Public page: email → OTP → same flow | Web |
| 14-day processing, cancellation, final delete or anonymise | All three | None | NOT IMPLEMENTED | Request table, states, daily job | Backend |
| Retain invoices, tax and dispute records | All three | Invoices hold `bill_to`, including GSTIN | PARTIAL | Keep financial rows. Anonymise identity outside invoices. Document the periods. | Backend |
| Privacy Policy covers real data and third parties | CUST §14, APP §7, Google, Apple | Four generic bullets | FAIL | Rewrite from the data inventory (section 6) for counsel to approve | Web + apps |
| Privacy link inside the apps | Apple, Google, APP §1 ("Profile → Legal") | Only on the register screen | FAIL | Add Profile → Legal to both apps | Apps |
| Legal routes `/privacy-policy`, `/terms-and-conditions`, `/customer-terms`, `/pujari-terms`, `/app-terms` | APP header, requirement | Only `/terms` and `/privacy` exist | NOT IMPLEMENTED | Add the routes and keep the old URLs | Web |
| Footer, login and register legal links | Requirement | Footer and register yes. Login no. | PARTIAL | Add to login screens | Web + apps |
| Acceptance with version and timestamp | CUST §3, PROV §3 | Hard-coded version | PARTIAL | Server-side version, history table, re-acceptance | All |
| Forgot password | Requirement | None anywhere | NOT IMPLEMENTED | Email OTP reset; revokes sessions | Web + apps |
| Change password | Requirement | Exists for customer and pujari. Not in the Admin app. | PARTIAL | Add an email notice and session revocation | Web + apps |
| Session revocation on password change or deletion | Requirement | Admins only. Customer and pujari tokens stay valid for up to 7 days. Logout is local only. | FAIL | Add a per-user token version, checked on every request | Backend |
| Account state enforced by the backend | Requirement | `blocked` only, checked on every request | PARTIAL | Add a deletion state to the same check | Backend |
| OTP: secure generation, single use, attempts, cooldown, prior invalidation | Requirement | Yes: 6-digit CSPRNG, bcrypt hash, 5 attempts, 60-second cooldown, single use | PASS | Keep | Backend |
| OTP expiry 5 minutes | Requirement | 10 minutes (5 for sensitive actions) | PARTIAL | Configurable, default 5 | Backend |
| 5 sends per account per purpose per 24 hours | Requirement | 5 per hour across all purposes. No daily cap. | PARTIAL | Add a per-purpose daily cap with support escalation | Backend |
| Keyed hash for OTP storage | Requirement | bcrypt, not keyed | PARTIAL | bcrypt is acceptable. A keyed HMAC is optional (section 8). | Backend |
| Rate limits safe across instances | Requirement | Database-backed. Fails open if the table is missing. | PASS (note) | Keep | Backend |
| No account enumeration | Requirement | Mostly generic. A 429 appears only for existing accounts. Register returns 409 on a duplicate email. | PARTIAL | Make reset and deletion responses generic | Backend |
| Delivery abstraction (email now, SMS/WhatsApp later) | Requirement | Email provider plus an SMS stub. No WhatsApp. | PARTIAL | Add a WhatsApp stub, inactive | Backend |
| No OTP or token values in logs | Requirement | OTP values not logged. Emails logged. Nginx logs full query strings. | PARTIAL | Mask emails; drop query strings from access logs | Backend, infra |
| Report and block | APP §8, CUST §15, Apple 1.2 | None | NOT IMPLEMENTED | Decision C10 | Apps |
| Permissions match features | Google, Apple | RECORD_AUDIO, SYSTEM_ALERT_WINDOW, WRITE_EXTERNAL_STORAGE, microphone and Face ID strings unused. Customer iOS declares Always location. Admin declares an unused camera. | FAIL | Block them in config. Customer iOS: When In Use only. | Apps |
| Background location disclosure | Google Play policy | In-app disclosure exists | PARTIAL | Add to the Privacy Policy. Play Console declaration and video. | Pujari |
| Pujari iOS app | Requirement | No bundle, no EAS profile | BLOCKED | Decision | Pujari iOS |
| Admin deletion management page | Requirement | None | NOT IMPLEMENTED | Build it (section 5) | Web admin |

---

## 4. Proposed account deletion design

**States:** ACTIVE → DELETION_REQUESTED (OTP verified, account deactivated) → PENDING_RESOLUTION (bookings or money open) → READY_FOR_DELETION → DELETED. Two exits: CANCELLED (user cancels before final deletion) and ESCALATED (overdue, with reason recorded).

**Flow, the same on web, Android and iOS:**
1. **Request form.** Fields:
   - Profile → Account → Delete Account, or `/delete-account` for signed-out users
   - account type
   - registered email, read-only when signed in
   - reason (required list)
   - explanation (10–500 characters)
   - warning and retained-records notice
   - confirmation box
2. **Obligations check.**
   - Customers: upcoming, confirmed, assigned, ongoing and rescheduled bookings; pending refunds; wallet balance; payment disputes.
   - Pujaris: accepted future bookings, ongoing pujas, pending settlements and payouts, disputes, negative wallet.
   - Each item is shown with its resolution option. Nothing is cancelled silently.
3. **Email OTP**, with a new purpose `delete_account`. Uses the same OTP service and the new caps. A failed or expired OTP changes nothing.
4. **On verify, in one transaction:**
   - recheck obligations
   - create the request
   - set the state
   - raise the token version, which signs out every session
   - hide the pujari from discovery and stop new offers
   - stop marketing
   - notify admins
   - email the user the deactivation message (wording in the requirement)
5. **Bookings.**
   - Customer upcoming bookings are cancelled with a refund only when the customer explicitly chose that on the form (decision C2). Otherwise they stay open for admin resolution.
   - Pujari future bookings go into the existing reassignment flow. Admin is notified. A booking is never marked reassigned until a replacement accepts.
   - Ongoing pujas finish normally.
6. **Cancel deletion.** Before final deletion, signing in, or using `/delete-account`, offers only "Cancel Deletion", confirmed by email OTP. It is refused if the account is separately blocked.
7. **Final deletion.** A daily job runs on day 14 for READY requests. It is idempotent and safe to retry.
   - **Delete:** profiles, addresses, family members, documents and their storage objects, photos, signature, FCM tokens, notifications, location pings, OTP rows for that email, consent snapshots, open sessions.
   - **Anonymise:** `users` keeps its id, role and creation date. Name, email and phone are replaced, the password is removed, and the state becomes DELETED. Ratings and support messages keep their text but lose the identity, pending counsel's view.
   - **Keep:** bookings, payments, wallet transactions, refunds, settlements and invoices, including invoice `bill_to` as a tax record. Also booking tax snapshots, reschedule history, security audit logs, and data tied to open disputes.
   - The kept categories and periods come from counsel.
   - A final confirmation email goes to the address captured at request time. That address is then deleted.
8. **Overdue.** Requests not finished by day 14 move to ESCALATED with a reason. The user is told; the deadline is never silently extended.

**Required fixes found while designing this:**
- `DELETE /admin/users/{id}` hard-deletes users, cascade-deletes the wallet ledger, and detaches pujaris from past bookings. Replace it with the deletion flow.
- Production runs with `WORKER_ENABLED=0`, so the daily job, and today's prune, would never run there. It needs either a protected cron call or the worker enabled. Both are Production infrastructure changes and need your approval.
- Legacy Supabase and Vercel storage may still hold personal data. Final deletion must cover it, or it must be decommissioned.
- Backups: RDS keeps automated backups for 14 days and the newest 5 pre-deploy snapshots. Deleted data stays in backups until they expire. The Privacy Policy must say so.

---

## 5. Proposed Admin "Account Deletion Management"

- **Dashboard counts:** new, pending resolution, pending settlement, ready, completed, cancelled, overdue.
- **Table:**
  - request id, role, name, email, phone
  - created and requested dates, deadline
  - reason and explanation
  - booking and money status, assignee, state
- **Detail view:**
  - booking obligations, with links to the existing reassignment and cancel tools
  - money obligations, read-only unless the admin has settlement rights
  - assign, notes, mark review complete
  - approve final deletion (Super Admin only)
  - audit history
- **Permissions:**
  - New `view_account_deletions` and `manage_account_deletions` in the existing permission system.
  - Final approval and anything financial stay Super Admin, using the existing MPIN + OTP challenge.
  - There is no route around settlement authorisation, and no way to delete financial rows.
- **Notifications:** submitted, reassignment needed, refund or payout pending, deadline in 3 days, completed, cancelled, overdue.
- **Audit:** an append-only table with triggers, the same pattern as `security_audit_log`.

---

## 6. Data inventory for the Privacy Policy (verified in code)

**Collected**
- **Account:** name, email, phone, password hash, role, language, consent records.
- **Customer:** addresses, coordinates, GSTIN, profile photo, Family Sankalp members (name, gotra, relationship, date of birth).
- **Pujari:**
  - identity: full name, father's name, gotra, pravara, date of birth, native place, both addresses, gender, languages, qualifications, sampradaya
  - Aadhaar and other documents
  - licence number
  - signature, photo
  - **full bank account number, stored unencrypted**, plus IFSC, UPI and holder name
- **Bookings:**
  - address, coordinates, special instructions
  - meeting links
  - start and completion OTPs, stored in plain text so they can be shown
  - customer timezone and country
- **Seva registrations:** names, gotra, sankalp text, family members.
- **Location:** pujari pings every 60 seconds and 35 metres while travelling; one-off customer location for addresses.
- **Other content:** ratings with comments, support tickets and messages.
- **Device:** push token and platform.
- **Network:** IP addresses in server logs.
- **Customer IP for virtual pujas:** sent to ip-api.com over plain HTTP, and ipapi.co.

**Third parties**
- **Active:**
  - Zoho Mail (email, OTPs, invoices)
  - Firebase Cloud Messaging (push, including puja OTPs in notifications)
  - Google Maps and Places
  - BigDataCloud, open-meteo, OpenStreetMap and photon geocoding, which receive coordinates and search text
  - ip-api.com and ipapi.co
  - AWS (RDS, S3, SSM, CloudWatch, CloudTrail), Mumbai region
  - Umami analytics, hosting unknown
- **Optional proxy:** `forge.butterfly-effect.dev` for Maps, used if only that key is set.
- **Present but off:** Google Calendar/Meet, reCAPTCHA (setting-controlled), Razorpay (label only), SMS (stub).
- **Legacy:** Supabase and Vercel.

**Retention today**
- Nothing is purged except rate-limit rows.
- Location pings, OTP rows, notifications and support data are kept indefinitely.
- Logs: 30 days in Production. CloudTrail: 90 days.
- Backups: 14 days, plus 5 deploy snapshots.

---

## 7. Store readiness (today)

| App | Verdict | Blockers |
|---|---|---|
| Customer Android | NOT READY | No account deletion. No Privacy link in the app. Unused RECORD_AUDIO, SYSTEM_ALERT_WINDOW and WRITE_EXTERNAL_STORAGE. Data Safety form not prepared. Placeholder legal text. |
| Pujari Android | NOT READY | Same as Customer, plus the background location declaration and video, and the Privacy Policy disclosure of tracking. |
| Customer iOS | NOT READY | No account deletion. Always location and the "location" background mode declared without use (Apple 5.1.1 and 2.5.4 risk). Unused microphone and Face ID strings. Privacy manifest lists no data types. App Privacy answers not prepared. EAS has no iOS profile. No report or block if review content is visible (1.2). |
| Pujari iOS | BLOCKED | No iOS bundle or build configuration exists. |

**Payments:** bookings pay for real-world services by a person, which both stores allow outside in-app purchase. Virtual pujas and consultations are live services by a person, which Apple treats as person-to-person services. Counsel should confirm. There is no digital content and no subscription.

**Store-relevant security findings:**
- Plaintext bank account numbers.
- Customer and pujari sessions survive a password change.
- Logout does not revoke the token.
- An IP address is sent over plain HTTP.
- Nginx logs search query strings.

---

## Decisions taken (2 November 2026)

- **Authentication:** the documents will describe email + password with email OTP. No SMS for now.
- **Customer bookings on deletion:**
  - Upcoming bookings are cancelled under the normal Cancellation Policy, so normal fees apply.
  - Each booking's refund is shown before the customer confirms.
  - Ongoing pujas finish first.
- **Report:** build minimal reporting, meaning report a pujari or a booking, plus an admin review queue. The legal clause will be narrowed to match.
- **Pujari iOS:** in scope now.
- **Defaults used where no answer was given:**
  - final deletion on day 14
  - OTP baseline as recommended in item 6
  - job runner prepared in code, with any Production enablement only on approval

## 8. Decisions needed before implementation

1. **Authentication wording (C1).** Recommended: change the documents to email + password with email OTP.
2. **Customer bookings on deletion (C2).** Recommended: the customer chooses cancel-with-full-refund on the form, with the cancellation fee waived. Otherwise admin resolves.
3. **Final deletion timing (C5).** Recommended: on day 14, so the cancellation window always lasts 14 days.
4. **Report and block (C10).** Recommended: build minimal reporting for a pujari or booking, plus an admin queue. Narrow the clause to match.
5. **Payment wording (C9).** Recommended: describe the wallet and the offline top-up until Razorpay is integrated. Correct the in-app text.
6. **OTP baseline.** Recommended: 5-minute expiry, 5 sends per purpose per 24 hours, 60-second cooldown, 5 attempts, all configurable. Super Admin and money actions stay stricter. Support can reset a user's daily cap.
7. **Production job runner.** Recommended: enable the Production worker, or add a protected cron for the daily deletion job. Either is a Production change.
8. **Pujari iOS.** In scope now or later?
9. **Company facts for counsel:**
   - effective dates
   - Grievance Officer
   - CIN
   - DPDP contact
   - the registered office line
   - one support address per audience
   - retention periods per category
10. **Bank account numbers.** Recommended: encrypt them at rest. This is a separate change.

## 9. Proposed delivery (each step as a PR to `develop`, verified on QA, Production only on approval)

1. **Backend foundations:**
   - deletion states and tables
   - token versioning for all roles
   - forgot password
   - OTP caps and expiry
   - deletion request, cancel and final-delete job
   - admin endpoints
   - removal of the hard delete
2. **Web:**
   - legal routes and redirects
   - `/delete-account`
   - Profile → Account (delete, change password)
   - Forgot Password
   - Admin Account Deletion Management
3. **Mobile:**
   - Profile → Legal and Account
   - delete account and cancel deletion
   - forgot password
   - permission clean-up
   - EAS iOS profile
4. **Legal content:** Privacy Policy and Terms pages from counsel-approved text, versioned acceptance and re-acceptance. Publishing waits for counsel.
5. **Store preparation:** Data Safety and App Privacy answers drafted from section 6, review account instructions, real-device test pass.
