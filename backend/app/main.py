from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import OperationalError, ProgrammingError, SQLAlchemyError

from app.config import settings
from app import env_loader  # noqa: F401 — load .env into os.environ
from app.routers import (
    admin,
    admin_pujari,
    auth,
    bookings,
    consultations,
    customer,
    google_oauth,
    lifecycle,
    meetings,
    notifications,
    ops,
    promos,
    pujari,
    reports,
    support,
    temples,
    tickets,
    wallet,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    # Schema migrations are NOT run on cold start (Vercel serverless).
    # Run separately: `cd backend && python -c "from app.schema_migrate import ensure_schema; ensure_schema()"`
    # or apply SQL under supabase/migrations/.
    try:
        from app.services.firebase_notifications import init_firebase

        init_firebase()
    except Exception:
        pass
    yield


app = FastAPI(title="BSeva API", version="1.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_origin_regex=(
        r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?"
        if settings.environment != "production"
        else None
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(auth.router, prefix="/api/v1")
app.include_router(google_oauth.router, prefix="/api/v1")
app.include_router(bookings.router, prefix="/api/v1")
app.include_router(meetings.router, prefix="/api/v1")
app.include_router(wallet.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(temples.router, prefix="/api/v1")
app.include_router(admin_pujari.router, prefix="/api/v1")
app.include_router(customer.router, prefix="/api/v1")
app.include_router(pujari.router, prefix="/api/v1")
app.include_router(lifecycle.router, prefix="/api/v1")
app.include_router(consultations.router, prefix="/api/v1")
app.include_router(ops.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(promos.router, prefix="/api/v1")
app.include_router(support.router, prefix="/api/v1")
app.include_router(tickets.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")

try:
    from fastapi.staticfiles import StaticFiles
    from app.catalog_images import public_images_root

    _images = public_images_root()
    if _images and _images.is_dir():
        app.mount("/images", StaticFiles(directory=str(_images)), name="catalog-images")
except Exception:
    pass


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


@app.exception_handler(ProgrammingError)
async def database_schema_error(_request: Request, exc: ProgrammingError):
    msg = str(getattr(exc, "orig", None) or exc).split("\n")[0][:240]
    return JSONResponse(
        status_code=500,
        content={"detail": f"Database schema error: {msg}"},
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(_request: Request, exc: SQLAlchemyError):
    msg = str(getattr(exc, "orig", None) or exc).split("\n")[0][:240]
    return JSONResponse(status_code=500, content={"detail": f"Database error: {msg}"})


@app.get("/health")
@app.get("/api/health")
def health():
    return {"ok": True, "service": "bseva-api"}
