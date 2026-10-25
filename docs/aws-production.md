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

## GoDaddy DNS cutover (only after explicit go-live approval)

Records that must stay exactly as they are: MX (`mx.zoho.in`, `mx2.zoho.in`, `mx3.zoho.in`), the SPF and
`zoho-verification` TXT records, `zmail._domainkey` (DKIM), `_dmarc`, the NS records, and `qa` / `app` A records.

1. A day before: note the current records (screenshot the DNS page). Lower the TTL of the `@` A records to the
   minimum GoDaddy allows (600 s) and wait at least one old TTL.
2. In GoDaddy, disconnect the Airo/Website Builder site from the domain (Website Builder → Settings → Domain),
   otherwise GoDaddy may re-create its own `@` records.
3. Maintenance window (writes frozen on the old system, final data copy reconciled):
   - Delete the two `@` A records `13.248.243.5` and `76.223.105.230`.
   - Add `A  @  43.205.223.51  TTL 600`.
   - Keep `CNAME  www  b-seva.com` (it then follows the new `@` record). If GoDaddy shows `www` as an A record
     instead, set it to `43.205.223.51`.
4. On the Production host: set `DOMAIN=b-seva.com`, `EXTRA_DOMAINS="www.b-seva.com app.b-seva.com"`, set SSM
   `PUBLIC_APP_URL=https://b-seva.com`, redeploy the same image tag, then run
   `/opt/bseva/bin/issue-cert.sh mybseva@gmail.com` once `dig b-seva.com` and `dig www.b-seva.com` return
   `43.205.223.51`. Until the certificate is issued (about a minute) browsers see a certificate warning on b-seva.com.
5. Verify: `https://b-seva.com/api/ready`, `http://b-seva.com` → 301 https, `https://www.b-seva.com` → 301
   `https://b-seva.com`, MX/SPF/DKIM/DMARC unchanged (`dig MX b-seva.com`, `dig TXT b-seva.com`), a test email to the
   Zoho mailbox still arrives.

Rollback: restore the two `@` A records (`13.248.243.5`, `76.223.105.230`) and reconnect the Airo site; the AWS
host keeps running and can be retried later.

## Mobile apps

Store builds before this change call `https://bseva.vercel.app` (baked in at build time, no OTA updates). Keep that
host serving (Vercel external rewrite to `https://b-seva.com`) until users have updated. New production builds use
`EXPO_PUBLIC_API_URL=https://b-seva.com` (`apps/*/eas.json`). Android App Links for `b-seva.com` additionally need
`/.well-known/assetlinks.json` with the Play signing certificate SHA-256, not yet available.
