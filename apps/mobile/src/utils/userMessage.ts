import { ApiError } from "@bseva/api-client";
import { errorKeyForCode, type TranslateVars } from "@bseva/locales";

type TFn = (key: string, vars?: TranslateVars) => string;

/** Translate an i18n key; pass through plain text; avoid showing raw dotted keys to users. */
export function userMessage(t: TFn, raw: string | null | undefined, fallback?: string): string | null {
  if (!raw?.trim()) return fallback ?? null;
  const text = raw.trim();
  const translated = t(text);
  if (translated !== text) return translated;
  if (text.includes(".") && /^[a-z][a-z0-9_.]+$/i.test(text)) {
    return fallback ?? null;
  }
  return text;
}

export function apiErrorMessage(t: TFn, e: unknown, fallbackKey: string): string {
  if (e instanceof ApiError) {
    const codeKey = errorKeyForCode(e.code);
    if (codeKey) {
      const fromCode = userMessage(t, codeKey);
      if (fromCode) return fromCode;
    }
    const fromDetail = userMessage(t, e.message);
    if (fromDetail) return fromDetail;
  } else if (e instanceof Error) {
    const fromError = userMessage(t, e.message);
    if (fromError) return fromError;
  }
  return t(fallbackKey);
}
