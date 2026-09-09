import { rupees } from "@bseva/config";
import { walletLoadSchema } from "@bseva/validation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type WalletPayload = {
  wallet?: { balance_paise?: number };
  balance_paise?: number;
  transactions?: { id?: string; amount_paise: number; type?: string; kind?: string; note?: string; created_at?: string }[];
};

export default function WalletScreen() {
  const { colors } = useAppTheme();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["wallet"], queryFn: () => apiClient.getWallet() as Promise<WalletPayload> });
  const [rupee, setRupee] = useState("500");
  const [error, setError] = useState<string | null>(null);
  const load = useMutation({
    mutationFn: async () => {
      const parsed = walletLoadSchema.safeParse({ amountRupees: Number(rupee) });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return apiClient.loadWallet(Math.round(parsed.data.amountRupees * 100));
    },
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: ["wallet"] });
    },
    onError: (e: Error) => setError(e.message),
  });
  const balance = q.data?.wallet?.balance_paise ?? q.data?.balance_paise ?? 0;
  const txns = q.data?.transactions || [];
  return (
    <Screen>
      <SafeAreaView edges={["top"]} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
        <AppText variant="h2">Wallet</AppText>
      </SafeAreaView>
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 12 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        {q.isLoading ? <LoadingBlock /> : null}
        <Card>
          <AppText variant="small">Balance</AppText>
          <AppText variant="h1" color={colors.primary}>
            {rupees(Number(balance))}
          </AppText>
        </Card>
        <Card>
          <AppText variant="h3">Load wallet</AppText>
          <AppText variant="small" color={colors.mutedForeground} style={{ marginVertical: 8 }}>
            Amounts are processed by the BSeva API (demo gateway until production payments are enabled).
          </AppText>
          <ErrorBanner message={error} />
          <Field label="Amount (₹)" value={rupee} onChangeText={setRupee} keyboardType="numeric" />
          <View style={{ height: 10 }} />
          <PrimaryButton title={load.isPending ? "Loading..." : "Add money"} loading={load.isPending} onPress={() => load.mutate()} />
        </Card>
        <AppText variant="h3">Transactions</AppText>
        {txns.map((t) => (
          <Card key={t.id || `${t.created_at}-${t.amount_paise}`}>
            <AppText>{t.note || t.type || t.kind || "Transaction"}</AppText>
            <AppText color={Number(t.amount_paise) < 0 ? colors.destructive : colors.success}>
              {rupees(t.amount_paise)}
            </AppText>
            <AppText variant="small" color={colors.mutedForeground}>
              {t.created_at}
            </AppText>
          </Card>
        ))}
      </ScrollView>
    </Screen>
  );
}
