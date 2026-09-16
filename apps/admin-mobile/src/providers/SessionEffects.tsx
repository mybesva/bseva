import { isLangCode, mapNotificationLinkToMobile } from "@bseva/config";
import * as Notifications from "expo-notifications";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/providers/I18nProvider";
import { notificationLink, registerPushToken } from "@/services/push";

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
      const path = mapNotificationLinkToMobile(link, "admin");
      if (path) router.push(path as never);
    });
    return () => sub.remove();
  }, [isAuthenticated, router]);

  return null;
}
