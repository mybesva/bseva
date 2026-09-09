import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, ErrorBanner, Field, PrimaryButton, Screen } from "@/components/ui";
import { apiClient } from "@/services/api";

export default function BankScreen() {
  const q = useQuery({ queryKey: ["pujari-profile"], queryFn: () => apiClient.getPujariProfile() });
  const [holder, setHolder] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [last4, setLast4] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!q.data) return;
    setHolder(String(q.data.bank_holder_name || ""));
    setIfsc(String(q.data.bank_ifsc || ""));
    setLast4(String(q.data.bank_account_last4 || ""));
  }, [q.data]);
  return (
    <Screen>
      <ScreenHeader title="Bank" back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        <ErrorBanner message={error} />
        <AppText variant="small">Used for settlements. Only the last 4 digits of the account are stored.</AppText>
        <Field label="Account holder" value={holder} onChangeText={setHolder} />
        <Field label="IFSC" value={ifsc} onChangeText={setIfsc} autoCapitalize="characters" />
        <Field label="Account last 4" value={last4} onChangeText={setLast4} keyboardType="number-pad" maxLength={4} />
        <PrimaryButton
          title="Save"
          onPress={async () => {
            setError(null);
            try {
              await apiClient.patchPujariProfile({
                bank_holder_name: holder,
                bank_ifsc: ifsc,
                bank_account_last4: last4,
              });
              await q.refetch();
            } catch (e: unknown) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          }}
        />
      </ScrollView>
    </Screen>
  );
}
