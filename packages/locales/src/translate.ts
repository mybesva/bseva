import { DEFAULT_LANG, FALLBACK_LANG, isLang, type Lang } from "./constants";

export type TranslateVars = Record<string, string | number | boolean | null | undefined>;

const missing = new Set<string>();

export function interpolate(template: string, vars?: TranslateVars): string {
  if (!vars) return template;
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, name: string) => {
    const value = vars[name];
    if (value == null) return "";
    return String(value);
  });
}

function pluralKey(key: string, count: number): string {
  return count === 1 ? `${key}_one` : `${key}_other`;
}

function lookup(dict: Record<string, string> | undefined, key: string): string | undefined {
  if (!dict) return undefined;
  const value = dict[key];
  return value == null || value === "" ? undefined : value;
}

export function translateWith(
  dictionaries: Record<Lang, Record<string, string>>,
  lang: Lang | string,
  key: string,
  vars?: TranslateVars,
): string {
  const locale = isLang(lang) ? lang : DEFAULT_LANG;
  const dict = dictionaries[locale];
  const fallback = dictionaries[FALLBACK_LANG];

  let resolved: string | undefined;
  if (vars && typeof vars.count === "number") {
    resolved = lookup(dict, pluralKey(key, vars.count)) || lookup(dict, key);
    if (!resolved) {
      resolved = lookup(fallback, pluralKey(key, vars.count)) || lookup(fallback, key);
      if (resolved && locale !== FALLBACK_LANG && typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        missing.add(`${locale}:${key}`);
      }
    }
  } else {
    resolved = lookup(dict, key);
    if (!resolved) {
      resolved = lookup(fallback, key);
      if (resolved && locale !== FALLBACK_LANG && typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
        missing.add(`${locale}:${key}`);
      }
    }
  }

  if (!resolved) {
    if (typeof process !== "undefined" && process.env.NODE_ENV !== "production") {
      missing.add(`${locale}:${key}`);
    }
    return key.includes(".") ? interpolate(lookup(fallback, key) || key, vars) : key;
  }
  return interpolate(resolved, vars);
}

export function recordMissingKey(lang: Lang, key: string) {
  missing.add(`${lang}:${key}`);
}

export function getMissingTranslationKeys(): string[] {
  return [...missing].sort();
}

export function resetMissingTranslationKeys() {
  missing.clear();
}

export function flattenLeaves(input: Record<string, unknown>, prefix = ""): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [rawKey, value] of Object.entries(input)) {
    const key = prefix ? `${prefix}.${rawKey}` : rawKey;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(out, flattenLeaves(value as Record<string, unknown>, key));
    } else if (typeof value === "string") {
      out[key] = value;
    }
  }
  return out;
}

export function collectKeys(dict: Record<string, string>): string[] {
  return Object.keys(dict).sort();
}

export function missingKeysAgainst(source: Record<string, string>, target: Record<string, string>): string[] {
  return collectKeys(source).filter((key) => !lookup(target, key));
}
