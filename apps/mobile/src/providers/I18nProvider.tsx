import AsyncStorage from "@react-native-async-storage/async-storage";
import { dictionaries, LANG_LABELS, type Lang } from "@bseva/locales";
import { LANG_KEY } from "@bseva/tokens";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  labels: typeof LANG_LABELS;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");

  useEffect(() => {
    void AsyncStorage.getItem(LANG_KEY).then((stored) => {
      if (stored === "en" || stored === "hi" || stored === "te") setLangState(stored);
    });
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      labels: LANG_LABELS,
      setLang: (next) => {
        setLangState(next);
        void AsyncStorage.setItem(LANG_KEY, next);
      },
      t: (key) => dictionaries[lang][key] || dictionaries.en[key] || key,
    }),
    [lang]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}
