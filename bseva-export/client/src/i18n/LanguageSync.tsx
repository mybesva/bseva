import { useCallback, useEffect } from "react";
import { isLang, type Lang } from "@bseva/locales";
import { isAdminRole } from "@bseva/config";
import { useAuth } from "@/_core/hooks/useAuth";
import { useI18n } from "@/i18n/I18nProvider";
import { api } from "@/lib/api";

export function useChangeLanguage() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();

  return useCallback(
    async (next: Lang) => {
      if (!isLang(next) || next === lang) return;
      setLang(next);
      if (user && !isAdminRole(user.role)) {
        try {
          await api("/auth/me", { method: "PATCH", body: JSON.stringify({ preferred_language: next }) });
        } catch {
          /* local language still applies */
        }
      }
    },
    [lang, setLang, user]
  );
}

/** After login, load the account preferred_language. Anonymous visitors keep localStorage.
 * Admin / Super Admin stay English without overwriting a public visitor's stored language.
 */
export function LanguageSync() {
  const { user } = useAuth();
  const { lang, setLang } = useI18n();

  useEffect(() => {
    if (!user) return;
    if (isAdminRole(user.role)) {
      if (lang !== "en") setLang("en", { persist: false });
      return;
    }
    const pref = user.preferred_language;
    if (isLang(pref) && pref !== lang) setLang(pref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.preferred_language, user?.role]);

  return null;
}
