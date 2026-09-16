import { mapNotificationLinkToMobile } from "@bseva/config";
import type { AppNotification } from "@bseva/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, EmptyState, ErrorBanner, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export function NotificationsInbox({ app }: { app: "consumer" | "admin" }) {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["notifications"],
    queryFn: () => apiClient.listNotifications({ page: 1, page_size: 50 }),
  });

  async function open(n: AppNotification) {
    if (!n.is_read) {
      try {
        await apiClient.markNotificationRead(n.id);
        await qc.invalidateQueries({ queryKey: ["notifications"] });
      } catch {
        /* still navigate */
      }
    }
    const path = mapNotificationLinkToMobile(n.link, app);
    router.push(path as never);
  }

  return (
    <Screen>
      <ScreenHeader title={t("mobile.notifications")} back />
      {q.isLoading ? <LoadingBlock /> : null}
      {q.error ? <ErrorBanner message={q.error instanceof Error ? q.error.message : t("mobile.networkError")} /> : null}
      <ScrollView
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}
      >
        <PrimaryButton
          title={t("mobile.markAllRead")}
          variant="outline"
          onPress={async () => {
            await apiClient.markAllNotificationsRead();
            await q.refetch();
          }}
        />
        {(q.data?.items || []).length === 0 && !q.isLoading ? (
          <EmptyState title={t("mobile.emptyNotifications")} />
        ) : null}
        {(q.data?.items || []).map((n) => (
          <Pressable key={n.id} onPress={() => void open(n)}>
            <View
              style={{
                backgroundColor: n.is_read ? colors.card : colors.secondary,
                borderRadius: 12,
                padding: 14,
                borderWidth: 0.5,
                borderColor: colors.border,
              }}
            >
              <AppText variant="h3">{n.title}</AppText>
              {n.body ? (
                <AppText variant="small" color={colors.mutedForeground} style={{ marginTop: 4 }}>
                  {n.body}
                </AppText>
              ) : null}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
