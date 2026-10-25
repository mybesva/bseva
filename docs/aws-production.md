# B-Seva Production on AWS (Mumbai)

| | QA | Production |
|---|---|---|
| Public URL | https://qa.b-seva.com | **https://b-seva.com** (canonical) |
| Redirects | — | `www.b-seva.com` → `b-seva.com`; after cutover `app.b-seva.com` → `b-seva.com` |
| Staging hostname (before cutover) | — | https://app.b-seva.com |
| AWS account / region | 472238087252 / ap-south-1 | same account, separate `bseva-prod-*` resources |
| Elastic IP | 15.252.163.89 | 43.205.223.51 |
| Infrastructure | `python3 infra/aws/bseva_qa.py plan` | `python3 infra/aws/bseva_qa.py --env production plan` |
| SSM settings | `/bseva/qa/app/*` | `/bseva/prod/app/*` (secrets: `/bseva/prod/admin/*`) |

## Host settings (`/opt/bseva/.env`, written by `deploy/ci/ssm_deploy.py`)

- `DOMAIN`: the canonical host Nginx serves and the certificate is named after.
- `EXTRA_DOMAINS`: space-separated hosts that redirect (301) to `DOMAIN`. They get an HTTPS redirect once the
  certificate covers them; `deploy/host/issue-cert.sh` expands the certificate when names are added.

Staging phase: `DOMAIN=app.b-seva.com`, `EXTRA_DOMAINS=""`, `PUBLIC_APP_URL=https://app.b-seva.com`.
After cutover: `DOMAIN=b-seva.com`, `EXTRA_DOMAINS="www.b-seva.com app.b-seva.com"`, `PUBLIC_APP_URL=https://b-seva.com`.

## Certificate before cutover (DNS-01, no browser warnings)

1. On the Production host: `/opt/bseva/bin/issue-cert-dns01.sh mybseva@gmail.com b-seva.com b-seva.com www.b-seva.com app.b-seva.com`
   (runs in the background; the live staging site keeps running).
2. Read `/opt/bseva/state/acme-dns01.txt` and add those three TXT records in GoDaddy
   (`_acme-challenge`, `_acme-challenge.www`, `_acme-challenge.app`). Nothing else changes.
3. The script waits until public DNS shows them, validates, and stores the `b-seva.com` certificate (covering all three
   names) next to the current `app.b-seva.com` one. Then delete the three TXT records.

## GoDaddy DNS cutover (only after explicit go-live approval)

Records that must stay exactly as they are: MX (`mx.zoho.in`, `mx2.zoho.in`, `mx3.zoho.in`), the SPF and
`zoho-verification` TXT records, `zmail._domainkey` (DKIM), `_dmarc`, the NS records, and the `qa` / `app` A records.

1. A day before: screenshot the DNS page. Lower the TTL of the two `@` A records to 600 s and wait one old TTL.
2. In GoDaddy, disconnect the Airo/Website Builder site from the domain, otherwise GoDaddy may re-create its `@` records.
3. Freeze writes on the old system (`READ_ONLY_MODE=1` on Vercel), then re-sync the catalog (the live admin console
   keeps editing it until the freeze): `reference_data.py export` locally (read-only), then on Production
   `reference_data.py import --apply --production-catalog`, and compare fingerprints (0 missing, 0 different).
   Data policy: catalog and non-personal configuration only. No accounts, profiles, KYC, wallets, bookings,
   payments, refunds, settlements, OTPs or sessions are migrated; Production starts with its bootstrap Super Admin.
4. Production host first (the certificate already exists, so HTTPS is valid immediately):
   `DOMAIN=b-seva.com`, `EXTRA_DOMAINS="www.b-seva.com app.b-seva.com"` in `/opt/bseva/.env`, SSM
   `PUBLIC_APP_URL=https://b-seva.com`, then `/opt/bseva/bin/deploy.sh <current tag>`. `app.b-seva.com` now redirects to
   `https://b-seva.com`.
5. GoDaddy: delete `A @ 13.248.243.5` and `A @ 76.223.105.230`, add `A @ 43.205.223.51` (TTL 600). Keep
   `CNAME www → b-seva.com` (if `www` is an A record instead, set it to `43.205.223.51`).
6. Once `dig b-seva.com` and `dig www.b-seva.com` return `43.205.223.51`: run
   `/opt/bseva/bin/issue-cert.sh mybseva@gmail.com` once. It re-issues the same names over HTTP-01 so renewals are automatic.
7. Verify `https://b-seva.com/api/ready`, `http://b-seva.com` → 301 https, `https://www.b-seva.com` and
   `https://app.b-seva.com` → 301 `https://b-seva.com`, `dig MX b-seva.com` / `dig TXT b-seva.com` unchanged, and a test
   email to the Zoho mailbox still arrives.

Rollback: restore the two `@` A records and reconnect the Airo site, set `DOMAIN=app.b-seva.com`, `EXTRA_DOMAINS=""`
and redeploy; lift `READ_ONLY_MODE` on Vercel.

## Mobile apps

Store builds before this change call `https://bseva.vercel.app` (baked in at build time, no OTA updates). Keep that
host serving (Vercel external rewrite to `https://b-seva.com`) until users have updated. New production builds use
`EXPO_PUBLIC_API_URL=https://b-seva.com` (`apps/*/eas.json`). Android App Links for `b-seva.com` additionally need
`/.well-known/assetlinks.json` with the Play signing certificate SHA-256, not yet available.
