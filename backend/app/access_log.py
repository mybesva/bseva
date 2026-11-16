"""Keep query strings out of the API access log.

Under Gunicorn's Uvicorn workers the request line is written by Uvicorn's own "uvicorn.access" logger, not by
Gunicorn's access_log_format, and it includes the query string. Meta's WhatsApp webhook check sends its verify
token there (?hub.verify_token=...), so the logged line is reduced to the path, as deploy/gunicorn.conf.py
already intends ("path": "%(U)s"). Method, status and client address are kept.
"""
from __future__ import annotations

import logging

ACCESS_LOGGER = "uvicorn.access"


class StripQueryString(logging.Filter):
    """Uvicorn logs '%s - "%s %s HTTP/%s" %d' with args (client, method, path_with_query, http_version, status)."""

    def filter(self, record: logging.LogRecord) -> bool:
        args = record.args
        if isinstance(args, tuple) and len(args) >= 3 and isinstance(args[2], str) and "?" in args[2]:
            record.args = (*args[:2], args[2].split("?", 1)[0], *args[3:])
        return True


def install() -> None:
    logger = logging.getLogger(ACCESS_LOGGER)
    if not any(isinstance(f, StripQueryString) for f in logger.filters):
        logger.addFilter(StripQueryString())
