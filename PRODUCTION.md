# BSeva production conversion

This repo now has three production pieces plus the existing demo web UI:

1. `supabase/migrations/001_init.sql` — PostgreSQL schema for Supabase
2. `backend/` — FastAPI API (auth, bookings, wallet, admin, documents)
3. `bseva-export/` — existing BSeva web UI, now with `/login` + `/register` talking to FastAPI when `VITE_API_URL` is set
4. `mobile/` — one Expo app; after login it shows the Customer, Pujari, or Admin home
5. `packages/locales/` — shared EN / HI / TE strings

## Architecture

- One web app, one React Native app, one FastAPI backend, one Supabase Postgres + Storage bucket (`bseva`)
- Roles: `customer` | `pujari` | `admin`. Admin cannot self-register
- Login does not ask for role; the JWT contains it
- Blocked users cannot login, book, or use wallet. Blocked pujaris are excluded from nearby search
- Cancellation: >48h 10% fee / 90% refund; 24–48h 50/50; <24h not allowed. Calculated only on the server
- Prices are snapshotted onto `bookings` so later admin changes do not rewrite history

## Environment

Copy `backend/.env.example` to `backend/.env`. Use your existing root `.env` values:

- `DATABASE_URL` (Supabase Postgres)
- `JWT_SECRET` (32+ random characters)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (backend only — never ship this to web/mobile)
- `SUPABASE_ANON_KEY` (optional, clients)
- `STORAGE_BUCKET=bseva`

Web: `bseva-export/.env` with `VITE_API_URL=http://localhost:8000`  
Mobile: `EXPO_PUBLIC_API_URL=http://localhost:8000`

## Database

In the Supabase SQL editor, run `supabase/migrations/001_init.sql`.  
Create a **private** Storage bucket named `bseva`.  
Then:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python seed.py
uvicorn app.main:app --reload --port 8000
```

Seed accounts (password `TestPass123!`):

| Role | Name | Email | Phone |
|------|------|-------|-------|
| Super Admin | BSeva Super Admin | `super@bseva.test` | `9000000000` |
| Admin | BSeva Admin | `admin@bseva.test` | `9000000001` |
| Customer | Ananya Customer | `customer1@bseva.test` | `9000000002` |
| Customer | Rohan Customer | `customer2@bseva.test` | `9000000003` |
| Customer | Meera Customer | `customer3@bseva.test` | `9000000004` |
| Head Pujari | Pandit Sharma | `pujari1@bseva.test` | `9000000005` |
| Pujari | Pandit Reddy | `pujari2@bseva.test` | `9000000006` |

Run: `cd backend && python seed.py` (idempotent — keeps existing users, adds/upgrades missing roles).

Dev OTP is `123456` unless `ENVIRONMENT=production`.

## Deploy

**Temporary one-project Vercel (web + FastAPI):** see `VERCEL_DEPLOY.md`.

**Recommended longer-term:**
- **Web (Vite SPA):** Vercel. Same-origin `/api` or set `VITE_API_URL`.
- **FastAPI:** Railway, Render, Fly, or AWS when you leave the temp setup.
- **Postgres + Storage:** Supabase.
- **Mobile:** EAS Build after `EXPO_PUBLIC_API_URL` points at the API origin.

Do not put secrets in `VITE_*` variables.

## Security checklist

- Passwords hashed with bcrypt
- JWT required for protected routes
- Role checks on admin / pujari / customer endpoints
- Blocked flag enforced in auth middleware and booking/wallet/search
- Private documents: storage paths in DB; service role stays on the server
- CORS via `CORS_ORIGINS`
- Audit rows for block / verify actions

## Still on the old demo path

Until `VITE_API_URL` is set, the current web app can still use the Node/tRPC demo. Point it at FastAPI for production auth and bookings.
