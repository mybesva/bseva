import { ADMIN_PERMISSIONS } from "@bseva/config";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Alert, Pressable, ScrollView, Switch, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, Card, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

type AdminRow = { id: string; name?: string; email?: string; role?: string; permissions?: string[] };

export default function AdminPermissions() {
  const { t } = useI18n();
  const { user } = useAuth();
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const list = useQuery({
    queryKey: ["admins"],
    queryFn: () => apiClient.api<AdminRow[] | { items?: AdminRow[] }>("/admin/admins"),
  });
  const rows = Array.isArray(list.data) ? list.data : list.data?.items || [];
  const current = rows.find((r) => r.id === selected);
  const isSuper = current?.role === "super_admin";
  return (
    <Screen>
      <ScreenHeader title={t("admin.permissions")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}>
        <ErrorBanner message={error} />
        {user?.role !== "super_admin" ? <AppText variant="small">Super Admin accounts always have every permission. This page is enforced by the backend.</AppText> : null}
        {list.isLoading ? <LoadingBlock /> : null}
        {rows.map((a) => (
          <Pressable
            key={a.id}
            onPress={() => {
              setSelected(a.id);
              setPerms(a.permissions || []);
            }}
          >
            <Card style={{ borderColor: selected === a.id ? colors.primary : colors.border, borderWidth: selected === a.id ? 2 : 0.5 }}>
              <AppText variant="h3">{a.name}</AppText>
              <AppText variant="small">{a.email} · {a.role}</AppText>
            </Card>
          </Pressable>
        ))}
        {current ? (
          <Card>
            {isSuper ? <AppText>Super Admin permissions cannot be reduced in the client.</AppText> : null}
            {ADMIN_PERMISSIONS.map((p) => (
              <View key={p} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }}>
                <AppText style={{ flex: 1 }}>{p}</AppText>
                <Switch
                  value={isSuper || perms.includes(p)}
                  disabled={isSuper}
                  onValueChange={(on) => setPerms((prev) => (on ? [...new Set([...prev, p])] : prev.filter((x) => x !== p)))}
                />
              </View>
            ))}
            {!isSuper ? (
              <PrimaryButton
                title={t("admin.save")}
                onPress={async () => {
                  setError(null);
                  try {
                    await apiClient.api(`/admin/users/${current.id}/permissions`, { method: "PUT", body: JSON.stringify({ permissions: perms }) });
                    await list.refetch();
                  } catch (e: unknown) {
                    setError(e instanceof Error ? e.message : "Failed");
                  }
                }}
              />
            ) : null}
            {user?.role === "super_admin" && !isSuper ? (
              <PrimaryButton
                title="Promote to Super Admin"
                variant="outline"
                onPress={() => {
                  Alert.alert(
                    "Promote to Super Admin",
                    `This cannot be undone from the app. Promote ${current.email || current.name}?`,
                    [
                      { text: t("common.cancel"), style: "cancel" },
                      {
                        text: "Promote",
                        style: "destructive",
                        onPress: async () => {
                          setError(null);
                          try {
                            await apiClient.api(`/admin/users/${current.id}/promote-super`, { method: "POST" });
                            await list.refetch();
                          } catch (e: unknown) {
                            setError(e instanceof Error ? e.message : "Failed");
                          }
                        },
                      },
                    ]
                  );
                }}
              />
            ) : null}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}
