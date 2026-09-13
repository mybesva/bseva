"""Load .env files into os.environ for modules that use os.getenv directly."""
from __future__ import annotations

import os
from pathlib import Path


def load_dotenv_files() -> None:
    here = Path(__file__).resolve().parent  # backend/app
    candidates = [
        here.parent / ".env",  # backend/.env
        here.parent.parent / ".env",  # repo root .env
    ]
    for path in candidates:
        if not path.is_file():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, val = line.partition("=")
            key = key.strip()
            val = val.strip().strip("'").strip('"')
            if key and key not in os.environ:
                os.environ[key] = val


load_dotenv_files()
