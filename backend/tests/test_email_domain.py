import dns.exception
import dns.resolver

from app import email_domain


class _MX:
    def __init__(self, host):
        self.exchange = host


def _fake(monkeypatch, table):
    """table: (domain, rtype) -> list of answers, or an exception class to raise."""

    class R:
        lifetime = 0

        def resolve(self, domain, rtype):
            v = table.get((domain, rtype), dns.resolver.NoAnswer)
            if isinstance(v, type) and issubclass(v, BaseException):
                raise v()
            return v

    monkeypatch.setattr(dns.resolver, "Resolver", R)
    email_domain._cache.clear()


def test_made_up_domain_is_refused(monkeypatch):
    _fake(monkeypatch, {("test.hom", "MX"): dns.resolver.NXDOMAIN})
    assert email_domain.email_domain_can_receive("gopichand@test.hom") is False


def test_domain_with_mail_server_is_accepted(monkeypatch):
    _fake(monkeypatch, {("gmail.com", "MX"): [_MX("gmail-smtp-in.l.google.com.")]})
    assert email_domain.email_domain_can_receive("a@gmail.com") is True


def test_null_mx_is_refused(monkeypatch):
    _fake(monkeypatch, {("example.com", "MX"): [_MX(".")]})
    assert email_domain.email_domain_can_receive("a@example.com") is False


def test_a_record_fallback(monkeypatch):
    _fake(monkeypatch, {("small.in", "MX"): dns.resolver.NoAnswer, ("small.in", "A"): ["1.2.3.4"]})
    assert email_domain.email_domain_can_receive("a@small.in") is True


def test_dns_trouble_does_not_block_sign_up(monkeypatch):
    _fake(monkeypatch, {("slow.com", "MX"): dns.exception.Timeout})
    assert email_domain.email_domain_can_receive("a@slow.com") is True


def test_test_domains_skip_lookup(monkeypatch):
    _fake(monkeypatch, {})  # any lookup would raise NoAnswer -> False
    assert email_domain.email_domain_can_receive("qa@bseva.test") is True
    assert email_domain.email_domain_can_receive("qa@qa.b-seva.com", skip_domains=("@qa.b-seva.com",)) is True
