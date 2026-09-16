import { LANG_LABELS, type Lang } from "./constants";
import { translateWith, type TranslateVars } from "./translate";
import en from "./resources/en";
import hi from "./resources/hi";
import te from "./resources/te";
import mr from "./resources/mr";
import kn from "./resources/kn";
import ta from "./resources/ta";
import { coverage } from "./resources/coverage";
import { mobileCoverage } from "./resources/mobileCoverage";
import { webCoverage } from "./resources/webCoverage";

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
const base: Record<string, string> = { ...en, ...coverage.en, ...webCoverage.en, ...mobileCoverage.en };

function localeDict(lang: Exclude<Lang, "en">, locale: Record<string, string>): Record<string, string> {
  return { ...locale, ...coverage[lang], ...webCoverage[lang], ...mobileCoverage[lang] };
}

export const localeOverrides: Record<Exclude<Lang, "en">, Record<string, string>> = {
  hi: localeDict("hi", hi),
  te: localeDict("te", te),
  mr: localeDict("mr", mr),
  kn: localeDict("kn", kn),
  ta: localeDict("ta", ta),
};

export const dictionaries: Record<Lang, Record<string, string>> = {
  en: base,
  hi: { ...base, ...localeOverrides.hi },
  te: { ...base, ...localeOverrides.te },
  mr: { ...base, ...localeOverrides.mr },
  kn: { ...base, ...localeOverrides.kn },
  ta: { ...base, ...localeOverrides.ta },
};

export function translate(lang: Lang | string, key: string, vars?: TranslateVars): string {
  return translateWith(dictionaries, lang, key, vars);
}

export function tFor(lang: Lang | string) {
  return (key: string, vars?: TranslateVars) => translate(lang, key, vars);
}

export { LANG_LABELS as labels };
