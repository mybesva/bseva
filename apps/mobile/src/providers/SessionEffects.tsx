import { isLangCode, mapNotificationLinkToMobile } from "@bseva/config";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { apiClient } from "@/services/api";
import { notificationLink, registerPushToken, unregisterPushToken } from "@/services/push";
import { stopPujariTracking, syncPujariTracking } from "@/services/pujariTracking";

export function SessionEffects() {
  const { user, isAuthenticated } = useAuth();
  const { lang, setLang } = useI18n();
  const router = useRouter();

  useEffect(() => {
    const pref = user?.preferred_language;
    if (isLangCode(pref) && pref !== lang) setLang(pref);
  }, [user?.preferred_language, lang, setLang]);

  useEffect(() => {
    if (!isAuthenticated) return;
    void registerPushToken();
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const link = notificationLink(response.notification.request.content.data as Record<string, unknown>);
      const path = mapNotificationLinkToMobile(link, "consumer");
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [isAuthenticated, router]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const sub = Notifications.addNotificationReceivedListener(() => {
      void apiClient.unreadNotificationCount().catch(() => undefined);
    });
    return () => sub.remove();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !user || (user.role !== "pujari" && user.role !== "head_pujari")) {
      void stopPujariTracking();
      return;
    }
    let cancelled = false;
    async function tick() {
      try {
        const row = await apiClient.pujariTrackingAssignments();
        if (cancelled) return;
        const first = row.items?.[0];
        if (first?.booking_id) {
          await syncPujariTracking({
            bookingId: first.booking_id,
            intervalMs: (first.gps_interval_seconds || row.gps_interval_seconds || 60) * 1000,
          });
        } else {
          await stopPujariTracking();
        }
      } catch {
        /* keep last watcher; retry next tick */
      }
    }
    void tick();
    const t = setInterval(() => void tick(), 30_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [isAuthenticated, user?.id, user?.role]);

  return null;
}

export { unregisterPushToken };
