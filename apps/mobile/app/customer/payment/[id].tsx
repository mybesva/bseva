import type { PaymentStatus } from "@bseva/api-client";
import { rupees } from "@bseva/config";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { openHostedCheckout } from "@/services/onlinePayment";
import { useAppTheme } from "@/theme/ThemeContext";

// What this screen shows always comes from the server, which verifies the payment with Cashfree.
const POLL_MS = 4000;
const POLL_LIMIT = 45;

type View = "checking" | "paid" | "pending" | "failed" | "closed";

function viewFor(s: PaymentStatus): View {
  if (s.paid) return "paid";
  if (s.booking_status !== "awaiting_payment") return "closed";
  if (s.attempt?.status === "processing") return "pending";
  return "failed";
}

// Closed without payment: say why. Only a real expiry is "the payment window has closed".
function closedMessageKey(s: PaymentStatus | null): string {
  if (s?.cancel_policy === "payment_abandoned") return "pay.cancelledByYou";
  if (s?.cancel_policy === "payment_expired") return "pay.expired";
  return "pay.bookingCancelled";
}

export default function PaymentStatusScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [view, setView] = useState<View>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const polls = useRef(0);

  const check = useCallback(async () => {
    if (!id) return;
    try {
      const s = await apiClient.paymentStatus(String(id));
      setStatus(s);
      setView(viewFor(s));
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
    if (view === "paid" || view === "closed") polls.current = POLL_LIMIT;
  }, [view]);

  async function retry() {
    setBusy(true);
    try {
      const session = await apiClient.resumeCheckout(String(id));
      polls.current = 0;
      await openHostedCheckout(String(id), session);
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
      await apiClient.abandonCheckout(String(id));
      await check();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("pay.unavailable"));
    } finally {
      setBusy(false);
    }
  }

  const message = {
    checking: t("pay.verifying"),
    paid: t("pay.success"),
    pending: t("pay.pending"),
    failed: t("pay.failed"),
    closed: t(closedMessageKey(status)),
  }[view];

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
              {status.booking_number} · {rupees(Number(status.total_paise))}
            </AppText>
          ) : null}
        </Card>
        {view === "failed" ? (
          <>
            <PrimaryButton title={t("pay.retry")} loading={busy} onPress={retry} />
            <PrimaryButton title={t("pay.cancel")} variant="outline" disabled={busy} onPress={cancel} />
          </>
        ) : null}
        {view === "paid" || view === "closed" || view === "pending" ? (
          <PrimaryButton title={t("pay.viewBooking")} variant={view === "paid" ? undefined : "outline"}
            onPress={() => router.replace(`/customer/booking/${id}`)} />
        ) : null}
      </ScrollView>
    </Screen>
  );
}
