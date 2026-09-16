import { LANG_LABELS, type Lang } from "./constants";
import { translateWith, type TranslateVars } from "./translate";
import en from "./resources/en";
import hi from "./resources/hi";
import te from "./resources/te";
import mr from "./resources/mr";
import kn from "./resources/kn";
import ta from "./resources/ta";

export {
  DEFAULT_LANG,
  FALLBACK_LANG,
  INTL_LOCALES,
  LANGS,
  LANG_ENGLISH_NAMES,
  LANG_LABELS,
  LANG_STORAGE_KEY,
  PREFERRED_LANGUAGES,
  isLang,
  normalizeLang,
  type Lang,
} from "./constants";
export {
  collectKeys,
  getMissingTranslationKeys,
  interpolate,
  missingKeysAgainst,
  resetMissingTranslationKeys,
  type TranslateVars,
} from "./translate";
export {
  formatCurrencyPaise,
  formatDisplayDate,
  formatDisplayDateTime,
  formatLongDate,
  formatNumber,
  formatSlot,
  formatTime,
} from "./format";
export { ERROR_CODE_KEYS, errorKeyForCode, parseApiErrorDetail } from "./errors";

/** English is copied first so missing locale keys fall back without showing raw keys. */
export const dictionaries: Record<Lang, Record<string, string>> = {
  en,
  hi: { ...en, ...hi },
  te: { ...en, ...te },
  mr: { ...en, ...mr },
  kn: { ...en, ...kn },
  ta: { ...en, ...ta },
};

export const localeOverrides: Record<Exclude<Lang, "en">, Record<string, string>> = { hi, te, mr, kn, ta };

export function translate(lang: Lang | string, key: string, vars?: TranslateVars): string {
  return translateWith(dictionaries, lang, key, vars);
}

export function tFor(lang: Lang | string) {
  return (key: string, vars?: TranslateVars) => translate(lang, key, vars);
}

export { LANG_LABELS as labels };
