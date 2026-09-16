import { mapNotificationLinkToMobile } from "@bseva/config";
import type { AppNotification } from "@bseva/types";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Pressable, RefreshControl, ScrollView } from "react-native";
import { ScreenHeader } from "@/components/ScreenHeader";
import { AppText, EmptyState, LoadingBlock, PrimaryButton, Screen } from "@/components/ui";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { useAppTheme } from "@/theme/ThemeContext";

export default function AdminNotifications() {
  const { t } = useI18n();
  const { colors } = useAppTheme();
  const router = useRouter();
  const q = useQuery({
    queryKey: ["admin-notifications"],
    queryFn: () => apiClient.listNotifications({ page: 1, page_size: 50 }),
  });
  return (
    <Screen>
      <ScreenHeader title={t("admin.notifications")} back />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={() => void q.refetch()} />}>
        <PrimaryButton title={t("mobile.markAllRead")} variant="outline" onPress={() => void apiClient.markAllNotificationsRead().then(() => q.refetch())} />
        <PrimaryButton title="Send test push" variant="ghost" onPress={() => void apiClient.sendTestPush()} />
        {q.isLoading ? <LoadingBlock /> : null}
        {(q.data?.items || []).length === 0 && !q.isLoading ? <EmptyState title={t("mobile.emptyNotifications")} /> : null}
        {(q.data?.items || []).map((n: AppNotification) => (
          <Pressable
            key={n.id}
            onPress={async () => {
              if (!n.is_read) await apiClient.markNotificationRead(n.id);
              router.push(mapNotificationLinkToMobile(n.link, "admin") as never);
            }}
          >
            <AppText variant="h3">{n.title}</AppText>
            <AppText variant="small" color={n.is_read ? colors.mutedForeground : colors.foreground}>{n.body}</AppText>
          </Pressable>
        ))}
      </ScrollView>
    </Screen>
  );
}
