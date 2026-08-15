import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { dictionaries, LANG_LABELS, type Lang } from "./translations";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
  labels: typeof LANG_LABELS;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem("bseva-lang") as Lang | null;
    return saved && dictionaries[saved] ? saved : "en";
  });

  const setLang = (next: Lang) => {
    setLangState(next);
    localStorage.setItem("bseva-lang", next);
  };

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18nContextValue>(
    () => ({
      lang,
      setLang,
      labels: LANG_LABELS,
      t: (key: string) => dictionaries[lang][key] || dictionaries.en[key] || key,
    }),
    [lang]
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
