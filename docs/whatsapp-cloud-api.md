# WhatsApp Cloud API

Phase 1 (webhook) and Phase 2 (test-number template sending). The Customer and Pujari OTP flows are **not** changed yet: OTP stays email-only.

## What exists

| Piece | Where |
|---|---|
| Webhook: `GET` and `POST /api/v1/webhooks/whatsapp` | `backend/app/routers/whatsapp_webhook.py`, `backend/app/whatsapp/webhook.py` |
| Template sender (off by default) | `backend/app/whatsapp/client.py` |
| Message log and webhook de-duplication | `backend/app/whatsapp/store.py`, `supabase/migrations/042_whatsapp_messaging.sql` |
| Nginx limit for the webhook | `deploy/nginx/templates/common.inc` (`bseva_webhook` zone in `*.conf.template`) |
| Pruning of processed webhook events after 30 days | `backend/app/worker.py` (`_prune`) |

## Settings

All are read from the environment; on AWS they come from SSM `/bseva/<env>/app/<NAME>` (SecureString for secrets).

| Variable | Secret | Purpose |
|---|---|---|
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | yes | Answer Meta's `GET` subscription check. Unset → the route answers 404 |
| `WHATSAPP_APP_SECRET` | yes | Meta App Secret; verifies `X-Hub-Signature-256` on every `POST`. Unset → 404 |
| `WHATSAPP_ACCESS_TOKEN` | yes | System-user token used to send |
| `WHATSAPP_PHONE_NUMBER_ID` | no | Sender. Meta's test number first |
| `WHATSAPP_GRAPH_API_VERSION` | no | Default `v26.0` |
| `WHATSAPP_SEND_ENABLED` | no | Default `false`. Refused at startup in production until the Production rollout is approved |
| `WHATSAPP_RECIPIENT_ALLOWLIST` | no | Comma-separated numbers with country code. Outside production an empty list sends nothing |
| `WHATSAPP_REQUEST_TIMEOUT_SECONDS`, `WHATSAPP_SEND_RETRIES` | no | Defaults 10 and 2 |

Callback URL for QA, once deployed: `https://qa.b-seva.com/api/v1/webhooks/whatsapp`.

## Security behaviour

- Verify token and signature compared in constant time (`hmac.compare_digest`); the HMAC is over the exact raw body.
- The challenge is echoed only if it is a short token (letters, digits, `_-.`), as plain text.
- Bodies over 3 MB are refused (Nginx and the app).
- Access logs never contain the query string, which is where Meta puts the verify token: Nginx logs the webhook route with the `bseva_noquery` format (`$uri`, not `$request`), and the API strips query strings from Uvicorn's access log (`backend/app/access_log.py`). Covered by `backend/tests/test_access_log_redaction.py`. Nginx *error* lines (for example a rate-limit refusal) still quote the full request.
- Every webhook delivery is applied in one transaction. Each event is claimed once in `whatsapp_webhook_events`, so Meta's retries and duplicates are skipped; a failure rolls the claims back, answers 503 and Meta retries.
- Delivery status only moves forward (`accepted → sent → delivered → read`); `failed` applies only before delivery.
- Nothing stores or logs message text, template parameters (they can hold OTPs), tokens or full phone numbers. Numbers are kept as a SHA-256 hash plus the last four digits.
- The client retries only sends that certainly did not reach Meta (connection refused, 429, 5xx, throttling codes), never a timeout on an open connection, so a code is not delivered twice. Error 131049 (per-user marketing limit) is never retried automatically.
- No code registers, migrates or deregisters a phone number. Do not call `/register` for +91 90146 54994: Meta's Coexistence flow skips registration and needs a Solution Partner or Tech Provider.

## Required before WhatsApp OTP (next phase)

**`phone_verified` must be corrected.** `POST /auth/register` stores `phone_verified = TRUE` without checking the phone (only the email code is verified). Before any OTP is sent to a stored phone number:

1. New sign-ups must store `phone_verified = FALSE` until a code sent to that phone is entered.
2. Existing accounts must be treated as unverified (no data change without a numbered migration and approval), and verified on next use.
3. OTP send limits must be keyed per phone as well as per email, so the WhatsApp channel cannot be used to pump paid messages.
4. Email OTP stays as the fallback and is not disabled.

## Local tests

```bash
cd backend
DATABASE_URL=postgresql+psycopg://ci:ci@127.0.0.1:1/ci python -m pytest tests/test_whatsapp_unit.py
BSEVA_TEST_PG_URL=postgresql://postgres@127.0.0.1:5432/postgres python -m pytest tests/test_whatsapp_pg.py
```
