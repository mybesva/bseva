import AsyncStorage from "@react-native-async-storage/async-storage";
import { dictionaries, type Lang } from "@bseva/locales";
import { LANG_KEY } from "@bseva/tokens";
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";

/** Admin/Super Admin app is English-only. Shared locale catalogs still power keys. */
type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  labels: { en: string };
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    void AsyncStorage.setItem(LANG_KEY, "en");
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang: "en",
      labels: { en: "English" },
      setLang: () => undefined,
      t: (key) => dictionaries.en[key] || key,
    }),
    []
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}
