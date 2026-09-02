from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError

from app.config import settings
from app.routers import admin, admin_pujari, auth, bookings, customer, lifecycle, ops, pujari, wallet


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Schema migrations are NOT run on cold start (Vercel serverless).
    # Run separately: `cd backend && python -c "from app.schema_migrate import ensure_schema; ensure_schema()"`
    # or apply SQL under supabase/migrations/.
    yield


app = FastAPI(title="BSeva API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?" if settings.environment != "production" else None,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(admin_pujari.router, prefix="/api/v1")
app.include_router(customer.router, prefix="/api/v1")
app.include_router(pujari.router, prefix="/api/v1")
app.include_router(lifecycle.router, prefix="/api/v1")
app.include_router(ops.router, prefix="/api/v1")


@app.exception_handler(OperationalError)
async def database_unavailable(_request: Request, _exc: OperationalError):
    return JSONResponse(
        status_code=503,
        content={
            "detail": (
                "Cannot reach Supabase Postgres. Use the Session pooler URI from "
                "Supabase Dashboard → Connect → Session pooler as DATABASE_URL."
            ),
        },
    )


@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True, "service": "bseva-api"}
