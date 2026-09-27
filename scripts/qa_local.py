"""Run commands against an isolated local QA database, without production credentials.

Usage: python3 scripts/qa_local.py <command> [args...]
The database must be created separately. This does not change application auth/RBAC.
"""
from pathlib import Path
import os
import sys

ROOT = Path(__file__).resolve().parents[1]
DATABASE = "bseva_mobile_qa_20260926"


def environment():
    env = os.environ.copy()
    # Prevent the application's dotenv loaders from filling unset keys with live values.
    for path in (ROOT / ".env", ROOT / ".env.local", ROOT / "backend/.env"):
        if path.exists():
            for line in path.read_text().splitlines():
                if "=" in line and not line.strip().startswith("#"):
                    env[line.split("=", 1)[0].strip()] = ""
    env.update(
        DATABASE_URL=f"postgresql://localhost/{DATABASE}",
        JWT_SECRET="isolated-local-bseva-qa-only-20260926-secret",
        ENVIRONMENT="development",
        OTP_DEV_CODE="123456",
        PUBLIC_APP_URL="http://localhost:5173",
        ADMIN_UI_PATH="/bseva-ops-m8k4q",
        VITE_ADMIN_PATH="/bseva-ops-m8k4q",
        CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173",
        EXPO_PUBLIC_API_URL="http://localhost:8000",
        VITE_API_URL="http://localhost:8000",
        PYTHONDONTWRITEBYTECODE="1",
    )
    node_bin = Path.home() / ".nvm/versions/node/v20.20.0/bin"
    if node_bin.exists():
        env["PATH"] = f"{node_bin}:{os.environ['PATH']}"
    return env


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    os.execvpe(sys.argv[1], sys.argv[1:], environment())
