"""The WhatsApp webhook verify token (a query parameter) must never reach the API or Nginx access log.

Checks the Uvicorn access-log filter directly and through a real Uvicorn process, and the Nginx templates
statically. When an `nginx` binary is available, a real Nginx built from the templates is run against a stub
upstream and its access log is inspected; otherwise that check skips (CI validates the config with nginx -t).
"""
from __future__ import annotations

import http.server
import logging
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
import urllib.request
from pathlib import Path

import pytest

from app import access_log

BACKEND = Path(__file__).resolve().parents[1]
REPO = BACKEND.parent
TEMPLATES = REPO / "deploy" / "nginx" / "templates"
TOKEN = "tok-" + "7" * 40
WEBHOOK = f"/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token={TOKEN}&hub.challenge=12345"


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _wait(url: str, seconds: float = 20) -> None:
    deadline = time.time() + seconds
    while time.time() < deadline:
        try:
            urllib.request.urlopen(url, timeout=1)
            return
        except urllib.error.HTTPError:
            return
        except OSError:
            time.sleep(0.2)
    raise AssertionError(f"{url} did not come up")


def _get(url: str) -> int:
    try:
        with urllib.request.urlopen(url, timeout=5) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code


# --- API (Uvicorn) access log ---------------------------------------------------------------------------------

def test_filter_strips_query_and_keeps_method_path_status(caplog):
    access_log.install()
    logger = logging.getLogger(access_log.ACCESS_LOGGER)
    with caplog.at_level(logging.INFO, logger=access_log.ACCESS_LOGGER):
        logger.info('%s - "%s %s HTTP/%s" %d', "203.0.113.9:0", "GET", WEBHOOK, "1.1", 200)
    line = caplog.records[-1].getMessage()
    assert TOKEN not in line and "?" not in line
    assert line == '203.0.113.9:0 - "GET /api/v1/webhooks/whatsapp HTTP/1.1" 200'


def test_filter_leaves_other_records_alone():
    f = access_log.StripQueryString()
    plain = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, '%s - "%s %s HTTP/%s" %d',
                              ("1.2.3.4:0", "GET", "/health", "1.1", 200), None)
    odd = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "no args", None, None)
    assert f.filter(plain) and plain.args[2] == "/health"
    assert f.filter(odd) and odd.args is None


def test_install_is_idempotent_and_done_by_app():
    import app.main  # noqa: F401  (installs the filter at import)

    access_log.install()
    filters = [f for f in logging.getLogger(access_log.ACCESS_LOGGER).filters if isinstance(f, access_log.StripQueryString)]
    assert len(filters) == 1


def test_real_uvicorn_access_log_has_no_token():
    port = _free_port()
    env = {
        **os.environ,
        "DATABASE_URL": "postgresql+psycopg://ci:ci@127.0.0.1:1/ci",
        "ENVIRONMENT": "development",
        "WHATSAPP_WEBHOOK_VERIFY_TOKEN": TOKEN,
        "WHATSAPP_APP_SECRET": "unused-in-this-test",
        "PYTHONDONTWRITEBYTECODE": "1",
    }
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
        cwd=BACKEND, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True,
    )
    try:
        _wait(f"http://127.0.0.1:{port}/health")
        assert _get(f"http://127.0.0.1:{port}{WEBHOOK}") == 200
        assert _get(f"http://127.0.0.1:{port}{WEBHOOK.replace(TOKEN, 'wrong-token')}") == 403
        time.sleep(0.5)
    finally:
        proc.terminate()
        out, _ = proc.communicate(timeout=20)
    assert '"GET /api/v1/webhooks/whatsapp HTTP/1.1" 200' in out, out[-2000:]
    assert '"GET /api/v1/webhooks/whatsapp HTTP/1.1" 403' in out, out[-2000:]
    assert TOKEN not in out and "verify_token" not in out


# --- Nginx access log -----------------------------------------------------------------------------------------

