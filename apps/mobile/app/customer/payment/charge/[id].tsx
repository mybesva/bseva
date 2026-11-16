import type { ChargeStatus } from "@bseva/api-client";
import { rupees } from "@bseva/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { openChargeCheckout } from "@/services/onlinePayment";
import { useAppTheme } from "@/theme/ThemeContext";

// Result of an online charge (reschedule fee, Muhurtham consultation, Seva registration, later-date booking pay).
// What this screen shows always comes from the server, which verifies the payment with Cashfree.
const POLL_MS = 4000;
const POLL_LIMIT = 45;

type View = "checking" | ChargeStatus["status"];
const FINAL: View[] = ["paid", "closed", "refunded"];

const SUCCESS_KEY: Record<ChargeStatus["purpose"], string> = {
  reschedule_fee: "pay.charge.reschedule.success",
  consultation: "pay.charge.consultation.success",
  seva_registration: "pay.charge.seva.success",
  booking_payment: "pay.charge.booking.success",
};

export default function ChargeStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<ChargeStatus | null>(null);
  const [view, setView] = useState<View>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const check = useCallback(async () => {
    if (!id) return;
    try {
      const s = await apiClient.chargeStatus(String(id));
      setStatus(s);
      setView(s.status);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("pay.unavailable"));
    }
  }, [id, t]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    const tick = async () => {
      await check();
      polls.current += 1;
      if (!stopped && polls.current < POLL_LIMIT) timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    // Coming back from the browser (or the UPI app) re-checks at once.
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        polls.current = 0;
        void check();
      }
    });
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [check]);

  useEffect(() => {
    if (FINAL.includes(view)) polls.current = POLL_LIMIT;
  }, [view]);

  async function retry() {
    setBusy(true);
    try {
      const checkout = await apiClient.resumeChargeCheckout(String(id));
      polls.current = 0;
      await openChargeCheckout(checkout);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("pay.unavailable"));
      await check();
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await apiClient.abandonCharge(String(id));
      await check();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("pay.unavailable"));
      await check();
    } finally {
      setBusy(false);
    }
  }

  function goOn() {
    const s = status;
    if (s?.booking_id && (s.purpose === "booking_payment" || s.purpose === "reschedule_fee")) {
      router.replace(`/customer/booking/${s.booking_id}`);
    } else if (s?.purpose === "seva_registration" && s.event_id) {
      router.replace(`/customer/seva/event/${s.event_id}`);
    } else if (router.canGoBack()) {
      // Consultation: back to the booking form it was requested from, which re-checks the payment.
      router.back();
    } else {
      router.replace(s?.purpose === "consultation" ? "/customer/astrology" : "/customer");
    }
  }

  const message = (() => {
    switch (view) {
      case "checking":
        return t("pay.verifying");
      case "paid":
        return t(status ? SUCCESS_KEY[status.purpose] ?? "pay.success" : "pay.success");
      case "pending":
        return t("pay.charge.pending");
      case "failed":
        return t("pay.charge.failed");
      case "refunded":
        return t("pay.charge.refunded");
      case "closed":
        return t(status?.closed_reason === "abandoned" ? "pay.charge.closedAbandoned" : "pay.charge.closedExpired");
    }
  })();

  return (
    <Screen>
      <ScreenHeader title={t("pay.method")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        {error ? <ErrorBanner message={error} /> : null}
        {view === "checking" && !status ? <LoadingBlock /> : null}
        <Card style={{ gap: 8 }}>
          <AppText variant="h3" color={view === "paid" ? colors.primary : undefined}>{message}</AppText>
          {status ? (
            <AppText variant="small" color={colors.mutedForeground}>
              {status.reference ? `${status.reference} · ` : ""}
              {rupees(Number(status.amount_paise))}
            </AppText>
          ) : null}
        </Card>
        {view === "failed" ? (
          <>
            <PrimaryButton title={t("pay.retry")} loading={busy} onPress={retry} />
            <PrimaryButton title={t("pay.charge.cancel")} variant="outline" disabled={busy} onPress={cancel} />
          </>
        ) : null}
        {view !== "checking" && view !== "failed" ? (
          <PrimaryButton title={t("pay.charge.continue")} variant={view === "paid" ? undefined : "outline"} onPress={goOn} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
