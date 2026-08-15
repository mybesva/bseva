# Deploy BSEVA (demo)

This app is a **long-running Node/Express server** with a **local SQLite** database.
It is **not** a static site and does **not** run correctly on Vercel.

Use **Railway** or **Render** (or Fly.io).

## Required environment variables

| Variable | Required | Notes |
|----------|----------|--------|
| `JWT_SECRET` | Yes | At least 32 characters |
| `NODE_ENV` | Yes | `production` |
| `PORT` | Auto | Set by the host |
| `HOST` | Optional | Defaults to `0.0.0.0` |

Demo SQLite is created automatically under `data/bseva.sqlite` on first start.
On free hosts the disk is often ephemeral — redeploys may reset demo data (OK for demos).

## Railway (recommended)

1. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub**
2. Select the `mybesva/bseva` repo (or your fork)
3. Set variables:
   - `JWT_SECRET` = any secret ≥ 32 chars (e.g. `bseva-demo-jwt-secret-min-32-characters-long`)
   - `NODE_ENV` = `production`
4. Deploy. Railway uses `railway.toml` (`pnpm build` → `pnpm start`)
5. Open the public URL. Health check: `/api/health`

Demo logins (password `password123`):

- `customer@bseva.com`
- `pujari@bseva.com`
- `admin@bseva.com`

## Render

1. Go to [render.com](https://render.com) → **New** → **Blueprint**
2. Connect the repo (uses `render.yaml`)
3. Confirm `JWT_SECRET` is set (Blueprint can auto-generate)
4. Deploy the web service

Or manually:

- **Build:** `pnpm install --frozen-lockfile && pnpm build`
- **Start:** `pnpm start`
- **Health check:** `/api/health`

## Why Vercel fails

Vercel expects serverless / static output. This project builds:

- Frontend → `dist/public/`
- Server → `dist/index.js` (Express)

If Vercel serves `dist/index.js` as a page, you see raw JS (`var __defProp...`).
`vercel.json` in this repo intentionally fails the build and points here.

## Local production smoke test

```bash
pnpm install
pnpm build
JWT_SECRET=bseva-demo-jwt-secret-min-32-characters-long NODE_ENV=production PORT=3001 pnpm start
```

Open http://localhost:3001/
