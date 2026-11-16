import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useI18n } from "@/i18n/I18nProvider";
import {
  abandonCharge,
  abandonCheckout,
  fetchChargeStatus,
  fetchPaymentStatus,
  openCashfreeCheckout,
  resumeChargeCheckout,
  resumeCheckout,
  type ChargePurpose,
  type ChargeStatus,
  type PaymentStatus,
} from "@/lib/cashfreeCheckout";
import { APP_RETURN_CHARGE_PREFIX, APP_RETURN_KEY } from "./PaymentCheckout";

const APP_SCHEME_RETURN = "bseva://payment-return";

function appReturnBooking(): string | null {
  try {
    return sessionStorage.getItem(APP_RETURN_KEY);
  } catch {
    return null;
  }
}

// The browser's redirect says nothing trustworthy: this page only shows what the server verified with Cashfree.
const POLL_MS = 3000;
const POLL_LIMIT = 40;

type View = "checking" | "paid" | "pending" | "failed" | "closed";

// Closed without payment: say why. Only a real expiry is "the payment window has closed".
function closedMessageKey(s: PaymentStatus | null): string {
  if (s?.cancel_policy === "payment_abandoned") return "pay.cancelledByYou";
  if (s?.cancel_policy === "payment_expired") return "pay.expired";
  return "pay.bookingCancelled";
}

function viewFor(s: PaymentStatus): View {
  if (s.paid) return "paid";
  if (s.booking_status !== "awaiting_payment") return "closed";
  // "processing" = an attempt is pending at the bank (e.g. UPI approval): wait, do not offer a second payment.
  if (s.attempt?.status === "processing") return "pending";
  // Failed, dropped or never attempted: the customer can try again while the payment window is open.
  return "failed";
}

export default function PaymentReturn() {
  const params = new URLSearchParams(useSearch());
  const paymentId = params.get("payment_id") || "";
  // ?payment_id= is an online charge (reschedule fee, consultation, Seva registration, later booking date);
  // ?booking_id= is the new-booking checkout.
  if (paymentId && !params.get("booking_id")) return <ChargeReturn paymentId={paymentId} />;
  return <BookingReturn bookingId={params.get("booking_id") || ""} />;
}

