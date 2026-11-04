# Compliance release: API contract (backend ↔ web ↔ mobile)

All paths are under `/api/v1`. JSON in and out. Errors use the existing shape: `{"detail": "..."}`, or `{"detail": {"code": "...", "message": "..."}}` for coded errors. Money is in paise.

## Account states
`users.account_state` is one of:
- `active`
- `deletion_requested`: deactivated, waiting for final deletion
- `deleted`: anonymised

A non-active account is refused on every authenticated request with **403**:

```json
{"detail": {"code": "ACCOUNT_DELETION_PENDING", "message": "This account is scheduled for deletion. You can cancel the request before <date>."}}
```

`POST /auth/login` returns the same 403 for these accounts, after the password checks out. Clients show the message and a **Cancel Deletion** action, which opens the cancel flow below.

## Sessions
Changing or resetting a password, requesting deletion, and cancelling deletion all end every existing session. The server bumps `users.token_version`.

`POST /auth/change-password` now also returns `{"ok": true, "access_token": "<new token>"}`. Clients replace their stored token with it.

## Forgot password (customer, pujari, head_pujari)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/password/forgot` | `{"email"}` | Always `200 {"ok": true, "message": "If an account exists for this email, we have sent a code."}`. A 429 only for rate limits, with the same wording for any email. |
| POST | `/auth/password/reset` | `{"email", "code", "new_password"}` | `200 {"ok": true}`, or `400 {"detail": {"code": "INVALID_CODE", ...}}`. The password must be at least 8 characters. All sessions end, and the user gets an email notice. |

- OTP: 6 digits, expires in 5 minutes, 60-second resend gap, 5 sends per purpose per 24 hours, 5 wrong tries.
- Admin and Super Admin passwords are not reset this way.

## Account deletion
Reasons (fixed list, send the key):
- `no_longer_using`
- `not_satisfied`
- `privacy`
- `payment_settlement`
- `app_issues`
- `duplicate_account`
- `other`

`explanation` is required, 10–500 characters.

### Signed-in user (Bearer access token)
| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/account/deletion` | — | `DeletionOverview` (below) |
| POST | `/account/deletion/request-otp` | `{"reason", "explanation"}` | `200 {"ok": true, "message": "...", "email_hint": "ab***@x.com"}`, or 429 with `retry_after_seconds` |
| POST | `/account/deletion/confirm` | `{"reason", "explanation", "code", "acknowledge": true}` | `200 {"request": DeletionRequest}`. The account is deactivated; clients sign out locally. |

### Signed-out user (website `/delete-account`)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/account/deletion/public/request-otp` | `{"email"}` | Always `200 {"ok": true, "message": "If an account exists..."}` |
| POST | `/account/deletion/public/verify` | `{"email", "code"}` | `200 {"deletion_token": "...", "expires_in": 900}`, or 400 INVALID_CODE |

Then call `GET /account/deletion` and `POST /account/deletion/confirm` with `Authorization: Bearer <deletion_token>`. With a deletion token, confirm needs no `code`, because the email was already verified.

If the account is already pending deletion, `GET` returns its request so the page can offer cancellation.

### Cancel deletion (public; works while deactivated)
| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/account/deletion/cancel/request-otp` | `{"email"}` | Always 200, generic |
| POST | `/account/deletion/cancel` | `{"email", "code"}` | `200 {"ok": true, "message": "Your deletion request was cancelled. You can sign in again."}`, or 400 |

- Cancelled bookings are **not** restored.
- A blocked account stays blocked after cancelling.

### Shapes
```ts
type DeletionOverview = {
  account: { role: "customer" | "pujari" | "head_pujari"; email: string; name: string };
  request: DeletionRequest | null;          // open or last request
  reasons: { key: string; label: string }[];
  obligations: {
    bookings: {
      id: string; booking_number: string; service_name: string;
      booking_date: string; start_time: string; status: string;
      kind: "upcoming" | "ongoing";
      // customer upcoming: what cancelling now would cost
      cancellation?: { allowed: boolean; refund_paise: number; fee_paise: number; policy_note: string };
      // pujari accepted future booking
      action?: "reassign";
    }[];
    wallet_balance_paise: number;           // customer refundable balance / pujari payable or owed
    pending_refunds: number;                // count
    pending_settlement_paise: number;       // pujari payouts not yet settled
    blocking: string[];                     // human messages; final deletion waits until these are resolved
  };
  retention_notice: string;                 // what is kept and why (show it on the form)
};

