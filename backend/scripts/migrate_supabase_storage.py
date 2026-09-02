#!/usr/bin/env python3
"""Copy Storage objects from old Supabase project bucket to new (same paths)."""
from __future__ import annotations

import os
import sys
from pathlib import Path

import httpx
import psycopg

ROOT = Path(__file__).resolve().parents[2]

OLD = {
    "url": os.environ.get("OLD_SUPABASE_URL", "https://upyumpuwjzzrkuovkxqe.supabase.co"),
    "key": os.environ.get("OLD_SUPABASE_SERVICE_ROLE_KEY", ""),
    "bucket": os.environ.get("OLD_STORAGE_BUCKET", "bseva"),
}
NEW = {
    "url": os.environ.get("SUPABASE_URL", ""),
    "key": os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
    "bucket": os.environ.get("STORAGE_BUCKET", "bseva"),
}


def load_env() -> None:
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def db_url() -> str:
    url = os.environ.get("DATABASE_URL", "").replace(":6543/", ":5432/")
    if not url:
        raise SystemExit("DATABASE_URL missing")
    return url


def storage_paths(conn) -> list[str]:
    paths: set[str] = set()
    queries = [
        "SELECT storage_path FROM pujari_documents WHERE storage_path IS NOT NULL",
        "SELECT profile_photo_path FROM customer_profiles WHERE profile_photo_path IS NOT NULL",
        "SELECT profile_photo_path FROM pujari_profiles WHERE profile_photo_path IS NOT NULL",
        "SELECT signature_path FROM pujari_profiles WHERE signature_path IS NOT NULL",
    ]
    for q in queries:
        for (p,) in conn.execute(q).fetchall():
            if p:
                paths.add(str(p).lstrip("/"))
    return sorted(paths)


def dl(cfg: dict, path: str) -> bytes:
    url = f"{cfg['url'].rstrip('/')}/storage/v1/object/{cfg['bucket']}/{path}"
    headers = {"Authorization": f"Bearer {cfg['key']}", "apikey": cfg["key"]}
    res = httpx.get(url, headers=headers, timeout=60)
    res.raise_for_status()
    return res.content


def ul(cfg: dict, path: str, data: bytes) -> None:
    url = f"{cfg['url'].rstrip('/')}/storage/v1/object/{cfg['bucket']}/{path}"
    headers = {
        "Authorization": f"Bearer {cfg['key']}",
        "apikey": cfg["key"],
        "Content-Type": "application/octet-stream",
        "x-upsert": "true",
    }
    res = httpx.post(url, content=data, headers=headers, timeout=60)
    if res.status_code not in (200, 201):
        res = httpx.put(url, content=data, headers=headers, timeout=60)
    res.raise_for_status()


def main() -> None:
    load_env()
    NEW["url"] = os.environ.get("SUPABASE_URL", NEW["url"])
    NEW["key"] = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", NEW["key"])
    NEW["bucket"] = os.environ.get("STORAGE_BUCKET", NEW["bucket"])
    OLD["key"] = os.environ.get("OLD_SUPABASE_SERVICE_ROLE_KEY", OLD["key"])

    if not OLD["key"] or not NEW["key"]:
        raise SystemExit(
            "Set OLD_SUPABASE_SERVICE_ROLE_KEY and SUPABASE_SERVICE_ROLE_KEY in .env "
            "(old project: Settings → API → service_role; new project: same)."
        )

    with psycopg.connect(db_url()) as conn:
        paths = storage_paths(conn)
    print(f"Found {len(paths)} storage paths in DB")

    ok = 0
    for path in paths:
        try:
            data = dl(OLD, path)
            ul(NEW, path, data)
            ok += 1
            print(f"  copied {path} ({len(data)} bytes)")
        except Exception as exc:
            print(f"  SKIP {path}: {exc}")

    print(f"Storage migration done: {ok}/{len(paths)} files")


if __name__ == "__main__":
    main()