function BookingReturn({ bookingId }: { bookingId: string }) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  // Started from the mobile app in the phone's browser: hand back to the app, which verifies with the server.
  const fromApp = Boolean(bookingId) && appReturnBooking() === bookingId;
  const appLink = `${APP_SCHEME_RETURN}?booking_id=${encodeURIComponent(bookingId)}`;
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [view, setView] = useState<View>("checking");
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const check = useCallback(async () => {
    if (!bookingId) return;
    try {
      const s = await fetchPaymentStatus(bookingId);
      setStatus(s);
      setView(viewFor(s));
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
    }
  }, [bookingId, t]);

  useEffect(() => {
    if (fromApp) {
      try {
        sessionStorage.removeItem(APP_RETURN_KEY);
      } catch {
        /* ignore */
      }
      window.location.href = appLink;
      return;
    }
    if (!bookingId) {
      setLocation("/customer/bookings");
      return;
    }
    let stopped = false;
    const tick = async () => {
      await check();
      polls.current += 1;
      if (!stopped && polls.current < POLL_LIMIT) timer = window.setTimeout(tick, POLL_MS);
    };
    let timer = window.setTimeout(tick, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [bookingId, check, setLocation]);

  useEffect(() => {
    // Stop polling once the outcome is final.
    if (view === "paid" || view === "closed") polls.current = POLL_LIMIT;
  }, [view]);

  const retry = async () => {
    setBusy(true);
    try {
      toast.message(t("pay.redirecting"));
      await openCashfreeCheckout(await resumeCheckout(bookingId));
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
      await check();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await abandonCheckout(bookingId);
      await check();
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
    } finally {
      setBusy(false);
    }
  };

  const amount = status ? `₹${(status.total_paise / 100).toLocaleString("en-IN")}` : "";
  const icon =
    view === "paid" ? (
      <CheckCircle2 className="h-12 w-12 text-green-600" />
    ) : view === "failed" || view === "closed" ? (
      <XCircle className="h-12 w-12 text-destructive" />
    ) : view === "pending" ? (
      <Clock className="h-12 w-12 text-amber-600" />
    ) : (
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    );
  const message = {
    checking: t("pay.verifying"),
    paid: t("pay.success"),
    pending: t("pay.pending"),
    failed: t("pay.failed"),
    closed: t(closedMessageKey(status)),
  }[view];

  if (fromApp) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p>{t("pay.verifying")}</p>
          <Button asChild>
            <a href={appLink}>B-Seva app</a>
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center px-4 py-10">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            {icon}
            <p className="text-lg font-semibold text-foreground" role="status" aria-live="polite">
              {message}
            </p>
            {status && (
              <p className="text-sm text-muted-foreground">
                {status.booking_number} · {amount}
              </p>
            )}
            <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              {(view === "paid" || view === "closed") && (
                <Button onClick={() => setLocation(`/booking/${bookingId}`)}>{t("pay.viewBooking")}</Button>
              )}
              {view === "failed" && (
                <>
                  <Button onClick={retry} disabled={busy}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {t("pay.retry")}
                  </Button>
                  <Button variant="outline" onClick={cancel} disabled={busy}>
                    {t("pay.cancel")}
                  </Button>
                </>
              )}
              {view === "pending" && (
                <Button variant="outline" onClick={() => setLocation(`/booking/${bookingId}`)}>
                  {t("pay.viewBooking")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

type ChargeView = "checking" | "paid" | "pending" | "failed" | "closed" | "refunded";

const CHARGE_SUCCESS_KEY: Record<ChargePurpose, string> = {
  reschedule_fee: "pay.charge.reschedule.success",
  consultation: "pay.charge.consultation.success",
  seva_registration: "pay.charge.seva.success",
  booking_payment: "pay.charge.booking.success",
};

function chargeViewFor(s: ChargeStatus): ChargeView {
  if (s.status === "paid") return "paid";
  if (s.status === "closed") return "closed";
  if (s.status === "refunded") return "refunded";
  // "processing" = an attempt is pending at the bank (e.g. UPI approval): wait, do not offer a second payment.
  if (s.status === "pending" && s.attempt?.status === "processing") return "pending";
  // Failed, dropped or never attempted: the customer can try again while the charge is still open.
  return "failed";
}

function ChargeReturn({ paymentId }: { paymentId: string }) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  // Started from the mobile app in the phone's browser: hand back to the app, which verifies with the server.
  const fromApp = appReturnBooking() === `${APP_RETURN_CHARGE_PREFIX}${paymentId}`;
  const appLink = `${APP_SCHEME_RETURN}?payment_id=${encodeURIComponent(paymentId)}`;
  const [status, setStatus] = useState<ChargeStatus | null>(null);
  const [view, setView] = useState<ChargeView>("checking");
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const check = useCallback(async () => {
    try {
      const s = await fetchChargeStatus(paymentId);
      setStatus(s);
      setView(chargeViewFor(s));
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
    }
  }, [paymentId, t]);

  useEffect(() => {
    if (fromApp) {
      try {
        sessionStorage.removeItem(APP_RETURN_KEY);
      } catch {
        /* ignore */
      }
      window.location.href = appLink;
      return;
    }
    let stopped = false;
    const tick = async () => {
      await check();
      polls.current += 1;
      if (!stopped && polls.current < POLL_LIMIT) timer = window.setTimeout(tick, POLL_MS);
    };
    let timer = window.setTimeout(tick, 0);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, check]);

  useEffect(() => {
    // Stop polling once the outcome is final.
    if (view === "paid" || view === "closed" || view === "refunded") polls.current = POLL_LIMIT;
  }, [view]);

  const retry = async () => {
    setBusy(true);
    try {
      toast.message(t("pay.redirecting"));
      await openCashfreeCheckout(await resumeChargeCheckout(paymentId));
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
      await check();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await abandonCharge(paymentId);
      await check();
    } catch (e: any) {
      toast.error(e?.message || t("pay.unavailable"));
      await check();
    } finally {
      setBusy(false);
    }
  };

  if (fromApp) {
    return (
      <Layout>
        <div className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p>{t("pay.verifying")}</p>
          <Button asChild>
            <a href={appLink}>B-Seva app</a>
          </Button>
        </div>
      </Layout>
    );
  }

  const amount = status ? `₹${(status.amount_paise / 100).toLocaleString("en-IN")}` : "";
  const icon =
    view === "paid" ? (
      <CheckCircle2 className="h-12 w-12 text-green-600" />
    ) : view === "failed" || view === "closed" ? (
      <XCircle className="h-12 w-12 text-destructive" />
    ) : view === "pending" || view === "refunded" ? (
      <Clock className="h-12 w-12 text-amber-600" />
    ) : (
      <Loader2 className="h-12 w-12 animate-spin text-primary" />
    );
  const message = {
    checking: t("pay.verifying"),
    paid: t(status ? CHARGE_SUCCESS_KEY[status.purpose] || "pay.success" : "pay.success"),
    pending: t("pay.charge.pending"),
    failed: t("pay.charge.failed"),
    closed: t(status?.closed_reason === "expired" ? "pay.charge.closedExpired" : "pay.charge.closedAbandoned"),
    refunded: t("pay.charge.refunded"),
  }[view];
  const link = status?.link && status.link.startsWith("/") ? status.link : null;

  return (
    <Layout>
      <div className="mx-auto flex min-h-[50vh] max-w-lg items-center px-4 py-10">
        <Card className="w-full">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            {icon}
            <p className="text-lg font-semibold text-foreground" role="status" aria-live="polite">
              {message}
            </p>
            {status && (
              <p className="text-sm text-muted-foreground">
                {status.reference ? `${status.reference} · ` : ""}
                {amount}
              </p>
            )}
            <div className="flex w-full flex-col gap-2 pt-2 sm:flex-row sm:justify-center">
              {view === "failed" && (
                <>
                  <Button onClick={retry} disabled={busy}>
                    {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
                    {t("pay.retry")}
                  </Button>
                  <Button variant="outline" onClick={cancel} disabled={busy}>
                    {t("pay.charge.cancel")}
                  </Button>
                </>
              )}
              {view !== "checking" && link && (
                <Button variant={view === "failed" ? "ghost" : "default"} onClick={() => setLocation(link)}>
                  {t("pay.charge.continue")}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
