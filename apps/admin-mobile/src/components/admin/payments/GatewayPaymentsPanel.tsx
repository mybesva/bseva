import { rupees } from "@bseva/config";
import { formatDisplayDateTime } from "@bseva/locales";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Alert, View } from "react-native";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, LoadingBlock, PrimaryButton, StatusBadge, SuccessBanner } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type Summary = {
  gateways: Record<string, any>;
  payments: Record<string, number>;
  refunds: Record<string, number>;
  payouts: Record<string, number>;
  awaiting_payment_bookings: number;
  needs_review: {
    payments: number;
    refunds: number;
    payouts: number;
    unverified_webhooks_24h: number;
    booking_follow_ups_failed: number;
    booking_follow_ups_pending: number;
  };
};

type Items = { items: any[] };
type Section = "payments" | "refunds" | "payouts" | "events" | "follow-ups";

function errText(e: unknown) {
  return e instanceof Error ? e.message : "Failed";
}

/** Gateway (Cashfree) payments, refunds, payouts and webhook log — mirrors web GatewayPaymentsPanel. */
export function GatewayPaymentsPanel() {
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const isSuper = user?.role === "super_admin";
  const [section, setSection] = useState<Section>("payments");
  const [methods, setMethods] = useState<{ method: string; eligible: boolean }[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const summary = useQuery({
    queryKey: ["gateway-summary"],
    queryFn: () => apiClient.api<Summary>("/admin/payments/summary"),
  });
  const payments = useQuery({
    queryKey: ["gateway-transactions"],
    queryFn: () => apiClient.api<Items>("/admin/payments/transactions?provider=cashfree&limit=50"),
  });
  const refunds = useQuery({
    queryKey: ["gateway-refunds"],
    queryFn: () => apiClient.api<Items>("/admin/payments/refunds?limit=50"),
  });
  const payouts = useQuery({
    queryKey: ["gateway-payouts"],
    queryFn: () => apiClient.api<Items>("/admin/payouts?limit=50"),
    enabled: isSuper,
  });
  const events = useQuery({
    queryKey: ["gateway-events"],
    queryFn: () => apiClient.api<Items>("/admin/payments/events?limit=50"),
    enabled: isSuper,
  });
  const followUps = useQuery({
    queryKey: ["gateway-follow-ups"],
    queryFn: () => apiClient.api<Items>("/admin/payments/follow-ups?status=failed"),
    enabled: isSuper,
  });

  async function reloadAll() {
    await Promise.all([
      summary.refetch(),
      payments.refetch(),
      refunds.refetch(),
      ...(isSuper ? [payouts.refetch(), events.refetch(), followUps.refetch()] : []),
    ]);
  }

  // One action at a time; never retried automatically.
  const action = useMutation({
    retry: false,
    mutationFn: async ({ fn }: { label: string; fn: () => Promise<unknown> }) => fn(),
    onMutate: () => {
      setError(null);
      setSuccess(null);
    },
    onSuccess: async (_d, vars) => {
      setSuccess(vars.label);
      await reloadAll();
    },
    onError: (e) => setError(errText(e)),
  });
  const busy = action.isPending;
  const run = (label: string, fn: () => Promise<unknown>) => {
    if (busy) return;
    action.mutate({ label, fn });
  };
  const confirmRun = (title: string, message: string, label: string, fn: () => Promise<unknown>) =>
    Alert.alert(title, message, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => run(label, fn) },
    ]);

  const sections = useMemo(
    () => [
      { id: "payments", label: "Gateway payments" },
      { id: "refunds", label: "Refunds" },
      ...(isSuper
        ? [
            { id: "payouts", label: "Pujari payouts" },
            { id: "events", label: "Webhooks" },
            { id: "follow-ups", label: "Booking follow-ups" },
          ]
        : []),
    ],
    [isSuper]
  );

  const s = summary.data;
  const cf = s?.gateways?.cashfree;
  const po = s?.gateways?.payouts;
  const loadError = summary.error || payments.error || refunds.error || payouts.error || events.error || followUps.error;

  const muted = (text: string) => (
    <AppText variant="small" color={colors.mutedForeground}>
      {text}
    </AppText>
  );
  const pill = (text: string, alert?: boolean) => (
    <View
      key={text}
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: (alert ? colors.destructive : colors.mutedForeground) + "22",
      }}
    >
      <AppText variant="small" color={alert ? colors.destructive : colors.foreground}>
        {text}
      </AppText>
    </View>
  );

  const current =
    section === "payments" ? payments : section === "refunds" ? refunds : section === "payouts" ? payouts : section === "events" ? events : followUps;
  const items = current.data?.items || [];

  return (
    <View style={{ gap: 10 }}>
      <Card>
        <AppText variant="h3">Online payments (Cashfree)</AppText>
        {muted(
          `Gateway: ${cf?.configured ? `configured · ${cf.environment}` : "not configured"}` +
            (s?.gateways?.selected_gateway ? ` · new checkouts: ${s.gateways.selected_gateway}` : " · new checkouts: wallet only") +
            ` · Payouts: ${po?.configured ? `configured · ${po.environment}${po.two_factor_key ? " · 2FA key" : ""}` : "not configured"}`
        )}
        {s ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {pill(`Awaiting payment: ${s.awaiting_payment_bookings}`)}
            {pill(`Amount mismatches: ${s.needs_review.payments}`, !!s.needs_review.payments)}
            {pill(`Refunds needing action: ${s.needs_review.refunds}`, !!s.needs_review.refunds)}
            {pill(`Failed / reversed payouts: ${s.needs_review.payouts}`, !!s.needs_review.payouts)}
            {pill(
              `Booking follow-ups failed: ${s.needs_review.booking_follow_ups_failed}` +
                (s.needs_review.booking_follow_ups_pending ? ` · overdue: ${s.needs_review.booking_follow_ups_pending}` : ""),
              !!s.needs_review.booking_follow_ups_failed
            )}
            {pill(`Unverified webhooks (24h): ${s.needs_review.unverified_webhooks_24h}`, !!s.needs_review.unverified_webhooks_24h)}
          </View>
        ) : null}
        {methods ? (
          <View style={{ marginTop: 8 }}>
            {muted(`Eligible on this account: ${methods.filter((m) => m.eligible).map((m) => m.method).join(", ") || "none reported"}`)}
          </View>
        ) : null}
        {isSuper ? (
          <View style={{ gap: 8, marginTop: 10 }}>
            <PrimaryButton
              title="Reconcile now"
              variant="outline"
              disabled={busy}
              onPress={() =>
                confirmRun(
                  "Reconcile now?",
                  "Re-checks pending payments, refunds and payouts with Cashfree.",
                  "Reconciliation finished",
                  () => apiClient.api("/admin/payments/reconcile", { method: "POST" })
                )
              }
            />
            <PrimaryButton
              title="Check enabled methods"
              variant="outline"
              disabled={busy || !cf?.configured}
              onPress={() =>
                run("Checked with Cashfree", async () =>
                  setMethods((await apiClient.api<{ methods: { method: string; eligible: boolean }[] }>("/admin/payments/methods")).methods)
                )
              }
            />
          </View>
        ) : null}
      </Card>

      <ErrorBanner message={error || (loadError ? errText(loadError) : null)} />
      <SuccessBanner message={success} />

      <ChoiceChips horizontal options={sections} value={section} onChange={(v) => setSection(String(v) as Section)} />
      {section === "follow-ups"
        ? muted("Offers, notifications, confirmation email and invoice for paid bookings that failed repeatedly. Each runs at most once.")
        : null}

      {current.isLoading ? <LoadingBlock /> : null}

      {!current.isLoading && items.length === 0 ? (
        <EmptyState
          title={
            section === "payments"
              ? "No gateway payments yet."
              : section === "refunds"
                ? "No gateway refunds yet."
                : section === "payouts"
                  ? "No bank payouts yet."
                  : section === "events"
                    ? "No webhooks received yet."
                    : "No failed follow-ups."
          }
        />
      ) : null}

      {section === "payments"
        ? items.map((p) => (
            <Card key={p.id}>
              <StatusBadge status={String(p.status)} />
              {p.duplicate_of ? muted("Duplicate payment") : null}
              <AppText variant="h3">{p.booking_number || "—"}</AppText>
              <AppText>{rupees(p.amount_paise)} · {p.payment_method || "—"}</AppText>
              {muted(`Order ${p.provider_order_id} · #${p.attempt_no}`)}
              {p.refunded_paise ? muted(`Refunded: ${rupees(p.refunded_paise)}`) : null}
              {muted(`Verified: ${formatDisplayDateTime(p.verified_at)}`)}
              {p.failure_reason ? muted(p.failure_reason) : null}
              {isSuper && ["pending", "processing"].includes(p.status) ? (
                <View style={{ marginTop: 8 }}>
                  <PrimaryButton
                    title="Re-check"
                    variant="outline"
                    disabled={busy}
                    onPress={() => run("Re-checked with Cashfree", () => apiClient.api(`/admin/payments/${p.id}/verify`, { method: "POST" }))}
                  />
                </View>
              ) : null}
            </Card>
          ))
        : null}

      {section === "refunds"
        ? items.map((r) => {
            const isRetry = ["failed", "manual_review"].includes(r.status);
            return (
              <Card key={r.id}>
                <StatusBadge status={String(r.status)} />
                <AppText variant="h3">{r.booking_number || "—"}</AppText>
                <AppText>{rupees(r.amount_paise)} · {r.kind} · {r.provider}</AppText>
                {muted(`Refund ${r.refund_id}`)}
                {muted(`Created: ${formatDisplayDateTime(r.created_at)}`)}
                {r.failure_reason ? muted(r.failure_reason) : null}
                {isSuper && ["pending", "processing", "failed", "manual_review"].includes(r.status) ? (
                  <View style={{ marginTop: 8 }}>
                    <PrimaryButton
                      title={isRetry ? "Retry" : "Re-check"}
                      variant="outline"
                      disabled={busy}
                      onPress={() => {
                        const fn = () => apiClient.api(`/admin/payments/refunds/${r.refund_id}/retry`, { method: "POST" });
                        if (isRetry) {
                          confirmRun(
                            "Retry refund?",
                            `Re-submit refund of ${rupees(r.amount_paise)} for ${r.booking_number || "this booking"} to ${r.provider}.`,
                            "Refund re-submitted",
                            fn
                          );
                        } else {
                          run("Refund re-submitted", fn);
                        }
                      }}
                    />
                  </View>
                ) : null}
              </Card>
            );
          })
        : null}

      {section === "payouts"
        ? items.map((p) => (
            <Card key={p.id}>
              <StatusBadge status={String(p.status)} />
              <AppText variant="h3">{p.pujari_name || "—"}</AppText>
              <AppText>{rupees(p.amount_paise)} · {p.booking_number || "—"}</AppText>
              {muted(`Transfer ${p.transfer_id} · ${p.transfer_mode}`)}
              {p.destination ? muted(`To: ${p.destination}`) : null}
              {muted(`UTR: ${p.utr || "—"}`)}
              {muted(`Approved by: ${p.initiated_by_name || "—"}`)}
              {p.status_detail ? muted(p.status_detail) : null}
              {["initiated", "pending", "successful"].includes(p.status) ? (
                <View style={{ marginTop: 8 }}>
                  <PrimaryButton
                    title="Re-check"
                    variant="outline"
                    disabled={busy}
                    onPress={() => run("Re-checked with Cashfree", () => apiClient.api(`/admin/payouts/${p.id}/refresh`, { method: "POST" }))}
                  />
                </View>
              ) : null}
            </Card>
          ))
        : null}

      {section === "events"
        ? items.map((e) => (
            <Card key={e.id}>
              <StatusBadge status={e.signature_valid ? "verified" : "rejected"} />
              <AppText variant="h3">{e.event_type || "—"}</AppText>
              {muted(`${e.channel} · ${formatDisplayDateTime(e.received_at)}`)}
              {muted(`Reference: ${e.reference || "—"}`)}
              {muted(`Outcome: ${e.outcome || (e.processed_at ? "processed" : "not processed")}`)}
            </Card>
          ))
        : null}

      {section === "follow-ups"
        ? items.map((f) => (
            <Card key={f.id}>
              <AppText variant="h3">{f.booking_number || "—"}</AppText>
              <AppText>{f.effect} · attempts: {f.attempts}</AppText>
              {f.last_error ? muted(String(f.last_error)) : null}
              <View style={{ marginTop: 8 }}>
                <PrimaryButton
                  title="Retry"
                  variant="outline"
                  disabled={busy}
                  onPress={() =>
                    confirmRun(
                      "Retry task?",
                      `Run "${f.effect}" again for ${f.booking_number || "this booking"}.`,
                      "Task retried",
                      () => apiClient.api(`/admin/payments/follow-ups/${f.id}/retry`, { method: "POST" })
                    )
                  }
                />
              </View>
            </Card>
          ))
        : null}
    </View>
  );
}
