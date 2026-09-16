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
from app.catalog import enrich_service, normalize_search
from app.routers.bookings import list_services


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


class _Rows:
    def __init__(self, rows=None, first=None):
        self._rows = rows or []
        self._first = first

    def mappings(self):
        return self

    def all(self):
        return self._rows

    def first(self):
        return self._first


class _CatalogDb:
    def __init__(self, translation):
        self.translation = translation

    def execute(self, statement, params=None):
        sql = str(statement)
        if "FROM service_category_map" in sql:
            return _Rows([])
        if "FROM service_translations" in sql:
            return _Rows(first=self.translation)
        raise AssertionError(sql)


def _service_row():
    return {
        "id": "00000000-0000-4000-8000-000000000001",
        "name": "Ganapathi Puja",
        "short_description": "English short",
        "full_description": "English full",
        "active": True,
        "standard_price_paise": 10000,
        "pricing_status": "priced",
        "search_aliases": [],
        "process_steps": [],
        "languages": ["en"],
    }


def test_catalog_locale_overlay_fallback_and_shape_parity():
    translated = enrich_service(
        _CatalogDb(
            {
                "name": "గణపతి పూజ",
                "short_description": "తెలుగు వివరణ",
                "full_description": None,
                "spiritual_meaning": None,
                "common_occasions": None,
                "benefits": None,
                "whats_included": None,
                "customer_instructions": None,
                "pujari_instructions": None,
            }
        ),
        _service_row(),
        lang="te",
    )
    fallback = enrich_service(_CatalogDb(None), _service_row(), lang="te")
    english = enrich_service(_CatalogDb(None), _service_row(), lang="en")

    assert translated["name"] == "గణపతి పూజ"
    assert translated["short_description"] == "తెలుగు వివరణ"
    assert translated["full_description"] == "English full"
    assert fallback["name"] == english["name"] == "Ganapathi Puja"
    assert set(translated) == set(fallback) == set(english)
    assert translated["locale"] == fallback["locale"] == "te"


def test_native_script_catalog_search_is_not_erased():
    assert normalize_search("  గణపతి పూజ! ") == "గణపతి పూజ"
    assert normalize_search("गणपति पूजा") == "गणपति पूजा"


def test_services_api_searches_translations_and_keeps_locale(monkeypatch):
    class SearchDb:
        sql = ""

        def execute(self, statement, params=None):
            self.sql = str(statement)
            assert params["like"] == "%గణపతి%"
            return _Rows([_service_row()])

    db = SearchDb()
    monkeypatch.setattr(
        "app.catalog.enrich_service",
        lambda _db, row, lang=None: {**dict(row), "locale": lang},
    )
    out = list_services(_Req("te-IN"), q="గణపతి", db=db)
    assert out[0]["locale"] == "te"
    assert "FROM service_translations st" in db.sql
