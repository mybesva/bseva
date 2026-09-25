export const LANGS = ["en", "hi", "te", "mr", "ta", "kn", "ml"] as const;
export type Lang = (typeof LANGS)[number];

export const DEFAULT_LANG: Lang = "en";
export const FALLBACK_LANG: Lang = "en";
export const LANG_STORAGE_KEY = "bseva-lang";

/** Native-script labels for the language selector. */
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  te: "తెలుగు",
  hi: "हिन्दी",
  mr: "मराठी",
  kn: "ಕನ್ನಡ",
  ta: "தமிழ்",
  ml: "മലയാളം",
};

export const LANG_ENGLISH_NAMES: Record<Lang, string> = {
  en: "English",
  te: "Telugu",
  hi: "Hindi",
  mr: "Marathi",
  kn: "Kannada",
  ta: "Tamil",
  ml: "Malayalam",
};

/** BCP-47 tags used for Intl date/number formatting. */
export const INTL_LOCALES: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
  te: "te-IN",
  mr: "mr-IN",
  kn: "kn-IN",
  ta: "ta-IN",
  ml: "ml-IN",
};

export const PREFERRED_LANGUAGES = LANGS.map((code) => ({
  code,
  label: LANG_LABELS[code],
  englishName: LANG_ENGLISH_NAMES[code],
}));

export function isLang(code: string | null | undefined): code is Lang {
  return !!code && (LANGS as readonly string[]).includes(code);
}

export function normalizeLang(code: string | null | undefined): Lang {
  if (!code) return DEFAULT_LANG;
  const short = code.trim().toLowerCase().replace("_", "-").split("-")[0];
  return isLang(short) ? short : DEFAULT_LANG;
}
