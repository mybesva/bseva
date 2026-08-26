"""Database engine — serverless-safe for Vercel; also works with local uvicorn."""

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
    # Supabase (pooler or direct) requires SSL
    if "supabase" in host or "pooler.supabase" in host:
        return {"sslmode": "require", "connect_timeout": 15}
    return {"connect_timeout": 15}


_SA_URL = _sqlalchemy_url(settings.database_url)

# NullPool: open a connection per request, close after — required on Vercel serverless
# so we do not hold persistent pools across frozen instances.
engine = create_engine(
    _SA_URL,
    poolclass=NullPool,
    pool_pre_ping=True,
    connect_args=_connect_args(settings.database_url),
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