type DeletionRequest = {
  id: string; state: "requested" | "pending_resolution" | "ready" | "deleted" | "cancelled" | "escalated";
  reason: string; explanation: string;
  requested_at: string; deadline_at: string; cancelled_at: string | null; completed_at: string | null;
  message: string;                           // user-facing status text
};
```

On confirm, depending on the role:
- **Customer:**
  - Upcoming bookings are cancelled under the normal Cancellation Policy, so normal fees apply. The overview shows each refund and fee beforehand.
  - Ongoing pujas are left to finish.
- **Pujari:**
  - Accepted future bookings are released into the existing reassignment flow, and admins are notified.
  - The pujari is hidden from discovery and gets no new offers.

The confirmation message is fixed: "Your account has been deactivated. Your account deletion request will be completed within 14 days, subject to any legally required retention or unresolved obligations. You will receive confirmation by email."

## Admin: account deletions
Permissions:
- `view_account_deletions` (list and detail)
- `manage_account_deletions` (assign, notes, review complete, escalate)

Super Admin has both.

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/admin/account-deletions` | `?status=&q=&page=&page_size=` | `{"items": [...], "total", "page", "pages", "counts": {"total","requested","pending_resolution","ready","deleted","cancelled","escalated","overdue"}}` |
| GET | `/admin/account-deletions/{id}` | — | `{"request": {...}, "user": {name,email,phone,role,created_at}, "obligations": {...}, "events": [{action, actor_name, detail, created_at}]}` |
| POST | `/admin/account-deletions/{id}/assign` | `{"admin_id": "uuid" or null}` | `{"ok": true}` |
| POST | `/admin/account-deletions/{id}/note` | `{"note"}` | `{"ok": true}` |
| POST | `/admin/account-deletions/{id}/review-complete` | `{"note"?}` | `{"ok": true, "state"}`. 400 if obligations still block. |
| POST | `/admin/account-deletions/{id}/escalate` | `{"reason"}` | `{"ok": true}` |
| GET | `/admin/admins-lite` | — | `[{id, name}]`, for the assign picker |

Each list item has:
- `id`, `user_id`, `role`, `name`, `email`, `phone`
- `account_created_at`, `requested_at`, `deadline_at`
- `reason`, `explanation`
- `booking_count`, `active_bookings`
- `financial_status`
- `assigned_admin_name`, `state`, `overdue`

Final deletion is not an admin button. A daily job deletes `ready` requests on day 14. Requests not ready by then become `escalated`.

Financial actions use the existing settlement and wallet screens, with their MPIN + OTP. This page only links to them.

## Reports (complaints)
Target types:
- `pujari`: customer reports a pujari
- `booking`: either side reports a booking
- `customer`: pujari reports a customer

Reasons:
- `misconduct`
- `no_show`
- `unsafe`
- `fraud`
- `payment`
- `inappropriate_content`
- `other`

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/reports` | `{"target_type", "target_id", "booking_id"?, "reason", "details"}` | `200 {"id", "status": "open"}`. `details` is 10–1000 characters. |
| GET | `/reports/mine` | — | `[{id, target_type, reason, status, created_at, resolution}]` |
| GET | `/admin/user-reports` | `?status=&target_type=&page=` | `{"items", "total", "page", "pages", "counts": {"open","in_review","escalated","resolved","dismissed"}}` |
| GET | `/admin/user-reports/{id}` | — | report + reporter + target summary + history |
| PATCH | `/admin/user-reports/{id}` | `{"status": "in_review"\|"escalated"\|"resolved"\|"dismissed", "resolution"?, "note"?}` | `{"ok": true}` |

- Permissions: `view_complaints` and `manage_complaints`.
- A user can only report a booking they belong to, or the pujari or customer on that booking.

## Legal pages (website, public, no login)
| Path | Notes |
|---|---|
| `/privacy-policy` | `/privacy` keeps working (redirect) |
| `/customer-terms` | `/terms-and-conditions` and `/terms` point here |
| `/pujari-terms` | |
| `/app-terms` | Mobile App Terms of Use & EULA |
| `/refund-policy` | Cancellation & Refund Policy. `/cancellation-policy` redirects here. |
| `/delete-account` | Public deletion and cancel page |

The content lives in `bseva-export/client/src/content/legal/*.ts`. The mobile apps open these URLs from Profile → Legal.

Legal content shape:
```ts
export type LegalDoc = {
  slug: string; title: string; version: string;
  effectiveDate: string;                 // e.g. "4 November 2026"
  intro?: string[];
  sections: { id: string; heading: string; paragraphs?: string[]; bullets?: string[]; table?: string[][] }[];
};
```
