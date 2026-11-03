"""Payment providers behind one interface. `payments.provider` picks the adapter for every later call.

"wallet" (and the legacy "wallet_demo") is the internal B-Seva wallet and needs no adapter: it is charged and
refunded through app.domain.apply_wallet. Online gateways implement GatewayProvider. Adding Razorpay later means
adding an adapter here; historical Cashfree rows keep routing to Cashfree whatever PAYMENT_GATEWAY says.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Protocol

from app.config import settings

WALLET_PROVIDERS = ("wallet", "wallet_demo")


@dataclass
class ProviderPayment:
    """One payment attempt on a gateway order, normalised."""

    provider_payment_id: str
    status: str  # success | failed | dropped | pending | cancelled | not_attempted | void
    amount_paise: int
    currency: str
    method: str | None = None
    message: str | None = None
    raw_status: str | None = None


@dataclass
class ProviderOrder:
    order_id: str
    status: str  # active | paid | expired | terminated | termination_requested
    amount_paise: int
    currency: str
    payments: list[ProviderPayment] = field(default_factory=list)
    raw_status: str | None = None


@dataclass
class ProviderRefund:
    refund_id: str
    status: str  # successful | processing | failed
    provider_refund_id: str | None = None
    amount_paise: int | None = None
    raw_status: str | None = None
    message: str | None = None


class GatewayProvider(Protocol):
    name: str

    def configured(self) -> bool: ...

    def environment(self) -> str: ...

    def create_order(self, **kw: Any) -> dict: ...

    def fetch_order(self, order_id: str) -> ProviderOrder: ...

    def terminate_order(self, order_id: str) -> None: ...

    def create_refund(self, *, order_id: str, refund_id: str, amount_paise: int, note: str) -> ProviderRefund: ...

    def fetch_refund(self, order_id: str, refund_id: str) -> ProviderRefund: ...

    def verify_webhook(self, headers: dict[str, str], raw_body: bytes) -> bool: ...


_PAYMENT_STATUS = {
    "SUCCESS": "success",
    "FAILED": "failed",
    "USER_DROPPED": "dropped",
    "PENDING": "pending",
    "CANCELLED": "cancelled",
    "VOID": "void",
    "NOT_ATTEMPTED": "not_attempted",
}
_REFUND_STATUS = {
    "SUCCESS": "successful",
    "PENDING": "processing",
    "PENDING_APPROVAL": "processing",
    "ONHOLD": "processing",
    "CANCELLED": "failed",
    "REJECTED": "failed",
}


class CashfreeProvider:
    name = "cashfree"

    def configured(self) -> bool:
        return settings.cashfree_pg_configured

    def environment(self) -> str:
        return (settings.cashfree_pg_env or "sandbox").strip().lower()

    def create_order(self, **kw: Any) -> dict:
        from app.payments import cashfree_pg

        return cashfree_pg.create_order(**kw)

    def fetch_order(self, order_id: str) -> ProviderOrder:
        from app.payments import cashfree_pg

        order = cashfree_pg.get_order(order_id)
        attempts = cashfree_pg.get_order_payments(order_id)
        return ProviderOrder(
            order_id=str(order.get("order_id") or order_id),
            status=str(order.get("order_status") or "").lower(),
            amount_paise=cashfree_pg.paise(order.get("order_amount") or 0),
            currency=str(order.get("order_currency") or "").upper(),
            raw_status=order.get("order_status"),
            payments=[
                ProviderPayment(
                    provider_payment_id=str(p.get("cf_payment_id") or ""),
                    status=_PAYMENT_STATUS.get(str(p.get("payment_status") or "").upper(), "pending"),
                    amount_paise=cashfree_pg.paise(p.get("payment_amount") or 0),
                    currency=str(p.get("payment_currency") or "").upper(),
                    method=p.get("payment_group"),
                    message=p.get("payment_message") or (p.get("error_details") or {}).get("error_description"),
                    raw_status=p.get("payment_status"),
                )
                # Cashfree lists attempts newest first; keep them oldest -> newest so payments[-1] is the latest.
                for p in sorted(attempts, key=lambda a: (str(a.get("payment_time") or ""), str(a.get("cf_payment_id") or "")))
            ],
        )

    def terminate_order(self, order_id: str) -> None:
        from app.payments import cashfree_pg

        cashfree_pg.terminate_order(order_id)

    def _refund(self, data: dict, refund_id: str) -> ProviderRefund:
        from app.payments import cashfree_pg

        raw = str(data.get("refund_status") or "").upper()
        return ProviderRefund(
            refund_id=str(data.get("refund_id") or refund_id),
            status=_REFUND_STATUS.get(raw, "processing"),
            provider_refund_id=str(data.get("cf_refund_id") or "") or None,
            amount_paise=cashfree_pg.paise(data["refund_amount"]) if data.get("refund_amount") is not None else None,
            raw_status=raw or None,
            message=data.get("status_description"),
        )

    def create_refund(self, *, order_id: str, refund_id: str, amount_paise: int, note: str) -> ProviderRefund:
        from app.payments import cashfree_pg

        return self._refund(
            cashfree_pg.create_refund(order_id=order_id, refund_id=refund_id, amount_paise=amount_paise, note=note),
            refund_id,
        )

    def fetch_refund(self, order_id: str, refund_id: str) -> ProviderRefund:
        from app.payments import cashfree_pg

        return self._refund(cashfree_pg.get_refund(order_id, refund_id), refund_id)

    def verify_webhook(self, headers: dict[str, str], raw_body: bytes) -> bool:
        from app.payments import cashfree_pg

        return cashfree_pg.verify_webhook(headers.get("x-webhook-timestamp"), headers.get("x-webhook-signature"), raw_body)


PROVIDERS: dict[str, GatewayProvider] = {"cashfree": CashfreeProvider()}


def gateway(name: str) -> GatewayProvider:
    provider = PROVIDERS.get((name or "").strip().lower())
    if not provider:
        raise LookupError(f"No payment adapter for provider {name!r}")
    return provider


def active_gateway() -> GatewayProvider | None:
    """The gateway new checkouts use, or None when only the wallet is available."""
    name = (settings.payment_gateway or "").strip().lower()
    provider = PROVIDERS.get(name)
    return provider if provider and provider.configured() else None
