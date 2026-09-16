import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LANG_LABELS,
  LANG_STORAGE_KEY,
  dictionaries,
  isLang,
  normalizeLang,
  translate as translateKey,
  type Lang,
  type TranslateVars,
} from "@bseva/locales";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang, opts?: { persist?: boolean }) => void;
  t: (key: string, vars?: TranslateVars) => string;
  labels: typeof LANG_LABELS;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function readStoredLang(): Lang {
  if (typeof window === "undefined") return "en";
  return normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((next: Lang, opts?: { persist?: boolean }) => {
    const resolved = isLang(next) ? next : "en";
    setLangState(resolved);
    if (typeof window !== "undefined") {
      document.documentElement.lang = resolved;
      if (opts?.persist !== false) localStorage.setItem(LANG_STORAGE_KEY, resolved);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      labels: LANG_LABELS,
      t: (key, vars) => translateKey(lang, key, vars),
    }),
    [lang, setLang]
  );

  return (
    <I18nContext.Provider value={value}>
      <div key={lang} lang={lang} className="contents">
        {children}
      </div>
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Kept for existing imports; dictionaries now include all six languages. */
export { dictionaries, LANG_LABELS };
export type { Lang };
