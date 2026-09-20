import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type Temple = {
  id: string;
  name: string;
  city?: string;
  state?: string;
  pincode?: string;
  address?: string;
  deity?: string;
  timings?: string;
  contact_phone?: string;
  contact_email?: string;
  pujari_name?: string;
  description?: string;
};

export default function AdminTemples() {
  const { t } = useI18n();
  const { can } = useAdmin();
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");
  const [address, setAddress] = useState("");
  const [deity, setDeity] = useState("");
  const [timings, setTimings] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [pujariName, setPujariName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-temples", q],
    queryFn: () => apiClient.api<Temple[]>(`/admin/temples${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  });
  const items = Array.isArray(list.data) ? list.data : (list.data as { items?: Temple[] } | undefined)?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.temples")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={setQ} />
        {list.isLoading ? <LoadingBlock /> : null}
        {items.map((temple) => (
          <Card key={temple.id}>
            <AppText variant="h3">{temple.name}</AppText>
            <AppText variant="small">{[temple.city, temple.state, temple.deity, temple.pujari_name].filter(Boolean).join(" · ")}</AppText>
            {can("manage_services") ? (
              <PrimaryButton
                title="Save edits"
                variant="outline"
                onPress={() =>
                  void apiClient.api(`/admin/temples/${temple.id}`, {
                    method: "PATCH",
                    body: JSON.stringify({
                      name: temple.name,
                      city: temple.city,
                      state: temple.state,
                      pincode: temple.pincode,
                      address: temple.address,
                      deity: temple.deity,
                      timings: temple.timings,
                      contact_phone: temple.contact_phone,
                      pujari_name: temple.pujari_name,
                      description: temple.description,
                    }),
                  }).then(() => list.refetch()).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"))
                }
              />
            ) : null}
            {can("manage_services") ? (
              <PrimaryButton
                title="Delete"
                variant="outline"
                onPress={() =>
                  Alert.alert("Delete temple?", temple.name, [
                    { text: "Cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: () =>
                        void apiClient.api(`/admin/temples/${temple.id}`, { method: "DELETE" }).then(() => list.refetch()).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed")),
                    },
                  ])
                }
              />
            ) : null}
          </Card>
        ))}
        {can("manage_services") ? (
          <Card>
            <AppText variant="h3">Add temple</AppText>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="City" value={city} onChangeText={setCity} />
            <Field label="State" value={state} onChangeText={setState} />
            <Field label="Pincode" value={pincode} onChangeText={setPincode} keyboardType="number-pad" />
            <Field label="Address" value={address} onChangeText={setAddress} />
            <Field label="Deity" value={deity} onChangeText={setDeity} />
            <Field label="Timings" value={timings} onChangeText={setTimings} />
            <Field label="Contact phone" value={contactPhone} onChangeText={setContactPhone} />
            <Field label="Pujari name" value={pujariName} onChangeText={setPujariName} />
            <Field label="Description" value={description} onChangeText={setDescription} />
            <PrimaryButton
              title="Create"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api("/admin/temples", {
                    method: "POST",
                    body: JSON.stringify({
                      name,
                      city,
                      state,
                      pincode,
                      address,
                      deity,
                      timings,
                      contact_phone: contactPhone,
                      pujari_name: pujariName,
                      description,
                    }),
                  });
                  setName(""); setCity(""); setState(""); setPincode(""); setAddress(""); setDeity(""); setTimings(""); setContactPhone(""); setPujariName(""); setDescription("");
                  await list.refetch();
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Failed");
                }
              }}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
