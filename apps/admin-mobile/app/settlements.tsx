import { rupees } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Row = {
  id: string;
  pujari_name?: string;
  status?: string;
  amount_paise?: number;
  pujari_payable_paise?: number;
  processed_by_name?: string | null;
  approved_by_name?: string | null;
};

export default function AdminSettlements() {
  const { t } = useI18n();
  const params = useLocalSearchParams<{ status?: string }>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [reason, setReason] = useState("");
  const [paymentRef, setPaymentRef] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ id: string; settlementId: string } | null>(null);
  const [mpin, setMpin] = useState("");
  const [otp, setOtp] = useState("");

  useEffect(() => {
    const next = typeof params.status === "string" ? params.status : "";
    if (next) setStatus(next);
  }, [params.status]);

  const list = useQuery({
    queryKey: ["settlements", q, status],
    queryFn: () =>
      apiClient.api<{ items?: Row[] } | Row[]>(
        `/settlements?page=1&limit=50${q ? `&q=${encodeURIComponent(q)}` : ""}${status ? `&status=${encodeURIComponent(status)}` : ""}`
      ),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.settlements")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((s) => (
          <Card key={s.id}>
            <StatusBadge status={String(s.status || "pending")} />
            <AppText variant="h3">{s.pujari_name || s.id}</AppText>
            <AppText>{rupees(s.pujari_payable_paise ?? s.amount_paise)}</AppText>
            {s.processed_by_name ? <AppText>Processed by: {s.processed_by_name}</AppText> : null}
            {s.approved_by_name ? <AppText>Approved by: {s.approved_by_name}</AppText> : null}
            {s.status === "settled" || s.status === "blocked" ? null : challenge?.settlementId === s.id ? (
              <>
                <Field label="MPIN" value={mpin} onChangeText={setMpin} secureTextEntry keyboardType="number-pad" maxLength={6} />
                <Field label="Email OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} />
                <PrimaryButton
                  title="Confirm payment"
                  onPress={async () => {
                    setError(null);
                    try {
                      await apiClient.api(`/settlements/${s.id}/override`, {
                        method: "POST",
                        body: JSON.stringify({
                          reason,
                          mark_settled: true,
                          payment_reference: paymentRef || null,
                          challenge_id: challenge.id,
                          otp,
                          mpin,
                        }),
                      });
                      setChallenge(null);
                      setReason("");
                      setPaymentRef("");
                      await list.refetch();
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "Failed");
                    } finally {
                      setMpin("");
                      setOtp("");
                    }
                  }}
                />
              </>
            ) : (
              <>
                <Field label="Override reason" value={reason} onChangeText={setReason} />
                <Field label="Payment reference" value={paymentRef} onChangeText={setPaymentRef} />
                <PrimaryButton
                  title="Send OTP"
                  variant="outline"
                  onPress={async () => {
                    setError(null);
                    try {
                      const out = await apiClient.api<{ challenge_id: string }>("/admin/security/challenge", {
                        method: "POST",
                        body: JSON.stringify({
                          action: "settlement_override",
                          settlement_id: s.id,
                          payment_reference: paymentRef || null,
                        }),
                      });
                      setChallenge({ id: out.challenge_id, settlementId: s.id });
                    } catch (e: unknown) {
                      setError(e instanceof Error ? e.message : "Failed");
                    }
                  }}
                />
              </>
            )}
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
