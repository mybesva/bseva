import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ChoiceChips, EmptyState, ErrorBanner, Field, LoadingBlock, PrimaryButton, Screen, StatusBadge } from "@/components/ui";
import { useAdmin } from "@/providers/AdminProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";

type UserRow = { id: string; name?: string; email?: string; phone?: string; blocked?: boolean; preferred_language?: string };

export default function AdminCustomers() {
  const { t } = useI18n();
  const { can } = useAdmin();
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [blocked, setBlocked] = useState("");
  const [page, setPage] = useState(1);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [location, setLocation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admin-customers", q, blocked, page],
    queryFn: () =>
      apiClient.api<{ items?: UserRow[]; pages?: number }>(
        `/admin/users?role=customer&page=${page}&page_size=20${q ? `&q=${encodeURIComponent(q)}` : ""}${blocked ? `&blocked=${blocked}` : ""}`
      ),
  });
  const items = list.data?.items || [];
  return (
    <Screen>
      <ScreenHeader title={t("admin.customers")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }} refreshControl={<RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />}>
        <ErrorBanner message={error} />
        <Field label={t("admin.search")} value={q} onChangeText={(v) => { setQ(v); setPage(1); }} />
        <ChoiceChips options={[{ id: "", label: "All" }, { id: "false", label: "Active" }, { id: "true", label: "Blocked" }]} value={blocked} onChange={(v) => { setBlocked(String(v)); setPage(1); }} />
        {list.isLoading ? <LoadingBlock /> : null}
        {items.length === 0 && !list.isLoading ? <EmptyState title="No customers" /> : null}
        {items.map((u) => (
          <Card key={u.id}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <AppText variant="h3">{u.name}</AppText>
              <StatusBadge status={u.blocked ? "blocked" : "active"} />
            </View>
            <AppText variant="small">{u.email} · {u.phone}</AppText>
            {u.preferred_language ? <AppText variant="small">{u.preferred_language}</AppText> : null}
            {can("edit_customers") ? (
              <>
                <Field
                  label="Preferred language"
                  value={u.preferred_language || "en"}
                  onChangeText={(lang) => {
                    void apiClient.api(`/admin/users/${u.id}/customer`, { method: "PUT", body: JSON.stringify({ preferred_language: lang }) }).then(() => list.refetch()).catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed"));
                  }}
                />
              <PrimaryButton
                title={u.blocked ? t("admin.unblock") : t("admin.block")}
                variant="outline"
                onPress={async () => {
                  setError(null);
                  try {
                    await apiClient.api(`/admin/users/${u.id}/block`, { method: "POST", body: JSON.stringify({ blocked: !u.blocked, reason: "admin" }) });
                    await list.refetch();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  }
                }}
              />
              </>
            ) : null}
          </Card>
        ))}
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Pressable onPress={() => setPage((p) => Math.max(1, p - 1))}><AppText>Prev</AppText></Pressable>
          <Pressable onPress={() => setPage((p) => p + 1)}><AppText>Next</AppText></Pressable>
        </View>
        {can("create_customers") ? (
          <Card>
            <AppText variant="h3">Create customer</AppText>
            <Field label="Name" value={name} onChangeText={setName} />
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Field label="Phone" value={phone} onChangeText={setPhone} />
            <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry />
            <Field label="Location" value={location} onChangeText={setLocation} />
            <PrimaryButton
              title="Create"
              onPress={async () => {
                setError(null);
                try {
                  await apiClient.api("/admin/users", { method: "POST", body: JSON.stringify({ name, email, phone, password, role: "customer", location }) });
                  setName(""); setEmail(""); setPhone(""); setPassword(""); setLocation("");
                  await qc.invalidateQueries({ queryKey: ["admin-customers"] });
                } catch (e: unknown) {
                  setError(e instanceof Error ? e.message : "Create failed");
                }
              }}
            />
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
