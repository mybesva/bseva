"""Catch email addresses whose domain cannot receive mail (typos like gmail.con, or made-up domains like test.hom)
before a sign-up OTP is "sent" to them. The mail server accepts such messages and only bounces them later, so the
user would otherwise see "OTP sent" for a code that can never arrive.

The check is a DNS lookup (MX, then A/AAAA as mail servers fall back to). It fails open: if DNS is slow or
unreachable the address is accepted, because the OTP itself still proves the inbox exists.
"""
from __future__ import annotations

import logging
import time

logger = logging.getLogger(__name__)

# Reserved names that never resolve publicly but are used for local/test accounts.
_LOCAL_SUFFIXES = (".test", ".localhost", ".local", ".invalid", ".example")
_CACHE_SECONDS = 600
_cache: dict[str, tuple[bool, float]] = {}


def _lookup(domain: str) -> bool:
    import dns.exception
    import dns.resolver

    resolver = dns.resolver.Resolver()
    resolver.lifetime = 3.0
    try:
        answer = resolver.resolve(domain, "MX")
        hosts = [str(r.exchange).rstrip(".") for r in answer]
        # RFC 7505 "null MX" (a single "." exchange) means the domain accepts no mail.
        return any(hosts)
    except dns.resolver.NXDOMAIN:
        return False
    except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
        pass
    except dns.exception.DNSException:
        return True  # timeout or resolver trouble: do not block sign-up
    for rtype in ("A", "AAAA"):
        try:
            if resolver.resolve(domain, rtype):
                return True
        except dns.resolver.NXDOMAIN:
            return False
        except (dns.resolver.NoAnswer, dns.resolver.NoNameservers):
            continue
        except dns.exception.DNSException:
            return True
    return False


def email_domain_can_receive(email: str, *, skip_domains: tuple[str, ...] = ()) -> bool:
    domain = (email or "").rsplit("@", 1)[-1].strip().lower().rstrip(".")
    if not domain or "." not in domain:
        return False
    if domain.endswith(_LOCAL_SUFFIXES) or any(domain == d.lstrip("@").lower() for d in skip_domains):
        return True
    now = time.time()
    hit = _cache.get(domain)
    if hit and now - hit[1] < _CACHE_SECONDS:
        return hit[0]
    try:
        ok = _lookup(domain)
    except Exception:
        logger.exception("EMAIL_DOMAIN_CHECK_ERROR domain=%s", domain)
        ok = True
    _cache[domain] = (ok, now)
    if not ok:
        logger.info("EMAIL_DOMAIN_UNDELIVERABLE domain=%s", domain)
    return ok
