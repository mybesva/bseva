from app.i18n import (
    EMAIL_GREET,
    NOTIFY,
    SUPPORTED_LANGS,
    coded_http,
    interpolate,
    normalize_lang,
    notify_copy,
    resolve_request_lang,
)


def test_normalize_lang_accepts_six_and_falls_back():
    assert [normalize_lang(c) for c in SUPPORTED_LANGS] == list(SUPPORTED_LANGS)
    assert normalize_lang("TE-IN") == "te"
    assert normalize_lang("fr") == "en"
    assert normalize_lang(None) == "en"


def test_notify_copy_uses_preferred_language_and_english_fallback():
    title, body = notify_copy("bookingCreated", "te", {"number": "BSEVA-1"})
    assert "BSEVA-1" in body
    assert title != NOTIFY["bookingCreated"]["en"]["title"]
    missing_title, missing_body = notify_copy("does-not-exist", "ta", {"number": "x"})
    assert missing_title == "does-not-exist"


def test_interpolate_and_coded_http():
    assert interpolate("Hello {{name}}", {"name": "Asha"}) == "Hello Asha"
    err = coded_http(401, "LOGIN_FAILED", "Invalid email/phone or password")
    assert err.status_code == 401
    assert err.detail["code"] == "LOGIN_FAILED"


class _Req:
    def __init__(self, header="", query=None):
        self.headers = {"accept-language": header}
        self.query_params = query or {}


def test_resolve_request_lang_header_and_query():
    assert resolve_request_lang("kn") == "kn"
    assert resolve_request_lang(None, _Req("hi-IN,en;q=0.8")) == "hi"
    assert resolve_request_lang(None, _Req("xx", {"lang": "ta"})) == "ta"
    assert EMAIL_GREET["ta"].startswith("வணக்கம்")