def _webhook_location() -> str:
    text = (TEMPLATES / "common.inc").read_text()
    m = re.search(r"location = /api/v1/webhooks/whatsapp \{(.*?)\n\}", text, re.S)
    assert m, "webhook location missing"
    return m.group(1)


def test_nginx_webhook_location_uses_query_free_log_format():
    assert re.search(r"^\s*access_log\s+\S+\s+bseva_noquery;", _webhook_location(), re.M)


@pytest.mark.parametrize("template", ["http.conf.template", "https.conf.template"])
def test_nginx_query_free_format_defined_without_query_variables(template):
    text = (TEMPLATES / template).read_text()
    m = re.search(r"log_format bseva_noquery (.*?);", text, re.S)
    assert m, f"bseva_noquery missing from {template}"
    fmt = m.group(1)
    for leaky in ("$request ", '$request"', "$request_uri", "$args", "$query_string", "$arg_"):
        assert leaky not in fmt, f"{leaky.strip()} would log the query string"
    for kept in ("$request_method", "$uri", "$status", "$request_time", "$request_id"):
        assert kept in fmt


NGINX = shutil.which("nginx") or ("/opt/homebrew/bin/nginx" if Path("/opt/homebrew/bin/nginx").exists() else None)


class _Upstream(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        body = b"12345"
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *_a):
        pass


@pytest.mark.skipif(not NGINX, reason="nginx binary not installed (CI checks the config with nginx -t)")
def test_real_nginx_access_log_has_no_token():
    upstream = http.server.ThreadingHTTPServer(("127.0.0.1", 0), _Upstream)
    threading.Thread(target=upstream.serve_forever, daemon=True).start()
    listen = _free_port()
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        inc = root / "templates"
        inc.mkdir()
        for name in ("common.inc", "proxy.inc", "security.inc"):
            text = (TEMPLATES / name).read_text().replace("/etc/nginx/bseva-templates", str(inc))
            text = text.replace("http://api:8000", f"http://127.0.0.1:{upstream.server_port}")
            text = text.replace("root /usr/share/nginx/html;", f"root {root};")
            text = text.replace("/var/log/nginx/access.log", str(root / "access.log"))
            (inc / name).write_text(text)
        site = (TEMPLATES / "http.conf.template").read_text().replace("${DOMAIN}", "localhost")
        site = site.replace("/etc/nginx/bseva-templates", str(inc))
        site = re.sub(r"listen 80[^;]*;", f"listen 127.0.0.1:{listen};", site)
        site = site.replace("/var/www/certbot", str(root))
        (root / "site.conf").write_text(site)
        (root / "nginx.conf").write_text(
            f"pid {root}/nginx.pid; error_log {root}/error.log; daemon off;\n"
            f"events {{}}\nhttp {{ access_log {root}/default_access.log;\n"
            f"client_body_temp_path {root}/b; proxy_temp_path {root}/p; fastcgi_temp_path {root}/f;"
            f" uwsgi_temp_path {root}/u; scgi_temp_path {root}/s;\ninclude {root}/site.conf; }}\n"
        )
        test = subprocess.run([NGINX, "-t", "-p", str(root), "-c", str(root / "nginx.conf")], capture_output=True, text=True)
        assert test.returncode == 0, test.stderr
        proc = subprocess.Popen([NGINX, "-p", str(root), "-c", str(root / "nginx.conf")], stderr=subprocess.PIPE, text=True)
        try:
            _wait(f"http://127.0.0.1:{listen}/nginx-health")
            assert _get(f"http://127.0.0.1:{listen}{WEBHOOK}") == 200
            time.sleep(0.3)
        finally:
            proc.terminate()
            proc.wait(timeout=10)
            upstream.shutdown()
        logged = (root / "access.log").read_text()
        assert "GET /api/v1/webhooks/whatsapp HTTP/1.1" in logged and " 200 " in logged, logged
        assert TOKEN not in logged and "verify_token" not in logged
        assert TOKEN not in (root / "default_access.log").read_text()
