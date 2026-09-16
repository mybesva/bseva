import { LANG_LABELS, isLang, type Lang } from "@bseva/locales";

export const PREFERRED_LANGUAGES = (Object.keys(LANG_LABELS) as Lang[]).map((code) => ({
  code,
  label: LANG_LABELS[code],
}));

export type PreferredLang = Lang;

export function isPreferredLang(code: string | null | undefined): code is PreferredLang {
  return isLang(code);
}

export function preferredLangLabel(code: string | null | undefined) {
  return isLang(code) ? LANG_LABELS[code] : LANG_LABELS.en;
}

/** UI language is the stored preference for all six supported locales. */
export function uiLangFromPreferred(code: string | null | undefined): Lang {
  return isLang(code) ? code : "en";
}
