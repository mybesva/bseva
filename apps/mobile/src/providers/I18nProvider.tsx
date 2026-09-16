import AsyncStorage from "@react-native-async-storage/async-storage";
import { LANG_LABELS, translate, type Lang, type TranslateVars } from "@bseva/locales";
import { isLangCode } from "@bseva/config";
import { LANG_KEY } from "@bseva/tokens";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { setApiLocale } from "@/services/api";

type I18nValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: TranslateVars) => string;
  labels: typeof LANG_LABELS;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("en");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(LANG_KEY)
      .then((stored) => {
        const initial = isLangCode(stored) ? stored : "en";
        setLangState(initial);
        setApiLocale(initial);
      })
      .finally(() => setReady(true));
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    setApiLocale(next);
    void AsyncStorage.setItem(LANG_KEY, next);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      labels: LANG_LABELS,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    }),
    [lang, setLang]
  );

  if (!ready) return null;
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("I18nProvider missing");
  return ctx;
}
