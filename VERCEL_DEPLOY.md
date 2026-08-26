# Temporary / dev: ONE Vercel project (Vite SPA + FastAPI → Supabase)

## Architecture

```text
https://YOUR-APP.vercel.app/           → React SPA (bseva-export/dist/public)
https://YOUR-APP.vercel.app/api/v1/*   → FastAPI (api/index.py → backend/app)
                                         → Supabase Postgres + Storage
```

Local uvicorn + Vite still work unchanged.

## Vercel project settings

| Setting | Value |
|--------|--------|
| Root Directory | **repository root** (not `bseva-export`) |
| Framework Preset | Other |
| Build Command | from `vercel.json` (or leave default) |
| Output Directory | `bseva-export/dist/public` |
| Install Command | from `vercel.json` |

Do **not** set Root Directory to `bseva-export` — Python entry is `api/index.py` at repo root.

## Environment variables (Vercel → Settings → Environment Variables)

### Frontend (Production + Preview)

Leave `VITE_API_URL` **unset** on Vercel (same-origin `/api/v1/...`).

The root `vercel.json` build forces `VITE_API_URL=` so a local `.env` value of `http://localhost:8000` is **not** baked into the production bundle.

Optional public keys only:
- `VITE_GOOGLE_MAPS_API_KEY`
- `VITE_FRONTEND_FORGE_API_*` / analytics if needed

### Backend (Production + Preview) — never prefix with `VITE_`

```text
DATABASE_URL=<Supabase Session pooler URI>
JWT_SECRET=<32+ random characters>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=10080
CORS_ORIGINS=https://YOUR-APP.vercel.app
ENVIRONMENT=production
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
STORAGE_BUCKET=bseva
OTP_DEV_CODE=123456
```

## Supabase manual setup

1. **Database** — Session pooler connection string as `DATABASE_URL`.
2. Apply schema once (not on cold start):
   - SQL editor: `supabase/migrations/001_init.sql`
   - Plus: `cd backend && python -c "from app.schema_migrate import ensure_schema; ensure_schema()"`
3. **Storage** — create a **private** bucket named `bseva` (or match `STORAGE_BUCKET`).
4. Service role key stays server-only.

## Local development

```bash
# API
cd backend && uvicorn app.main:app --reload --port 8000

# Web (with VITE_API_URL=http://localhost:8000 in bseva-export/.env)
cd bseva-export && npm run dev
```

Uploads use local `backend/app/data/documents` when Supabase Storage env is empty; on Vercel they use Supabase Storage.

## Schema / seed (run separately, not on Vercel cold start)

```bash
cd backend
python -c "from app.schema_migrate import ensure_schema; ensure_schema()"
python seed.py
```

## Limits (temp deploy)

- Cold starts on `/api`
- Function timeout ~30s (Hobby/Pro limits)
- Not a long-running uvicorn process
- Mobile can later point `EXPO_PUBLIC_API_URL` at this same origin or a future AWS URL
