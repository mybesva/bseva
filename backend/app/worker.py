"""Background worker for long-running deployments (AWS QA/Production).

Runs the same jobs the /ops/cron/* endpoints expose, on a fixed schedule, without public HTTP calls:

    python -m app.worker

* Each job takes a Postgres advisory lock (pg_try_advisory_lock) on a dedicated connection, so two
  workers — e.g. during a deploy overlap — never run the same job at the same time.
* Jobs are window scans; after a restart the next tick catches up. Side effects are deduplicated
  inside the jobs (job_dedupe, notification checks).
* Heartbeat: WORKER_HEARTBEAT_FILE is touched after every loop (used by the container healthcheck).
* SIGTERM/SIGINT: the current job finishes, then the worker exits cleanly.
"""
from __future__ import annotations

import json
import logging
import os
import signal
import sys
import time
import zlib
from collections.abc import Callable
from pathlib import Path

from sqlalchemy import text

from app.db import SessionLocal, engine

logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"), format="%(message)s", stream=sys.stdout)
logger = logging.getLogger("bseva.worker")

HEARTBEAT = Path(os.environ.get("WORKER_HEARTBEAT_FILE", "/tmp/worker-heartbeat"))
_stopping = False


def _log(event: str, **fields) -> None:
    logger.info(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "event": event, **fields}, default=str))


def _with_session(fn: Callable) -> Callable[[], dict]:
    def run() -> dict:
        db = SessionLocal()
        try:
            out = fn(db)
            db.commit()
            return out if isinstance(out, dict) else {"result": out}
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

    return run


def _puja_lifecycle(db) -> dict:
    from app.jobs.booking_reminders import (
        issue_complete_otps_nearing_end,
        issue_start_otps_nearing_start,
        notify_location_unlocked,
    )

    return {
        "start_otp": issue_start_otps_nearing_start(db),
        "complete_otp": issue_complete_otps_nearing_end(db),
        "location_unlock": notify_location_unlocked(db),
    }


def _reminders(db) -> dict:
    from app.jobs.booking_reminders import send_upcoming_booking_reminders

    return send_upcoming_booking_reminders(db, hours_ahead=24)


def _offers(db) -> dict:
    from app.booking_offers import refresh_offers_for_open_bookings

    return {"newly_invited": len(refresh_offers_for_open_bookings(db))}


def _prune(db) -> dict:
    deleted = {}
    for table, column, days in (("job_dedupe", "created_at", 30), ("security_rate_limits", "window_start", 2)):
        try:
            with db.begin_nested():
                res = db.execute(text(f"DELETE FROM {table} WHERE {column} < NOW() - make_interval(days => :d)"), {"d": days})
                deleted[table] = res.rowcount
        except Exception:
            deleted[table] = "unavailable"
    return deleted


def _settlements(db) -> dict:
    from app.settlement_cycle import run_due_settlements

    return run_due_settlements(db)


# name -> (interval seconds, job). Matches the documented cron cadence.
JOBS: dict[str, tuple[int, Callable[[], dict]]] = {
    "puja_lifecycle": (int(os.environ.get("WORKER_LIFECYCLE_SECONDS", 60)), _with_session(_puja_lifecycle)),
    "booking_reminders": (int(os.environ.get("WORKER_REMINDER_SECONDS", 300)), _with_session(_reminders)),
    "booking_offers": (int(os.environ.get("WORKER_OFFERS_SECONDS", 300)), _with_session(_offers)),
    "settlements": (int(os.environ.get("WORKER_SETTLEMENT_SECONDS", 3600)), _with_session(_settlements)),
    "prune": (86400, _with_session(_prune)),
}


def _run_locked(name: str, job: Callable[[], dict]) -> None:
    lock_id = zlib.crc32(f"bseva-job:{name}".encode())
    started = time.monotonic()
    with engine.connect() as conn:
        got = conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": lock_id}).scalar()
        conn.commit()
        if not got:
            _log("job_skipped_locked", job=name)
            return
        try:
            result = job()
            _log("job_ok", job=name, ms=int((time.monotonic() - started) * 1000), result=result)
        except Exception as exc:
            _log("job_failed", job=name, ms=int((time.monotonic() - started) * 1000), error=type(exc).__name__, detail=str(exc)[:300])
        finally:
            conn.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": lock_id})
            conn.commit()


def _stop(signum, _frame) -> None:
    global _stopping
    _stopping = True
    _log("worker_stopping", signal=signum)


def main() -> int:
    signal.signal(signal.SIGTERM, _stop)
    signal.signal(signal.SIGINT, _stop)
    if (os.environ.get("WORKER_ENABLED", "1").strip().lower()) in ("0", "false", "no", "off"):
        _log("worker_disabled")
        while not _stopping:
            HEARTBEAT.touch()
            time.sleep(30)
        return 0
    next_run = {name: 0.0 for name in JOBS}
    _log("worker_started", jobs={k: v[0] for k, v in JOBS.items()})
    while not _stopping:
        now = time.monotonic()
        for name, (interval, job) in JOBS.items():
            if _stopping:
                break
            if now >= next_run[name]:
                try:
                    _run_locked(name, job)
                except Exception as exc:  # database unreachable etc. — keep the loop alive
                    _log("job_error", job=name, error=type(exc).__name__, detail=str(exc)[:300])
                next_run[name] = time.monotonic() + interval
        HEARTBEAT.touch()
        for _ in range(10):
            if _stopping:
                break
            time.sleep(1)
    _log("worker_stopped")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
