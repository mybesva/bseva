"""Database engine — serverless-safe for Vercel; pooled for long-running containers (AWS)."""

import os
from urllib.parse import urlparse

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from sqlalchemy.pool import NullPool

from app.config import settings


class Base(DeclarativeBase):
    pass


def _sqlalchemy_url(url: str) -> str:
    if url.startswith("postgresql+psycopg://"):
        return url
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url[len("postgres://") :]
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url[len("postgresql://") :]
    return url


def _connect_args(url: str) -> dict:
    host = (urlparse(url.replace("postgresql+psycopg://", "postgresql://", 1)).hostname or "").lower()
    args: dict = {"connect_timeout": 15}
    # Supabase (pooler or direct) requires SSL
    if "supabase" in host or "pooler.supabase" in host:
        args["sslmode"] = "require"
    # Explicit SSL settings (e.g. RDS: DB_SSLMODE=verify-full + DB_SSLROOTCERT=<RDS CA bundle>)
    sslmode = (os.environ.get("DB_SSLMODE") or "").strip()
    if sslmode:
        args["sslmode"] = sslmode
    rootcert = (os.environ.get("DB_SSLROOTCERT") or "").strip()
    if rootcert:
        args["sslrootcert"] = rootcert
    return args


def _engine_kwargs() -> dict:
    # NullPool (default): open a connection per request, close after — required on Vercel serverless
    # so we do not hold persistent pools across frozen instances.
    # DB_POOL=queue: long-running Gunicorn/worker processes keep a small per-process pool.
    if (os.environ.get("DB_POOL") or "").strip().lower() == "queue":
        return {
            "pool_size": int(os.environ.get("DB_POOL_SIZE") or 5),
            "max_overflow": int(os.environ.get("DB_POOL_OVERFLOW") or 5),
            "pool_recycle": 1800,
            "pool_timeout": 30,
        }
    return {"poolclass": NullPool}


_SA_URL = _sqlalchemy_url(settings.database_url)

engine = create_engine(
    _SA_URL,
    pool_pre_ping=True,
    connect_args=_connect_args(settings.database_url),
    **_engine_kwargs(),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
